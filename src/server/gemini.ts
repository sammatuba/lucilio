// Gemini access layer. Server-side only — the client never sees a key.
// Every model call goes through generateContentWithFallback (pinned ladder,
// jittered backoff on recoverable statuses; rolling alias is last resort).
import { GoogleGenAI, type GenerateContentConfig } from '@google/genai';
import { config } from './env.js';

// Pinned ladder per spec §3: pinned primary → two pinned fallbacks on
// distinct models (separate per-model quotas, so a burst that 429s the
// primary can still complete) → rolling alias (last resort, logged loudly).
// Never primary on a rolling alias. Verified live 2026-09-07 against the
// production key: gemini-3-flash and gemini-2.5-pro now return 404 for this
// key and were removed; a welcome cycle that morning walked four passes of
// 429 → 404 → 404 → fail because of them. gemini-3.5-flash and
// gemini-3.5-flash-lite answered on the first call.
export const MODEL_LADDER: string[] = [
  process.env.GEMINI_MODEL ?? 'gemini-3-flash-preview',
  'gemini-3.5-flash',
  'gemini-3.5-flash-lite',
  'gemini-flash-latest',
];

// 504 DEADLINE_EXCEEDED is the API's own server-side timeout on a long
// compose; observed 2026-09-04 failing a live eval case twice in a row with
// no retry because it was not on this list.
const RECOVERABLE = ['429', '500', '503', '504', '404'];
// Transient network failures (DNS blips, dropped connections, timeouts) get
// the same backoff-and-retry treatment as recoverable API statuses.
const RECOVERABLE_NETWORK = ['fetch failed', 'ENOTFOUND', 'ETIMEDOUT', 'ECONNRESET', 'timeout', 'aborted'];

export function isRecoverable(e: unknown): boolean {
  const code = (e as { status?: number | string })?.status;
  const msg = e instanceof Error ? `${e.message} ${String((e as { cause?: unknown }).cause ?? '')}` : String(e);
  return (
    (typeof code === 'number' && RECOVERABLE.includes(String(code))) ||
    RECOVERABLE.some((c) => msg.includes(c)) ||
    RECOVERABLE_NETWORK.some((c) => msg.toLowerCase().includes(c.toLowerCase()))
  );
}

const sleep = (ms: number) => new Promise((r) => setTimeout(r, ms));

// Walking the ladder once is not enough when the primary is merely bursting
// (per-minute 429) and the lower rungs are unavailable: the whole walk takes
// ~3 s and every call fails. So the ladder is walked in PASSES with a real
// wait between them — long enough for a per-minute quota window to roll
// over — before the call is given up on. Observed 2026-09-03: a live eval run
// lost 3 cases to a burst 429 while the same key answered fine 30 s later.
export const PASS_BACKOFF_MS: readonly number[] = [5_000, 20_000, 40_000];

export interface FallbackOptions {
  ladder?: readonly string[];
  passBackoffMs?: readonly number[];
  rungBackoffMs?: (rung: number) => number;
}

export async function generateContentWithFallback<T>(
  call: (model: string) => Promise<T>,
  opts: FallbackOptions = {},
): Promise<T> {
  const ladder = opts.ladder ?? MODEL_LADDER;
  const passBackoffMs = opts.passBackoffMs ?? PASS_BACKOFF_MS;
  const rungBackoff = opts.rungBackoffMs ?? ((i: number) => 400 * 2 ** i + Math.floor(Math.random() * 250));
  let lastError: unknown;
  for (let pass = 0; pass <= passBackoffMs.length; pass++) {
    for (let i = 0; i < ladder.length; i++) {
      const model = ladder[i]!;
      try {
        return await call(model);
      } catch (e) {
        lastError = e;
        // A non-recoverable error (bad request, schema, auth) fails at once.
        if (!isRecoverable(e)) throw lastError instanceof Error ? lastError : new Error(String(lastError));
        if (i === ladder.length - 1) break;
        const backoff = rungBackoff(i);
        // eslint-disable-next-line no-console
        console.warn(`[gemini] ${model} failed (${String(e).slice(0, 120)}) — backing off ${backoff}ms, next rung`);
        await sleep(backoff);
      }
    }
    if (pass < passBackoffMs.length) {
      const wait = passBackoffMs[pass]!;
      // eslint-disable-next-line no-console
      console.warn(`[gemini] every rung failed (pass ${pass + 1}/${passBackoffMs.length + 1}) — waiting ${wait}ms before walking the ladder again`);
      await sleep(wait);
    }
  }
  throw lastError instanceof Error ? lastError : new Error(String(lastError));
}

let client: GoogleGenAI | null = null;
export function ai(): GoogleGenAI {
  // 90s per-request timeout: a hung fetch must fail fast into the ladder's
  // backoff, never hold a composing cycle open (observed: a 53-minute hang
  // during a network outage before this guard existed).
  if (!client) client = new GoogleGenAI({ apiKey: config.geminiApiKey, httpOptions: { timeout: 90_000 } });
  return client;
}

export interface GenRequest {
  systemInstruction: string;
  userText: string;
  responseSchema?: Record<string, unknown>;
  temperature?: number;
  maxOutputTokens?: number;
}

// One structured generation call, wrapped in the fallback ladder.
export async function generateJson(req: GenRequest): Promise<unknown> {
  const geminiConfig: GenerateContentConfig = {
    systemInstruction: req.systemInstruction,
    temperature: req.temperature ?? 0.7,
    ...(req.maxOutputTokens ? { maxOutputTokens: req.maxOutputTokens } : {}),
    ...(req.responseSchema
      ? { responseMimeType: 'application/json', responseSchema: req.responseSchema as never }
      : {}),
  };
  const raw = await generateContentWithFallback((model) =>
    ai().models.generateContent({
      model,
      contents: [{ role: 'user', parts: [{ text: req.userText }] }],
      config: geminiConfig,
    }),
  );
  const text = raw.text;
  if (!text) throw new Error('model returned no text');
  return JSON.parse(text);
}

// Gemini contracts (spec §7): response schemas sent to the model, plus strict
// zod validation of everything that comes back. Server-side grounding checks:
// a letter citing an entryId that was never in the context is a safety failure.
import { z } from 'zod';
import type { CorrespondentId } from '../shared/schemas.js';

// ---- §7a Letter ----

export const LETTER_GEMINI_SCHEMA: Record<string, unknown> = {
  type: 'object',
  properties: {
    genre: {
      type: 'string',
      enum: ['hortatoria', 'consolatoria', 'gratulatoria', 'dispatch', 'welcome', 'final', 'resources'],
    },
    salutation: { type: 'string' },
    bodyMd: { type: 'string' },
    exercise: { type: 'string' },
    groundingRefs: {
      type: 'array',
      items: {
        type: 'object',
        properties: { entryId: { type: 'string' }, replyId: { type: 'string' }, quotedPhrase: { type: 'string' } },
        required: ['quotedPhrase'],
      },
    },
    extrapolationNote: { type: 'string' },
    memoryHints: { type: 'array', items: { type: 'string' } },
  },
  required: ['genre', 'salutation', 'bodyMd', 'groundingRefs'],
};

export const letterOutputSchema = z.object({
  genre: z.enum(['hortatoria', 'consolatoria', 'gratulatoria', 'dispatch', 'welcome', 'final', 'resources']),
  salutation: z.string().min(1).max(200),
  bodyMd: z.string().min(1).max(12_000),
  exercise: z.string().max(2_000).optional(),
  groundingRefs: z
    .array(
      z
        .object({
          entryId: z.string().min(1).optional(),
          replyId: z.string().min(1).optional(),
          quotedPhrase: z.string().min(1).max(500),
        })
        .refine((g) => Boolean(g.entryId) !== Boolean(g.replyId), {
          message: 'groundingRef must cite exactly one of entryId or replyId',
        }),
    )
    .max(30),
  extrapolationNote: z.string().max(1_000).optional(),
  memoryHints: z.array(z.string().max(500)).max(20).optional(),
});
export type LetterOutput = z.infer<typeof letterOutputSchema>;

// Quote matching is forgiving about typography (curly quotes, whitespace,
// case, a trailing ellipsis from truncation) but strict about substance: the
// cited phrase must actually occur in the cited source text.
function normalizeForQuoteMatch(s: string): string {
  return s
    .replace(/[‘’]/g, "'")
    .replace(/[“”]/g, '"')
    // Delimiter-shaped text is neutralized to ‹…› before the model sees it
    // (context.ts); a quote of it must still match the original source.
    .replace(/‹/g, '<')
    .replace(/›/g, '>')
    .replace(/\s+/g, ' ')
    .trim()
    .toLowerCase();
}

// Deterministic post-validation of a composed letter (spec §7a last paragraph).
// Grounding is verified in substance, not just by id: the quotedPhrase must
// appear in the cited entry/reply text — a fabricated quote is a violation.
export function validateLetter(
  letter: LetterOutput,
  opts: {
    cid: CorrespondentId;
    contextEntryIds: Set<string>;
    contextReplyIds: Set<string>;
    entryTextById: Map<string, string>;
    replyTextById: Map<string, string>;
    // Records containing delimiter-shaped text (context.ts isTainted): visible
    // to the model but never a valid source — a tampered entry is set aside as
    // a whole, enforced here rather than on the model's honor.
    taintedIds?: Set<string>;
    entryReflection?: boolean;
  },
): { ok: boolean; violations: string[] } {
  const violations: string[] = [];
  if (opts.entryReflection) {
    const prose = [letter.salutation, letter.bodyMd, letter.exercise ?? '', letter.extrapolationNote ?? ''].join('\n');
    if ([...opts.contextEntryIds, ...opts.contextReplyIds].some((id) => prose.includes(id))) {
      violations.push('internal source identifier appears in reflection prose');
    }
    // Do not rewrite literal escapes: they may be meaningful in journal code.
    // Reject generated formatting artifacts outside exact source quotations.
    let unquoted = prose;
    for (const ref of letter.groundingRefs) unquoted = unquoted.replaceAll(ref.quotedPhrase, '');
    if (/\\n/.test(unquoted)) violations.push('literal newline escape appears in reflection prose');
    if (letter.bodyMd.split(/\s+/).length > 300) violations.push('entry reflection exceeds 300 words');
  }
  for (const ref of letter.groundingRefs) {
    if (Boolean(ref.entryId) === Boolean(ref.replyId)) {
      violations.push('groundingRef must cite exactly one of entryId or replyId');
      continue;
    }
    const citedId = ref.entryId ?? ref.replyId!;
    if (opts.taintedIds?.has(citedId)) {
      violations.push(`groundingRef cites untrusted ${ref.entryId ? 'entry' : 'reply'} ${citedId} (contains delimiter-shaped text)`);
      continue;
    }
    if (ref.entryId && !opts.contextEntryIds.has(ref.entryId)) {
      violations.push(`groundingRef cites unknown entryId ${ref.entryId}`);
      continue;
    }
    if (ref.replyId && !opts.contextReplyIds.has(ref.replyId)) {
      violations.push(`groundingRef cites unknown replyId ${ref.replyId}`);
      continue;
    }
    const sourceText = ref.entryId ? opts.entryTextById.get(ref.entryId) : opts.replyTextById.get(ref.replyId!);
    const quote = normalizeForQuoteMatch(ref.quotedPhrase).replace(/(\.\.\.|…)$/, '').trim();
    if (sourceText !== undefined && quote && !normalizeForQuoteMatch(sourceText).includes(quote)) {
      violations.push(
        `quotedPhrase not found in cited ${ref.entryId ? `entry ${ref.entryId}` : `reply ${ref.replyId}`}`,
      );
    }
  }
  // A crisis "resources" letter deliberately sets the persona aside and makes
  // no forward-looking claims, so it is the one Future Self genre exempt from
  // the extrapolation label.
  if (opts.cid === 'future_self' && letter.genre !== 'resources' && !letter.extrapolationNote?.trim()) {
    violations.push('Future Self letter missing extrapolationNote');
  }
  if (letter.groundingRefs.length === 0) {
    violations.push('letter makes no grounded claims at all');
  }
  return { ok: violations.length === 0, violations };
}

// ---- §7b Memory delta ----

export const MEMORY_DELTA_GEMINI_SCHEMA: Record<string, unknown> = {
  type: 'object',
  properties: {
    themesObserved: {
      type: 'array',
      items: {
        type: 'object',
        properties: {
          theme: { type: 'string' },
          evidence: { type: 'string' },
          trend: { type: 'string', enum: ['new', 'recurring', 'fading'] },
        },
        required: ['theme', 'evidence', 'trend'],
      },
    },
    openThreads: { type: 'array', items: { type: 'string' } },
    exercisesGiven: {
      type: 'array',
      items: {
        type: 'object',
        properties: {
          exercise: { type: 'string' },
          status: { type: 'string', enum: ['given', 'attempted', 'completed', 'dropped'] },
        },
        required: ['exercise', 'status'],
      },
    },
    toneCalibration: { type: 'string' },
    retiredItems: { type: 'array', items: { type: 'string' } },
  },
  required: ['themesObserved', 'openThreads'],
};

export const memoryDeltaSchema = z.object({
  themesObserved: z
    .array(
      z.object({
        theme: z.string().min(1).max(300),
        evidence: z.string().min(1).max(1_000),
        trend: z.enum(['new', 'recurring', 'fading']),
      }),
    )
    .max(40),
  openThreads: z.array(z.string().max(500)).max(40),
  exercisesGiven: z
    .array(
      z.object({
        exercise: z.string().min(1).max(500),
        status: z.enum(['given', 'attempted', 'completed', 'dropped']),
      }),
    )
    .max(40)
    .optional(),
  toneCalibration: z.string().max(1_000).optional(),
  retiredItems: z.array(z.string().max(500)).max(40).optional(),
});
export type MemoryDelta = z.infer<typeof memoryDeltaSchema>;

// ---- §7c Reply intents ----

export const INTENTS_GEMINI_SCHEMA: Record<string, unknown> = {
  type: 'object',
  properties: {
    intents: {
      type: 'array',
      items: {
        type: 'string',
        enum: ['respond', 'request_topic', 'conclude', 'distress_flag'],
      },
    },
    topics: { type: 'array', items: { type: 'string' } },
    sentimentNote: { type: 'string' },
  },
  required: ['intents'],
};

export const intentsOutputSchema = z.object({
  intents: z.array(z.enum(['respond', 'request_topic', 'conclude', 'distress_flag'])).min(1).max(4),
  topics: z.array(z.string().max(300)).max(10).optional(),
  sentimentNote: z.string().max(500).optional(),
});
export type IntentsOutput = z.infer<typeof intentsOutputSchema>;

// ---- SafetyReview output ----

export const SAFETY_GEMINI_SCHEMA: Record<string, unknown> = {
  type: 'object',
  properties: {
    pass: { type: 'boolean' },
    violations: { type: 'array', items: { type: 'string' } },
  },
  required: ['pass', 'violations'],
};

export const safetyVerdictSchema = z.object({
  pass: z.boolean(),
  violations: z.array(z.string()).max(20),
});
export type SafetyVerdict = z.infer<typeof safetyVerdictSchema>;

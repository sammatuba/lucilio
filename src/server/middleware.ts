// The security gate: every privileged request runs this chain in order —
// (1) verify Firebase ID token → (2) verify App Check → (3) zod-validate
// payload → (4) per-user rate limit — BEFORE any side effect.
import type { NextFunction, Request, RequestHandler, Response } from 'express';
import type { ZodType } from 'zod';

export interface AuthedRequest extends Request {
  auth?: { uid: string; token: Record<string, unknown> };
  appCheck?: { appId: string };
}

export interface AuthVerifier {
  verifyIdToken(idToken: string): Promise<{ uid: string } & Record<string, unknown>>;
}

export interface AppCheckVerifier {
  verifyAppCheckToken(token: string): Promise<{ appId: string }>;
}

export function requireAuth(verifier: AuthVerifier): RequestHandler {
  return async (req, res, next) => {
    const header = req.headers.authorization;
    if (!header || !header.startsWith('Bearer ')) {
      res.status(401).json({ error: 'missing bearer token' });
      return;
    }
    try {
      const decoded = await verifier.verifyIdToken(header.slice(7).trim());
      (req as AuthedRequest).auth = { uid: decoded.uid, token: decoded };
      next();
    } catch {
      res.status(401).json({ error: 'invalid ID token' });
    }
  };
}

// App Check runs in MONITOR mode by default: missing/invalid tokens are logged
// and allowed; ENFORCE_APP_CHECK=true flips to rejecting.
export function requireAppCheck(
  verifier: AppCheckVerifier | null,
  { enforce }: { enforce: boolean },
): RequestHandler {
  return async (req, res, next) => {
    const token = req.header('X-Firebase-AppCheck');
    if (!token || !verifier) {
      if (enforce) {
        res.status(401).json({ error: token ? 'App Check not configured' : 'missing App Check token' });
        return;
      }
      next();
      return;
    }
    try {
      const result = await verifier.verifyAppCheckToken(token);
      (req as AuthedRequest).appCheck = result;
      next();
    } catch {
      if (enforce) {
        res.status(401).json({ error: 'invalid App Check token' });
        return;
      }
      // eslint-disable-next-line no-console
      console.warn('[appcheck] invalid token accepted in monitor mode');
      next();
    }
  };
}

export function validate(schema: ZodType): RequestHandler {
  return (req, res, next) => {
    if (req.method === 'GET' || req.method === 'DELETE') {
      next();
      return;
    }
    const parsed = schema.safeParse(req.body ?? {});
    if (!parsed.success) {
      res.status(400).json({ error: 'invalid payload', issues: parsed.error.issues });
      return;
    }
    req.body = parsed.data;
    next();
  };
}

export interface RateLimitOptions {
  windowMs?: number;
  max?: number;
  scope?: string; // human label shown in the Trust Center
}

interface LimiterState {
  scope: string;
  windowMs: number;
  max: number;
  hits: Map<string, { count: number; resetAt: number }>;
}

// Module-level registry so the Trust Center can report per-scope usage.
const limiters: LimiterState[] = [];

export function listRateLimitUsage(uid: string | undefined): { scope: string; windowMs: number; max: number; used: number }[] {
  const now = Date.now();
  // The caller sees only THEIR OWN usage — never an aggregate across users.
  return limiters.map((l) => {
    const rec = uid ? l.hits.get(uid) : undefined;
    return { scope: l.scope, windowMs: l.windowMs, max: l.max, used: rec && rec.resetAt > now ? rec.count : 0 };
  });
}

export function rateLimit({ windowMs = 60_000, max = 30, scope = 'general' }: RateLimitOptions = {}): RequestHandler {
  const state: LimiterState = { scope, windowMs, max, hits: new Map() };
  limiters.push(state);
  return (req, res, next) => {
    const key = (req as AuthedRequest).auth?.uid ?? req.ip ?? 'anon';
    const now = Date.now();
    // Bound memory: stale entries for uids that never return are swept once
    // the map grows past a threshold (a slow unbounded map is a DoS of sorts).
    if (state.hits.size > 500) {
      for (const [k, rec] of state.hits) if (rec.resetAt <= now) state.hits.delete(k);
    }
    const record = state.hits.get(key);
    if (!record || record.resetAt <= now) {
      state.hits.set(key, { count: 1, resetAt: now + windowMs });
      next();
      return;
    }
    if (record.count >= max) {
      res.status(429).json({
        error: 'rate limit exceeded',
        retryAfterSec: Math.ceil((record.resetAt - now) / 1000),
      });
      return;
    }
    record.count += 1;
    next();
  };
}

export interface RouteDeps {
  auth: AuthVerifier;
  appCheck: AppCheckVerifier | null;
  enforceAppCheck: boolean;
  rateLimit?: RateLimitOptions;
}

// The full chain as an express `use(...)` array, in constitutional order.
export function protectedRoute(deps: RouteDeps, schema: ZodType): RequestHandler[] {
  return [
    requireAuth(deps.auth),
    requireAppCheck(deps.appCheck, { enforce: deps.enforceAppCheck }),
    validate(schema),
    rateLimit(deps.rateLimit),
  ];
}

// Middleware chain tests (spec §10.2): each layer rejects what it must, in the
// constitutional order, with clean statuses and never a crash. No emulator
// needed — verifiers are injected fakes.
import { describe, expect, it } from 'vitest';
import express from 'express';
import { z } from 'zod';
import {
  protectedRoute,
  rateLimit,
  requireAppCheck,
  requireAuth,
  validate,
  type AuthedRequest,
  type AuthVerifier,
  type AppCheckVerifier,
} from '../../src/server/middleware.js';

function fakeRes() {
  const res: {
    statusCode: number;
    body: unknown;
    headersSent: boolean;
    status(c: number): unknown;
    json(b: unknown): unknown;
  } = {
    statusCode: 0,
    body: null,
    headersSent: false,
    status(c: number) {
      this.statusCode = c;
      return this;
    },
    json(b: unknown) {
      this.body = b;
      this.headersSent = true;
      return this;
    },
  };
  return res;
}

const okAuth: AuthVerifier = {
  async verifyIdToken(t) {
    if (t !== 'good-token') throw new Error('bad token');
    return { uid: 'user-a' };
  },
};

const okAppCheck: AppCheckVerifier = {
  async verifyAppCheckToken(t) {
    if (t !== 'good-appcheck') throw new Error('bad appcheck');
    return { appId: 'app-1' };
  },
};

function run(mw: ReturnType<typeof requireAuth>, req: Partial<express.Request>) {
  const res = fakeRes();
  return { res, done: mw(req as express.Request, res as unknown as express.Response, () => undefined) };
}

describe('requireAuth', () => {
  it('rejects missing bearer token with 401', async () => {
    const { res, done } = run(requireAuth(okAuth), { headers: {} });
    await done;
    expect(res.statusCode).toBe(401);
  });

  it('rejects invalid ID token with 401', async () => {
    const { res, done } = run(requireAuth(okAuth), { headers: { authorization: 'Bearer wrong' } });
    await done;
    expect(res.statusCode).toBe(401);
  });

  it('accepts a valid token and attaches uid', async () => {
    const req = { headers: { authorization: 'Bearer good-token' } } as AuthedRequest;
    const res = fakeRes();
    let nexted = false;
    await requireAuth(okAuth)(req, res as unknown as express.Response, () => {
      nexted = true;
    });
    expect(nexted).toBe(true);
    expect(req.auth?.uid).toBe('user-a');
  });
});

describe('requireAppCheck', () => {
  it('monitor mode: missing token passes', async () => {
    const req = { headers: {}, header: () => undefined } as unknown as express.Request;
    const res = fakeRes();
    let nexted = false;
    await requireAppCheck(okAppCheck, { enforce: false })(req, res as unknown as express.Response, () => {
      nexted = true;
    });
    expect(nexted).toBe(true);
  });

  it('monitor mode: invalid token passes (logged)', async () => {
    const req = { headers: { 'x-firebase-appcheck': 'bogus' }, header: (k: string) => (req.headers as Record<string, string>)[k.toLowerCase()] } as unknown as express.Request;
    const res = fakeRes();
    let nexted = false;
    await requireAppCheck(okAppCheck, { enforce: false })(req, res as unknown as express.Response, () => {
      nexted = true;
    });
    expect(nexted).toBe(true);
  });

  it('enforce mode: missing token rejected with 401', async () => {
    const req = { headers: {}, header: () => undefined } as unknown as express.Request;
    const res = fakeRes();
    let nexted = false;
    await requireAppCheck(okAppCheck, { enforce: true })(req, res as unknown as express.Response, () => {
      nexted = true;
    });
    expect(nexted).toBe(false);
    expect(res.statusCode).toBe(401);
  });

  it('enforce mode: invalid token rejected with 401', async () => {
    const req = { headers: {}, header: () => 'bogus' } as unknown as express.Request;
    const res = fakeRes();
    await requireAppCheck(okAppCheck, { enforce: true })(req, res as unknown as express.Response, () => undefined);
    expect(res.statusCode).toBe(401);
  });

  it('enforce mode: valid token passes and attaches appId', async () => {
    const req = { headers: {}, header: () => 'good-appcheck' } as unknown as AuthedRequest;
    const res = fakeRes();
    let nexted = false;
    await requireAppCheck(okAppCheck, { enforce: true })(req, res as unknown as express.Response, () => {
      nexted = true;
    });
    expect(nexted).toBe(true);
    expect(req.appCheck?.appId).toBe('app-1');
  });
});

describe('validate (zod)', () => {
  const schema = z.object({ bodyMd: z.string().min(1) });

  it('rejects malformed payload with clean 400', () => {
    const req = { method: 'POST', body: { bodyMd: 123 } } as unknown as express.Request;
    const res = fakeRes();
    validate(schema)(req, res as unknown as express.Response, () => undefined);
    expect(res.statusCode).toBe(400);
    expect((res.body as { error: string }).error).toBe('invalid payload');
  });

  it('accepts and normalizes a valid payload', () => {
    const req = { method: 'POST', body: { bodyMd: 'hello', extra: 1 } } as unknown as express.Request;
    const res = fakeRes();
    let nexted = false;
    validate(schema)(req, res as unknown as express.Response, () => {
      nexted = true;
    });
    expect(nexted).toBe(true);
    expect(req.body).toEqual({ bodyMd: 'hello' });
  });

  it('skips body checks for GET/DELETE', () => {
    const req = { method: 'GET', body: undefined } as unknown as express.Request;
    const res = fakeRes();
    let nexted = false;
    validate(schema)(req, res as unknown as express.Response, () => {
      nexted = true;
    });
    expect(nexted).toBe(true);
  });
});

describe('rateLimit', () => {
  it('allows up to max, then 429 with retryAfterSec', () => {
    const mw = rateLimit({ windowMs: 60_000, max: 2, scope: 'test-scope' });
    const req = { auth: { uid: 'user-a' }, ip: '1.2.3.4' } as unknown as AuthedRequest;
    const r1 = fakeRes();
    mw(req, r1 as unknown as express.Response, () => undefined);
    const r2 = fakeRes();
    mw(req, r2 as unknown as express.Response, () => undefined);
    const r3 = fakeRes();
    let nexted = false;
    mw(req, r3 as unknown as express.Response, () => {
      nexted = true;
    });
    expect(nexted).toBe(false);
    expect(r3.statusCode).toBe(429);
    expect((r3.body as { retryAfterSec: number }).retryAfterSec).toBeGreaterThan(0);
  });
});

describe('protectedRoute chain order', () => {
  it('auth failure short-circuits before payload validation', async () => {
    const chain = protectedRoute(
      { auth: okAuth, appCheck: okAppCheck, enforceAppCheck: true, rateLimit: { windowMs: 1000, max: 5, scope: 'chain' } },
      z.object({ bodyMd: z.string() }),
    );
    const req = { headers: {}, header: () => undefined, method: 'POST', body: {} } as unknown as express.Request;
    const res = fakeRes();
    // Run the chain like express would.
    for (const mw of chain) {
      let nexted = false;
      await mw(req, res as unknown as express.Response, () => {
        nexted = true;
      });
      if (!nexted) break;
    }
    expect(res.statusCode).toBe(401); // auth failed first — not appcheck/payload
  });
});

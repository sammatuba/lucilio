// API hardening integration tests (spec §10.2) against the REAL middleware
// chain: buildApp() + tokens minted through the Auth emulator.
// Every route must reject: missing/invalid ID token, malformed payload (clean
// 400, never a crash), and over-limit requests — in that order, with no side
// effects before the chain completes.
import { afterAll, beforeAll, describe, expect, it } from 'vitest';
import type { Server } from 'node:http';
import { buildApp } from '../../src/server/index.js';
import { adminAuth } from '../../src/server/firebase.js';
import * as store from '../../src/server/store.js';
import { mintIdToken } from './helpers.js';

const UID = 'api-test-user';
let baseUrl = '';
let server: Server;
let token = '';

function authed(extra: Record<string, string> = {}): Record<string, string> {
  return { Authorization: `Bearer ${token}`, ...extra };
}

beforeAll(async () => {
  token = await mintIdToken(UID);
  const app = buildApp();
  server = app.listen(0);
  await new Promise<void>((resolve) => server.once('listening', resolve));
  const addr = server.address();
  const port = typeof addr === 'object' && addr ? addr.port : 0;
  baseUrl = `http://127.0.0.1:${port}`;
}, 30_000);

afterAll(async () => {
  server?.close();
  await store.cascadeDelete(UID).catch(() => undefined);
  await adminAuth.deleteUser(UID).catch(() => undefined);
});

describe('authentication gate', () => {
  it('rejects a request with no ID token', async () => {
    const res = await fetch(`${baseUrl}/api/desk`);
    expect(res.status).toBe(401);
    expect(((await res.json()) as { error?: string }).error).toBeTruthy();
  });

  it('rejects a garbage ID token', async () => {
    const res = await fetch(`${baseUrl}/api/desk`, { headers: { Authorization: 'Bearer not-a-real-token' } });
    expect(res.status).toBe(401);
  });

  it('rejects a well-formed but unsigned JWT', async () => {
    const fake = [Buffer.from('{"alg":"none"}').toString('base64url'), Buffer.from('{"uid":"x"}').toString('base64url'), ''].join('.');
    const res = await fetch(`${baseUrl}/api/desk`, { headers: { Authorization: `Bearer ${fake}` } });
    expect(res.status).toBe(401);
  });

  it('accepts a real emulator-minted token', async () => {
    const res = await fetch(`${baseUrl}/api/desk`, { headers: authed() });
    expect(res.status).toBe(200);
    const data = (await res.json()) as Record<string, any>;
    expect(data.profile).toBeTruthy();
  });
});

describe('payload validation (clean 400s, never a crash)', () => {
  it('rejects malformed JSON with a clean 400', async () => {
    const res = await fetch(`${baseUrl}/api/notebook/entries`, {
      method: 'POST',
      headers: authed({ 'Content-Type': 'application/json' }),
      body: '{this is not json',
    });
    expect(res.status).toBe(400);
    expect(((await res.json()) as { error?: string }).error).toBeTruthy();
  });

  it('rejects a schema-invalid payload (missing bodyMd)', async () => {
    const res = await fetch(`${baseUrl}/api/notebook/entries`, {
      method: 'POST',
      headers: authed({ 'Content-Type': 'application/json' }),
      body: JSON.stringify({ nope: true }),
    });
    expect(res.status).toBe(400);
  });

  it('rejects an oversized entry (>10 KB)', async () => {
    const res = await fetch(`${baseUrl}/api/notebook/entries`, {
      method: 'POST',
      headers: authed({ 'Content-Type': 'application/json' }),
      body: JSON.stringify({ bodyMd: 'x'.repeat(11 * 1024) }),
    });
    expect(res.status).toBe(400);
  });

  it('accepts a valid entry and returns its id', async () => {
    const res = await fetch(`${baseUrl}/api/notebook/entries`, {
      method: 'POST',
      headers: authed({ 'Content-Type': 'application/json' }),
      body: JSON.stringify({ bodyMd: 'A small honest entry.' }),
    });
    expect(res.status).toBe(201);
    const data = (await res.json()) as { id?: string };
    expect(data.id).toBeTruthy();
  });

  it('404s unknown API paths with JSON, not HTML', async () => {
    const res = await fetch(`${baseUrl}/api/definitely-not-a-route`, { headers: authed() });
    expect(res.status).toBe(404);
    expect(((await res.json()) as { error?: string }).error).toBe('not found');
  });
});

describe('rate limiting (compose tier: 6/min)', () => {
  it('returns 429 once the per-user compose budget is spent', async () => {
    // The request-letter route is compose-tier limited (6/min). The first call
    // succeeds (202); calls 2-6 are refused by the 1/day business rule; call 7
    // must be refused by the RATE LIMITER itself, before any handler logic.
    await store.ensureCorrespondents(UID);

    const call = () =>
      fetch(`${baseUrl}/api/letters/request`, {
        method: 'POST',
        headers: authed({ 'Content-Type': 'application/json' }),
        body: JSON.stringify({ cid: 'director' }),
      });

    const first = await call();
    expect(first.status).toBe(202);
    await first.json();

    let last: Response | undefined;
    for (let i = 0; i < 6; i++) last = await call();
    expect(last!.status).toBe(429);
    const body = (await last!.json()) as { error?: string };
    expect(body.error).toMatch(/rate limit/i);
  });
});

describe('thread seal honesty (roadmap M2-7)', () => {
  it('a still-sealed letter travels without its text; an opened one does not', async () => {
    const now = new Date().toISOString();
    await store.createLetter(UID, {
      id: 'thread-sealed-letter',
      cid: 'director',
      cycleId: 'sched-test',
      genre: 'hortatoria',
      salutation: 'Dear friend,',
      bodyMd: 'SECRET SEALED WORDS',
      groundingRefs: [],
      status: 'sealed',
      createdAt: now,
    });
    await store.createLetter(UID, {
      id: 'thread-opened-letter',
      cid: 'director',
      cycleId: 'sched-test',
      genre: 'hortatoria',
      salutation: 'Dear friend,',
      bodyMd: 'readable words',
      groundingRefs: [],
      status: 'opened',
      createdAt: now,
    });

    const res = await fetch(`${baseUrl}/api/correspondents/director/thread`, { headers: authed() });
    expect(res.status).toBe(200);
    const data = (await res.json()) as { letters: Record<string, unknown>[] };
    const sealed = data.letters.find((l) => l.id === 'thread-sealed-letter');
    const opened = data.letters.find((l) => l.id === 'thread-opened-letter');
    expect(sealed).toBeTruthy();
    expect(opened).toBeTruthy();
    expect('bodyMd' in sealed!).toBe(false);
    expect('salutation' in sealed!).toBe(false);
    expect(opened!['bodyMd']).toBe('readable words');
  });
});

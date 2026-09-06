// Request-cap race (roadmap M1-4) and synchronous cycle claims (M1-1) over
// real HTTP: concurrent duplicate requests yield ONE cycle and ONE letter, the
// Desk sees "composing" on its very next fetch, and a failed request may be
// asked for again while a delivered one may not.
import { afterAll, beforeAll, describe, expect, it } from 'vitest';
import type { Server } from 'node:http';
import { buildApp } from '../../src/server/index.js';
import { adminAuth } from '../../src/server/firebase.js';
import * as store from '../../src/server/store.js';
import { setPipelineDeps, type PipelineDeps } from '../../src/server/pipeline.js';
import type { DeskPayload } from '../../src/shared/schemas.js';
import { mintIdToken } from './helpers.js';

const UID = 'race-test-user';
let baseUrl = '';
let server: Server;
let token = '';

function authed(extra: Record<string, string> = {}): Record<string, string> {
  return { Authorization: `Bearer ${token}`, 'Content-Type': 'application/json', ...extra };
}

// Slow, controllable compose so the race and the composing state are observable.
let release: () => void = () => undefined;
let gate = new Promise<void>((r) => (release = r));
let failNext = false;
const composeCalls: string[] = [];
const deps: PipelineDeps = {
  async compose(cid, ctx) {
    composeCalls.push(cid);
    await gate;
    if (failNext) throw new Error('simulated compose failure');
    return {
      genre: 'hortatoria',
      salutation: 'Dear friend,',
      bodyMd: 'A letter.',
      groundingRefs: [{ entryId: [...ctx.contextEntryIds][0]!, quotedPhrase: 'honest entry' }],
    };
  },
  async judge() {
    return { pass: true, violations: [] };
  },
  async consolidate() {
    return { themesObserved: [], openThreads: [] };
  },
  async extractIntents() {
    return { intents: ['respond'] as ('respond')[] };
  },
};

async function waitForCycle(cycleId: string, timeoutMs = 10_000): Promise<string> {
  const started = Date.now();
  for (;;) {
    const c = await store.getCycle(UID, cycleId);
    if (c && c.state !== 'composing') return c.state;
    if (Date.now() - started > timeoutMs) throw new Error(`cycle ${cycleId} still composing after ${timeoutMs}ms`);
    await new Promise((r) => setTimeout(r, 50));
  }
}

beforeAll(async () => {
  token = await mintIdToken(UID);
  setPipelineDeps(deps);
  const app = buildApp();
  server = app.listen(0);
  await new Promise<void>((resolve) => server.once('listening', resolve));
  const addr = server.address();
  baseUrl = `http://127.0.0.1:${typeof addr === 'object' && addr ? addr.port : 0}`;
  await store.ensureProfile(UID, 'UTC');
  await store.ensureCorrespondents(UID);
  await store.addEntry(UID, 'A small honest entry.');
}, 30_000);

afterAll(async () => {
  setPipelineDeps(null);
  server?.close();
  await store.cascadeDelete(UID).catch(() => undefined);
  await adminAuth.deleteUser(UID).catch(() => undefined);
});

const request = (cid: string) =>
  fetch(`${baseUrl}/api/letters/request`, { method: 'POST', headers: authed(), body: JSON.stringify({ cid }) });

describe('request-letter race', () => {
  it('three concurrent requests yield exactly one 202, one cycle, one letter', async () => {
    const results = await Promise.all([request('director'), request('director'), request('director')]);
    const statuses = results.map((r) => r.status);
    expect(statuses.filter((s) => s === 202)).toHaveLength(1);
    for (const s of statuses.filter((s) => s !== 202)) expect([409, 429]).toContain(s);

    // The Desk sees the claim immediately — before the letter exists.
    const desk = (await (await fetch(`${baseUrl}/api/desk`, { headers: authed() })).json()) as DeskPayload;
    expect(desk.composing.map((c) => c.kind)).toContain('requested');
    expect(desk.requestUsedToday.director).toBe(true);

    release();
    const cycleId = desk.composing.find((c) => c.kind === 'requested')!.cycleId;
    expect(await waitForCycle(cycleId)).toBe('delivered');
    expect(composeCalls.filter((c) => c === 'director')).toHaveLength(1);
    expect(await store.lettersByCid(UID, 'director', 5)).toHaveLength(1);

    // Delivered today → asking again is refused by the daily cap.
    expect((await request('director')).status).toBe(429);
  });

  it('a failed request does not spend the day and may be asked for again', async () => {
    gate = Promise.resolve();
    failNext = true;
    const first = await request('foreign');
    expect(first.status).toBe(202);
    const { cycleId } = (await first.json()) as { cycleId: string };
    expect(await waitForCycle(cycleId)).toBe('failed');

    const desk = (await (await fetch(`${baseUrl}/api/desk`, { headers: authed() })).json()) as DeskPayload;
    expect(desk.requestUsedToday.foreign).toBe(false);
    expect(desk.undelivered.map((u) => u.cid)).toContain('foreign');

    failNext = false;
    const again = await request('foreign');
    expect(again.status).toBe(202);
    expect(await waitForCycle(cycleId)).toBe('delivered');
    expect(await store.lettersByCid(UID, 'foreign', 5)).toHaveLength(1);

    const after = (await (await fetch(`${baseUrl}/api/desk`, { headers: authed() })).json()) as DeskPayload;
    expect(after.undelivered.map((u) => u.cid)).not.toContain('foreign');
    expect(after.requestUsedToday.foreign).toBe(true);
  });
});

describe('onboarding claims the welcome cycle before responding', () => {
  it('the Desk fetched right after onboarding shows the welcome cycle composing', async () => {
    gate = new Promise<void>((r) => (release = r));
    // Context only carries entries newer than each correspondent's last
    // letter; the earlier tests delivered letters, so give them a fresh entry.
    await store.addEntry(UID, 'Another small honest entry.');
    const res = await fetch(`${baseUrl}/api/profile/onboard`, {
      method: 'POST',
      headers: authed(),
      body: JSON.stringify({ tz: 'UTC', onboarded: true }),
    });
    expect(res.status).toBe(200);
    expect(((await res.json()) as { welcomeStarted: boolean }).welcomeStarted).toBe(true);

    const desk = (await (await fetch(`${baseUrl}/api/desk`, { headers: authed() })).json()) as DeskPayload;
    expect(desk.composing.map((c) => c.kind)).toContain('welcome');

    release();
    expect(await waitForCycle('welcome')).toBe('delivered');
  });
});

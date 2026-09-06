import { afterAll, beforeAll, beforeEach, describe, expect, it } from 'vitest';
import type { Server } from 'node:http';
import { buildApp } from '../../src/server/index.js';
import { adminAuth } from '../../src/server/firebase.js';
import * as store from '../../src/server/store.js';
import { gatherContext } from '../../src/server/context.js';
import { DEFAULT_REFLECTION_PREFERENCES, REFLECTION_DEPTHS } from '../../src/shared/schemas.js';
import { mintIdToken } from './helpers.js';
import { deps, newCycleDoc, resumeStaleCycles, setPipelineDeps } from '../../src/server/pipeline.js';

let server: Server;
let base = '';
let uid = '';
let token = '';
const users: string[] = [];
beforeAll(async () => {
  server = buildApp().listen(0);
  await new Promise<void>((resolve) => server.once('listening', resolve));
  const address = server.address();
  base = `http://127.0.0.1:${typeof address === 'object' && address ? address.port : 0}`;
});
beforeEach(async () => {
  uid = `reflection-test-${users.length}`; users.push(uid);
  token = await mintIdToken(uid);
  await store.ensureProfile(uid, 'UTC');
  await store.ensureCorrespondents(uid);
});
afterAll(async () => {
  server?.close();
  for (const user of users) {
    await store.cascadeDelete(user);
    await adminAuth.deleteUser(user);
  }
});
function post(path: string, body: unknown) {
  return fetch(`${base}/api${path}`, { method: 'POST', headers: { Authorization: `Bearer ${token}`, 'Content-Type': 'application/json' }, body: JSON.stringify(body) });
}

describe('Invited entry reflections', () => {
  it('collapses concurrent requests and exposes only the owner’s status', async () => {
    const entry = await store.addEntry(uid, 'A moment worth considering.');
    const selection = { entryId: entry.id, preferences: DEFAULT_REFLECTION_PREFERENCES };
    const original = deps();
    let unblock!: () => void;
    let composing!: () => void;
    const started = new Promise<void>((resolve) => { composing = resolve; });
    const blocked = new Promise<void>((resolve) => { unblock = resolve; });
    let count = 0;
    setPipelineDeps({ ...original, compose: async (...args) => { count++; composing(); await blocked; return original.compose(...args); } });
    try {
      const first = post('/reflections', selection);
      await started;
      const second = await post('/reflections', selection);
      expect(second.status).toBe(202);
      const pending = await second.json() as { cycleId: string };
      expect((await fetch(`${base}/api/reflections/${pending.cycleId}`)).status).toBe(401);
      const anotherToken = await mintIdToken('reflection-status-stranger');
      try {
        expect((await fetch(`${base}/api/reflections/${pending.cycleId}`, { headers: { Authorization: `Bearer ${anotherToken}` } })).status).toBe(404);
      } finally { await adminAuth.deleteUser('reflection-status-stranger'); }
      unblock();
      expect((await first).status).toBe(200);
      expect(count).toBe(1);
      const status = await fetch(`${base}/api/reflections/${pending.cycleId}`, { headers: { Authorization: `Bearer ${token}` } });
      expect((await status.json() as { state: string }).state).toBe('delivered');
    } finally { unblock(); setPipelineDeps(null); }
  });

  it('recovers a stranded reflection with its original entry and depth snapshot', async () => {
    const entry = await store.addEntry(uid, 'What makes a choice my own?');
    const selection = { entryId: entry.id, preferences: { ...DEFAULT_REFLECTION_PREFERENCES, depth: 'philosophical' as const } };
    const cycleId = 'reflection-000000000000000000000000';
    await store.claimCycle(uid, { ...newCycleDoc(cycleId, 'requested'), reflection: selection });
    await store.updateProfile(uid, { reflectionPreferences: DEFAULT_REFLECTION_PREFERENCES, weeklyLetters: false });
    const recovered = await resumeStaleCycles(uid, { staleMs: -1 });
    expect(recovered.resumed).toContain(cycleId);
    const letter = await store.getLetter(uid, `${cycleId}-director`);
    expect(letter?.reflection).toEqual(selection);
    expect(letter?.groundingRefs[0]?.entryId).toBe(entry.id);
    expect(await store.latestMemory(uid, 'director')).toBeNull();
  });

  it('saves onboarding preferences without starting welcome letters', async () => {
    await store.addEntry(uid, 'An ordinary afternoon.');
    const response = await post('/profile/onboard', {
      tz: 'UTC', reflectionPreferences: DEFAULT_REFLECTION_PREFERENCES, weeklyLetters: false, welcomeLetters: false,
    });
    expect(response.status).toBe(200);
    expect(((await response.json()) as { welcomeStarted: boolean }).welcomeStarted).toBe(false);
    expect(await store.getCycle(uid, 'welcome')).toBeNull();
    expect((await store.getProfile(uid))?.weeklyLetters).toBe(false);
    expect(await store.recentLetters(uid)).toEqual([]);
  });

  it('reads only the selected entry and leaves correspondence memory untouched', async () => {
    const entry = await store.addEntry(uid, 'I enjoyed learning something slowly.');
    await store.addEntry(uid, 'An unrelated private conversation.');
    const selection = { entryId: entry.id, preferences: DEFAULT_REFLECTION_PREFERENCES };
    const context = await gatherContext(uid, 'director', selection);
    expect(context.entries.map((e) => e.id)).toEqual([entry.id]);
    expect(context.prompt).not.toContain('unrelated private');
    const response = await post('/reflections', selection);
    expect(response.status).toBe(200);
    const result = await response.json() as { letterId: string };
    const letter = await store.getLetter(uid, result.letterId);
    expect(letter?.reflection).toEqual(selection);
    expect(letter?.groundingRefs.map((g) => g.entryId)).toEqual([entry.id]);
    expect(await store.latestMemory(uid, 'director')).toBeNull();
    expect(await store.lastLetterAt(uid, 'director')).toBeNull();
    expect(await store.lettersByCid(uid, 'director', 3, true)).toEqual([]);
    expect(await store.requestedCyclesToday(uid, 'director')).toEqual([]);
  });

  it('remains available after Director correspondence concludes and stays out of Study', async () => {
    const entry = await store.addEntry(uid, 'I am still allowed to return to this question.');
    await store.updateCorrespondent(uid, 'director', { status: 'concluded', concludedAt: new Date().toISOString() });

    const response = await post('/reflections', { entryId: entry.id, preferences: DEFAULT_REFLECTION_PREFERENCES });
    expect(response.status).toBe(200);
    const result = await response.json() as { letterId: string };
    expect(result.letterId).toMatch(/^reflection-[a-f0-9]{24}-director$/);

    const letter = await store.getLetter(uid, result.letterId);
    expect(letter?.reflection?.entryId).toBe(entry.id);
    expect((await store.lettersByCid(uid, 'director', 60, true))).toEqual([]);

    const thread = await fetch(`${base}/api/correspondents/director/thread`, { headers: { Authorization: `Bearer ${token}` } });
    expect(thread.status).toBe(200);
    expect(((await thread.json()) as { letters: unknown[] }).letters).toEqual([]);

    const bundle = await fetch(`${base}/api/letters/${result.letterId}`, { headers: { Authorization: `Bearer ${token}` } });
    expect(bundle.status).toBe(200);
  });

  it('persists each depth and reuses a completed request on retry', async () => {
    const entry = await store.addEntry(uid, 'AI made the task easier, but I missed the effort.');
    const ids = new Set<string>();
    for (const depth of REFLECTION_DEPTHS) {
      const selection = { entryId: entry.id, preferences: { ...DEFAULT_REFLECTION_PREFERENCES, depth, interests: ['ai'] } };
      const response = await post('/reflections', selection);
      expect(response.status).toBe(200);
      const result = await response.json() as { letterId: string };
      ids.add(result.letterId);
      expect((await store.getLetter(uid, result.letterId))?.reflection?.preferences.depth).toBe(depth);
    }
    expect(ids.size).toBe(4);
    const retry = await post('/reflections', { entryId: entry.id, preferences: { ...DEFAULT_REFLECTION_PREFERENCES, depth: 'philosophical', interests: ['ai'] } });
    expect(ids.has(((await retry.json()) as { letterId: string }).letterId)).toBe(true);
    expect((await store.recentLetters(uid)).length).toBe(4);
  });

  it('rejects another user’s entry and malformed settings before composing', async () => {
    const other = users[0]!;
    const entry = await store.addEntry(other, 'Not available to this caller.');
    expect((await post('/reflections', { entryId: entry.id, preferences: {} })).status).toBe(404);
    expect((await post('/reflections', { entryId: '../profile', preferences: {} })).status).toBe(400);
    expect((await post('/reflections', { entryId: 'example', preferences: { depth: 'aggressive' } })).status).toBe(400);
    expect(await store.recentLetters(uid)).toEqual([]);
  });
});

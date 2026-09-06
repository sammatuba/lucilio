// Export / delete cascade integration test (spec §10.6), exercised through the
// real HTTP API (buildApp + real Auth-emulator ID token):
//  1. Seed a full user subtree (profile, correspondents+memory, entries, a
//     delivered letter, a reply, a cycle).
//  2. GET /api/export returns the entire subtree and records an exports doc.
//  3. DELETE /api/account removes EVERYTHING under users/{uid} + the auth user.
import { afterAll, beforeAll, describe, expect, it } from 'vitest';
import type { Server } from 'node:http';
import { buildApp } from '../../src/server/index.js';
import { adminDb, adminAuth } from '../../src/server/firebase.js';
import * as store from '../../src/server/store.js';
import { mintIdToken } from './helpers.js';
import type { CycleDoc, LetterDoc, ReplyDoc } from '../../src/shared/schemas.js';

const UID = 'cascade-test-user';
let baseUrl = '';
let server: Server;
let token = '';

async function seed(): Promise<void> {
  await store.ensureProfile(UID, 'UTC');
  await store.ensureCorrespondents(UID);
  const e1 = await store.addEntry(UID, 'Monday: I started the thing I keep postponing.');
  await store.addEntry(UID, 'Thursday: it went better than I feared.');

  const cycle: CycleDoc = {
    id: 'casc-cycle-1',
    kind: 'scheduled',
    state: 'delivered',
    createdAt: new Date().toISOString(),
    notes: [],
    deliveredCids: ['director'],
  };
  await store.createCycle(UID, cycle);

  const letter: LetterDoc = {
    id: 'casc-letter-1',
    cid: 'director',
    cycleId: 'casc-cycle-1',
    genre: 'hortatoria',
    salutation: 'Dear friend,',
    bodyMd: 'You wrote: "I started the thing I keep postponing."',
    groundingRefs: [{ entryId: e1.id, quotedPhrase: 'the thing I keep postponing' }],
    status: 'replied',
    createdAt: new Date().toISOString(),
  };
  await store.deliverLetterWithCycle(UID, letter);

  const reply: ReplyDoc = {
    id: 'casc-reply-1',
    letterId: 'casc-letter-1',
    cid: 'director',
    bodyMd: 'You were right about the postponement.',
    intents: ['respond'],
    processed: false,
    createdAt: new Date().toISOString(),
  };
  await store.addReply(UID, reply);

  await store.appendMemoryVersion(UID, 'director', {
    version: 1,
    createdAt: new Date().toISOString(),
    themesObserved: [{ theme: 'procrastination', evidence: 'the thing I keep postponing', trend: 'new' }],
    openThreads: ['the postponed thing'],
    exercisesGiven: [],
    toneCalibration: 'warm, direct',
    retiredItems: [],
    letterCount: 1,
  });
}

beforeAll(async () => {
  token = await mintIdToken(UID);
  await seed();
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

describe('export + delete cascade (spec §10.6)', () => {
  it('GET /api/export downloads the full subtree', async () => {
    const res = await fetch(`${baseUrl}/api/export`, { headers: { Authorization: `Bearer ${token}` } });
    expect(res.status).toBe(200);
    expect(res.headers.get('content-disposition')).toContain('attachment');
    const data = (await res.json()) as Record<string, any>;

    expect(data.profile).toBeTruthy();
    expect(data.profile.tz).toBe('UTC');
    expect(Array.isArray(data.notebook) && data.notebook).toHaveLength(2);
    expect(data.letters).toHaveLength(1);
    expect(data.letters[0].id).toBe('casc-letter-1');
    expect(data.replies).toHaveLength(1);
    expect(data.cycles.length).toBeGreaterThanOrEqual(1);
    const director = data.correspondents.find((c: any) => c.cid === 'director');
    expect(director).toBeTruthy();
    expect(director.memory).toHaveLength(1);
    expect(director.memory[0].version).toBe(1);
  });

  it('the export recorded an exports doc', async () => {
    const snap = await adminDb.collection(`users/${UID}/exports`).get();
    expect(snap.size).toBeGreaterThanOrEqual(1);
  });

  it('a stranger cannot export another user\'s subtree', async () => {
    // mintIdToken for a different uid; the route is uid-scoped so this only
    // ever returns the caller's own (empty) subtree, never ours.
    const otherToken = await mintIdToken('cascade-stranger');
    const res = await fetch(`${baseUrl}/api/export`, { headers: { Authorization: `Bearer ${otherToken}` } });
    expect(res.status).toBe(200);
    const data = (await res.json()) as Record<string, any>;
    expect(data.notebook).toHaveLength(0);
    expect(data.letters).toHaveLength(0);
    await store.cascadeDelete('cascade-stranger').catch(() => undefined);
    await adminAuth.deleteUser('cascade-stranger').catch(() => undefined);
  });

  it('DELETE /api/account removes the whole subtree and the auth record', async () => {
    const res = await fetch(`${baseUrl}/api/account`, {
      method: 'DELETE',
      headers: { Authorization: `Bearer ${token}` },
    });
    expect(res.status).toBe(200);
    expect(await res.json()).toEqual({ ok: true, deleted: true, authDeleted: true });

    // Nothing survives under users/{uid}: no doc, no subcollections, and no
    // orphaned grandchildren (memory versions lived two levels deep).
    const userRef = adminDb.doc(`users/${UID}`);
    expect((await userRef.get()).exists).toBe(false);
    const cols = await userRef.listCollections();
    expect(cols).toHaveLength(0);

    await expect(adminAuth.getUser(UID)).rejects.toThrow();
  });
});

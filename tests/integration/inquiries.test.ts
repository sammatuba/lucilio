// Real Auth/Firestore emulators and buildApp middleware. App Check alone uses
// a test verifier, since Firebase provides no App Check emulator.
import { randomUUID } from 'node:crypto';
import type { Server } from 'node:http';
import express from 'express';
import { afterAll, beforeAll, beforeEach, describe, expect, it, vi } from 'vitest';
import { buildApp } from '../../src/server/index.js';
import { adminAuth, adminAuthVerifier, adminDb } from '../../src/server/firebase.js';
import { inquiriesRouter } from '../../src/server/routes/inquiries.js';
import { PHILOSOPHY_PACK } from '../../src/server/philosophy-pack.js';
import { philosophyPackSchema } from '../../src/shared/philosophy.js';
import { inquiryDetailSchema, inquiryDocSchema, inquiryWritingSchema, type Inquiry, type InquiryDetail, type InquiryWriting } from '../../src/shared/inquiry.js';
import * as store from '../../src/server/store.js';
import * as gemini from '../../src/server/gemini.js';
import { mintIdToken } from './helpers.js';

let server: Server;
let base = '';
let uid = '';
let token = '';
const users: string[] = [];
const runId = randomUUID().slice(0, 8);
const readingId = PHILOSOPHY_PACK.readings[0]!.id;
const nodeId = PHILOSOPHY_PACK.nodes[0]!.id;
const otherNodeId = PHILOSOPHY_PACK.nodes[1]!.id;

async function newUser() {
  const id = `inquiry-test-${runId}-${users.length}`;
  users.push(id);
  return { uid: id, token: await mintIdToken(id) };
}
async function listen(app: express.Express) {
  const listener = app.listen(0);
  await new Promise<void>((resolve) => listener.once('listening', resolve));
  const address = listener.address();
  return { listener, url: `http://127.0.0.1:${typeof address === 'object' && address ? address.port : 0}` };
}
function headers(authToken = token) {
  return { Authorization: `Bearer ${authToken}`, 'Content-Type': 'application/json' };
}
function get(path: string, authToken = token) {
  return fetch(`${base}/api${path}`, { headers: headers(authToken) });
}
function post(path: string, body: unknown, authToken = token) {
  return fetch(`${base}/api${path}`, { method: 'POST', headers: headers(authToken), body: JSON.stringify(body) });
}
async function json<T>(response: Response, status = 200): Promise<T> {
  const body = await response.json();
  expect(response.status, JSON.stringify(body)).toBe(status);
  return body as T;
}
async function create(id = 'root', extra: Record<string, unknown> = {}): Promise<Inquiry> {
  return inquiryDocSchema.parse(await json(await post('/inquiries', { id, question: 'What makes a life my own?', ...extra }), 201));
}
async function write(id = 'first', inquiryId = 'root', extra: Record<string, unknown> = {}): Promise<InquiryWriting> {
  return inquiryWritingSchema.parse(await json(await post(`/inquiries/${inquiryId}/writings`, { id, bodyMd: 'An unfinished thought.', mode: 'reflection', ...extra }), 201));
}
async function detail(id = 'root'): Promise<InquiryDetail> {
  return inquiryDetailSchema.parse(await json(await get(`/inquiries/${id}`)));
}
const col = (name: string, owner = uid) => adminDb.collection('users').doc(owner).collection(name);

beforeAll(async () => {
  const running = await listen(buildApp());
  server = running.listener;
  base = running.url;
});
beforeEach(async () => { ({ uid, token } = await newUser()); });
afterAll(async () => {
  server?.close();
  for (const user of users) {
    await store.cascadeDelete(user);
    await adminAuth.deleteUser(user).catch((error: { code: string }) => {
      if (error.code !== 'auth/user-not-found') throw error;
    });
  }
});

const endpoints = [
  { method: 'GET', path: '/philosophy' },
  { method: 'GET', path: '/inquiries' },
  { method: 'POST', path: '/inquiries', body: { id: 'gate', question: 'A question?' } },
  { method: 'GET', path: '/inquiries/gate' },
  { method: 'POST', path: '/inquiries/gate', body: { revision: 0, status: 'paused' } },
  { method: 'POST', path: '/inquiries/gate/writings', body: { id: 'gate-writing', bodyMd: 'Words.', mode: 'reflection' } },
  { method: 'POST', path: '/inquiries/gate/writings/gate-writing/notebook', body: {} },
];

describe('inquiry middleware and payload boundaries', () => {
  it('protects every endpoint with real ID token verification before any side effect', async () => {
    for (const endpoint of endpoints) {
      for (const auth of [undefined, 'Bearer garbage-token']) {
        const response = await fetch(`${base}/api${endpoint.path}`, {
          method: endpoint.method,
          headers: { 'Content-Type': 'application/json', ...(auth ? { Authorization: auth } : {}) },
          body: endpoint.body ? JSON.stringify(endpoint.body) : undefined,
        });
        await json(response, 401);
      }
    }
    expect((await col('inquiries').get()).empty).toBe(true);
    expect((await col('inquiryWritings').get()).empty).toBe(true);
    expect(await store.listEntries(uid)).toEqual([]);
  });

  it('enforces App Check, validation, and per-user limits on every route in that order', async () => {
    const app = express();
    app.use(express.json());
    app.use('/api', inquiriesRouter({
      auth: adminAuthVerifier,
      appCheck: { verifyAppCheckToken: async (value) => {
        if (value !== 'test-app-check') throw new Error('invalid test App Check');
        return { appId: 'test-app' };
      } },
      enforceAppCheck: true,
      rateLimit: { max: 1, windowMs: 60_000, scope: 'inquiry-test' },
    }));
    const running = await listen(app);
    try {
      for (const [index, endpoint] of endpoints.entries()) {
        const call = (appCheck?: string, body: unknown = endpoint.body) => fetch(`${running.url}/api${endpoint.path}`, {
          method: endpoint.method,
          headers: { ...headers(), ...(appCheck ? { 'X-Firebase-AppCheck': appCheck } : {}) },
          body: body === undefined ? undefined : JSON.stringify(body),
        });
        await json(await call(), 401);
        await json(await call('bad'), 401);
        if (endpoint.method === 'POST') {
          // Invalid requests never consume the route's single successful slot.
          await json(await call('test-app-check', []), 400);
        }
        await json(await call('test-app-check'), index === 2 || index === 5 ? 201 : 200);
        await json(await call('test-app-check'), 429);
      }
      const stranger = await newUser();
      const independent = await fetch(`${running.url}/api/philosophy`, {
        headers: { ...headers(stranger.token), 'X-Firebase-AppCheck': 'test-app-check' },
      });
      await json(independent);
      expect((await col('inquiries').get()).size).toBe(1);
      expect((await col('inquiryWritings').get()).size).toBe(1);
      expect(await store.recentCycles(uid)).toEqual([]);
    } finally { running.listener.close(); }
  });

  it('mounts the general 60/min tier, not the model-compose tier', async () => {
    for (let i = 0; i < 60; i++) await json(await get('/philosophy'));
    await json(await get('/philosophy'), 429);
    // Creation has its own limiter, matching the existing route patterns.
    for (let i = 0; i < 7; i++) await create(`general-${i}`);
    expect(await store.recentCycles(uid)).toEqual([]);
  });

  it('serves the real validated static pack and an empty inquiry list', async () => {
    expect(philosophyPackSchema.parse(await json(await get('/philosophy')))).toEqual(PHILOSOPHY_PACK);
    expect(await json(await get('/inquiries'))).toEqual({ inquiries: [] });
    const exported = await json<Record<string, unknown>>(await get('/export'));
    expect(exported.inquiries).toEqual([]);
    expect(exported.inquiryWritings).toEqual([]);
  });

  it('rejects malformed JSON, unknown fields, bad IDs, and server-owned fields', async () => {
    await json(await fetch(`${base}/api/inquiries`, { method: 'POST', headers: headers(), body: '{broken' }), 400);
    const invalid = [
      {}, { id: '../escape', question: 'Q?' }, { id: 'a'.repeat(101), question: 'Q?' },
      { id: 'line\n', question: 'Q?' }, { id: 'ok', question: '   ' },
      { id: 'ok', question: 'x'.repeat(301) }, { id: 'ok', question: 'Q?', uid: 'other' },
      { id: 'ok', question: 'Q?', revision: 9 }, { id: 'ok', question: 'Q?', status: 'paused' },
      { id: 'ok', question: 'Q?', createdAt: 'yesterday' }, { id: 'ok', question: 'Q?', nodeIds: Array(25).fill(nodeId) },
    ];
    for (const body of invalid) await json(await post('/inquiries', body), 400);
    expect((await col('inquiries').get()).empty).toBe(true);
  });

  it('validates decoded path IDs before any Firestore access', async () => {
    for (const id of ['a.b', 'a%2Fb', 'a%20b', 'a%0A', '%00', 'a'.repeat(101)]) {
      await json(await get(`/inquiries/${id}`), 400);
      await json(await post(`/inquiries/${id}`, { revision: 0 }), 400);
      await json(await post(`/inquiries/${id}/writings`, { id: 'w', bodyMd: 'text', mode: 'reflection' }), 400);
      await json(await post(`/inquiries/root/writings/${id}/notebook`, {}), 400);
    }
  });

  it('validates known reading, concept and writing-source IDs', async () => {
    await json(await post('/inquiries', { id: 'unknown-reading', question: 'Q?', readingId: 'not-in-pack' }), 400);
    await json(await post('/inquiries', { id: 'unknown-node', question: 'Q?', nodeIds: ['not-in-pack'] }), 400);
    await create('root', { readingId, nodeIds: [nodeId] });
    await json(await post('/inquiries/root', { revision: 0, nodeIds: ['not-in-pack'] }), 400);
    await json(await post('/inquiries/root/writings', { id: 'w', bodyMd: 'text', mode: 'reflection', sourceNodeId: 'not-in-pack' }), 400);
    await write('known', 'root', { sourceNodeId: nodeId });
    expect((await detail()).inquiry.nodeIds).toEqual([nodeId]);
  });

  it('enforces writing schema and 20 KB UTF-8 limit, accepting the exact limit', async () => {
    await create();
    for (const extra of [
      { bodyMd: '   ' }, { bodyMd: 'x'.repeat(20 * 1024 + 1) }, { bodyMd: 'é'.repeat(10 * 1024 + 1) },
      { mode: 'essay' }, { id: 'bad/id' }, { id: 'line\n' }, { inquiryId: 'elsewhere' },
      { createdAt: 'yesterday' }, { mode: 'revision' },
    ]) {
      await json(await post('/inquiries/root/writings', { id: 'invalid', bodyMd: 'text', mode: 'reflection', ...extra }), 400);
    }
    const writing = await write('limit', 'root', { bodyMd: 'é'.repeat(10 * 1024) });
    expect(Buffer.byteLength(writing.bodyMd)).toBe(20 * 1024);
    expect((await detail()).writings).toEqual([writing]);
  });
});

describe('inquiry ownership, retries and revision integrity', () => {
  it('collapses simultaneous identical creates without exposing internal fingerprints', async () => {
    const input = { id: 'retry', question: 'Can I belong without agreeing?', readingId, nodeIds: [nodeId] };
    const responses = await Promise.all([post('/inquiries', input), post('/inquiries', input)]);
    expect(responses.map((r) => r.status).sort()).toEqual([200, 201]);
    const values = await Promise.all(responses.map((r) => r.json()));
    expect(values[0]).toEqual(values[1]);
    const inquiry = inquiryDocSchema.parse(values[0]);
    expect(inquiry).toMatchObject({ ...input, parentId: null, status: 'active', revision: 0 });
    expect(values[0]).not.toHaveProperty('createFingerprint');
    expect((await col('inquiries').get()).size).toBe(1);
    expect((await detail('retry')).inquiry).toEqual(inquiry);
  });

  it('conflicts on changed creation data, including concurrent different content', async () => {
    const responses = await Promise.all([
      post('/inquiries', { id: 'collision', question: 'First?' }),
      post('/inquiries', { id: 'collision', question: 'Second?' }),
    ]);
    expect(responses.map((r) => r.status).sort()).toEqual([201, 409]);
    const winner = await detail('collision');
    await json(await post('/inquiries', { id: 'collision', question: winner.inquiry.question, readingId }), 409);
    await json(await post('/inquiries', { id: 'collision', question: winner.inquiry.question, nodeIds: [nodeId] }), 409);
    await create('parent');
    await json(await post('/inquiries', { id: 'collision', question: winner.inquiry.question, parentId: 'parent' }), 409);
    expect((await detail('collision')).inquiry).toEqual(winner.inquiry);
  });

  it('preserves later edits on a retry of the original creation operation', async () => {
    const original = await create();
    const changed = await json<Inquiry>(await post('/inquiries/root', { revision: 0, question: 'A better question?', status: 'paused', nodeIds: [nodeId] }));
    expect(changed.revision).toBe(1);
    const retry = await json(await post('/inquiries', { id: original.id, question: original.question }));
    expect(retry).toEqual(changed);
    expect((await detail()).inquiry).toEqual(changed);
  });

  it('serializes optimistic edits; stale retries cannot silently overwrite a winner', async () => {
    await create();
    const responses = await Promise.all([
      post('/inquiries/root', { revision: 0, question: 'First concurrent edit?' }),
      post('/inquiries/root', { revision: 0, question: 'Second concurrent edit?' }),
    ]);
    expect(responses.map((r) => r.status).sort()).toEqual([200, 409]);
    const saved = (await detail()).inquiry;
    expect(saved.revision).toBe(1);
    await json(await post('/inquiries/root', { revision: 0, question: 'Stale overwrite?' }), 409);
    for (const body of [{ status: 'paused' }, { revision: -1 }, { revision: 1.5 }, { revision: 1, parentId: 'other' }, { revision: 1, readingId }]) {
      await json(await post('/inquiries/root', body), 400);
    }
    expect((await detail()).inquiry).toEqual(saved);
    for (const [index, status] of ['paused', 'resting', 'active'].entries()) {
      const changed = await json<Inquiry>(await post('/inquiries/root', { revision: index + 1, status }));
      expect(changed).toMatchObject({ status, revision: index + 2 });
    }
  });

  it('branches only from existing owner inquiries and cannot create parent cycles', async () => {
    const root = await create('root', { readingId, nodeIds: [nodeId] });
    const original = await write();
    const branch = await create('branch', { parentId: 'root', question: 'What does belonging ask of me?', nodeIds: [otherNodeId] });
    expect((await detail()).branches).toEqual([branch]);
    expect((await detail()).writings).toEqual([original]);
    expect((await detail()).inquiry).toMatchObject({ question: root.question, readingId, nodeIds: [nodeId] });
    await json(await post('/inquiries', { id: 'self', question: 'Q?', parentId: 'self' }), 400);
    const mutual = await Promise.all([
      post('/inquiries', { id: 'a', question: 'Q?', parentId: 'b' }),
      post('/inquiries', { id: 'b', question: 'Q?', parentId: 'a' }),
    ]);
    expect(mutual.map((r) => r.status)).toEqual([404, 404]);
    await json(await post('/inquiries/root', { revision: 0, parentId: 'branch' }), 400);
    expect((await col('inquiries').get()).size).toBe(2);
  });

  it('isolates lists, details, parent links, updates and writes between real users', async () => {
    await create('private');
    await write('private-writing', 'private');
    const other = await newUser();
    expect(await json(await get('/inquiries', other.token))).toEqual({ inquiries: [] });
    await json(await get('/inquiries/private', other.token), 404);
    await json(await post('/inquiries/private', { revision: 0, status: 'paused' }, other.token), 404);
    await json(await post('/inquiries', { id: 'foreign-child', question: 'Q?', parentId: 'private' }, other.token), 404);
    await json(await post('/inquiries/private/writings', { id: 'attempt', bodyMd: 'text', mode: 'reflection' }, other.token), 404);
    await json(await post('/inquiries/private/writings/private-writing/notebook', {}, other.token), 404);
    await json(await post('/inquiries', { id: 'private', question: 'My separate question?' }, other.token), 201);
    await json(await post('/inquiries/private/writings', { id: 'revision', bodyMd: 'text', mode: 'revision', revisesId: 'private-writing' }, other.token), 404);
    await json(await post('/inquiries/private/writings/private-writing/notebook', {}, other.token), 404);
    await json(await post('/inquiries/private/writings', { id: 'private-writing', bodyMd: 'Other owner.', mode: 'reflection' }, other.token), 201);
    expect((await detail('private')).writings[0]!.bodyMd).toBe('An unfinished thought.');
    const exported = await json<{ inquiries: Inquiry[]; inquiryWritings: InquiryWriting[] }>(await get('/export', other.token));
    expect(exported.inquiries).toHaveLength(1);
    expect(exported.inquiryWritings.map((w) => w.bodyMd)).toEqual(['Other owner.']);
  });

  it('returns 404 for missing inquiries, including an orphaned writing copy', async () => {
    await json(await get('/inquiries/missing'), 404);
    await json(await post('/inquiries/missing', { revision: 0 }), 404);
    await json(await post('/inquiries/missing/writings', { id: 'w', bodyMd: 'text', mode: 'reflection' }), 404);
    await col('inquiryWritings').doc('orphan').create({ id: 'orphan', inquiryId: 'missing', bodyMd: 'Orphaned.', mode: 'reflection', revisesId: null, sourceNodeId: null, createdAt: new Date().toISOString() });
    await json(await post('/inquiries/missing/writings/orphan/notebook', {}), 404);
    expect(await store.listEntries(uid)).toEqual([]);
  });

  it('keeps immutable revisions, rejects cross-inquiry/missing links, and prevents revision cycles', async () => {
    await create();
    await create('another');
    const original = await write('original');
    const revision = await write('revision', 'root', { mode: 'revision', bodyMd: 'A better account.', revisesId: original.id, sourceNodeId: nodeId });
    const second = await write('second', 'root', { mode: 'revision', revisesId: revision.id });
    expect((await detail()).writings).toEqual([original, revision, second]);
    for (const [inquiryId, id, revisesId, status] of [
      ['another', 'foreign-revision', 'original', 404], ['root', 'missing-revision', 'unknown', 404],
      ['root', 'self', 'self', 400], ['root', 'future', 'not-created-yet', 404],
    ] as const) {
      await json(await post(`/inquiries/${inquiryId}/writings`, { id, revisesId, bodyMd: 'text', mode: 'revision' }), status);
    }
    await json(await post('/inquiries/root/writings', { id: original.id, bodyMd: original.bodyMd, mode: 'revision', revisesId: second.id }), 409);
    expect((await detail()).writings).toEqual([original, revision, second]);
  });

  it('serializes immutable writing retries and rejects any changed data or inquiry reuse', async () => {
    await create();
    await create('another');
    const input = { id: 'retry-writing', bodyMd: 'An argument.', mode: 'argument', sourceNodeId: nodeId };
    const responses = await Promise.all([post('/inquiries/root/writings', input), post('/inquiries/root/writings', input)]);
    expect(responses.map((r) => r.status).sort()).toEqual([200, 201]);
    const values = await Promise.all(responses.map((r) => r.json()));
    expect(values[0]).toEqual(values[1]);
    const saved = await detail();
    for (const extra of [{ bodyMd: 'Different.' }, { mode: 'question' }, { sourceNodeId: otherNodeId }]) {
      await json(await post('/inquiries/root/writings', { ...input, ...extra }), 409);
    }
    await json(await post('/inquiries/another/writings', input), 409);
    expect(await json(await post('/inquiries/root/writings', input))).toEqual(values[0]);
    expect(await detail()).toEqual(saved); // Retry does not even move updatedAt.
  });

  it('allows just one concurrent different writing for a supplied ID', async () => {
    await create();
    const responses = await Promise.all([
      post('/inquiries/root/writings', { id: 'race', bodyMd: 'First.', mode: 'reflection' }),
      post('/inquiries/root/writings', { id: 'race', bodyMd: 'Second.', mode: 'reflection' }),
    ]);
    expect(responses.map((r) => r.status).sort()).toEqual([201, 409]);
    expect((await detail()).writings).toHaveLength(1);
  });

  it('sorts flat queries by writing creation and descending inquiry activity', async () => {
    await create();
    await create('older', { parentId: 'root' });
    await create('newer', { parentId: 'root' });
    await write('a-late');
    await write('z-early');
    await col('inquiries').doc('root').update({ updatedAt: '2026-01-02T00:00:00.000Z' });
    await col('inquiries').doc('older').update({ updatedAt: '2026-01-01T00:00:00.000Z' });
    await col('inquiries').doc('newer').update({ updatedAt: '2026-01-03T00:00:00.000Z' });
    await col('inquiryWritings').doc('a-late').update({ createdAt: '2026-01-02T00:00:00.000Z' });
    await col('inquiryWritings').doc('z-early').update({ createdAt: '2026-01-01T00:00:00.000Z' });
    const saved = await detail();
    expect(saved.writings.map((w) => w.id)).toEqual(['z-early', 'a-late']);
    expect(saved.branches.map((b) => b.id)).toEqual(['newer', 'older']);
    const list = await json<{ inquiries: Inquiry[] }>(await get('/inquiries'));
    expect(list.inquiries.map((i) => i.id)).toEqual(['newer', 'root', 'older']);
    await write('activity', 'older');
    const refreshed = await json<{ inquiries: Inquiry[] }>(await get('/inquiries'));
    expect(refreshed.inquiries[0]!.id).toBe('older');
  });
});

describe('explicit Notebook copy and account lifecycle', () => {
  it('creates no Notebook data or model/correspondence work until explicit idempotent copy', async () => {
    const model = vi.spyOn(gemini, 'generateJson').mockRejectedValue(new Error('Inquiry routes must never invoke a model'));
    try {
      await store.ensureProfile(uid, 'UTC');
      await store.ensureCorrespondents(uid);
      await store.updateProfile(uid, { weeklyLetters: true });
      await create();
      const writing = await write();
      await create('branch', { parentId: 'root' });
      expect(await store.listEntries(uid)).toEqual([]);
      expect(await store.recentCycles(uid)).toEqual([]);
      const saved = await detail();
      const copies = await Promise.all([
        post('/inquiries/root/writings/first/notebook', {}),
        post('/inquiries/root/writings/first/notebook', {}),
      ]);
      for (const response of copies) expect(await json(response)).toEqual({ entryId: 'inquiry-first' });
      expect(await store.listEntries(uid)).toEqual([{ id: 'inquiry-first', bodyMd: writing.bodyMd, createdAt: writing.createdAt }]);
      expect(await detail()).toEqual(saved);
      expect(await store.recentCycles(uid)).toEqual([]);
      expect(await store.recentLetters(uid)).toEqual([]);
      expect(await store.latestMemory(uid, 'director')).toBeNull();
      expect((await col('replies').get()).empty).toBe(true);
      expect(model).not.toHaveBeenCalled();
    } finally { model.mockRestore(); }
  });

  it('copies exactly 10 KB without truncating, with a bounded deterministic entry ID', async () => {
    await create();
    const id = 'a'.repeat(100);
    const writing = await write(id, 'root', { bodyMd: 'é'.repeat(5 * 1024) });
    const copy = await json<{ entryId: string }>(await post(`/inquiries/root/writings/${id}/notebook`, {}));
    expect(copy.entryId).toBe(`inquiry-${id}`);
    expect(copy.entryId.length).toBeLessThanOrEqual(128);
    expect((await store.getEntriesByIds(uid, [copy.entryId]))[0]!.bodyMd).toBe(writing.bodyMd);
  });

  it('rejects oversize copies before writing anything, keeping all saved text intact', async () => {
    await create();
    const writing = await write('oversize', 'root', { bodyMd: 'é'.repeat(5 * 1024 + 1) });
    const error = await json<{ error: string }>(await post('/inquiries/root/writings/oversize/notebook', {}), 400);
    expect(error.error).toContain('10 KB');
    expect(await store.listEntries(uid)).toEqual([]);
    expect((await detail()).writings).toEqual([writing]);
    // Even a pre-existing target must not bypass the copy-size check.
    await col('notebook').doc('inquiry-oversize').set({ id: 'inquiry-oversize', bodyMd: writing.bodyMd, createdAt: writing.createdAt });
    await json(await post('/inquiries/root/writings/oversize/notebook', {}), 400);
  });

  it('does not overwrite user-owned Notebook content or metadata on collision or retry', async () => {
    await create();
    const writing = await write();
    const ref = col('notebook').doc('inquiry-first');
    const userEntry = { id: 'inquiry-first', bodyMd: writing.bodyMd, createdAt: '2025-01-01T00:00:00.000Z', custom: 'keep me' };
    await ref.set(userEntry);
    await json(await post('/inquiries/root/writings/first/notebook', {}), 409);
    expect((await ref.get()).data()).toEqual(userEntry);
    await ref.delete();
    await json(await post('/inquiries/root/writings/first/notebook', {}));
    await ref.update({ bodyMd: 'Edited in the Notebook.' });
    await json(await post('/inquiries/root/writings/first/notebook', {}), 409);
    expect((await ref.get()).data()!.bodyMd).toBe('Edited in the Notebook.');
    expect((await detail()).writings).toEqual([writing]);
  });

  it('requires a saved writing in the requested inquiry and never trusts copy payload overrides', async () => {
    await create();
    await create('another');
    const writing = await write();
    await json(await post('/inquiries/root/writings/missing/notebook', {}), 404);
    await json(await post('/inquiries/another/writings/first/notebook', {}), 404);
    await json(await post('/inquiries/root/writings/first/notebook', []), 400);
    // emptyBodySchema is passthrough in this repository. Extra fields are
    // ignored, never used to choose a source, owner, content, or target ID.
    expect(await json(await post('/inquiries/root/writings/first/notebook', { entryId: 'other', bodyMd: 'forged', uid: 'another-user' }))).toEqual({ entryId: 'inquiry-first' });
    expect(await store.listEntries(uid)).toEqual([{ id: 'inquiry-first', bodyMd: writing.bodyMd, createdAt: writing.createdAt }]);
  });

  it('exports all saved inquiry and revision records and recursively deletes only the owner', async () => {
    const root = await create();
    const original = await write();
    const revision = await write('revision', 'root', { mode: 'revision', revisesId: original.id, bodyMd: 'Reconsidered.' });
    const branch = await create('branch', { parentId: 'root' });
    await json(await post('/inquiries/root/writings/revision/notebook', {}));
    const other = await newUser();
    await json(await post('/inquiries', { id: 'keep', question: 'Still mine?' }, other.token), 201);
    const exported = await json<{ inquiries: Inquiry[]; inquiryWritings: InquiryWriting[]; notebook: { id: string }[] }>(await get('/export'));
    expect(exported.inquiries.map((i) => i.id).sort()).toEqual([branch.id, root.id].sort());
    expect(exported.inquiries.find((i) => i.id === branch.id)?.parentId).toBe(root.id);
    expect(exported.inquiryWritings).toEqual([original, revision]);
    expect(exported.notebook.map((entry) => entry.id)).toEqual(['inquiry-revision']);
    const deleted = await json<{ deleted: boolean; authDeleted: boolean }>(await fetch(`${base}/api/account`, { method: 'DELETE', headers: headers() }));
    expect(deleted).toMatchObject({ deleted: true, authDeleted: true });
    for (const name of ['inquiries', 'inquiryWritings', 'notebook', 'exports']) expect((await col(name).get()).empty).toBe(true);
    await expect(adminAuth.getUser(uid)).rejects.toMatchObject({ code: 'auth/user-not-found' });
    expect((await col('inquiries', other.uid).doc('keep').get()).exists).toBe(true);
  });
});

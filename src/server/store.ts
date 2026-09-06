// Firestore data access. All paths live under users/{uid}/…; every write
// strips undefined (Firestore rejects it) and all server-owned collections are
// written only through this module (Admin SDK bypasses rules by design).
import { FieldValue } from 'firebase-admin/firestore';
import { adminDb } from './firebase.js';
import type {
  CorrespondentDoc,
  CorrespondentId,
  CycleDoc,
  EntryDoc,
  LetterDoc,
  MemoryDoc,
  ReplyDoc,
  ReflectionPreferences,
} from '../shared/schemas.js';
import { CORRESPONDENT_IDS } from '../shared/schemas.js';

// Deep variant: Firestore rejects undefined even NESTED inside maps/arrays
// (e.g. optional groundingRef fields). FieldValue sentinels and other class
// instances are passed through untouched — only plain objects are rewritten.
export function stripUndefined<T>(value: T): T {
  if (Array.isArray(value)) return value.map((v) => stripUndefined(v)) as unknown as T;
  if (
    value &&
    typeof value === 'object' &&
    (Object.getPrototypeOf(value) === Object.prototype || Object.getPrototypeOf(value) === null)
  ) {
    const out: Record<string, unknown> = {};
    for (const [k, v] of Object.entries(value as Record<string, unknown>)) {
      if (v !== undefined) out[k] = stripUndefined(v);
    }
    return out as T;
  }
  return value;
}

const nowIso = () => new Date().toISOString();
const userDoc = (uid: string) => adminDb.doc(`users/${uid}`);
const col = (uid: string, name: string) => userDoc(uid).collection(name);

// ---- profile ----

export interface ProfileDoc {
  reflectionPreferences?: ReflectionPreferences;
  weeklyLetters?: boolean;
  displayName?: string;
  tz: string;
  postDay: 'sunday';
  onboarded: boolean;
  crisisNotice: boolean;
  createdAt: string;
  lastWelcomeAt?: string;
}

export async function getProfile(uid: string): Promise<ProfileDoc | null> {
  const snap = await userDoc(uid).collection('profile').doc('main').get();
  return snap.exists ? (snap.data() as ProfileDoc) : null;
}

export async function ensureProfile(uid: string, tz: string): Promise<ProfileDoc> {
  const ref = userDoc(uid).collection('profile').doc('main');
  const snap = await ref.get();
  if (snap.exists) return snap.data() as ProfileDoc;
  const profile: ProfileDoc = { tz, postDay: 'sunday', onboarded: false, crisisNotice: false, createdAt: nowIso() };
  await ref.set(stripUndefined(profile));
  return profile;
}

export async function updateProfile(uid: string, patch: Partial<ProfileDoc>): Promise<void> {
  await userDoc(uid).collection('profile').doc('main').set(stripUndefined(patch), { merge: true });
}

// ---- correspondents ----

export async function ensureCorrespondents(uid: string): Promise<CorrespondentDoc[]> {
  const existing = await listCorrespondents(uid);
  if (existing.length === CORRESPONDENT_IDS.length) return existing;
  const batch = adminDb.batch();
  for (const cid of CORRESPONDENT_IDS) {
    if (existing.some((c) => c.cid === cid)) continue;
    const doc: CorrespondentDoc = { cid, cardVersion: 1, status: 'active', activatedAt: nowIso() };
    batch.set(col(uid, 'correspondents').doc(cid), stripUndefined(doc));
  }
  await batch.commit();
  return listCorrespondents(uid);
}

export async function listCorrespondents(uid: string): Promise<CorrespondentDoc[]> {
  const snap = await col(uid, 'correspondents').get();
  return snap.docs.map((d) => d.data() as CorrespondentDoc);
}

export async function getCorrespondent(uid: string, cid: CorrespondentId): Promise<CorrespondentDoc | null> {
  const snap = await col(uid, 'correspondents').doc(cid).get();
  return snap.exists ? (snap.data() as CorrespondentDoc) : null;
}

export async function updateCorrespondent(uid: string, cid: CorrespondentId, patch: Partial<CorrespondentDoc>): Promise<void> {
  await col(uid, 'correspondents').doc(cid).set(stripUndefined(patch), { merge: true });
}

// ---- notebook ----

export async function addEntry(uid: string, bodyMd: string): Promise<EntryDoc> {
  const ref = col(uid, 'notebook').doc();
  const entry: EntryDoc = { id: ref.id, bodyMd, createdAt: nowIso() };
  await ref.set(stripUndefined(entry));
  return entry;
}

export async function listEntries(uid: string, opts: { since?: string; limit?: number } = {}): Promise<EntryDoc[]> {
  let q: FirebaseFirestore.Query = col(uid, 'notebook').orderBy('createdAt', 'desc');
  if (opts.limit) q = q.limit(opts.limit);
  const snap = await q.get();
  let entries = snap.docs.map((d) => d.data() as EntryDoc);
  if (opts.since) entries = entries.filter((e) => e.createdAt > opts.since!);
  return entries;
}

export async function getEntriesByIds(uid: string, ids: string[]): Promise<EntryDoc[]> {
  if (ids.length === 0) return [];
  const unique = [...new Set(ids)];
  const out: EntryDoc[] = [];
  for (let i = 0; i < unique.length; i += 10) {
    const chunk = unique.slice(i, i + 10);
    const snap = await col(uid, 'notebook').where('__name__', 'in', chunk).get();
    for (const d of snap.docs) out.push(d.data() as EntryDoc);
  }
  return out;
}

// ---- memory ----

export async function latestMemory(uid: string, cid: CorrespondentId): Promise<MemoryDoc | null> {
  const snap = await col(uid, 'correspondents').doc(cid).collection('memory').orderBy('version', 'desc').limit(1).get();
  const first = snap.docs[0];
  return first ? (first.data() as MemoryDoc) : null;
}

export async function listMemoryVersions(uid: string, cid: CorrespondentId): Promise<MemoryDoc[]> {
  const snap = await col(uid, 'correspondents').doc(cid).collection('memory').orderBy('version', 'desc').limit(52).get();
  return snap.docs.map((d) => d.data() as MemoryDoc);
}

export async function appendMemoryVersion(uid: string, cid: CorrespondentId, memory: MemoryDoc): Promise<void> {
  const verId = String(memory.version).padStart(4, '0');
  await col(uid, 'correspondents').doc(cid).collection('memory').doc(verId).set(stripUndefined(memory));
}

// ---- letters ----

export async function createLetter(uid: string, letter: LetterDoc): Promise<void> {
  await col(uid, 'letters').doc(letter.id).set(stripUndefined(letter));
}

export async function deliverLetterWithCycle(uid: string, letter: LetterDoc): Promise<void> {
  // One atomic batch: the letter and its cycle state arrive together or not at all.
  const batch = adminDb.batch();
  batch.set(col(uid, 'letters').doc(letter.id), stripUndefined(letter));
  batch.set(
    col(uid, 'cycles').doc(letter.cycleId),
    { state: 'composing', deliveredCids: FieldValue.arrayUnion(letter.cid), updatedAt: nowIso() },
    { merge: true },
  );
  await batch.commit();
}

export async function getLetter(uid: string, letterId: string): Promise<LetterDoc | null> {
  const snap = await col(uid, 'letters').doc(letterId).get();
  return snap.exists ? (snap.data() as LetterDoc) : null;
}

export async function updateLetterStatus(uid: string, letterId: string, status: LetterDoc['status']): Promise<void> {
  await col(uid, 'letters').doc(letterId).update({ status });
}

export async function lettersByCid(uid: string, cid: CorrespondentId, limit = 3, correspondenceOnly = false): Promise<LetterDoc[]> {
  const query = col(uid, 'letters').where('cid', '==', cid).orderBy('createdAt', 'desc');
  if (!correspondenceOnly) {
    const snap = await query.limit(limit).get();
    return snap.docs.map((d) => d.data() as LetterDoc);
  }
  // Entry reflections must not advance the correspondence cursor or become
  // implicit memory. Paginate using the existing cid/createdAt index.
  const letters: LetterDoc[] = [];
  let cursor: FirebaseFirestore.QueryDocumentSnapshot | undefined;
  while (letters.length < limit) {
    const page = await (cursor ? query.startAfter(cursor) : query).limit(30).get();
    for (const doc of page.docs) {
      const letter = doc.data() as LetterDoc;
      if (!letter.reflection) letters.push(letter);
    }
    if (page.size < 30) break;
    cursor = page.docs[page.docs.length - 1];
  }
  return letters.slice(0, limit);
}

export async function recentLetters(uid: string, limit = 30): Promise<LetterDoc[]> {
  const snap = await col(uid, 'letters').orderBy('createdAt', 'desc').limit(limit).get();
  return snap.docs.map((d) => d.data() as LetterDoc);
}

export async function lastLetterAt(uid: string, cid: CorrespondentId): Promise<string | null> {
  const letters = await lettersByCid(uid, cid, 1, true);
  return letters[0]?.createdAt ?? null;
}

// ---- replies ----

export async function addReply(uid: string, reply: ReplyDoc): Promise<void> {
  await col(uid, 'replies').doc(reply.id).set(stripUndefined(reply));
}

export async function repliesForLetter(uid: string, letterId: string): Promise<ReplyDoc[]> {
  const snap = await col(uid, 'replies').where('letterId', '==', letterId).orderBy('createdAt', 'asc').get();
  return snap.docs.map((d) => d.data() as ReplyDoc);
}

export async function getRepliesByIds(uid: string, ids: string[]): Promise<ReplyDoc[]> {
  if (ids.length === 0) return [];
  const unique = [...new Set(ids)];
  const out: ReplyDoc[] = [];
  for (let i = 0; i < unique.length; i += 10) {
    const chunk = unique.slice(i, i + 10);
    const snap = await col(uid, 'replies').where('__name__', 'in', chunk).get();
    for (const d of snap.docs) out.push(d.data() as ReplyDoc);
  }
  return out;
}

export async function unprocessedReplies(uid: string, cid: CorrespondentId): Promise<ReplyDoc[]> {
  const snap = await col(uid, 'replies').where('cid', '==', cid).where('processed', '==', false).get();
  return snap.docs.map((d) => d.data() as ReplyDoc).sort((a, b) => a.createdAt.localeCompare(b.createdAt));
}

export async function markRepliesProcessed(uid: string, replyIds: string[]): Promise<void> {
  if (replyIds.length === 0) return;
  const batch = adminDb.batch();
  for (const id of replyIds) batch.update(col(uid, 'replies').doc(id), { processed: true });
  await batch.commit();
}

// ---- cycles ----

export async function getCycle(uid: string, cycleId: string): Promise<CycleDoc | null> {
  const snap = await col(uid, 'cycles').doc(cycleId).get();
  return snap.exists ? (snap.data() as CycleDoc) : null;
}

export type CycleClaim =
  | { status: 'created'; existing: null }
  | { status: 'composing' | 'delivered' | 'failed'; existing: CycleDoc };

// Atomic claim of a cycle id (one Firestore transaction — concurrent claims
// serialize, so two simultaneous requests can never both "create" it):
//   created   — the doc did not exist; it now does, in state composing.
//   composing — someone already owns it (in progress, or stale and resumable).
//   delivered — done; never re-deliver.
//   failed    — a previous attempt failed; the claim flips it back to composing
//               so the caller may retry (the retry overwrites its own letters).
export async function claimCycle(uid: string, cycle: CycleDoc): Promise<CycleClaim> {
  const ref = col(uid, 'cycles').doc(cycle.id);
  return adminDb.runTransaction(async (tx) => {
    const snap = await tx.get(ref);
    if (!snap.exists) {
      tx.set(ref, stripUndefined(cycle));
      return { status: 'created', existing: null } as CycleClaim;
    }
    const existing = snap.data() as CycleDoc;
    if (existing.state === 'failed') {
      tx.set(
        ref,
        stripUndefined({
          state: 'composing',
          updatedAt: nowIso(),
          notes: [...(existing.notes ?? []).slice(-6), `retry: ${nowIso()}`],
        }),
        { merge: true },
      );
    }
    return { status: existing.state, existing } as CycleClaim;
  });
}


// Create-only (precondition: must not exist). Used by seeds and tests; the
// pipeline and routes go through claimCycle so a failed cycle can be retried.
export async function createCycle(uid: string, cycle: CycleDoc): Promise<boolean> {
  try {
    await col(uid, 'cycles').doc(cycle.id).create(stripUndefined(cycle));
    return true;
  } catch (e) {
    if ((e as { code?: number }).code === 6) return false; // ALREADY_EXISTS
    throw e;
  }
}

export async function updateCycle(uid: string, cycleId: string, patch: Partial<CycleDoc>): Promise<void> {
  await col(uid, 'cycles').doc(cycleId).set(stripUndefined({ ...patch, updatedAt: nowIso() }), { merge: true });
}

export async function composingCycles(uid: string): Promise<CycleDoc[]> {
  const snap = await col(uid, 'cycles').where('state', '==', 'composing').orderBy('createdAt', 'desc').limit(5).get();
  return snap.docs.map((d) => d.data() as CycleDoc);
}

export async function recentCycles(uid: string, limit = 12): Promise<CycleDoc[]> {
  const snap = await col(uid, 'cycles').orderBy('createdAt', 'desc').limit(limit).get();
  return snap.docs.map((d) => d.data() as CycleDoc);
}

export async function requestedCyclesToday(uid: string, cid: CorrespondentId): Promise<CycleDoc[]> {
  const dayStart = new Date();
  dayStart.setUTCHours(0, 0, 0, 0);
  const snap = await col(uid, 'cycles')
    .where('kind', '==', 'requested')
    .where('createdAt', '>=', dayStart.toISOString())
    .get();
  return snap.docs.map((d) => d.data() as CycleDoc).filter((c) => !c.reflection && (c.deliveredCids?.includes(cid) || c.id.includes(cid)));
}

// ---- export / delete ----

export async function exportSubtree(uid: string): Promise<Record<string, unknown>> {
  const out: Record<string, unknown> = { exportedAt: nowIso(), profile: null, notebook: [], replies: [], letters: [], cycles: [], correspondents: [] };
  const profile = await getProfile(uid);
  out.profile = profile;
  const simple = ['notebook', 'replies', 'letters', 'cycles'] as const;
  for (const name of simple) {
    const snap = await col(uid, name).orderBy('createdAt', 'asc').get().catch(async () => {
      const s2 = await col(uid, name).get();
      return s2;
    });
    out[name] = snap.docs.map((d) => ({ id: d.id, ...d.data() }));
  }
  const correspondents = await listCorrespondents(uid);
  out.correspondents = await Promise.all(
    correspondents.map(async (c) => ({ ...c, memory: await listMemoryVersions(uid, c.cid) })),
  );
  return out;
}

export async function cascadeDelete(uid: string): Promise<void> {
  // BFS delete of the whole users/{uid} subtree (documents then collections).
  const queue: FirebaseFirestore.DocumentReference[] = [userDoc(uid)];
  while (queue.length > 0) {
    const ref = queue.shift()!;
    const cols = await ref.listCollections();
    for (const c of cols) {
      const snap = await c.get();
      for (const d of snap.docs) queue.push(d.ref);
      // batch-delete the documents we just listed
      for (let i = 0; i < snap.docs.length; i += 400) {
        const batch = adminDb.batch();
        for (const d of snap.docs.slice(i, i + 400)) batch.delete(d.ref);
        await batch.commit();
      }
    }
    await ref.delete();
  }
}

export { FieldValue };

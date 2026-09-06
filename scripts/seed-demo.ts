// Seed the demo archive (fixtures/demo-archive.json) into the local emulator
// so the Desk/Study render richly (spec §11). Idempotent: re-running replaces
// the demo user's data. The emulator must be running (npm run dev first).
//   npm run seed:demo
// Sign in with the demo user via the emulator sign-in form ("Demo Reader").
import { readFileSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';
import { loadEnvLocal } from '../src/server/env.js';
import type { CorrespondentId, CycleDoc, LetterGenre, LetterStatus, MemoryDoc, ReplyIntent } from '../src/shared/schemas.js';

loadEnvLocal();

const { adminAuth, adminDb } = await import('../src/server/firebase.js');
const store = await import('../src/server/store.js');

interface Archive {
  user: { uid: string; displayName: string; email: string; tz: string };
  entries: { id: string; date: string; body: string }[];
  cycles: { id: string; kind: CycleDoc['kind']; state: CycleDoc['state']; date: string; deliveredCids: CorrespondentId[] }[];
  letters: {
    id: string;
    cid: CorrespondentId;
    cycleId: string;
    genre: LetterGenre;
    status: LetterStatus;
    date: string;
    salutation: string;
    bodyMd: string;
    groundingRefs: { entryId: string; quotedPhrase: string }[];
    extrapolationNote?: string;
    exercise?: string;
  }[];
  replies: { id: string; letterId: string; cid: CorrespondentId; date: string; body: string; intents: ReplyIntent[]; processed: boolean }[];
  memory: ({ cid: CorrespondentId; date: string } & Omit<MemoryDoc, 'createdAt'>)[];
}

const here = dirname(fileURLToPath(import.meta.url));
const archive = JSON.parse(readFileSync(join(here, '..', 'fixtures', 'demo-archive.json'), 'utf8')) as Archive;
const uid = archive.user.uid;

async function ensureAuthUser(): Promise<void> {
  try {
    await adminAuth.getUserByEmail(archive.user.email);
  } catch {
    try {
      await adminAuth.createUser({ uid, email: archive.user.email, displayName: archive.user.displayName });
    } catch {
      // Already exists (raced with /dev/signin) — fine.
    }
  }
}

const at = (date: string, hour = 8): string => new Date(`${date}T${String(hour).padStart(2, '0')}:00:00.000Z`).toISOString();

async function main(): Promise<void> {
  await ensureAuthUser();
  await store.cascadeDelete(uid); // idempotent reseed

  await store.ensureProfile(uid, archive.user.tz);
  await store.updateProfile(uid, { onboarded: true });
  await store.ensureCorrespondents(uid);

  for (const e of archive.entries) {
    await adminDb.doc(`users/${uid}/notebook/${e.id}`).set({ id: e.id, bodyMd: e.body, createdAt: at(e.date) });
  }

  for (const c of archive.cycles) {
    await store.createCycle(uid, {
      id: c.id,
      kind: c.kind,
      state: c.state,
      createdAt: at(c.date, 6),
      notes: ['seeded fixture'],
      deliveredCids: c.deliveredCids,
    });
  }

  for (const l of archive.letters) {
    await store.createLetter(uid, {
      id: l.id,
      cid: l.cid,
      cycleId: l.cycleId,
      genre: l.genre,
      salutation: l.salutation,
      bodyMd: l.bodyMd,
      groundingRefs: l.groundingRefs.map((g) => ({
        ...g,
        entryDate: archive.entries.find((e) => e.id === g.entryId)?.date ?? l.date,
      })),
      extrapolationNote: l.extrapolationNote,
      exercise: l.exercise,
      status: l.status,
      createdAt: at(l.date, 7),
    });
  }

  for (const r of archive.replies) {
    await store.addReply(uid, {
      id: r.id,
      letterId: r.letterId,
      cid: r.cid,
      bodyMd: r.body,
      intents: r.intents,
      processed: r.processed,
      createdAt: at(r.date, 19),
    });
  }

  for (const m of archive.memory) {
    await store.appendMemoryVersion(uid, m.cid, {
      version: m.version,
      createdAt: at(m.date, 7),
      themesObserved: m.themesObserved,
      openThreads: m.openThreads,
      exercisesGiven: m.exercisesGiven,
      toneCalibration: m.toneCalibration,
      retiredItems: m.retiredItems,
      letterCount: m.letterCount,
    });
  }

  console.log('[seed:demo] seeded fixture data (FIXTURE — not real user content):');
  console.log(`  user: ${archive.user.displayName} <${archive.user.email}> (uid ${uid})`);
  console.log(`  ${archive.entries.length} entries · ${archive.letters.length} letters · ${archive.replies.length} reply · ${archive.memory.length} memory docs`);
  console.log('  One letter is left sealed so the Desk shows a waiting envelope.');
}

main().catch((e) => {
  console.error('[seed:demo] failed:', e);
  process.exitCode = 1;
});

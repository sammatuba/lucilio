// Firestore rules unit tests (spec §4). Run against the emulator:
//   npm run test:rules
// Proves for every subcollection: owner-allowed (where applicable),
// stranger-denied, unauthenticated-denied, and client-write-DENIED on all
// server-owned collections. Results are written to tests/results/ for the
// Trust Center to render.
import { readFileSync, writeFileSync, mkdirSync } from 'node:fs';
import { execSync } from 'node:child_process';
import { fileURLToPath } from 'node:url';
import { resolve } from 'node:path';
import { afterAll, beforeAll, describe, it } from 'vitest';
import {
  assertFails,
  assertSucceeds,
  initializeTestEnvironment,
  type RulesTestEnvironment,
} from '@firebase/rules-unit-testing';

const here = fileURLToPath(new URL('.', import.meta.url));
const OWNER = 'owner-ana';
const STRANGER = 'stranger-bob';
const NOW = new Date().toISOString();

let env: RulesTestEnvironment;

// Honor FIRESTORE_EMULATOR_HOST (set by scripts/run-emulated-tests.mjs to the
// dedicated test emulator). Hardcoding a port here once wiped a running dev
// emulator via clearFirestore() — never do that again.
const [emuHost = '127.0.0.1', emuPort = '8081'] = (process.env.FIRESTORE_EMULATOR_HOST ?? '').split(':');

const results: { category: string; tests: { name: string; pass: boolean }[] }[] = [];
let activeEntry: { category: string; tests: { name: string; pass: boolean }[] } | null = null;

function suite(category: string, fn: () => void): void {
  const entry = { category, tests: [] as { name: string; pass: boolean }[] };
  results.push(entry);
  describe(category, () => {
    // Vitest runs describe callbacks deferred, after every suite has registered.
    // Bind the owning entry synchronously around fn() so check() attributes to
    // the right category no matter when collection happens.
    const prev = activeEntry;
    activeEntry = entry;
    try {
      fn();
    } finally {
      activeEntry = prev;
    }
  });
}

function check(name: string, fn: () => Promise<unknown>): void {
  const target = activeEntry;
  it(name, async () => {
    let pass = true;
    try {
      await fn();
    } catch (e) {
      pass = false;
      throw e;
    } finally {
      target?.tests.push({ name, pass });
    }
  });
}

const paths = {
  profile: (uid: string) => `users/${uid}/profile/main`,
  entry: (uid: string) => `users/${uid}/notebook/e1`,
  reply: (uid: string) => `users/${uid}/replies/r1`,
  letter: (uid: string) => `users/${uid}/letters/l1`,
  cycle: (uid: string) => `users/${uid}/cycles/c1`,
  correspondent: (uid: string) => `users/${uid}/correspondents/director`,
  memory: (uid: string) => `users/${uid}/correspondents/director/memory/0001`,
  exportDoc: (uid: string) => `users/${uid}/exports/x1`,
};

beforeAll(async () => {
  env = await initializeTestEnvironment({
    projectId: 'lucilio-dev',
    firestore: {
      rules: readFileSync(resolve(here, '../../firestore.rules'), 'utf8'),
      host: emuHost || '127.0.0.1',
      port: Number(emuPort || 8081),
    },
  });
  // Seed existing documents as admin so read/update/delete tests operate on
  // real data — a denial must come from the rules, not a missing doc.
  await env.withSecurityRulesDisabled(async (ctx) => {
    const db = ctx.firestore();
    await db.doc(paths.profile(OWNER)).set({ tz: 'UTC', postDay: 'sunday', onboarded: true });
    await db.doc(paths.entry(OWNER)).set({ bodyMd: 'seeded entry', createdAt: NOW });
    await db.doc(paths.reply(OWNER)).set({ letterId: 'l1', cid: 'director', bodyMd: 'seeded reply', intents: ['respond'], processed: false, createdAt: NOW });
    await db.doc(paths.letter(OWNER)).set({ cid: 'director', cycleId: 'c1', genre: 'hortatoria', salutation: 'Dear friend,', bodyMd: 'seeded letter', groundingRefs: [], status: 'sealed', createdAt: NOW });
    await db.doc(paths.cycle(OWNER)).set({ kind: 'scheduled', state: 'delivered', notes: [], createdAt: NOW });
    await db.doc(paths.correspondent(OWNER)).set({ cid: 'director', cardVersion: 1, status: 'active', activatedAt: NOW });
    await db.doc(paths.memory(OWNER)).set({ version: 1, createdAt: NOW, themesObserved: [], openThreads: [], exercisesGiven: [], toneCalibration: '', retiredItems: [], letterCount: 1 });
    await db.doc(paths.exportDoc(OWNER)).set({ createdAt: NOW, collections: [] });
  });
});

afterAll(async () => {
  await env.clearFirestore().catch(() => undefined);
  await env.cleanup();
  const total = results.flatMap((c) => c.tests).length;
  const passed = results.flatMap((c) => c.tests).filter((t) => t.pass).length;
  mkdirSync(resolve(here, '../results'), { recursive: true });
  writeFileSync(
    resolve(here, '../results/rules-results.json'),
    JSON.stringify(
      {
        generatedAt: new Date().toISOString(),
        // Provenance: which commit this evidence was made at (Trust Center
        // renders it alongside the age, so a stale snapshot is visible).
        gitSha: (() => {
          try {
            return execSync('git rev-parse --short HEAD', { cwd: resolve(here, '../..'), encoding: 'utf8' }).trim() || null;
          } catch {
            return null;
          }
        })(),
        framework: '@firebase/rules-unit-testing against the Firestore emulator',
        total,
        passed,
        failed: total - passed,
        categories: results.map((c) => ({
          category: c.category,
          passed: c.tests.filter((t) => t.pass).length,
          total: c.tests.length,
          tests: c.tests,
        })),
      },
      null,
      2,
    ),
  );
});

const owner = () => env.authenticatedContext(OWNER).firestore();
const stranger = () => env.authenticatedContext(STRANGER).firestore();
const anon = () => env.unauthenticatedContext().firestore();

// ---- profile & notebook: owner read/write, stranger/unauth denied ----

suite('profile (client-writable, owner only)', () => {
  check('owner can read', () => assertSucceeds(owner().doc(paths.profile(OWNER)).get()));
  check('owner can write', () => assertSucceeds(owner().doc(paths.profile(OWNER)).set({ tz: 'UTC', postDay: 'sunday', onboarded: true })));
  check('stranger cannot read', () => assertFails(stranger().doc(paths.profile(OWNER)).get()));
  check('stranger cannot write', () => assertFails(stranger().doc(paths.profile(OWNER)).set({ onboarded: false })));
  check('unauthenticated cannot read', () => assertFails(anon().doc(paths.profile(OWNER)).get()));
  check('unauthenticated cannot write', () => assertFails(anon().doc(paths.profile(OWNER)).set({ onboarded: false })));
});

suite('notebook (client-writable, owner only)', () => {
  check('owner can read', () => assertSucceeds(owner().doc(paths.entry(OWNER)).get()));
  check('owner can create', () => assertSucceeds(owner().doc(`users/${OWNER}/notebook/e2`).set({ bodyMd: 'hello', createdAt: NOW })));
  check('owner can update', () => assertSucceeds(owner().doc(paths.entry(OWNER)).update({ bodyMd: 'edited' })));
  check('owner can delete', () => assertSucceeds(owner().doc(paths.entry(OWNER)).delete()));
  check('stranger cannot read', () => assertFails(stranger().doc(paths.entry(OWNER)).get()));
  check('stranger cannot write', () => assertFails(stranger().doc(paths.entry(OWNER)).set({ bodyMd: 'x' })));
  check('unauthenticated cannot read', () => assertFails(anon().doc(paths.entry(OWNER)).get()));
  check('unauthenticated cannot write', () => assertFails(anon().doc(paths.entry(OWNER)).set({ bodyMd: 'x' })));
});

// ---- replies: owner read + create only; no update/delete ever ----

suite('replies (create-only, immutable)', () => {
  check('owner can read', () => assertSucceeds(owner().doc(paths.reply(OWNER)).get()));
  check('owner can create', () =>
    assertSucceeds(owner().doc(`users/${OWNER}/replies/r2`).set({ letterId: 'l1', cid: 'director', bodyMd: 'thanks', intents: ['respond'], processed: false, createdAt: NOW })));
  check('owner CANNOT update', () => assertFails(owner().doc(paths.reply(OWNER)).update({ processed: true })));
  check('owner CANNOT delete', () => assertFails(owner().doc(paths.reply(OWNER)).delete()));
  check('stranger cannot read', () => assertFails(stranger().doc(paths.reply(OWNER)).get()));
  check('stranger cannot create', () => assertFails(stranger().doc(paths.reply(OWNER)).set({ bodyMd: 'x' })));
  check('unauthenticated cannot read', () => assertFails(anon().doc(paths.reply(OWNER)).get()));
  check('unauthenticated cannot create', () => assertFails(anon().doc(paths.reply(OWNER)).set({ bodyMd: 'x' })));
});

// ---- server-owned collections: read-only for owner, writes denied for ALL ----

function serverOwnedSuite(label: string, pathFor: (uid: string) => string, sample: Record<string, unknown>): void {
  suite(`${label} (server-owned: client writes denied)`, () => {
    check('owner can read', () => assertSucceeds(owner().doc(pathFor(OWNER)).get()));
    check('owner CANNOT write', () => assertFails(owner().doc(pathFor(OWNER)).set(sample)));
    check('owner CANNOT update', () => assertFails(owner().doc(pathFor(OWNER)).update({ status: 'opened' })));
    check('owner CANNOT delete', () => assertFails(owner().doc(pathFor(OWNER)).delete()));
    check('stranger cannot read', () => assertFails(stranger().doc(pathFor(OWNER)).get()));
    check('stranger cannot write', () => assertFails(stranger().doc(pathFor(OWNER)).set(sample)));
    check('unauthenticated cannot read', () => assertFails(anon().doc(pathFor(OWNER)).get()));
    check('unauthenticated cannot write', () => assertFails(anon().doc(pathFor(OWNER)).set(sample)));
  });
}

serverOwnedSuite('letters', paths.letter, { cid: 'director', bodyMd: 'x', status: 'sealed' });
serverOwnedSuite('cycles', paths.cycle, { kind: 'scheduled', state: 'composing' });
serverOwnedSuite('correspondents', paths.correspondent, { status: 'active', cardVersion: 1 });
serverOwnedSuite('correspondent memory', paths.memory, { version: 2, themesObserved: [] });
serverOwnedSuite('exports', paths.exportDoc, { createdAt: NOW });

// ---- default deny everywhere else ----

suite('default deny', () => {
  check('unauthenticated cannot list users', () => assertFails(anon().collection('users').get()));
  check('owner cannot read another user subtree root', () => assertFails(owner().doc(`users/${STRANGER}`).get()));
});

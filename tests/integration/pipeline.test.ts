// Pipeline integration tests (spec §10.3 + §10.4) against the Firestore
// emulator with a MOCKED Gemini layer (dependency injection):
//  - failure isolation (one correspondent fails → others deliver)
//  - grounding validation rejects fake entryIds
//  - Future Self without extrapolationNote is rejected
//  - cycle idempotency (same cycleId twice → delivers once)
import { afterAll, beforeAll, describe, expect, it } from 'vitest';
import type { CorrespondentId } from '../../src/shared/schemas.js';
import { setPipelineDeps, runCycle, type PipelineDeps } from '../../src/server/pipeline.js';
import * as store from '../../src/server/store.js';
import type { LetterOutput } from '../../src/server/contracts.js';

const UID = 'pipeline-test-user';

function goodLetter(entryId: string, phrase: string, cid: CorrespondentId): LetterOutput {
  return {
    genre: cid === 'foreign' ? 'dispatch' : 'hortatoria',
    salutation: 'Dear friend,',
    bodyMd: 'A grounded letter about your week.',
    groundingRefs: [{ entryId, quotedPhrase: phrase }],
    extrapolationNote: cid === 'future_self' ? 'Extrapolated from your entries.' : undefined,
  };
}

async function seedUser(uid: string, entryBody: string): Promise<string> {
  await store.ensureProfile(uid, 'UTC');
  await store.ensureCorrespondents(uid);
  const entry = await store.addEntry(uid, entryBody);
  return entry.id;
}

afterAll(async () => {
  setPipelineDeps(null);
  await store.cascadeDelete(UID).catch(() => undefined);
  await store.cascadeDelete('iso-user').catch(() => undefined);
});

describe('failure isolation', () => {
  it('one correspondent failing does not block the others', async () => {
    const entryId = await seedUser(UID, 'I have been thinking about patience this week.');
    const phrase = 'thinking about patience';

    const deps: PipelineDeps = {
      async compose(cid, ctx) {
        if (cid === 'director') throw new Error('simulated compose failure');
        return goodLetter(entryId, phrase, cid);
      },
      async judge() {
        return { pass: true, violations: [] };
      },
      async consolidate() {
        return { themesObserved: [{ theme: 'patience', evidence: phrase, trend: 'new' as const }], openThreads: [] };
      },
      async extractIntents() {
        return { intents: ['respond'] as ('respond')[] };
      },
    };
    setPipelineDeps(deps);

    const result = await runCycle(UID, { kind: 'scheduled', cycleId: 'iso-cycle-1' });
    expect(result.delivered.sort()).toEqual(['foreign', 'future_self']);
    expect(result.degraded).toHaveLength(1);
    expect(result.degraded[0]!.cid).toBe('director');

    const cycle = await store.getCycle(UID, 'iso-cycle-1');
    expect(cycle?.state).toBe('delivered');
    expect(cycle?.notes?.some((n) => n.includes('degraded'))).toBe(true);

    // The two healthy correspondents really delivered sealed letters.
    const fs = await store.lettersByCid(UID, 'future_self', 1);
    const fo = await store.lettersByCid(UID, 'foreign', 1);
    expect(fs[0]?.status).toBe('sealed');
    expect(fo[0]?.status).toBe('sealed');
    const di = await store.lettersByCid(UID, 'director', 1);
    expect(di.length).toBe(0);
  });

  it('cycle idempotency: re-running the same cycleId delivers once', async () => {
    const before = (await store.recentLetters(UID, 50)).length;
    const second = await runCycle(UID, { kind: 'scheduled', cycleId: 'iso-cycle-1' });
    const after = (await store.recentLetters(UID, 50)).length;
    expect(after).toBe(before);
    expect(second.delivered).toEqual(expect.arrayContaining(['foreign', 'future_self'])); // reports prior delivery
  });
});

describe('grounding and extrapolation enforcement', () => {
  it('rejects a letter citing an entryId never sent in the context', async () => {
    const uid = 'iso-user';
    await seedUser(uid, 'A quiet week, mostly reading.');

    let composeCalls = 0;
    const deps: PipelineDeps = {
      async compose(cid) {
        composeCalls++;
        // Always cites a fabricated entry — even on recompose.
        return goodLetter('FAKE-ENTRY-ID', 'fabricated quote', cid);
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
    setPipelineDeps(deps);

    const result = await runCycle(uid, { kind: 'requested', cycleId: 'req-grounding', only: 'director' });
    expect(result.delivered).toEqual([]);
    expect(result.degraded).toHaveLength(1);
    expect(result.degraded[0]!.reason).toMatch(/FAKE-ENTRY-ID|grounding|safety/);
    expect(composeCalls).toBe(2); // composed, failed validation, recomposed, failed again → skipped
    const cycle = await store.getCycle(uid, 'req-grounding');
    expect(cycle?.state).toBe('failed');
  });

  it('rejects a Future Self letter missing extrapolationNote', async () => {
    const uid = 'iso-user';
    const deps: PipelineDeps = {
      async compose(cid, ctx) {
        const entryId = [...ctx.contextEntryIds][0] ?? 'e';
        const letter = goodLetter(entryId, 'mostly reading', cid);
        if (cid === 'future_self') delete letter.extrapolationNote;
        return letter;
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
    setPipelineDeps(deps);

    const result = await runCycle(uid, { kind: 'requested', cycleId: 'req-extrap', only: 'future_self' });
    expect(result.delivered).toEqual([]);
    expect(result.degraded[0]!.reason).toMatch(/extrapolation/i);
  });

  it('a passing SafetyReview verdict delivers; a failing verdict recomposes then skips', async () => {
    const uid = 'iso-user';
    let verdict: { pass: boolean; violations: string[] } = { pass: false, violations: ['simulated longing detected'] };
    const deps: PipelineDeps = {
      async compose(cid, ctx) {
        const entryId = [...ctx.contextEntryIds][0] ?? 'e';
        return goodLetter(entryId, 'mostly reading', cid);
      },
      async judge() {
        return verdict;
      },
      async consolidate() {
        return { themesObserved: [], openThreads: [] };
      },
      async extractIntents() {
        return { intents: ['respond'] as ('respond')[] };
      },
    };
    setPipelineDeps(deps);

    const failed = await runCycle(uid, { kind: 'requested', cycleId: 'req-judge-fail', only: 'foreign' });
    expect(failed.delivered).toEqual([]);
    expect(failed.degraded[0]!.reason).toMatch(/longing|safety/);

    verdict = { pass: true, violations: [] };
    const passed = await runCycle(uid, { kind: 'requested', cycleId: 'req-judge-pass', only: 'foreign' });
    expect(passed.delivered).toEqual(['foreign']);
  });
});

describe('concluding cycle', () => {
  it('delivers a final letter and flips the correspondent to concluded', async () => {
    const uid = 'iso-user';
    const deps: PipelineDeps = {
      async compose(cid, ctx) {
        const entryId = [...ctx.contextEntryIds][0] ?? 'e';
        return { ...goodLetter(entryId, 'mostly reading', cid), genre: 'final' as const };
      },
      async judge() {
        return { pass: true, violations: [] };
      },
      async consolidate() {
        return { themesObserved: [], openThreads: [] };
      },
      async extractIntents() {
        return { intents: ['conclude'] as ('conclude')[] };
      },
    };
    setPipelineDeps(deps);

    const result = await runCycle(uid, { kind: 'concluding', cycleId: 'concl-director', only: 'director' });
    expect(result.delivered).toEqual(['director']);
    const correspondent = await store.getCorrespondent(uid, 'director');
    expect(correspondent?.status).toBe('concluded');
    const finalLetter = await store.lettersByCid(uid, 'director', 1);
    expect(finalLetter[0]?.status).toBe('final');
  });
});

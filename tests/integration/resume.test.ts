// Stuck-cycle resume and retry (roadmap M1-2) against the Firestore emulator
// with a mocked Gemini layer:
//  - a cycle stranded in `composing` is resumed by the sweep, and only the
//    correspondents who had NOT delivered are composed (an opened letter is
//    never silently replaced)
//  - a fresh composing cycle is left alone (not yet stale)
//  - a stale requested/concluding cycle resumes only its own correspondent
//  - a failed cycle can be reclaimed and retried; the retry delivers
//  - degradedCids is recorded so the Desk can say what did not come through
import { afterAll, beforeAll, beforeEach, describe, expect, it } from 'vitest';
import type { CorrespondentId } from '../../src/shared/schemas.js';
import { resumeStaleCycles, runCycle, setPipelineDeps, type PipelineDeps } from '../../src/server/pipeline.js';
import * as store from '../../src/server/store.js';
import { adminDb } from '../../src/server/firebase.js';
import type { LetterOutput } from '../../src/server/contracts.js';

const UID = 'resume-test-user';

function okDeps(fail: (cid: CorrespondentId) => boolean = () => false): PipelineDeps & { composed: CorrespondentId[] } {
  const composed: CorrespondentId[] = [];
  return {
    composed,
    async compose(cid, ctx): Promise<LetterOutput> {
      composed.push(cid);
      if (fail(cid)) throw new Error(`simulated failure for ${cid}`);
      const entryId = [...ctx.contextEntryIds][0]!;
      return {
        genre: cid === 'foreign' ? 'dispatch' : 'hortatoria',
        salutation: 'Dear friend,',
        bodyMd: `A letter for ${cid}.`,
        groundingRefs: [{ entryId, quotedPhrase: 'walked anyway' }],
        extrapolationNote: cid === 'future_self' ? 'Extrapolated from your entries.' : undefined,
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
}

beforeAll(async () => {
  await store.ensureProfile(UID, 'UTC');
  await store.ensureCorrespondents(UID);
});

// Context only carries entries newer than the correspondent's last letter, so
// every run needs a fresh entry to cite — exactly as a real week would.
beforeEach(async () => {
  await store.addEntry(UID, 'Slept badly, walked anyway.');
});

afterAll(async () => {
  setPipelineDeps(null);
  await store.cascadeDelete(UID).catch(() => undefined);
});

describe('stuck-cycle sweep', () => {
  it('records degradedCids when a correspondent fails', async () => {
    setPipelineDeps(okDeps((cid) => cid === 'foreign'));

    const result = await runCycle(UID, { kind: 'scheduled', cycleId: 'res-degraded' });
    expect(result.delivered.sort()).toEqual(['director', 'future_self']);
    const cycle = await store.getCycle(UID, 'res-degraded');
    expect(cycle?.state).toBe('delivered');
    expect(cycle?.degradedCids).toEqual(['foreign']);
  });

  it('resumes a stale composing cycle and leaves an already-delivered letter untouched', async () => {
    const twentyMinutesAgo = new Date(Date.now() - 20 * 60_000).toISOString();
    // A cycle that died mid-flight: director delivered (and the reader opened
    // the letter), the other two never composed.
    expect(
      await store.createCycle(UID, {
        id: 'res-stale',
        kind: 'scheduled',
        state: 'composing',
        createdAt: twentyMinutesAgo,
        updatedAt: twentyMinutesAgo,
        notes: ['personas-test'],
        deliveredCids: ['director'],
      }),
    ).toBe(true);
    await store.createLetter(UID, {
      id: 'res-stale-director',
      cid: 'director',
      cycleId: 'res-stale',
      genre: 'hortatoria',
      salutation: 'Dear friend,',
      bodyMd: 'The letter the reader already opened.',
      groundingRefs: [],
      status: 'opened',
      createdAt: twentyMinutesAgo,
    });

    const deps = okDeps();
    setPipelineDeps(deps);
    const swept = await resumeStaleCycles(UID);
    expect(swept.resumed).toEqual(['res-stale']);
    expect(deps.composed.sort()).toEqual(['foreign', 'future_self']); // director NOT recomposed

    const cycle = await store.getCycle(UID, 'res-stale');
    expect(cycle?.state).toBe('delivered');
    expect(cycle?.deliveredCids?.sort()).toEqual(['director', 'foreign', 'future_self']);

    const director = await store.getLetter(UID, 'res-stale-director');
    expect(director?.status).toBe('opened');
    expect(director?.bodyMd).toBe('The letter the reader already opened.');
    expect((await store.getLetter(UID, 'res-stale-foreign'))?.status).toBe('sealed');
  });

  it('leaves a fresh composing cycle alone', async () => {
    await store.createCycle(UID, {
      id: 'res-fresh',
      kind: 'requested',
      state: 'composing',
      createdAt: new Date().toISOString(),
      notes: [],
      deliveredCids: [],
    });
    const deps = okDeps();
    setPipelineDeps(deps);
    const swept = await resumeStaleCycles(UID);
    expect(swept.resumed).not.toContain('res-fresh');
    expect(deps.composed).toEqual([]);
    expect((await store.getCycle(UID, 'res-fresh'))?.state).toBe('composing');
    await store.updateCycle(UID, 'res-fresh', { state: 'delivered' }); // tidy for later sweeps
  });

  it('a stale requested cycle resumes only its own correspondent', async () => {
    const old = new Date(Date.now() - 60 * 60_000).toISOString();
    await store.createCycle(UID, {
      id: 'req-future_self-2026-01-04',
      kind: 'requested',
      state: 'composing',
      createdAt: old,
      updatedAt: old,
      notes: [],
      deliveredCids: [],
    });
    const deps = okDeps();
    setPipelineDeps(deps);
    const swept = await resumeStaleCycles(UID);
    expect(swept.resumed).toEqual(['req-future_self-2026-01-04']);
    expect(deps.composed).toEqual(['future_self']);
    expect((await store.getLetter(UID, 'req-future_self-2026-01-04-future_self'))?.status).toBe('sealed');
  });

  it('chaos: a compose that never resolves strands the cycle; the sweep completes it', async () => {
    // An instance death mid-compose, literally: the call neither resolves nor
    // rejects, and nothing is killed.
    const hung = {
      ...okDeps(),
      async compose(): Promise<LetterOutput> {
        return new Promise<LetterOutput>(() => undefined);
      },
    };
    setPipelineDeps(hung);

    // Start the cycle the way the routes do: claim synchronously, then launch
    // the fire-and-forget run and abandon its promise (never awaited). The id
    // encodes its correspondent the way real request-cycle ids do.
    await store.claimCycle(UID, {
      id: 'req-director-2026-01-06',
      kind: 'requested',
      state: 'composing',
      createdAt: new Date().toISOString(),
      notes: [],
      deliveredCids: [],
    });
    void runCycle(UID, { kind: 'requested', cycleId: 'req-director-2026-01-06', only: 'director' }).catch(() => undefined);
    await new Promise((r) => setTimeout(r, 50)); // let the abandoned run reach its hang
    expect((await store.getCycle(UID, 'req-director-2026-01-06'))?.state).toBe('composing');

    // Age the stranded doc past the sweep threshold — directly through the
    // admin SDK, because store.updateCycle stamps updatedAt itself.
    const old = new Date(Date.now() - 20 * 60_000).toISOString();
    await adminDb
      .collection(`users/${UID}/cycles`)
      .doc('req-director-2026-01-06')
      .set({ updatedAt: old }, { merge: true });

    // The sweep finds it and resumes with healthy deps; the first compose
    // never settles, so the abandoned run stays abandoned and cannot double-
    // deliver (deterministic letter ids + the delivered-cycle claim guard).
    const deps = okDeps();
    setPipelineDeps(deps);
    const swept = await resumeStaleCycles(UID);
    expect(swept.resumed).toContain('req-director-2026-01-06');
    expect(deps.composed).toEqual(['director']);

    const cycle = await store.getCycle(UID, 'req-director-2026-01-06');
    expect(cycle?.state).toBe('delivered');
    expect((await store.getLetter(UID, 'req-director-2026-01-06-director'))?.status).toBe('sealed');
  });
});

describe('failed-cycle retry', () => {
  it('claimCycle flips a failed cycle back to composing and the retry delivers', async () => {
    setPipelineDeps(okDeps(() => true)); // everything fails
    const failed = await runCycle(UID, { kind: 'requested', cycleId: 'req-director-2026-01-05', only: 'director' });
    expect(failed.delivered).toEqual([]);
    expect((await store.getCycle(UID, 'req-director-2026-01-05'))?.state).toBe('failed');

    const claim = await store.claimCycle(UID, {
      id: 'req-director-2026-01-05',
      kind: 'requested',
      state: 'composing',
      createdAt: new Date().toISOString(),
      notes: [],
      deliveredCids: [],
    });
    expect(claim.status).toBe('failed');
    expect((await store.getCycle(UID, 'req-director-2026-01-05'))?.state).toBe('composing');

    setPipelineDeps(okDeps());
    const retried = await runCycle(UID, { kind: 'requested', cycleId: 'req-director-2026-01-05', only: 'director' });
    expect(retried.delivered).toEqual(['director']);
    const cycle = await store.getCycle(UID, 'req-director-2026-01-05');
    expect(cycle?.state).toBe('delivered');
    expect(cycle?.degradedCids).toEqual([]);
  });

  it('a delivered cycle is never re-claimed as composing', async () => {
    const claim = await store.claimCycle(UID, {
      id: 'req-director-2026-01-05',
      kind: 'requested',
      state: 'composing',
      createdAt: new Date().toISOString(),
      notes: [],
      deliveredCids: [],
    });
    expect(claim.status).toBe('delivered');
    expect((await store.getCycle(UID, 'req-director-2026-01-05'))?.state).toBe('delivered');
  });
});

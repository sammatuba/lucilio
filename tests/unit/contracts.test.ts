// Pure unit tests for Gemini contracts and memory merging — no emulator.
import { describe, expect, it } from 'vitest';
import { letterOutputSchema, validateLetter, type LetterOutput } from '../../src/server/contracts.js';
import { mergeMemory } from '../../src/server/pipeline.js';
import type { MemoryDoc } from '../../src/shared/schemas.js';

const baseLetter: LetterOutput = {
  genre: 'hortatoria',
  salutation: 'Dear friend,',
  bodyMd: 'A letter.',
  groundingRefs: [{ entryId: 'e1', quotedPhrase: 'something I wrote' }],
};

const ctx = {
  cid: 'director' as const,
  contextEntryIds: new Set(['e1', 'e2']),
  contextReplyIds: new Set(['r1']),
  entryTextById: new Map([
    ['e1', 'Today I noticed something I wrote last week still bothers me.'],
    ['e2', 'A quieter day. Mostly reading.'],
  ]),
  replyTextById: new Map([['r1', 'Thank you for the letter — what you told me about patience landed.']]),
};

describe('validateLetter', () => {
  it('accepts a letter whose groundingRefs exist in the sent context', () => {
    const r = validateLetter(baseLetter, ctx);
    expect(r.ok).toBe(true);
  });

  it('rejects a letter citing an entryId that was never in the context', () => {
    const r = validateLetter(
      { ...baseLetter, groundingRefs: [{ entryId: 'FAKE', quotedPhrase: 'x' }] },
      ctx,
    );
    expect(r.ok).toBe(false);
    expect(r.violations.join(' ')).toContain('FAKE');
  });

  it('accepts a reply citation when the reply was in the context', () => {
    const r = validateLetter(
      { ...baseLetter, groundingRefs: [{ replyId: 'r1', quotedPhrase: 'what you told me' }] },
      ctx,
    );
    expect(r.ok).toBe(true);
  });

  it('rejects a reply citation to a reply that was never in the context', () => {
    const r = validateLetter(
      { ...baseLetter, groundingRefs: [{ replyId: 'FAKE-REPLY', quotedPhrase: 'x' }] },
      ctx,
    );
    expect(r.ok).toBe(false);
    expect(r.violations.join(' ')).toContain('FAKE-REPLY');
  });

  it('rejects a Future Self letter without extrapolationNote', () => {
    const r = validateLetter(baseLetter, { ...ctx, cid: 'future_self' });
    expect(r.ok).toBe(false);
    expect(r.violations.join(' ')).toMatch(/extrapolation/i);
  });

  it('exempts a crisis resources letter from the extrapolation requirement', () => {
    const r = validateLetter({ ...baseLetter, genre: 'resources' }, { ...ctx, cid: 'future_self' });
    expect(r.ok).toBe(true);
  });

  it('accepts a Future Self letter WITH extrapolationNote', () => {
    const r = validateLetter(
      { ...baseLetter, extrapolationNote: 'Extrapolated from your entries, not a prediction.' },
      { ...ctx, cid: 'future_self' },
    );
    expect(r.ok).toBe(true);
  });

  it('rejects a letter with no grounding at all', () => {
    const r = validateLetter({ ...baseLetter, groundingRefs: [] }, ctx);
    expect(r.ok).toBe(false);
  });

  it('rejects a fabricated quote: the entryId exists but the phrase was never written', () => {
    const r = validateLetter(
      { ...baseLetter, groundingRefs: [{ entryId: 'e1', quotedPhrase: 'I have decided to move to Lisbon' }] },
      ctx,
    );
    expect(r.ok).toBe(false);
    expect(r.violations.join(' ')).toMatch(/quotedPhrase not found/);
  });

  it('accepts a quote that differs only in case, whitespace, and typography', () => {
    const r = validateLetter(
      { ...baseLetter, groundingRefs: [{ entryId: 'e1', quotedPhrase: 'Something  I WROTE last\nweek' }] },
      ctx,
    );
    expect(r.ok).toBe(true);
  });

  it('accepts a truncated quote ending in an ellipsis', () => {
    const r = validateLetter(
      { ...baseLetter, groundingRefs: [{ entryId: 'e1', quotedPhrase: 'Today I noticed something...' }] },
      ctx,
    );
    expect(r.ok).toBe(true);
  });

  it('rejects a fabricated quote against a cited reply too', () => {
    const r = validateLetter(
      { ...baseLetter, groundingRefs: [{ replyId: 'r1', quotedPhrase: 'please write to me every day' }] },
      ctx,
    );
    expect(r.ok).toBe(false);
    expect(r.violations.join(' ')).toMatch(/quotedPhrase not found/);
  });
});

describe('letterOutputSchema grounding refs', () => {
  it('accepts a ref citing exactly one target', () => {
    expect(() =>
      letterOutputSchema.parse({
        genre: 'hortatoria',
        salutation: 'Dear friend,',
        bodyMd: 'A letter.',
        groundingRefs: [{ replyId: 'r1', quotedPhrase: 'phrase' }],
      }),
    ).not.toThrow();
  });

  it('rejects a ref citing both entryId and replyId', () => {
    expect(() =>
      letterOutputSchema.parse({
        genre: 'hortatoria',
        salutation: 'Dear friend,',
        bodyMd: 'A letter.',
        groundingRefs: [{ entryId: 'e1', replyId: 'r1', quotedPhrase: 'phrase' }],
      }),
    ).toThrow(/exactly one/);
  });

  it('rejects a ref citing neither target', () => {
    expect(() =>
      letterOutputSchema.parse({
        genre: 'hortatoria',
        salutation: 'Dear friend,',
        bodyMd: 'A letter.',
        groundingRefs: [{ quotedPhrase: 'phrase' }],
      }),
    ).toThrow(/exactly one/);
  });
});

describe('mergeMemory (append-only versions)', () => {
  const delta = {
    themesObserved: [{ theme: 'patience', evidence: 'wrote about waiting well', trend: 'new' as const }],
    openThreads: ['the open question about the move'],
    exercisesGiven: [{ exercise: 'five minutes of writing', status: 'given' as const }],
    toneCalibration: 'warm, direct',
    retiredItems: [],
  };

  it('creates version 1 from nothing', () => {
    const m = mergeMemory(null, delta);
    expect(m.version).toBe(1);
    expect(m.themesObserved).toHaveLength(1);
    expect(m.letterCount).toBe(1);
  });

  it('increments versions and carries forward themes', () => {
    const v1 = mergeMemory(null, delta);
    const v2 = mergeMemory(v1, {
      themesObserved: [{ theme: 'patience', evidence: 'again', trend: 'recurring' as const }],
      openThreads: ['a second thread'],
    });
    expect(v2.version).toBe(2);
    expect(v2.themesObserved.find((t) => t.theme === 'patience')?.trend).toBe('recurring');
    expect(v2.openThreads).toContain('the open question about the move');
    expect(v2.letterCount).toBe(2);
  });

  it('drops retired items from themes and threads', () => {
    const v1 = mergeMemory(null, delta);
    const v2 = mergeMemory(v1, {
      themesObserved: [],
      openThreads: [],
      retiredItems: ['patience', 'the open question about the move'],
    });
    expect(v2.themesObserved.find((t) => t.theme === 'patience')).toBeUndefined();
    expect(v2.openThreads).not.toContain('the open question about the move');
  });

  it('stays within the 32 KB cap by trimming', () => {
    let doc: MemoryDoc | null = null;
    for (let i = 0; i < 40; i++) {
      doc = mergeMemory(doc, {
        themesObserved: Array.from({ length: 8 }, (_, j) => ({
          theme: `theme-${i}-${j}-${'x'.repeat(200)}`,
          evidence: 'y'.repeat(400),
          trend: 'new' as const,
        })),
        openThreads: Array.from({ length: 8 }, (_, j) => `thread-${i}-${j}-${'z'.repeat(300)}`),
      });
    }
    expect(JSON.stringify(doc).length).toBeLessThanOrEqual(32 * 1024);
  });
});

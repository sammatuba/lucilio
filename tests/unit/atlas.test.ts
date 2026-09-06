// The Atlas pack is facts, frozen: these tests pin the pack contract —
// sequential plates, dated sources with real URLs, three margin notes per
// plate, essays within letter-adjacent length, and the schema rejecting the
// shapes that would let a source be invented.
import { describe, expect, it } from 'vitest';
import {
  atlasIndexPayloadSchema,
  atlasPackSchema,
  atlasPlateSchema,
  plateRoman,
  toRoman,
} from '../../src/shared/atlas.js';
import { ATLAS_PACK, ATLAS_PACK_INDEX } from '../../src/server/atlas/pack.js';
import { atlasIndexPayload } from '../../src/server/routes/atlas.js';

describe('Atlas pack invariants (edition frozen like the personas)', () => {
  it('parses as a valid pack', () => {
    expect(() => atlasPackSchema.parse(ATLAS_PACK)).not.toThrow();
    expect(ATLAS_PACK.version).toBe('atlas-v1.1.0');
  });

  it('numbers plates sequentially from 1 with unique ids', () => {
    const ids = new Set(ATLAS_PACK.plates.map((p) => p.id));
    expect(ids.size).toBe(ATLAS_PACK.plates.length);
    ATLAS_PACK.plates.forEach((p, i) => expect(p.number).toBe(i + 1));
  });

  it('every plate carries 3–5 margin notes, sources, a question, and a write-from quote', () => {
    for (const p of ATLAS_PACK.plates) {
      expect(p.marginNotes.length).toBeGreaterThanOrEqual(3);
      expect(p.marginNotes.length).toBeLessThanOrEqual(5);
      expect(p.sources.length).toBeGreaterThanOrEqual(1);
      expect(p.question.length).toBeGreaterThan(10);
      expect(p.writeFromQuote.length).toBeGreaterThan(10);
      expect(p.standfirst.length).toBeGreaterThan(10);
    }
  });

  it('every source is https with a retrieval date (sources are never invented)', () => {
    for (const p of ATLAS_PACK.plates) {
      for (const s of p.sources) {
        if (s.url) expect(s.url.startsWith('https://')).toBe(true);
        expect(s.retrievedAt).toMatch(/^\d{4}-\d{2}-\d{2}$/);
        expect(s.title.length).toBeGreaterThan(3);
      }
    }
  });

  it('street-view plates carry coordinates and framing; lines are human-readable', () => {
    for (const p of ATLAS_PACK.plates) {
      expect(p.view.placeLine.length).toBeGreaterThan(3);
      if (p.view.kind === 'streetview') {
        expect(p.view.lat).toBeDefined();
        expect(p.view.lng).toBeDefined();
        expect(p.view.heading).toBeDefined();
      }
    }
  });

  it('essays sit in the letter-adjacent band (450–1000 words)', () => {
    for (const p of ATLAS_PACK.plates) {
      const words = p.bodyMd.split(/\s+/).filter(Boolean).length;
      expect(words).toBeGreaterThanOrEqual(450);
      expect(words).toBeLessThanOrEqual(1000);
    }
  });

  it('index summary matches the pack', () => {
    expect(ATLAS_PACK_INDEX.plateCount).toBe(ATLAS_PACK.plates.length);
    expect(ATLAS_PACK_INDEX.sourceCount).toBe(
      ATLAS_PACK.plates.reduce((sum, p) => sum + p.sources.length, 0),
    );
  });

  it('the real index payload satisfies the CLIENT schema (route and contract cannot drift)', () => {
    // Regression: production shipped an index payload without
    // pack.editionNumber, which the client's zod contract requires — the
    // Atlas opened to an error for every signed-in user. This parses the
    // exact object the route serves through the exact schema the client
    // validates with.
    const parsed = atlasIndexPayloadSchema.safeParse(atlasIndexPayload());
    expect(parsed.success).toBe(true);
  });
});

describe('Atlas schema rejects malformed plates', () => {
  const base = ATLAS_PACK.plates[0]!;

  it('rejects an unknown plate kind', () => {
    const bad = { ...base, id: 'x-1', kind: 'kingdom' } as unknown;
    expect(atlasPlateSchema.safeParse(bad).success).toBe(false);
  });

  it('rejects a source with a non-URL', () => {
    const bad = {
      ...base,
      id: 'x-2',
      sources: [{ ...base.sources[0], url: 'not-a-url' }],
    } as unknown;
    expect(atlasPlateSchema.safeParse(bad).success).toBe(false);
  });

  it('rejects a plate with fewer than three margin notes', () => {
    const bad = { ...base, id: 'x-3', marginNotes: base.marginNotes.slice(0, 2) } as unknown;
    expect(atlasPlateSchema.safeParse(bad).success).toBe(false);
  });

  it('rejects a street-view plate without coordinates', () => {
    const bad = {
      ...base,
      id: 'x-4',
      view: { ...base.view, lat: undefined, lng: undefined },
    } as unknown;
    expect(atlasPlateSchema.safeParse(bad).success).toBe(false);
  });

  it('accepts a typographic plate without coordinates', () => {
    const ok = {
      ...base,
      id: 'x-5',
      view: { kind: 'typographic', placeLine: 'Nowhere in particular', coordsLine: '' },
    } as unknown;
    expect(atlasPlateSchema.safeParse(ok).success).toBe(true);
  });
});

describe('Roman numerals (plate numbers are set like an old atlas)', () => {
  it('converts the standard cases', () => {
    expect(toRoman(1)).toBe('I');
    expect(toRoman(4)).toBe('IV');
    expect(toRoman(9)).toBe('IX');
    expect(toRoman(14)).toBe('XIV');
    expect(toRoman(40)).toBe('XL');
    expect(toRoman(90)).toBe('XC');
    expect(toRoman(2026)).toBe('MMXXVI');
  });

  it('plateRoman works off a plate number', () => {
    expect(plateRoman({ number: 5 })).toBe('V');
  });
});

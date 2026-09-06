// The Atlas content pack contract: plain data + zod validation, no imports
// beyond zod — safe to bundle into the browser (same rule as shared/schemas).
//
// The load-bearing split (see the Atlas design notes): FACTS
// come from a frozen, sourced, versioned pack; only personal meaning is
// composed live. Every plate must trace its claims to listed sources with
// retrieval dates — sources are never invented, on plates any more than in
// letters.
import { z } from 'zod';

export const ATLAS_KINDS = ['place', 'idea', 'work', 'life'] as const;
export type AtlasKind = (typeof ATLAS_KINDS)[number];

export const ATLAS_KIND_LABELS: Record<AtlasKind, string> = {
  place: 'Place',
  idea: 'Idea',
  work: 'Work',
  life: 'Life',
};

export const ATLAS_VIEW_KINDS = ['streetview', 'typographic'] as const;
export type AtlasViewKind = (typeof ATLAS_VIEW_KINDS)[number];

// The vantage: where the reader stands. Street-view plates carry coordinates +
// framing chosen at curation time; the image itself is proxied server-side
// (never a client-side key) and falls back to a typographic plate when no
// imagery is configured or coverage does not exist.
export const atlasViewSchema = z
  .object({
    kind: z.enum(ATLAS_VIEW_KINDS),
    lat: z.number().min(-90).max(90).optional(),
    lng: z.number().min(-180).max(180).optional(),
    heading: z.number().min(0).max(360).optional(),
    pitch: z.number().min(-90).max(90).optional(),
    fov: z.number().min(10).max(120).optional(),
    placeLine: z.string().min(1).max(140),
    coordsLine: z.string().max(90).default(''),
  })
  .refine((v) => v.kind === 'typographic' || (v.lat !== undefined && v.lng !== undefined), {
    message: 'a street-view plate needs coordinates',
  });
export type AtlasView = z.infer<typeof atlasViewSchema>;

export const atlasSourceSchema = z.object({
  title: z.string().min(1).max(200),
  publisher: z.string().max(120).default(''),
  url: z.string().url().max(400).optional(),
  retrievedAt: z.string().regex(/^\d{4}-\d{2}-\d{2}$/),
});
export type AtlasSource = z.infer<typeof atlasSourceSchema>;

export const atlasMarginNoteSchema = z.object({
  fact: z.string().min(1).max(280),
  date: z.string().max(60).default(''),
});
export type AtlasMarginNote = z.infer<typeof atlasMarginNoteSchema>;

export const atlasPlateSchema = z.object({
  id: z.string().regex(/^[a-z0-9-]{2,64}$/),
  number: z.number().int().min(1),
  kind: z.enum(ATLAS_KINDS),
  title: z.string().min(1).max(120),
  standfirst: z.string().min(1).max(280),
  bodyMd: z.string().min(1).max(24 * 1024),
  question: z.string().min(1).max(280),
  writeFromQuote: z.string().min(1).max(200),
  view: atlasViewSchema,
  marginNotes: z.array(atlasMarginNoteSchema).min(3).max(5),
  sources: z.array(atlasSourceSchema).min(1).max(6),
});
export type AtlasPlate = z.infer<typeof atlasPlateSchema>;

export const atlasPackSchema = z.object({
  version: z.string().regex(/^atlas-v\d+\.\d+(\.\d+)?$/),
  createdAt: z.string().regex(/^\d{4}-\d{2}-\d{2}$/),
  edition: z.object({
    number: z.number().int().min(1),
    title: z.string().min(1).max(120),
  }),
  provenance: z.string().min(1).max(500),
  plates: z.array(atlasPlateSchema).min(1).max(200),
});
export type AtlasPack = z.infer<typeof atlasPackSchema>;

// ---- API payloads ----

export const atlasPlateSummarySchema = z.object({
  id: z.string().regex(/^[a-z0-9-]{2,64}$/),
  number: z.number().int().min(1),
  kind: z.enum(ATLAS_KINDS),
  title: z.string().min(1).max(120),
  standfirst: z.string().min(1).max(280),
  placeLine: z.string().min(1).max(140),
  imagery: z.enum(ATLAS_VIEW_KINDS),
});
export type AtlasPlateSummary = z.infer<typeof atlasPlateSummarySchema>;

export const atlasIndexPayloadSchema = z.object({
  pack: z.object({
    version: z.string().min(1),
    edition: z.string().min(1),
    editionNumber: z.number().int().min(1),
    createdAt: z.string().min(1),
    plateCount: z.number().int().min(1),
    sourceCount: z.number().int().min(0),
    provenance: z.string().min(1),
  }),
  plates: z.array(atlasPlateSummarySchema).min(1),
});
export type AtlasIndexPayload = z.infer<typeof atlasIndexPayloadSchema>;

export const atlasPlatePayloadSchema = z.object({
  pack: z.object({
    version: z.string().min(1),
    edition: z.string().min(1),
  }),
  plate: atlasPlateSchema,
});
export type AtlasPlatePayload = z.infer<typeof atlasPlatePayloadSchema>;

export function plateRoman(plate: Pick<AtlasPlate, 'number'>): string {
  return toRoman(plate.number);
}

export function toRoman(n: number): string {
  const table: [number, string][] = [
    [1000, 'M'], [900, 'CM'], [500, 'D'], [400, 'CD'], [100, 'C'], [90, 'XC'],
    [50, 'L'], [40, 'XL'], [10, 'X'], [9, 'IX'], [5, 'V'], [4, 'IV'], [1, 'I'],
  ];
  let out = '';
  let rest = n;
  for (const [value, sym] of table) {
    while (rest >= value) {
      out += sym;
      rest -= value;
    }
  }
  return out || '0';
}

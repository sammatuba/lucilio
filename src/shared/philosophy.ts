import { z } from 'zod';

export const philosophySourceSchema = z.object({
  id: z.string(), title: z.string(), author: z.string(),
  url: z.url().refine((url) => url.startsWith('https://')),
  kind: z.enum(['primary', 'reference']), locator: z.string(), note: z.string(),
});
export const philosophyNodeSchema = z.object({
  id: z.string(), title: z.string(), kind: z.enum(['tradition', 'concept', 'question']),
  area: z.string(), summary: z.string(), detailMd: z.string(),
  questions: z.array(z.string()), sourceIds: z.array(z.string()).min(1),
  readingIds: z.array(z.string()), prerequisiteIds: z.array(z.string()),
});
export const philosophyReadingSchema = z.object({
  id: z.string(), title: z.string(), question: z.string(), standfirst: z.string(),
  bodyMd: z.string(), counterpointMd: z.string(),
  prompts: z.object({ reflection: z.string(), argument: z.string(), revision: z.string() }),
  nodeIds: z.array(z.string()).min(1), sourceIds: z.array(z.string()).min(1),
  minutes: z.number().int().positive(), sourceNotes: z.string(),
});
export const philosophyRelationSchema = z.object({
  from: z.string(), to: z.string(), kind: z.enum(['contrasts', 'explores', 'context']),
  explanation: z.string(), sourceIds: z.array(z.string()).min(1),
});
export const philosophyPackSchema = z.object({
  version: z.string(), coverageNote: z.string(),
  sources: z.array(philosophySourceSchema), nodes: z.array(philosophyNodeSchema),
  readings: z.array(philosophyReadingSchema), relations: z.array(philosophyRelationSchema),
}).superRefine((pack, ctx) => {
  const sets = { source: new Set(pack.sources.map((s) => s.id)), node: new Set(pack.nodes.map((n) => n.id)), reading: new Set(pack.readings.map((r) => r.id)) };
  for (const [kind, items] of [['source', pack.sources], ['node', pack.nodes], ['reading', pack.readings]] as const) {
    if (sets[kind].size !== items.length) ctx.addIssue({ code: 'custom', message: `Duplicate ${kind} id` });
  }
  const check = (kind: keyof typeof sets, ids: string[]) => {
    for (const id of ids) if (!sets[kind].has(id)) ctx.addIssue({ code: 'custom', message: `Missing ${kind}: ${id}` });
  };
  for (const n of pack.nodes) { check('source', n.sourceIds); check('reading', n.readingIds); check('node', n.prerequisiteIds); }
  for (const r of pack.readings) { check('source', r.sourceIds); check('node', r.nodeIds); }
  for (const edge of pack.relations) { check('node', [edge.from, edge.to]); check('source', edge.sourceIds); }
});
export type PhilosophyPack = z.infer<typeof philosophyPackSchema>;
export type PhilosophyNode = z.infer<typeof philosophyNodeSchema>;
export type PhilosophyReading = z.infer<typeof philosophyReadingSchema>;
export type PhilosophySource = z.infer<typeof philosophySourceSchema>;

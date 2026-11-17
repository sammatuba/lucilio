import { describe, expect, it } from 'vitest';
import { PHILOSOPHY_PACK } from '../../src/server/philosophy-pack.js';
import {
  philosophyPackSchema,
  philosophySourceSchema,
  type PhilosophyPack,
} from '../../src/shared/philosophy.js';

// Offline integrity checks, not evidence of URL availability or scholarly review.
// The pack's source notes record the separate preparation-time access checks.
const words = (text: string) => text.trim().split(/\s+/u).filter(Boolean).length;
const readingIds = ['trust', 'belonging', 'attention', 'good-life', 'responsibility', 'uncertainty'];
const requiredNodes = [
  'stoicism', 'epicureanism', 'aristotle', 'skepticism', 'kant', 'utilitarianism',
  'pragmatism', 'existentialism', 'phenomenology', 'confucian', 'daoist', 'buddhist',
  'nyaya', 'islamic', 'african-relational', 'testimony',
];
const clonePack = (): PhilosophyPack => structuredClone(PHILOSOPHY_PACK);
const nodeById = new Map(PHILOSOPHY_PACK.nodes.map((node) => [node.id, node]));
const readingById = new Map(PHILOSOPHY_PACK.readings.map((reading) => [reading.id, reading]));
const sourceIds = new Set(PHILOSOPHY_PACK.sources.map((source) => source.id));

function expectUnique(ids: string[]) {
  expect(new Set(ids).size).toBe(ids.length);
}

describe('Philosophy foundation pack', () => {
  it('parses through the shared contract with the intended edition', () => {
    expect(philosophyPackSchema.parse(PHILOSOPHY_PACK)).toEqual(PHILOSOPHY_PACK);
    expect(PHILOSOPHY_PACK.version).toBe('philosophy-v1.0.0');
  });

  it('discloses curation, omissions, access checks, and editorial limits prominently', () => {
    const note = PHILOSOPHY_PACK.coverageNote;
    expect(note).toMatch(/curated introductory foundation/i);
    expect(note).toMatch(/not a comprehensive/i);
    expect(note).toMatch(/omissions/i);
    expect(note).toMatch(/Indigenous and Latin American/i);
    expect(note).toMatch(/not historical influence claims/i);
    expect(note).toMatch(/not a full reading/i);
    expect(note).toMatch(/No claim of independent scholarly review/i);
    expect(note).toMatch(/English-language/i);
  });

  it('has unique nonempty source, node, and reading IDs', () => {
    for (const group of [PHILOSOPHY_PACK.sources, PHILOSOPHY_PACK.nodes, PHILOSOPHY_PACK.readings]) {
      const ids = group.map((item) => item.id);
      expectUnique(ids);
      for (const id of ids) expect(id).toMatch(/^[a-z][a-z0-9-]*$/);
    }
  });

  it('opens with trust and leaves all six personal inquiries directly available', () => {
    expect(PHILOSOPHY_PACK.readings.length).toBeGreaterThanOrEqual(6);
    expect(PHILOSOPHY_PACK.readings.map((reading) => reading.id)).toEqual(expect.arrayContaining(readingIds));
    expect(PHILOSOPHY_PACK.readings[0]?.id).toBe('trust');
    expect(PHILOSOPHY_PACK.readings[0]?.question).toBe('When should I rely on another mind?');
    for (const node of PHILOSOPHY_PACK.nodes) expect(node.prerequisiteIds).toEqual([]);
  });

  it.each(readingIds)('%s has a substantial body, counterargument, and three distinct writing invitations', (id) => {
    const reading = readingById.get(id)!;
    // Counterpoint, prompts, standfirst, and source notes cannot pad the body count.
    expect(words(reading.bodyMd)).toBeGreaterThanOrEqual(650);
    expect(words(reading.bodyMd)).toBeLessThanOrEqual(950);
    expect(words(reading.counterpointMd)).toBeGreaterThanOrEqual(50);
    expect(words(reading.sourceNotes)).toBeGreaterThanOrEqual(40);
    expect(words(reading.standfirst)).toBeGreaterThanOrEqual(15);
    expect(reading.question.endsWith('?')).toBe(true);
    expect(Object.keys(reading.prompts).sort()).toEqual(['argument', 'reflection', 'revision']);
    const prompts = Object.values(reading.prompts);
    expectUnique(prompts);
    for (const prompt of prompts) expect(words(prompt)).toBeGreaterThanOrEqual(20);
    expect(reading.minutes).toBeGreaterThan(0);
    expect(reading.nodeIds.length).toBeGreaterThanOrEqual(3);
    expect(reading.sourceIds.length).toBeGreaterThanOrEqual(3);
    expectUnique(reading.bodyMd.split(/\n\n/u));
  });

  it('does not reuse essay bodies or make the optional research example a curriculum filter', () => {
    expectUnique(PHILOSOPHY_PACK.readings.map((reading) => reading.bodyMd));
    const essays = PHILOSOPHY_PACK.readings.map((reading) => JSON.stringify(reading)).join('\n');
    expect(essays.match(/AI[- ]safety/giu)).toHaveLength(1);
    expect(readingById.get('trust')!.prompts.reflection).toMatch(/optionally, an AI-safety report/);
    for (const reading of PHILOSOPHY_PACK.readings.filter((item) => item.id !== 'trust')) {
      expect(JSON.stringify(reading)).not.toMatch(/AI[- ]safety/iu);
    }
  });

  it('covers all sixteen required entry points without merging regional traditions', () => {
    expect(PHILOSOPHY_PACK.nodes.length).toBeGreaterThanOrEqual(16);
    expect([...nodeById.keys()]).toEqual(expect.arrayContaining(requiredNodes));
    expect(nodeById.get('confucian')!.area).toMatch(/Chinese/);
    expect(nodeById.get('daoist')!.area).toMatch(/Chinese/);
    expect(nodeById.get('buddhist')!.area).toMatch(/Indian/);
    expect(nodeById.get('nyaya')!.area).toMatch(/Indian/);
    expect(nodeById.get('islamic')!.area).toMatch(/Islamic/);
    expect(nodeById.get('african-relational')!.area).toMatch(/African/);
    expect(nodeById.get('aristotle')!.area).toMatch(/Mediterranean/);
    expect(nodeById.get('islamic')!.title).toContain('al-Fārābī');
    expect(nodeById.get('african-relational')!.title).toContain('Akan-centered');
    expect(nodeById.get('confucian')!.sourceIds).not.toEqual(nodeById.get('daoist')!.sourceIds);
    expect(nodeById.get('buddhist')!.sourceIds).not.toEqual(nodeById.get('nyaya')!.sourceIds);
  });

  it('gives every node orientation, depth, questions, sources, and a reciprocal reading link', () => {
    for (const node of PHILOSOPHY_PACK.nodes) {
      expect(words(node.summary)).toBeGreaterThanOrEqual(15);
      expect(words(node.detailMd)).toBeGreaterThanOrEqual(65);
      expect(node.questions.length).toBeGreaterThanOrEqual(2);
      expectUnique(node.questions);
      for (const question of node.questions) expect(question.endsWith('?')).toBe(true);
      expect(node.readingIds.length).toBeGreaterThanOrEqual(1);
      expect(node.sourceIds.length).toBeGreaterThanOrEqual(1);
      expectUnique(node.readingIds);
      expectUnique(node.sourceIds);
      for (const sourceId of node.sourceIds) expect(sourceIds.has(sourceId)).toBe(true);
      for (const readingId of node.readingIds) {
        const reading = readingById.get(readingId);
        expect(reading).toBeDefined();
        expect(reading!.nodeIds).toContain(node.id);
        expect(reading!.sourceIds.some((sourceId) => node.sourceIds.includes(sourceId))).toBe(true);
      }
    }
    for (const reading of PHILOSOPHY_PACK.readings) {
      expectUnique(reading.nodeIds);
      expectUnique(reading.sourceIds);
      for (const nodeId of reading.nodeIds) expect(nodeById.get(nodeId)?.readingIds).toContain(reading.id);
      for (const sourceId of reading.sourceIds) expect(sourceIds.has(sourceId)).toBe(true);
    }
  });

  it('provides locatable source metadata at trusted HTTPS hosts without orphan citations', () => {
    expect(PHILOSOPHY_PACK.sources.some((source) => source.kind === 'primary')).toBe(true);
    for (const source of PHILOSOPHY_PACK.sources) {
      const url = new URL(source.url);
      expect(url.protocol).toBe('https:');
      expect(['plato.stanford.edu', 'sourcebooks.web.fordham.edu']).toContain(url.hostname);
      expect(url.username).toBe('');
      expect(url.password).toBe('');
      expect(url.port).toBe('');
      expect(source.title.length).toBeGreaterThan(3);
      expect(source.author.length).toBeGreaterThan(3);
      expect(words(source.locator)).toBeGreaterThanOrEqual(8);
      expect(source.note).toMatch(/Access check: HTTP 200; inspected/);
      expect(words(source.note)).toBeGreaterThanOrEqual(35);
      expect(PHILOSOPHY_PACK.nodes.some((node) => node.sourceIds.includes(source.id))).toBe(true);
      expect(PHILOSOPHY_PACK.readings.some((reading) => reading.sourceIds.includes(source.id))).toBe(true);
      expect(PHILOSOPHY_PACK.relations.some((relation) => relation.sourceIds.includes(source.id))).toBe(true);
    }
  });

  it('explains at least 22 nonduplicate relations with sources for both linked nodes', () => {
    expect(PHILOSOPHY_PACK.relations.length).toBeGreaterThanOrEqual(22);
    const keys: string[] = [];
    for (const relation of PHILOSOPHY_PACK.relations) {
      expect(['contrasts', 'explores', 'context']).toContain(relation.kind);
      expect(relation.from).not.toBe(relation.to);
      keys.push([relation.from, relation.kind, relation.to].join(':'));
      expect(relation.explanation).toMatch(/^Editorial comparison \(not a historical influence claim\):/);
      expect(words(relation.explanation)).toBeGreaterThanOrEqual(35);
      expect(relation.sourceIds.length).toBeGreaterThanOrEqual(2);
      expectUnique(relation.sourceIds);
      for (const sourceId of relation.sourceIds) expect(sourceIds.has(sourceId)).toBe(true);
      for (const id of [relation.from, relation.to]) {
        const node = nodeById.get(id);
        expect(node).toBeDefined();
        expect(relation.sourceIds.some((sourceId) => node!.sourceIds.includes(sourceId))).toBe(true);
        expect(node!.readingIds.some((readingId) => readingById.has(readingId))).toBe(true);
      }
    }
    expectUnique(keys);
  });

  it('connects every entry point to the foundation without isolated decorative nodes', () => {
    const reached = new Set(['testimony']);
    const pending = ['testimony'];
    while (pending.length > 0) {
      const current = pending.pop()!;
      for (const relation of PHILOSOPHY_PACK.relations) {
        const neighbor = relation.from === current ? relation.to : relation.to === current ? relation.from : undefined;
        if (neighbor && !reached.has(neighbor)) {
          reached.add(neighbor);
          pending.push(neighbor);
        }
      }
    }
    expect(reached.size).toBe(PHILOSOPHY_PACK.nodes.length);
  });
});

describe('Shared philosophy contract rejects corrupt packs', () => {
  it.each(['sources', 'nodes', 'readings'] as const)('rejects duplicate IDs in %s', (group) => {
    const pack = clonePack();
    pack[group][1]!.id = pack[group][0]!.id;
    const result = philosophyPackSchema.safeParse(pack);
    expect(result.success).toBe(false);
    if (!result.success) expect(result.error.issues.some((issue) => issue.message.startsWith('Duplicate'))).toBe(true);
  });

  const brokenReferences: [string, (pack: PhilosophyPack) => void][] = [
    ['node source', (pack) => { pack.nodes[0]!.sourceIds = ['missing-source']; }],
    ['node reading', (pack) => { pack.nodes[0]!.readingIds = ['missing-reading']; }],
    ['node prerequisite', (pack) => { pack.nodes[0]!.prerequisiteIds = ['missing-node']; }],
    ['reading source', (pack) => { pack.readings[0]!.sourceIds = ['missing-source']; }],
    ['reading node', (pack) => { pack.readings[0]!.nodeIds = ['missing-node']; }],
    ['relation origin', (pack) => { pack.relations[0]!.from = 'missing-node'; }],
    ['relation destination', (pack) => { pack.relations[0]!.to = 'missing-node'; }],
    ['relation source', (pack) => { pack.relations[0]!.sourceIds = ['missing-source']; }],
  ];
  it.each(brokenReferences)('rejects a dangling %s reference', (_label, mutate) => {
    const pack = clonePack();
    mutate(pack);
    const result = philosophyPackSchema.safeParse(pack);
    expect(result.success).toBe(false);
    if (!result.success) expect(result.error.issues.some((issue) => issue.message.startsWith('Missing'))).toBe(true);
  });

  const emptyRequiredLinks: [string, (pack: PhilosophyPack) => void][] = [
    ['node sources', (pack) => { pack.nodes[0]!.sourceIds = []; }],
    ['reading sources', (pack) => { pack.readings[0]!.sourceIds = []; }],
    ['reading nodes', (pack) => { pack.readings[0]!.nodeIds = []; }],
    ['relation sources', (pack) => { pack.relations[0]!.sourceIds = []; }],
  ];
  it.each(emptyRequiredLinks)('rejects empty %s', (_label, mutate) => {
    const pack = clonePack();
    mutate(pack);
    expect(philosophyPackSchema.safeParse(pack).success).toBe(false);
  });

  it('rejects a historical-influence relation kind unsupported by the schema', () => {
    const pack = clonePack();
    const unsupported = { ...pack, relations: [{ ...pack.relations[0], kind: 'influences' }] };
    expect(philosophyPackSchema.safeParse(unsupported).success).toBe(false);
  });

  it.each([
    'javascript:alert(1)',
    'javascript://https://plato.stanford.edu',
    'data:text/html,<script>alert(1)</script>',
    'vbscript:msgbox(1)',
    'file:///etc/passwd',
    'http://plato.stanford.edu/entries/stoicism/',
    'ftp://example.org/source',
    'mailto:someone@example.org',
    '//plato.stanford.edu/entries/stoicism/',
    'https://',
    'not-a-url',
  ])('rejects unsafe or malformed source URL %s in both source and pack', (url) => {
    const pack = clonePack();
    pack.sources[0]!.url = url;
    expect(philosophySourceSchema.safeParse(pack.sources[0]).success).toBe(false);
    expect(philosophyPackSchema.safeParse(pack).success).toBe(false);
  });
});

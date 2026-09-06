// Synthetic entries only. --live is explicit; default exercises mock plumbing.
import { writeFileSync } from 'node:fs';
import { loadEnvLocal, config } from '../src/server/env.js';
import { deps } from '../src/server/pipeline.js';
import { formatEntry, wrap, type CorrespondentContext } from '../src/server/context.js';
import { validateLetter } from '../src/server/contracts.js';
import { DEFAULT_REFLECTION_PREFERENCES, REFLECTION_DEPTHS } from '../src/shared/schemas.js';
import { REFLECTION_VERSION } from '../src/shared/reflection.js';

const live = process.argv.includes('--live');
if (live) loadEnvLocal();
else process.env.GEMINI_API_KEY = '';
if (live && config.mockGemini) throw new Error('Live evaluation requires a configured Gemini key');
const rows = [];
for (const depth of REFLECTION_DEPTHS) {
  const entry = {
    id: 'synthetic-entry-001', createdAt: '2026-09-06T10:00:00.000Z',
    bodyMd: depth === 'gentle'
      ? 'I took a quiet walk and enjoyed the afternoon. Nothing much happened.'
      : 'AI helped me finish a task in ten minutes instead of an afternoon. I felt relieved, but also strangely disappointed. I wonder what made the work feel mine.',
  };
  const context: CorrespondentContext = {
    cid: 'director', entries: [entry], previousLetters: [], memory: null, replies: [],
    contextEntryIds: new Set([entry.id]), contextReplyIds: new Set(), taintedIds: new Set(),
    entryTextById: new Map([[entry.id, entry.bodyMd]]), replyTextById: new Map(),
    prompt: wrap('notebook_entries', formatEntry(entry)),
    reflection: { entryId: entry.id, preferences: { ...DEFAULT_REFLECTION_PREFERENCES, depth, interests: ['ai'] } },
  };
  try {
    const d = deps();
    const letter = await d.compose('director', context, 'requested');
    const validation = validateLetter(letter, { ...context, entryReflection: true });
    const verdict = await d.judge('director', letter, context);
    const pass = validation.ok && verdict.pass;
    rows.push({ depth, pass, violations: [...validation.violations, ...verdict.violations], letter });
    console.log(`${depth}: ${pass ? 'PASS' : 'FAIL'}`);
  } catch {
    rows.push({ depth, pass: false, violations: ['Generation or review failed; inspect provider availability separately.'] });
    console.log(`${depth}: FAIL (generation or review unavailable)`);
  }
}
const result = { generatedAt: new Date().toISOString(), version: REFLECTION_VERSION, mode: live ? 'live' : 'mock',
  note: 'Four synthetic smoke cases, not comprehensive behavioral safety evidence. Read generated letters to assess depth and tone.', rows };
writeFileSync(`evals/results/reflections.${live ? 'live' : 'mock'}.json`, JSON.stringify(result, null, 2) + '\n');
if (rows.some((row) => !row.pass)) process.exitCode = 1;

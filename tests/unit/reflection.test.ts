import { describe, expect, it } from 'vitest';
import { validateLetter, type LetterOutput } from '../../src/server/contracts.js';
import { reflectionRequestSchema } from '../../src/shared/schemas.js';

const options = {
  cid: 'director' as const, contextEntryIds: new Set(['entry-source-123']), contextReplyIds: new Set<string>(),
  entryTextById: new Map([['entry-source-123', 'I wrote about a quiet afternoon.']]), replyTextById: new Map<string, string>(), entryReflection: true,
};
const letter: LetterOutput = {
  genre: 'consolatoria', salutation: 'A moment to reflect,', bodyMd: 'You wrote about a quiet afternoon. What felt worth noticing?',
  groundingRefs: [{ entryId: 'entry-source-123', quotedPhrase: 'a quiet afternoon' }],
};
describe('Entry reflection boundaries', () => {
  it('defaults to gentle with no automatic reflection or challenge', () => {
    expect(reflectionRequestSchema.parse({ entryId: 'entry-source-123', preferences: {} }).preferences).toEqual({ depth: 'gentle', interests: [], challenge: false, autoReflect: false });
  });
  it('rejects source identifiers and generated newline escapes without rewriting user data', () => {
    expect(validateLetter({ ...letter, bodyMd: letter.bodyMd + ' (entry-source-123)' }, options).ok).toBe(false);
    expect(validateLetter({ ...letter, bodyMd: letter.bodyMd + '\\nAnother paragraph.' }, options).ok).toBe(false);
    expect(validateLetter({ ...letter, bodyMd: letter.bodyMd + '\n\nAnother paragraph.' }, options).ok).toBe(true);
  });
  it('permits meaningful escape text when quoted from the entry', () => {
    const source = 'I learned what \\n means in code.';
    expect(validateLetter({ ...letter, bodyMd: source, groundingRefs: [{ entryId: 'entry-source-123', quotedPhrase: source }] }, {
      ...options, entryTextById: new Map([['entry-source-123', source]]),
    }).ok).toBe(true);
  });
});

import { withDraftLock } from './draftLock';
import { z } from 'zod';
import { inquiryCreateSchema } from '../../shared/inquiry';
import { draftKeys } from './inquiryDraft';

const schema = z.object({ question: z.string(), attempts: z.array(inquiryCreateSchema) });
export type ReadingDraft = z.infer<typeof schema>;
const prefix = (uid: string) => `lucilio-reading-question:${encodeURIComponent(uid)}:`;
const key = (uid: string, id: string) => prefix(uid) + encodeURIComponent(id);

export function withReadingDraftLock<T>(uid: string, id: string, update: () => T): Promise<T> {
  return withDraftLock(key(uid, id), update);
}

export function readReadingDraft(uid: string, id: string): ReadingDraft | null {
  const raw = localStorage.getItem(key(uid, id));
  return raw === null ? null : schema.parse(JSON.parse(raw));
}

export function writeReadingDraft(uid: string, id: string, draft: ReadingDraft) {
  localStorage.setItem(key(uid, id), JSON.stringify(draft));
}

export function removeReadingDraft(uid: string, id: string) {
  localStorage.removeItem(key(uid, id));
}

export function exportReadingDrafts(uid: string) {
  return draftKeys(prefix(uid)).map((name) => {
    const readingId = decodeURIComponent(name.slice(prefix(uid).length));
    const draft = readReadingDraft(uid, readingId)!;
    return { readingId, ...draft };
  });
}

export function clearReadingDrafts(uid: string) {
  for (const name of draftKeys(prefix(uid))) localStorage.removeItem(name);
}

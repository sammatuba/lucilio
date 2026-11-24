import { z } from 'zod';
import { writingModes } from '../../shared/inquiry';

const prefix = 'lucilio-inquiry-draft:';
const draftSchema = z.object({
  id: z.string(), bodyMd: z.string(), mode: z.enum(writingModes),
  revisesId: z.string().nullable(), sourceNodeId: z.string().nullable(), updatedAt: z.string(),
});
export type InquiryDraft = z.infer<typeof draftSchema>;
export function freshInquiryDraft(): InquiryDraft {
  return { id: crypto.randomUUID(), bodyMd: '', mode: 'reflection', revisesId: null, sourceNodeId: null, updatedAt: new Date().toISOString() };
}
function key(uid: string, inquiryId: string) { return `${prefix}${encodeURIComponent(uid)}:${encodeURIComponent(inquiryId)}`; }
export function readInquiryDraft(uid: string, inquiryId: string): InquiryDraft | null {
  const stored = localStorage.getItem(key(uid, inquiryId));
  return stored ? draftSchema.parse(JSON.parse(stored)) : null;
}
export function writeInquiryDraft(uid: string, inquiryId: string, draft: InquiryDraft): void {
  localStorage.setItem(key(uid, inquiryId), JSON.stringify(draft));
}
export function removeInquiryDraft(uid: string, inquiryId: string): void {
  localStorage.removeItem(key(uid, inquiryId));
}
export function draftKeys(ownPrefix: string): string[] {
  const keys = [];
  for (let i = 0; i < localStorage.length; i++) {
    const name = localStorage.key(i);
    if (name?.startsWith(ownPrefix)) keys.push(name);
  }
  return keys;
}

export function exportInquiryDrafts(uid: string): Array<{ inquiryId: string; draft: InquiryDraft }> {
  const ownPrefix = `${prefix}${encodeURIComponent(uid)}:`;
  const drafts = [];
  for (const name of draftKeys(ownPrefix)) {
    const draft = draftSchema.parse(JSON.parse(localStorage.getItem(name)!));
    if (draft.bodyMd.trim()) drafts.push({ inquiryId: decodeURIComponent(name.slice(ownPrefix.length)), draft });
  }
  return drafts;
}
export function clearInquiryDrafts(uid: string): void {
  const ownPrefix = `${prefix}${encodeURIComponent(uid)}:`;
  for (const name of Object.keys(localStorage)) if (name.startsWith(ownPrefix)) localStorage.removeItem(name);
}
export function downloadWriting(text: string, name = 'lucilio-writing.md'): void {
  const url = URL.createObjectURL(new Blob([text], { type: 'text/markdown;charset=utf-8' }));
  const a = document.createElement('a');
  a.href = url; a.download = name; document.body.appendChild(a); a.click(); a.remove(); URL.revokeObjectURL(url);
}
export async function inquiryRequest<T>(request: Promise<T>): Promise<T> {
  let timer: ReturnType<typeof setTimeout> | undefined;
  try {
    return await Promise.race([request, new Promise<never>((_, reject) => {
      timer = setTimeout(() => reject(new Error('Inquiry request timed out')), 15_000);
    })]);
  } finally { clearTimeout(timer); }
}

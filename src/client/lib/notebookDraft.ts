// Drafts belong to a signed-in user rather than to one mounted Notebook view.
// Keeping this small store in the client lets route navigation unmount the
// view without throwing away words that have not been saved yet.
const drafts = new Map<string, string>();

export function getNotebookDraft(uid: string): string {
  return drafts.get(uid) ?? '';
}

export function setNotebookDraft(uid: string, draft: string): void {
  if (draft) drafts.set(uid, draft);
  else drafts.delete(uid);
}


// Shared composer save (Notebook + Onboarding). Firestore queues writes
// offline (persistentLocalCache), so a save normally resolves from the local
// store even with no network. The 4 s race exists for the pathological hang:
// after it the surface says the truth ("kept on this device — will sync")
// while the write keeps trying in the background. The composer clears only
// once the write is locally acknowledged, and a late failure restores the
// words — input is never silently lost (§2.8).
import type { User } from 'firebase/auth';
import { collection, doc, setDoc, getDocFromServer, waitForPendingWrites } from 'firebase/firestore';
import { db } from './firebase';

const ACK_TIMEOUT_MS = 4000;

export type SaveOutcome = 'saved' | 'queued';

export function saveEntry(
  user: User,
  body: string,
  entryId?: string,
): { entryId?: string; outcome: Promise<SaveOutcome>; final: Promise<void> } {
  const entries = collection(db, `users/${user.uid}/notebook`);
  const ref = entryId ? doc(entries, entryId) : doc(entries);
  const write = setDoc(ref, { id: ref.id, bodyMd: body, createdAt: new Date().toISOString() });
  const outcome = Promise.race([
    write.then(() => 'saved' as const),
    new Promise<'queued'>((resolve) => setTimeout(() => resolve('queued'), ACK_TIMEOUT_MS)),
  ]);
  return { entryId: ref.id, outcome, final: write };
}

// A cached document can include a write that Firestore has not acknowledged.
export async function confirmEntry(uid: string, entryId: string): Promise<boolean> {
  await waitForPendingWrites(db);
  const entry = await getDocFromServer(doc(db, 'users', uid, 'notebook', entryId));
  if (entry.metadata.hasPendingWrites) throw new Error('Entry still syncing');
  return entry.exists();
}

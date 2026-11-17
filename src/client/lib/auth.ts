// Federated identity only — no password handling anywhere.
import {
  getRedirectResult,
  signInWithPopup,
  signInWithRedirect,
  signInWithCustomToken,
  signOut as fbSignOut,
  onAuthStateChanged,
  type User,
} from 'firebase/auth';
import { auth, googleProvider, useEmulators } from './firebase';
import { clearInquiryDrafts, exportInquiryDrafts } from './inquiryDraft';
import { setNotebookDraft } from './notebookDraft';

export { onAuthStateChanged, type User };

// Production signs in through a full-page redirect, not a popup: the popup
// round-trip needs third-party storage between the app origin and the auth
// domain, and privacy-restrictive browsers block it — the popup closes right
// after Google approval and the result never reaches the opener (seen live on
// 2026-09-06). The redirect is first-party end to end. Emulator dev keeps the
// popup so nothing navigates away.
export async function signInWithGoogle(): Promise<void> {
  if (useEmulators) {
    await signInWithPopup(auth, googleProvider);
    return;
  }
  await signInWithRedirect(auth, googleProvider);
}

// Called once on the Landing to resolve a redirect sign-in return. Success is
// handled by onAuthStateChanged routing away; this surfaces failures through
// the same copy map as every other sign-in error.
export async function completeRedirectSignIn(): Promise<void> {
  if (useEmulators) return;
  await getRedirectResult(auth);
}

// Dev/emulator-only path: the unified server mints a custom token for a named
// demo user. Never present in production (route is unmounted there).
export async function devSignIn(name: string): Promise<User> {
  const res = await fetch('/dev/signin', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ name }),
  });
  if (!res.ok) throw new Error('dev sign-in unavailable');
  const { customToken } = await res.json();
  const cred = await signInWithCustomToken(auth, customToken);
  return cred.user;
}

const localDraftWarning = 'Uncleared local drafts may remain on this device. Clear this site’s data in your browser settings before someone else uses it.';

// Completed account deletion must not ask for discard consent again.
export async function signOut({ discardDrafts = false, user = auth.currentUser }: { discardDrafts?: boolean; user?: User | null } = {}): Promise<void> {
  const uid = user?.uid;
  if (uid) {
    let allowUnclearedDrafts = false;
    if (!discardDrafts) {
      let hasDrafts = false;
      try {
        hasDrafts = exportInquiryDrafts(uid).length > 0;
      } catch {
        if (!window.confirm(`Local inquiry drafts could not be read. Cancel to stay signed in and recover your writing before retrying. Signing out will try to discard unsaved drafts. ${localDraftWarning} Sign out anyway?`)) return;
        allowUnclearedDrafts = true;
      }
      if (hasDrafts && !window.confirm('Signing out clears unsaved inquiry drafts on this device. Save or export them first if you want to keep them. Sign out and clear drafts?')) return;
    }
    try {
      clearInquiryDrafts(uid);
    } catch {
      if (discardDrafts) {
        const signOutNotice = auth.currentUser === user ? 'You will still be signed out.' : 'Your current sign-in state will not be changed.';
        window.alert(`Local drafts could not be cleared. ${localDraftWarning} ${signOutNotice}`);
      } else if (!allowUnclearedDrafts && !window.confirm(`Local drafts could not be cleared. ${localDraftWarning} Cancel to stay signed in and save or export your remaining writing before retrying. Sign out anyway?`)) {
        return;
      }
    }
    setNotebookDraft(uid, '');
  }
  if (auth.currentUser === user) await fbSignOut(auth);
}

export { useEmulators };

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

export function signOut(): Promise<void> {
  return fbSignOut(auth);
}

export { useEmulators };

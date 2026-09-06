// The single place where failures become copy in the product's own voice
// (roadmap M1-7): status codes map to in-voice lines; raw server messages,
// Firestore error texts, and Firebase auth codes never reach a user-facing
// surface. Each surface gets only the lines it can honestly say — the shared
// shapes are factored here, not duplicated.

import { ApiError } from './api';

const SESSION =
  'Your session needs a fresh sign-in before this can happen. Nothing is lost — sign in once more and try again.';
const RATE_LIMIT =
  'That was a few asks in quick succession. Give it a minute, then try once more.';
const OFFLINE =
  'You seem to be offline. Your words are kept on this device and will sync when the connection returns.';

function isOffline(e: unknown): boolean {
  const msg = e instanceof Error ? e.message : '';
  return e instanceof TypeError || /offline|network|unavailable|failed to fetch/i.test(msg);
}

// Desk — request a letter.
export function requestLetterCopy(e: unknown, name: string): string {
  if (e instanceof ApiError) {
    if (e.status === 409) return `${name} is already reading your notebook — the letter is on its way.`;
    if (e.status === 429 && /rate limit/i.test(e.message)) return RATE_LIMIT;
    if (e.status === 429) return `${name} has already been asked today. Once a day keeps the letters awaited.`;
    if (e.status === 400) return 'Write a notebook entry first — your correspondent needs something to read.';
    if (e.status === 401 || e.status === 403) return SESSION;
  }
  return 'The request did not go through. Nothing was lost — you may try again.';
}

// Letter — send a reply (compose tier).
export function replyCopy(e: unknown): string {
  if (e instanceof ApiError) {
    if (e.status === 429) return RATE_LIMIT;
    if (e.status === 400)
      return 'That reply could not be read — it may be over the 10 KB limit. Your words are still in the box; shorten them a little and send again.';
    if (e.status === 401 || e.status === 403) return SESSION;
  }
  return 'The reply did not leave. Your words are still in the box — send it once more.';
}

// Letter — opening the page.
export function letterLoadCopy(e: unknown): string {
  if (e instanceof ApiError) {
    if (e.status === 404)
      return 'This letter is not on your shelves. It may belong to a concluded correspondence — the Correspondents page holds those.';
    if (e.status === 401 || e.status === 403) return SESSION;
  }
  return 'The letter did not open. Refresh once — if it stays shut, sign in again.';
}

// Letter — the sealed→opened transition. Non-fatal: reading is unaffected.
export function letterOpenCopy(_e: unknown): string {
  return 'The seal could not be marked broken — reading is unaffected, and your Notebook will settle it.';
}

// Study — conclude a correspondence (compose tier).
export function concludeCopy(e: unknown): string {
  if (e instanceof ApiError) {
    if (e.status === 409) return 'This correspondence is already concluded — the volume is bound.';
    if (e.status === 429) return RATE_LIMIT;
    if (e.status === 401 || e.status === 403) return SESSION;
  }
  return 'The final letter could not be asked for. The volume remains open — nothing is lost; try again in a moment.';
}

// Trust Center.
export function trustLoadCopy(e: unknown): string {
  if (e instanceof ApiError && (e.status === 401 || e.status === 403)) return SESSION;
  return 'The Trust Center could not open. Refresh once — if it stays shut, sign in again.';
}

// Settings — saving the display name / reflection preferences.
export function profileSaveCopy(e: unknown): string {
  if (e instanceof ApiError) {
    if (e.status === 400) return 'That name could not be saved — try something between 1 and 60 characters.';
    if (e.status === 429) return RATE_LIMIT;
    if (e.status === 401 || e.status === 403) return SESSION;
  }
  return 'That was not saved. Try again.';
}

export function accountDeleteCopy(e: unknown): string {
  if (e instanceof ApiError) {
    if (e.status === 429) return RATE_LIMIT;
    if (e.status === 401 || e.status === 403) return SESSION;
  }
  return 'The erasure did not complete. Nothing is half-deleted — export first if you have not, then try again.';
}

// Notebook + Onboarding — Firestore entry writes and the snapshot listener.
export function entrySaveCopy(e: unknown): string {
  if (isOffline(e)) return OFFLINE;
  return 'Your entry could not be saved just now. Nothing has been lost — try once more.';
}

export function snapshotCopy(_e: unknown): string {
  return 'The notebook could not be read just now. Refresh once — if it stays shut, sign in again.';
}

// Onboarding — the server call that begins the welcome cycle.
export function onboardCopy(e: unknown): string {
  if (isOffline(e))
    return 'You seem to be offline. Your first entry is kept on this device and will sync — come back online to begin the correspondence.';
  if (e instanceof ApiError) {
    if (e.status === 409) return 'You are already aboard — the welcome letters may already be on their way.';
    if (e.status === 429) return RATE_LIMIT;
    if (e.status === 401 || e.status === 403) return SESSION;
  }
  return 'Beginning the correspondence did not go through. Your first entry is safe — try once more.';
}

// Landing — Firebase auth failures (client-side; codes never shown raw).
export function signInCopy(e: unknown): string {
  const msg = e instanceof Error ? e.message : '';
  if (/popup-closed|cancelled-popup/.test(msg))
    return 'The sign-in window closed before finishing. Try once more — and allow popups for this site.';
  if (/popup-blocked/.test(msg))
    return 'The browser blocked the sign-in window. Allow popups for this site, then try again.';
  if (/unauthorized-domain/.test(msg))
    return 'Sign-in is not yet allowed from this address — the project keeper must add it to Firebase Auth → Settings → Authorized domains.';
  if (/operation-not-allowed|admin-restricted/.test(msg))
    return 'Sign-in with Google is not switched on yet — one toggle in the Firebase Console (Authentication → Sign-in method).';
  if (/web-storage-unsupported|operation-not-supported/.test(msg))
    return 'This browser is blocking the site data sign-in needs. Allow cookies and site data for this site, then try once more.';
  if (isOffline(e)) return 'The network interrupted sign-in. Check your connection and try once more.';
  return 'Sign-in did not complete. Nothing was lost — try once more.';
}

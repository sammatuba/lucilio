// Authenticated API client. Every call carries the Firebase ID token (Bearer)
// and, when App Check is initialized, an attestation token header.
import { auth, appCheck } from './firebase';
import { getToken as getAppCheckToken } from 'firebase/app-check';
import { onAuthStateChanged } from 'firebase/auth';
import { exportInquiryDrafts } from './inquiryDraft';

async function headers(user = auth.currentUser): Promise<Record<string, string>> {
  const h: Record<string, string> = { 'Content-Type': 'application/json' };
  if (user) h.Authorization = `Bearer ${await user.getIdToken()}`;
  if (appCheck) {
    try {
      const { token } = await getAppCheckToken(appCheck, false);
      if (token) h['X-Firebase-AppCheck'] = token;
    } catch {
      // Monitor mode tolerates missing attestation; never block the user.
    }
  }
  return h;
}

export class ApiError extends Error {
  constructor(
    public status: number,
    message: string,
  ) {
    super(message);
  }
}

async function request<T>(method: string, path: string, body?: unknown): Promise<T> {
  const res = await fetch(path, {
    method,
    headers: await headers(),
    body: body === undefined ? undefined : JSON.stringify(body),
  });
  const text = await res.text();
  let data: unknown = null;
  try {
    data = text ? JSON.parse(text) : null;
  } catch {
    data = { error: text.slice(0, 200) };
  }
  if (!res.ok) {
    const msg = (data as { error?: string })?.error ?? `request failed (${res.status})`;
    throw new ApiError(res.status, msg);
  }
  return data as T;
}

export const api = {
  get: <T>(path: string) => request<T>('GET', path),
  post: <T>(path: string, body?: unknown) => request<T>('POST', path, body ?? {}),
  del: <T>(path: string) => request<T>('DELETE', path),
};

// Authenticated binary download (Atlas vantage imagery): an <img src> cannot
// carry the Authorization/App Check headers, so the bytes are fetched here and
// handed to the <img> as a blob URL instead.
export async function getBlob(path: string): Promise<Blob> {
  const res = await fetch(path, { headers: await headers() });
  if (!res.ok) throw new ApiError(res.status, `request failed (${res.status})`);
  return res.blob();
}

// Authenticated file download (export).
export async function downloadExport(): Promise<void> {
  const user = auth.currentUser;
  if (!user) throw new ApiError(401, 'Sign in to export your data.');
  // Keep this operation bound to one session, even if that account signs back in.
  let accountChanged = false;
  const unsubscribe = onAuthStateChanged(auth, (current) => {
    if (current !== user) accountChanged = true;
  });
  function assertCurrentUser() {
    if (accountChanged || auth.currentUser !== user) {
      throw new Error('Your account changed. Start a new export for your current account.');
    }
  }
  try {
    const exportHeaders = await headers(user);
    assertCurrentUser();
    const res = await fetch('/api/export', { headers: exportHeaders });
    assertCurrentUser();
    if (!res.ok) throw new ApiError(res.status, 'export failed');
    const data = await res.json() as Record<string, unknown>;
    assertCurrentUser();
    const localInquiryDrafts = exportInquiryDrafts(user.uid);
    const blob = new Blob([JSON.stringify({ ...data, localInquiryDrafts }, null, 2)], { type: 'application/json' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    try {
      a.href = url;
      a.download = `lucilio-export-${new Date().toISOString().slice(0, 10)}.json`;
      document.body.appendChild(a);
      a.click();
    } finally {
      a.remove();
      URL.revokeObjectURL(url);
    }
  } finally {
    unsubscribe();
  }
}

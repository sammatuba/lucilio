// Test helper: mint a REAL ID token against the Auth emulator (custom token →
// REST exchange). Lets integration tests exercise the full middleware chain
// with genuine token verification, not fakes.
import { adminAuth } from '../../src/server/firebase.js';

const AUTH_EMULATOR = process.env.FIREBASE_AUTH_EMULATOR_HOST ?? '127.0.0.1:9099';

export async function mintIdToken(uid: string): Promise<string> {
  try {
    await adminAuth.getUser(uid);
  } catch {
    await adminAuth.createUser({ uid, email: `${uid}@lucilio.test.local` });
  }
  const customToken = await adminAuth.createCustomToken(uid);
  const res = await fetch(
    `http://${AUTH_EMULATOR}/identitytoolkit.googleapis.com/v1/accounts:signInWithCustomToken?key=fake-api-key`,
    {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ token: customToken, returnSecureToken: true }),
    },
  );
  const data = (await res.json()) as { idToken?: string; error?: { message?: string } };
  if (!data.idToken) throw new Error(`token exchange failed: ${JSON.stringify(data)}`);
  return data.idToken;
}

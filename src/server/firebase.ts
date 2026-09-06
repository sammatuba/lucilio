// Admin SDK bootstrap. Emulator-first: without live credentials the SDK talks
// to the local Auth/Firestore emulators. In production (Cloud Run) the runtime
// service account provides identity and FIREBASE_EMULATORS=false.
import { getApp, getApps, initializeApp, type App } from 'firebase-admin/app';
import { getAuth } from 'firebase-admin/auth';
import { getFirestore } from 'firebase-admin/firestore';
import { config } from './env.js';
import type { AppCheckVerifier, AuthVerifier } from './middleware.js';

if (config.useEmulators) {
  process.env.FIREBASE_AUTH_EMULATOR_HOST ??= '127.0.0.1:9099';
  process.env.FIRESTORE_EMULATOR_HOST ??= '127.0.0.1:8081';
}

export const app: App = getApps()[0] ?? initializeApp({ projectId: config.projectId });
export const adminAuth = getAuth(app);
export const adminDb = getFirestore(app);

export const adminAuthVerifier: AuthVerifier = {
  async verifyIdToken(idToken: string) {
    return adminAuth.verifyIdToken(idToken);
  },
};

// App Check verification needs a live project; in emulator mode there is no
// verifier (monitor mode lets requests through until enforcement is wired).
export const appCheckVerifier: AppCheckVerifier | null = config.useEmulators
  ? null
  : {
      async verifyAppCheckToken(token: string) {
        const { getAppCheck } = await import('firebase-admin/app-check');
        return getAppCheck(app).verifyToken(token);
      },
    };

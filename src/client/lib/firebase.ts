// Client Firebase bootstrap. Emulator-first dev (default): demo config points
// at local emulators. Live values arrive via VITE_FIREBASE_* for production.
import { initializeApp } from 'firebase/app';
import { getAuth, connectAuthEmulator, GoogleAuthProvider } from 'firebase/auth';
import {
  initializeFirestore,
  persistentLocalCache,
  persistentMultipleTabManager,
  connectFirestoreEmulator,
} from 'firebase/firestore';
import { initializeAppCheck, ReCaptchaV3Provider, type AppCheck } from 'firebase/app-check';

export const useEmulators =
  import.meta.env.DEV && import.meta.env.VITE_USE_EMULATORS !== 'false';

const projectId = import.meta.env.VITE_FIREBASE_PROJECT_ID ?? 'lucilio-dev';

const firebaseConfig = {
  apiKey: import.meta.env.VITE_FIREBASE_API_KEY ?? 'demo-api-key',
  authDomain: import.meta.env.VITE_FIREBASE_AUTH_DOMAIN ?? `${projectId}.firebaseapp.com`,
  projectId,
  storageBucket: import.meta.env.VITE_FIREBASE_STORAGE_BUCKET ?? `${projectId}.appspot.com`,
  appId: import.meta.env.VITE_FIREBASE_APP_ID ?? 'demo-app-id',
};

export const app = initializeApp(firebaseConfig);
export const auth = getAuth(app);

// Offline-first (US-2): entries composed offline queue locally and sync when
// connectivity returns.
export const db = initializeFirestore(app, {
  localCache: persistentLocalCache({ tabManager: persistentMultipleTabManager() }),
});
export const googleProvider = new GoogleAuthProvider();

if (useEmulators) {
  connectAuthEmulator(auth, 'http://127.0.0.1:9099', { disableWarnings: true });
  connectFirestoreEmulator(db, '127.0.0.1', 8081);
}

// App Check: initialized only when a reCAPTCHA site key is configured.
// Absent key = no attestation token; the server runs monitor mode until
// enforcement flips.
export let appCheck: AppCheck | null = null;
const siteKey = import.meta.env.VITE_RECAPTCHA_SITE_KEY;
if (siteKey) {
  appCheck = initializeAppCheck(app, {
    provider: new ReCaptchaV3Provider(siteKey),
    isTokenAutoRefreshEnabled: true,
  });
}

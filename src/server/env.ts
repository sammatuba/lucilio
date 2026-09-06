// Hand-rolled env loader: reads .env.local from the repo root if present.
// Existing process env always wins (Secret Manager injection / CI overrides).
import { readFileSync, existsSync } from 'node:fs';
import { resolve } from 'node:path';

export function loadEnvLocal(cwd: string = process.cwd()): void {
  for (const name of ['.env.local', '.env']) {
    const file = resolve(cwd, name);
    if (!existsSync(file)) continue;
    for (const rawLine of readFileSync(file, 'utf8').split(/\r?\n/)) {
      const line = rawLine.trim();
      if (!line || line.startsWith('#')) continue;
      const eq = line.indexOf('=');
      if (eq === -1) continue;
      const key = line.slice(0, eq).trim();
      let value = line.slice(eq + 1).trim();
      if ((value.startsWith('"') && value.endsWith('"')) || (value.startsWith("'") && value.endsWith("'"))) {
        value = value.slice(1, -1);
      }
      if (!(key in process.env)) process.env[key] = value;
    }
  }
}

export const config = {
  get port(): number {
    return Number(process.env.PORT ?? 5175);
  },
  get projectId(): string {
    return process.env.FIREBASE_PROJECT_ID ?? 'lucilio-dev';
  },
  // Emulator-first for local dev, but FAIL CLOSED on real deployments: a Cloud
  // Run instance (K_SERVICE set) or NODE_ENV=production that forgets the env
  // var must get production behavior (live Admin SDK, full CSP), never
  // emulator mode. An explicit FIREBASE_EMULATORS always wins.
  get useEmulators(): boolean {
    const explicit = process.env.FIREBASE_EMULATORS;
    if (explicit === 'true') return true;
    if (explicit === 'false') return false;
    return !(process.env.K_SERVICE || process.env.NODE_ENV === 'production');
  },
  get geminiApiKey(): string {
    return process.env.GEMINI_API_KEY ?? '';
  },
  // Google Maps Platform key (Street View Static + metadata) for Atlas vantage
  // imagery. Server-side only: the browser gets same-origin proxied images.
  // Without it the Atlas serves typographic plates — an optional enhancement,
  // never a dependency (same ethos as mock-Gemini mode).
  get mapsApiKey(): string {
    return process.env.GOOGLE_MAPS_API_KEY ?? '';
  },
  // Mock-Gemini mode: deterministic fixtures when no key is present.
  get mockGemini(): boolean {
    return !process.env.GEMINI_API_KEY;
  },
  get enforceAppCheck(): boolean {
    return process.env.ENFORCE_APP_CHECK === 'true';
  },
  // Dev/local trigger for the cycle endpoint (production uses OIDC).
  get internalCycleToken(): string {
    return process.env.INTERNAL_CYCLE_TOKEN ?? 'lucilio-local-cycle';
  },
  // Cloud Run base URL is the expected OIDC audience for the scheduler job.
  get publicUrl(): string {
    return process.env.PUBLIC_URL ?? `http://localhost:${this.port}`;
  },
  get schedulerServiceAccountEmail(): string {
    return process.env.SCHEDULER_SA_EMAIL ?? '';
  },
};

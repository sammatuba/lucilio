// Runs a vitest target under a SECOND set of emulators (firebase.test.json,
// ports 19099/18081) so `npm run dev` can stay up while tests run.
//   node scripts/run-emulated-tests.mjs tests/integration
import { spawnSync } from 'node:child_process';

process.env.FIREBASE_AUTH_EMULATOR_HOST = '127.0.0.1:19099';
process.env.FIRESTORE_EMULATOR_HOST = '127.0.0.1:18081';
// Tests must be deterministic regardless of local secrets: a GEMINI_API_KEY
// in .env.local would silently flip the pipeline into live-Gemini mode. Set
// (not delete) the var so loadEnvLocal's "process env wins" rule keeps it
// empty — an empty key IS mock mode for the server.
process.env.GEMINI_API_KEY = '';
delete process.env.GEMINI_MODEL;

const target = process.argv[2] ?? 'tests/integration';
const result = spawnSync(
  process.execPath,
  [
    'scripts/with-java.mjs',
    'firebase',
    'emulators:exec',
    '--config',
    'firebase.test.json',
    '--only',
    'auth,firestore',
    '--project',
    'lucilio-dev',
    `vitest run ${target}`,
  ],
  { stdio: 'inherit' },
);
process.exit(result.status ?? 1);

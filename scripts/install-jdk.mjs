// Downloads + extracts a local Temurin JDK 21 for the Firebase emulators.
// Idempotent: skips when .tools/jdk-* already exists. Kept out of git via .tools/.
import { execFileSync } from 'node:child_process';
import { existsSync, mkdirSync, readdirSync, rmSync } from 'node:fs';
import { resolve } from 'node:path';

const tools = resolve('.tools');
const existing = existsSync(tools) ? readdirSync(tools).filter((d) => d.startsWith('jdk-')) : [];
if (existing.length > 0) {
  console.log(`JDK already present: ${existing[0]}`);
  process.exit(0);
}
mkdirSync(tools, { recursive: true });
const zip = resolve(tools, 'jdk21.zip');
console.log('downloading Temurin JDK 21 (~190 MB)...');
execFileSync('curl', ['-sSL', '-o', zip, 'https://api.adoptium.net/v3/binary/latest/21/ga/windows/x64/jdk/hotspot/normal/eclipse?project=jdk'], { stdio: 'inherit' });
console.log('extracting...');
const TAR = process.env.SystemRoot ? resolve(process.env.SystemRoot, 'System32', 'tar.exe') : 'tar';
execFileSync(TAR, ['-xf', zip, '-C', tools], { stdio: 'inherit' });
rmSync(zip, { force: true });
const dirs = readdirSync(tools).filter((d) => d.startsWith('jdk-'));
console.log(`JDK ready: ${resolve(tools, dirs[0] ?? '')}`);

// Prepends the local JDK (.tools/jdk-*) to JAVA_HOME/PATH, then runs the
// remaining command. Required because the Firebase emulators need Java and we
// deliberately install it project-locally (no global system changes).
// If no project-local JDK exists but a Java runtime is already available
// (JAVA_HOME set, or `java` on PATH — e.g. CI's setup-java), that is used.
//
// On Windows we invoke `firebase` as `node node_modules/firebase-tools/lib/bin/firebase.js`
// with shell:false — spawnSync's shell path mangles the quoted emulator:exec
// command ("vitest run ..."), which firebase rejects as "too many arguments".
import { existsSync, readdirSync } from 'node:fs';
import { resolve } from 'node:path';
import { spawnSync } from 'node:child_process';

const tools = resolve('.tools');
const jdkDir = existsSync(tools) ? readdirSync(tools).find((d) => d.startsWith('jdk-')) : undefined;
const sep = process.platform === 'win32' ? ';' : ':';

if (jdkDir) {
  const jdkHome = resolve(tools, jdkDir);
  process.env.JAVA_HOME = jdkHome;
  process.env.PATH = `${resolve(jdkHome, 'bin')}${sep}${process.env.PATH ?? ''}`;
} else if (process.env.JAVA_HOME && existsSync(resolve(process.env.JAVA_HOME, 'bin'))) {
  process.env.PATH = `${resolve(process.env.JAVA_HOME, 'bin')}${sep}${process.env.PATH ?? ''}`;
} else {
  const probe = spawnSync('java', ['-version'], { stdio: 'ignore' });
  if (probe.error || probe.status !== 0) {
    console.error('No Java runtime found — run: npm run setup:jdk (or set JAVA_HOME)');
    process.exit(1);
  }
}

const [cmd, ...args] = process.argv.slice(2);
if (!cmd) {
  console.error('usage: node scripts/with-java.mjs <command> [args...]');
  process.exit(1);
}

let file = cmd;
let finalArgs = args;
if (cmd === 'firebase') {
  file = process.execPath;
  finalArgs = [resolve('node_modules', 'firebase-tools', 'lib', 'bin', 'firebase.js'), ...args];
}

const result = spawnSync(file, finalArgs, { stdio: 'inherit' });
process.exit(result.status ?? 1);

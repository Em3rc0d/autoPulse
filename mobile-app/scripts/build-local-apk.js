#!/usr/bin/env node
'use strict';

// Offline-friendly local build. Never calls GitHub Actions or cloud build services.
// Internal signed RELEASE variant, not a production/Play Store signing artifact.
const fs = require('node:fs');
const path = require('node:path');
const os = require('node:os');
const crypto = require('node:crypto');
const { spawnSync } = require('node:child_process');

const root = path.resolve(__dirname, '..');
const args = process.argv.slice(2);
const checkOnly = args.includes('--check');
const skipCi = args.includes('--skip-install');
const allowedArgs = new Set(['--check', '--skip-install']);
for (const arg of args) if (!allowedArgs.has(arg)) throw Error('Unsupported option: ' + arg);

function exists(file) { return fs.existsSync(file); }
function fail(message) { console.error('[AutoPulse APK] BLOCKED: ' + message); process.exit(1); }
function run(executable, commands, extraEnv) {
  console.log('[AutoPulse APK] ' + executable + ' ' + commands.join(' '));
  const result = spawnSync(executable, commands, {
    cwd: root,
    env: { ...process.env, ...extraEnv },
    stdio: 'inherit',
    shell: process.platform === 'win32',
  });
  if (result.error) fail(result.error.message);
  if (result.status !== 0) fail(executable + ' failed with exit code ' + result.status);
}

const sdkCandidates = [
  process.env.ANDROID_HOME,
  process.env.ANDROID_SDK_ROOT,
  process.platform === 'win32' && process.env.LOCALAPPDATA
    ? path.join(process.env.LOCALAPPDATA, 'Android', 'Sdk')
    : path.join(os.homedir(), 'Android', 'Sdk'),
].filter(Boolean);
const sdk = sdkCandidates.find(value => exists(path.join(value, 'platforms', 'android-36')));
if (!sdk) fail('Android SDK with platforms/android-36 is missing. Install Android SDK API 36 and set ANDROID_HOME.');
if (!exists(path.join(root, 'android', 'gradlew')) ||
    !exists(path.join(root, 'android', 'gradlew.bat'))) {
  fail('Gradle wrapper missing. Use the complete repository including mobile-app/android.');
}
const java = spawnSync('java', ['-version'], { encoding: 'utf8', shell: process.platform === 'win32' });
if (java.error || java.status !== 0) fail('JDK 17+ is missing. Set JAVA_HOME and install the JDK.');
if (!exists(path.join(root, 'package-lock.json'))) fail('package-lock.json is missing.');
if (!exists(path.join(root, 'app.json'))) fail('Expo configuration missing.');
run(process.execPath, [path.join(root, 'scripts', 'apply-approved-icon.js'), '--check']);
if (checkOnly) {
  console.log('[AutoPulse APK] PREFLIGHT PASS: SDK, Gradle wrapper, Java, approved icon.');
  process.exit(0);
}
if (!skipCi) run('npm', ['ci', '--no-audit', '--no-fund']);
if (!exists(path.join(root, 'node_modules', 'typescript')) ||
    !exists(path.join(root, 'node_modules', 'jest'))) {
  fail('Dependencies missing. Run npm ci first or omit --skip-install.');
}
run('npm', ['run', 'verify']);
const gradlew = process.platform === 'win32' ? 'gradlew.bat' : './gradlew';
console.log('[AutoPulse APK] Building internal signed RELEASE APK with embedded JS assets.');
const result = spawnSync(gradlew, ['--no-daemon', ':app:assembleRelease'], {
  cwd: path.join(root, 'android'),
  env: { ...process.env, ANDROID_HOME: sdk, ANDROID_SDK_ROOT: sdk, AUTOPULSE_INTERNAL_RELEASE: 'true' },
  stdio: 'inherit',
  shell: process.platform === 'win32',
});
if (result.error || result.status !== 0) fail('Gradle assembleRelease failed.');
const apk = path.join(root, 'android', 'app', 'build', 'outputs', 'apk', 'release', 'app-release.apk');
if (!exists(apk)) fail('Gradle finished but app-release.apk does not exist.');
const bytes = fs.readFileSync(apk);
const sha256 = crypto.createHash('sha256').update(bytes).digest('hex');
const destination = path.join(root, 'dist');
fs.mkdirSync(destination, { recursive: true });
const out = path.join(destination, 'autopulse-internal-' + sha256.slice(0, 12) + '.apk');
fs.copyFileSync(apk, out);
fs.writeFileSync(out + '.json', JSON.stringify({
  kind: 'INTERNAL_ANDROID_TEST_ONLY',
  sha256,
  sizeBytes: bytes.length,
  createdAt: new Date().toISOString(),
  productionSigned: false,
  certifiedOnRealVehicle: false
}, null, 2) + '\n');
console.log('[AutoPulse APK] CREATED ' + out);
console.log('[AutoPulse APK] SHA-256 ' + sha256);
console.log('[AutoPulse APK] Internal QA only. Not a public Play Store release.');

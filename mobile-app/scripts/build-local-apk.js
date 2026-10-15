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
const packageConfig = JSON.parse(fs.readFileSync(path.join(root, 'package.json'), 'utf8'));
if (packageConfig.main !== 'index.js' || !exists(path.join(root, 'index.js'))) {
  fail('Expected custom index.js entrypoint to register the foreground service and Expo app.');
}
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
// The checked-in Unix gradlew currently has mode 100644. Invoke it through sh,
// so a fresh clone can build without relying on an executable-bit change.
const gradlew = process.platform === 'win32' ? 'gradlew.bat' : 'sh';
const gradleArgs = process.platform === 'win32'
  ? ['--no-daemon', ':app:assembleRelease']
  : ['gradlew', '--no-daemon', ':app:assembleRelease'];
console.log('[AutoPulse APK] Building internal signed RELEASE APK with embedded JS assets.');
const result = spawnSync(gradlew, gradleArgs, {
  cwd: path.join(root, 'android'),
  env: { ...process.env, ANDROID_HOME: sdk, ANDROID_SDK_ROOT: sdk, AUTOPULSE_INTERNAL_RELEASE: 'true' },
  stdio: 'inherit',
  shell: process.platform === 'win32',
});
if (result.error || result.status !== 0) fail('Gradle assembleRelease failed.');
const apk = path.join(root, 'android', 'app', 'build', 'outputs', 'apk', 'release', 'app-release.apk');
if (!exists(apk)) fail('Gradle finished but app-release.apk does not exist.');
// A successful Gradle exit is not enough: prove Expo's embedded bundle exists.
const jar = spawnSync('jar', ['tf', apk], { encoding: 'utf8', maxBuffer: 12 * 1024 * 1024,
  shell: process.platform === 'win32' });
if (jar.error || jar.status !== 0) fail('Could not inspect the APK with JDK jar.');
const apkEntries = jar.stdout.split(/\r?\n/);
if (!apkEntries.includes('assets/index.android.bundle')) {
  fail('APK does not contain assets/index.android.bundle; not a standalone installable release.');
}
const buildToolsRoot = path.join(sdk, 'build-tools');
const buildTools = exists(buildToolsRoot)
  ? fs.readdirSync(buildToolsRoot).sort((a, b) => b.localeCompare(a, undefined, { numeric: true }))
  : [];
const signerExe = process.platform === 'win32' ? 'apksigner.bat' : 'apksigner';
const signer = buildTools.map(version => path.join(buildToolsRoot, version, signerExe)).find(exists);
if (!signer) fail('Android apksigner is not installed under SDK/build-tools.');
const signature = spawnSync(signer, ['verify', '--verbose', apk], {
  stdio: 'inherit', shell: process.platform === 'win32',
});
if (signature.error || signature.status !== 0) fail('APK signature verification failed.');
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

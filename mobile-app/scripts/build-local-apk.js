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
const verifyOnly = args.includes('--verify-only');
const allowDirty = args.includes('--allow-dirty');
const allowedArgs = new Set(['--check', '--skip-install', '--verify-only', '--allow-dirty']);
for (const arg of args) if (!allowedArgs.has(arg)) throw Error('Unsupported option: ' + arg);
if (checkOnly && verifyOnly) throw Error('Cannot combine --check with --verify-only');
if (verifyOnly && allowDirty) throw Error('--allow-dirty is meaningless with --verify-only');

function exists(file) { return fs.existsSync(file); }
function fail(message) { console.error('[AutoPulse APK] BLOCKED: ' + message); process.exit(1); }
function sha256File(file) {
  return crypto.createHash('sha256').update(fs.readFileSync(file)).digest('hex');
}
function gitText(repoRoot, gitArgs) {
  const result = spawnSync('git', gitArgs, {
    cwd: repoRoot,
    encoding: 'utf8',
    shell: false,
    maxBuffer: 4 * 1024 * 1024,
  });
  if (result.error || result.status !== 0) {
    fail('Git provenance command failed: git ' + gitArgs.join(' '));
  }
  return result.stdout.trim();
}
function run(executable, commands, extraEnv) {
  // Windows needs a command shell for npm.cmd, but shell:true breaks the
  // absolute node.exe path under "C:\\Program Files" and quoted script args.
  const isWindowsNpm = process.platform === 'win32' && executable === 'npm';
  const command = isWindowsNpm ? 'npm.cmd' : executable;
  console.log('[AutoPulse APK] ' + command + ' ' + commands.join(' '));
  const result = spawnSync(command, commands, {
    cwd: root,
    env: { ...process.env, ...extraEnv },
    stdio: 'inherit',
    shell: isWindowsNpm,
  });
  if (result.error) fail(result.error.message);
  if (result.status !== 0) fail(executable + ' failed with exit code ' + result.status);
}

const repoRoot = path.resolve(root, '..');
const packageLockPath = path.join(root, 'package-lock.json');

const sourceCommit = verifyOnly ? null : gitText(repoRoot, ['rev-parse', 'HEAD']);
const sourceBranch = verifyOnly ? null : gitText(repoRoot, ['rev-parse', '--abbrev-ref', 'HEAD']);
const workingTreeStatus = verifyOnly ? null : gitText(repoRoot, ['status', '--porcelain', '--untracked-files=all']);
const sourceTreeClean = verifyOnly ? null : workingTreeStatus.length === 0;
const workingTreeStatusSha256 = verifyOnly || sourceTreeClean
  ? null
  : crypto.createHash('sha256').update(workingTreeStatus).digest('hex');

if (!verifyOnly && !sourceTreeClean && !allowDirty) {
  fail('Working tree is not clean. Commit/stash changes before building a certification candidate, or use --allow-dirty for a non-certifiable internal build.');
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
const java = spawnSync('java', ['-version'], { encoding: 'utf8', shell: false });
if (java.error || java.status !== 0) fail('JDK 17+ is missing. Set JAVA_HOME and install the JDK.');
if (!exists(packageLockPath)) fail('package-lock.json is missing.');
if (!exists(path.join(root, 'app.json'))) fail('Expo configuration missing.');
const packageConfig = JSON.parse(fs.readFileSync(path.join(root, 'package.json'), 'utf8'));
if (packageConfig.main !== 'index.js' || !exists(path.join(root, 'index.js'))) {
  fail('Expected custom index.js entrypoint to register the foreground service and Expo app.');
}
run(process.execPath, [path.join(root, 'scripts', 'install-approved-icon.js')]);
run(process.execPath, [path.join(root, 'scripts', 'apply-approved-icon.js'), '--check']);
if (!verifyOnly) {
  // Prevent Expo from inlining real Gemini credentials into the signed APK.
  run(process.execPath, [path.join(root, 'scripts', 'security', 'validate-android-build-env.js')]);
}
if (checkOnly) {
  console.log('[AutoPulse APK] PREFLIGHT PASS: SDK, Gradle wrapper, Java, approved icon.');
  process.exit(0);
}
if (!verifyOnly) {
  if (!skipCi) run('npm', ['ci', '--no-audit', '--no-fund']);
  if (!exists(path.join(root, 'node_modules', 'typescript')) ||
      !exists(path.join(root, 'node_modules', 'jest'))) {
    fail('Dependencies missing. Run npm ci first or omit --skip-install.');
  }
  run('npm', ['run', 'verify']);
  // The checked-in Unix gradlew currently has mode 100644. Invoke it through sh.
  const gradlew = process.platform === 'win32' ? 'gradlew.bat' : 'sh';
  const gradleArgs = process.platform === 'win32'
    ? ['--no-daemon', ':app:assembleRelease']
    : ['gradlew', '--no-daemon', ':app:assembleRelease'];
  console.log('[AutoPulse APK] Building internal signed RELEASE APK with embedded JS assets.');
  const result = spawnSync(gradlew, gradleArgs, {
    cwd: path.join(root, 'android'),
    env: { ...process.env, ANDROID_HOME: sdk, ANDROID_SDK_ROOT: sdk, AUTOPULSE_INTERNAL_RELEASE: 'true', NODE_ENV: 'production' },
    stdio: 'inherit',
    shell: process.platform === 'win32',
  });
  if (result.error || result.status !== 0) fail('Gradle assembleRelease failed.');
} else {
  console.log('[AutoPulse APK] VERIFY ONLY: using existing APK; skipping npm, Jest and Gradle.');
}
const apk = path.join(root, 'android', 'app', 'build', 'outputs', 'apk', 'release', 'app-release.apk');
if (!exists(apk)) fail('Gradle finished but app-release.apk does not exist.');
// A successful Gradle exit is not enough: prove the embedded JS bundle exists.
// Windows JDK installations can provide java.exe without jar.exe on PATH.
// Use Windows PowerShell's built-in .NET ZIP reader with an encoded command,
// avoiding cmd.exe quoting problems for paths containing spaces.
if (process.platform === 'win32') {
  const quotedApk = apk.replace(/'/g, "''");
  const ps = [
    "$ErrorActionPreference = 'Stop'",
    'Add-Type -AssemblyName System.IO.Compression.FileSystem',
    "$archive = [System.IO.Compression.ZipFile]::OpenRead('" + quotedApk + "')",
    'try {',
    "  $bundle = $archive.GetEntry('assets/index.android.bundle')",
    "  $manifest = $archive.GetEntry('AndroidManifest.xml')",
    "  if ($null -eq $bundle -or $bundle.Length -le 0 -or $null -eq $manifest) { throw 'MISSING_OR_EMPTY_BUNDLE_OR_MANIFEST' }",
    "  Write-Output 'AUTOPULSE_APK_BUNDLE_VERIFIED'",
    '} finally { $archive.Dispose() }',
  ].join('\n');
  const encoded = Buffer.from(ps, 'utf16le').toString('base64');
  const inspection = spawnSync('powershell.exe', [
    '-NoProfile', '-NonInteractive', '-EncodedCommand', encoded,
  ], { encoding: 'utf8', shell: false, maxBuffer: 4 * 1024 * 1024 });
  if (inspection.error || inspection.status !== 0 ||
      !inspection.stdout.includes('AUTOPULSE_APK_BUNDLE_VERIFIED')) {
    fail('APK ZIP or JS bundle inspection failed: ' +
      (inspection.error?.message ?? inspection.stderr ?? 'no matching bundle'));
  }
} else {
  const jar = spawnSync('jar', ['tf', apk], {
    encoding: 'utf8', maxBuffer: 12 * 1024 * 1024, shell: false,
  });
  if (jar.error || jar.status !== 0 ||
      !jar.stdout.split(/\r?\n/).includes('assets/index.android.bundle')) {
    fail('Could not verify APK JS bundle using JDK jar.');
  }
}
console.log('[AutoPulse APK] Embedded JS bundle and ZIP structure verified.');
const buildToolsRoot = path.join(sdk, 'build-tools');
const buildTools = exists(buildToolsRoot)
  ? fs.readdirSync(buildToolsRoot).sort((a, b) => b.localeCompare(a, undefined, { numeric: true }))
  : [];
const signerExe = process.platform === 'win32' ? 'apksigner.bat' : 'apksigner';
const signer = buildTools.map(version => path.join(buildToolsRoot, version, signerExe)).find(exists);
if (!signer) fail('Android apksigner is not installed under SDK/build-tools.');
// Use the Java entrypoint on Windows to keep paths with spaces intact.
// apksigner.bat is a wrapper around build-tools/lib/apksigner.jar.
const signerCommand = process.platform === 'win32' ? 'java' : signer;
const signerArgs = process.platform === 'win32'
  ? ['-jar', path.join(path.dirname(signer), 'lib', 'apksigner.jar'), 'verify', '--verbose', apk]
  : ['verify', '--verbose', apk];
if (process.platform === 'win32' && !exists(signerArgs[1])) {
  fail('Android apksigner.jar is missing under SDK/build-tools.');
}
const signature = spawnSync(signerCommand, signerArgs, {
  stdio: 'inherit', shell: false,
});
if (signature.error || signature.status !== 0) fail('APK signature verification failed.');

const aapt2Name = process.platform === 'win32' ? 'aapt2.exe' : 'aapt2';
const aapt2 = buildTools.map(version => path.join(buildToolsRoot, version, aapt2Name)).find(exists);
if (!aapt2) fail('Android aapt2 is missing; cannot check effective APK permissions.');
function aapt2Dump(type) {
  const res = spawnSync(aapt2, ['dump', type, apk], {
    encoding: 'utf8', shell: false, maxBuffer: 8 * 1024 * 1024,
  });
  if (res.error || res.status !== 0) {
    fail('aapt2 dump ' + type + ' failed: ' + (res.error?.message ?? res.stderr ?? 'unknown error'));
  }
  return res.stdout;
}
const badging = aapt2Dump('badging');
if (!/targetSdkVersion:'36'/.test(badging) ||
    !/package: name='com\.em3rc0dth\.autopulse'/.test(badging)) {
  fail('APK package identity or Android target SDK does not match V1 contract.');
}
const permissionDump = aapt2Dump('permissions');
const actualPermissions = [...permissionDump.matchAll(/^(?:uses-permission|uses-permission-sdk-23):\s+name='([^']+)'/gm)]
  .map(match => match[1]);
const allowedPermissions = new Set([
  'android.permission.ACCESS_COARSE_LOCATION',
  'android.permission.ACCESS_FINE_LOCATION',
  'android.permission.ACCESS_NETWORK_STATE',
  'android.permission.BLUETOOTH',
  'android.permission.BLUETOOTH_ADMIN',
  'android.permission.BLUETOOTH_CONNECT',
  'android.permission.BLUETOOTH_SCAN',
  'android.permission.FOREGROUND_SERVICE',
  'android.permission.FOREGROUND_SERVICE_CONNECTED_DEVICE',
  'android.permission.INTERNET',
  'android.permission.POST_NOTIFICATIONS',
  'android.permission.VIBRATE',
  'android.permission.WAKE_LOCK',
  'com.em3rc0dth.autopulse.DYNAMIC_RECEIVER_NOT_EXPORTED_PERMISSION',
]);
const requiredPermissions = [
  'android.permission.ACCESS_COARSE_LOCATION',
  'android.permission.ACCESS_FINE_LOCATION',
  'android.permission.BLUETOOTH',
  'android.permission.BLUETOOTH_ADMIN',
  'android.permission.BLUETOOTH_CONNECT',
  'android.permission.BLUETOOTH_SCAN',
  'android.permission.FOREGROUND_SERVICE',
  'android.permission.FOREGROUND_SERVICE_CONNECTED_DEVICE',
  'android.permission.INTERNET',
  'android.permission.POST_NOTIFICATIONS',
  'android.permission.VIBRATE',
  'android.permission.WAKE_LOCK',
];
const unexpectedPermissions = actualPermissions.filter(name => !allowedPermissions.has(name));
const missingRequired = requiredPermissions.filter(name => !actualPermissions.includes(name));
if (actualPermissions.length === 0 || unexpectedPermissions.length || missingRequired.length) {
  fail('Effective APK permissions violate V1 policy. Unexpected: ' +
    JSON.stringify(unexpectedPermissions) + '; missing: ' + JSON.stringify(missingRequired));
}
console.log('[AutoPulse APK] Effective permissions V1 verified (' + actualPermissions.length + ').');
const bytes = fs.readFileSync(apk);
const sha256 = crypto.createHash('sha256').update(bytes).digest('hex');
const packageLockSha256 = sha256File(packageLockPath);
const certificationEligible = !verifyOnly && sourceTreeClean === true;
const destination = path.join(root, 'dist');
fs.mkdirSync(destination, { recursive: true });
const out = path.join(destination, 'autopulse-internal-' + sha256.slice(0, 12) + '.apk');
fs.copyFileSync(apk, out);
fs.writeFileSync(out + '.json', JSON.stringify({
  schemaVersion: 2,
  kind: 'INTERNAL_ANDROID_TEST_ONLY',
  sha256,
  sizeBytes: bytes.length,
  createdAt: new Date().toISOString(),
  verifiedOnly: verifyOnly,
  certificationEligible,
  sourceCommit,
  sourceBranch,
  sourceTreeClean,
  workingTreeStatusSha256,
  packageLockSha256,
  sourceCommitNote: verifyOnly
    ? 'An existing APK was inspected; source provenance must come from its original build receipt.'
    : sourceTreeClean
      ? 'Source HEAD and clean working tree were captured before build.'
      : 'Built with --allow-dirty. The APK is internal-only and is NOT eligible for physical certification.',
  packageName: 'com.em3rc0dth.autopulse',
  androidTargetSdk: 36,
  permissionNames: [...new Set(actualPermissions)].sort(),
  productionSigned: false,
  certifiedOnRealVehicle: false
}, null, 2) + '\n');
console.log('[AutoPulse APK] CREATED ' + out);
console.log('[AutoPulse APK] SHA-256 ' + sha256);
console.log('[AutoPulse APK] Internal QA only. Not a public Play Store release.');

#!/usr/bin/env node
'use strict';

const fs = require('node:fs');
const path = require('node:path');
const os = require('node:os');
const crypto = require('node:crypto');
const { spawnSync } = require('node:child_process');

const root = path.resolve(__dirname, '..');
const packageName = process.argv[2] || 'com.em3rc0dth.autopulse';

function fail(message, code = 1) {
  console.error('[AutoPulse Artifact] BLOCKED: ' + message);
  process.exit(code);
}

function adb(args, options = {}) {
  const result = spawnSync('adb', args, {
    encoding: 'utf8',
    shell: false,
    maxBuffer: 16 * 1024 * 1024,
    ...options,
  });
  if (result.error) fail('adb unavailable: ' + result.error.message);
  if (result.status !== 0) {
    fail('adb ' + args.join(' ') + ' failed: ' + (result.stderr || result.stdout || 'unknown error').trim());
  }
  return result.stdout || '';
}

function sha256File(file) {
  return crypto.createHash('sha256').update(fs.readFileSync(file)).digest('hex');
}

const state = adb(['get-state']).trim();
if (state !== 'device') fail('No authorized Android device is connected.');

const pathsOutput = adb(['shell', 'pm', 'path', packageName]);
const installedPaths = pathsOutput
  .split(/\r?\n/)
  .map(line => line.trim())
  .filter(line => line.startsWith('package:'))
  .map(line => line.slice('package:'.length));

if (installedPaths.length === 0) fail('Package is not installed: ' + packageName);

const basePath = installedPaths.find(value => /\/base\.apk$/.test(value)) || installedPaths[0];
const tempDir = fs.mkdtempSync(path.join(os.tmpdir(), 'autopulse-installed-'));
const pulledApk = path.join(tempDir, 'installed-base.apk');

try {
  adb(['pull', basePath, pulledApk], { stdio: ['ignore', 'pipe', 'pipe'] });
  if (!fs.existsSync(pulledApk)) fail('adb pull completed but installed APK was not found locally.');

  const installedSha256 = sha256File(pulledApk);
  const dist = path.join(root, 'dist');
  const receipts = fs.existsSync(dist)
    ? fs.readdirSync(dist).filter(name => name.endsWith('.apk.json')).sort()
    : [];

  const matches = [];
  for (const name of receipts) {
    const receiptPath = path.join(dist, name);
    try {
      const receipt = JSON.parse(fs.readFileSync(receiptPath, 'utf8'));
      if (typeof receipt.sha256 === 'string' && receipt.sha256.toLowerCase() === installedSha256) {
        matches.push({ receiptFile: name, receipt });
      }
    } catch (error) {
      console.warn('[AutoPulse Artifact] Ignoring unreadable receipt ' + name + ': ' + error.message);
    }
  }

  const packageDump = adb(['shell', 'dumpsys', 'package', packageName]);
  const versionName = packageDump.match(/\bversionName=([^\s]+)/)?.[1] || null;
  const versionCode = packageDump.match(/\bversionCode=(\d+)/)?.[1] || null;

  const result = {
    packageName,
    versionName,
    versionCode,
    installedBasePath: basePath,
    installedSha256,
    knownReceiptMatches: matches.map(item => ({
      receiptFile: item.receiptFile,
      sourceCommit: item.receipt.sourceCommit ?? null,
      sourceBranch: item.receipt.sourceBranch ?? null,
      sourceTreeClean: item.receipt.sourceTreeClean ?? null,
      certificationEligible: item.receipt.certificationEligible ?? false,
      createdAt: item.receipt.createdAt ?? null,
    })),
  };

  console.log(JSON.stringify(result, null, 2));

  if (matches.length === 0) {
    fail('UNKNOWN_INSTALLED_ARTIFACT: installed APK SHA-256 does not match any local dist/*.apk.json receipt.', 2);
  }
  if (matches.length > 1) {
    console.warn('[AutoPulse Artifact] Multiple receipts match the same APK hash; review provenance duplicates.');
  }

  const eligible = matches.some(item => item.receipt.certificationEligible === true);
  if (!eligible) {
    fail('Installed APK is known but no matching receipt is certification-eligible.', 3);
  }

  console.log('[AutoPulse Artifact] VERIFIED: installed APK matches a certification-eligible local receipt.');
} finally {
  fs.rmSync(tempDir, { recursive: true, force: true });
}

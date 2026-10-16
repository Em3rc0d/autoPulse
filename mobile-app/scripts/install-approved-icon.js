#!/usr/bin/env node
'use strict';

// Extract the exact user-approved AutoPulse launcher icon assets.
// The archive is committed as a Git binary blob and verified before extraction.
// Avoid npm/pip dependencies so CI can verify icons before installing any packages.
const fs = require('node:fs');
const path = require('node:path');
const crypto = require('node:crypto');
const { spawnSync } = require('node:child_process');
const repo = path.resolve(__dirname, '..', '..');
const archive = path.resolve(repo, 'mobile-app/assets/approved-icon-assets.zip');
const expected = '8ade7116a2e6ea5f0b148c049fcab2e2b488ce2c14684a32fcd1f18a51420341';

function die(msg) { console.error('[AutoPulse artwork] BLOCKED: '+msg);process.exit(1); }
if (!fs.existsSync(archive)) die('Approved icon archive is missing from repository.');
const actual = crypto.createHash('sha256').update(fs.readFileSync(archive)).digest('hex');
if (actual !== expected) die('Approved artwork archive integrity mismatch: '+actual);

let command, args;
if (process.platform === 'win32') {
  command = 'powershell.exe';
  args = ['-NoProfile','-NonInteractive','-Command',
    'Expand-Archive -LiteralPath '+JSON.stringify(archive)+' -DestinationPath '+JSON.stringify(repo)+' -Force'];
} else {
  command = 'unzip';
  args = ['-q','-o',archive,'-d',repo];
}
const unpack = spawnSync(command,args,{stdio:'inherit',shell:false});
if (unpack.error || unpack.status !== 0) die('Unable to unpack approved icon archive.');
const verify=spawnSync(process.execPath,[path.join(repo,'mobile-app/scripts/apply-approved-icon.js'),'--check'],{
  cwd:path.join(repo,'mobile-app'),stdio:'inherit'
});
if(verify.error || verify.status!==0) die('Approved icon file manifest did not verify.');
console.log('[AutoPulse artwork] VERIFIED: exact original approved ZIP and all Android launcher assets.');

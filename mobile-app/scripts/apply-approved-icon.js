#!/usr/bin/env node
'use strict';

// Install only the user-approved AutoPulse artwork, with exact SHA-256 verification.
// Usage: npm run icon:apply -- --source "/path/to/autopulse_icon_ready"
const fs = require('node:fs');
const path = require('node:path');
const crypto = require('node:crypto');
const root = path.resolve(__dirname, '..', '..');
const checksums = require('./approved-icon-hashes.json');
const args = process.argv.slice(2);
const checkOnly = args.includes('--check');
const sourceIndex = args.indexOf('--source');
const input = sourceIndex >= 0 ? args[sourceIndex + 1] : null;

function fail(message) { console.error('[AutoPulse icon] ' + message); process.exit(1); }
function digest(file) { return crypto.createHash('sha256').update(fs.readFileSync(file)).digest('hex'); }
if (!checkOnly && !input) fail('Expected --source pointing to extracted autopulse_icon_ready folder.');
if (sourceIndex >= 0 && !input) fail('Missing value for --source.');
const sourceRoot = input ? path.resolve(input) : null;
let copied = 0;
for (const [relative, expected] of Object.entries(checksums)) {
  // Source ZIP includes play-store/icon-512.png but it is not a packaged Android resource.
  const source = sourceRoot ? path.join(sourceRoot, relative) : null;
  const target = relative.startsWith('play-store/')
    ? path.join(root, relative)
    : path.join(root, relative);
  if (!checkOnly) {
    if (!fs.existsSync(source)) fail('Missing approved artwork: ' + source);
    if (digest(source) !== expected) fail('Approved artwork hash mismatch: ' + relative);
    fs.mkdirSync(path.dirname(target), { recursive: true });
    fs.copyFileSync(source, target);
    copied++;
  }
  if (!fs.existsSync(target) || digest(target) !== expected) {
    fail('Repository icon missing or wrong: ' + relative + '. Apply approved icon ZIP before building.');
  }
}
console.log('[AutoPulse icon] ' + (checkOnly ? 'Verified' : 'Installed and verified') +
  ' ' + Object.keys(checksums).length + ' approved files' + (checkOnly ? '' : ' (' + copied + ' copied)') + '.');

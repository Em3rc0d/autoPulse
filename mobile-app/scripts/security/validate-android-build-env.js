#!/usr/bin/env node
'use strict';

// Fail closed before packaging Android: EXPO_PUBLIC_* values are client-readable.
// Do not print environment values or credential material.
const fs = require('node:fs');
const path = require('node:path');

function hasConfiguredValue(value) {
  if (typeof value !== 'string') return false;
  let text = value.trim();
  if (text.length >= 2 &&
      ((text.startsWith('"') && text.endsWith('"')) ||
       (text.startsWith("'") && text.endsWith("'")))) {
    text = text.slice(1, -1).trim();
  }
  return text.length > 0;
}

function findExposedGeminiSources(env, dotenvFiles) {
  const sources = [];
  if (hasConfiguredValue(env.EXPO_PUBLIC_GEMINI_API_KEY)) {
    sources.push('process environment');
  }
  for (const file of dotenvFiles) {
    const lines = file.content.split(/\r?\n/);
    for (const line of lines) {
      const match = line.match(/^\s*(?:export\s+)?EXPO_PUBLIC_GEMINI_API_KEY\s*=\s*(.*)$/);
      if (match && hasConfiguredValue(match[1].replace(/\s+#.*$/, ''))) {
        sources.push(file.name);
        break;
      }
    }
  }
  return sources;
}

function main() {
  const root = path.resolve(__dirname, '../..');
  const expoFiles = ['.env', '.env.local', '.env.production', '.env.production.local'];
  const inputs = expoFiles
    .filter(name => fs.existsSync(path.join(root, name)))
    .map(name => ({ name, content: fs.readFileSync(path.join(root, name), 'utf8') }));
  const sources = findExposedGeminiSources(process.env, inputs);
  if (sources.length) {
    console.error('[AutoPulse security] BLOCKED: a client-readable Gemini credential is configured in ' +
      sources.join(', ') + '. Exclude it from this build and rotate real exposed keys. The key value was not logged.');
    process.exitCode = 1;
    return;
  }
  console.log('[AutoPulse security] PASS: Gemini public-key input not configured.');
}
if (require.main === module) main();
module.exports = { hasConfiguredValue, findExposedGeminiSources };

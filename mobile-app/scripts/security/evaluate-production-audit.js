const fs = require('fs');
const path = require('path');

const auditPath = process.argv[2] || path.join('.release', 'npm-audit-production.json');
const outputPath = process.argv[3] || path.join('.release', 'npm-audit-policy.json');

const audit = JSON.parse(fs.readFileSync(auditPath, 'utf8'));
const vulnerabilities = audit.vulnerabilities || {};

const blocking = Object.entries(vulnerabilities)
  .filter(([, value]) => value?.severity === 'high' || value?.severity === 'critical')
  .map(([name, value]) => ({
    package: name,
    severity: value.severity,
    via: value.via,
    nodes: value.nodes,
    fixAvailable: value.fixAvailable,
  }));

const result = {
  schema: 'autopulse.npm-audit-policy/v1',
  generatedAt: new Date().toISOString(),
  policy: 'NO_HIGH_OR_CRITICAL',
  auditMetadata: audit.metadata || null,
  approvedExceptions: [],
  blocking,
  passed: blocking.length === 0,
};

fs.mkdirSync(path.dirname(outputPath), { recursive: true });
fs.writeFileSync(outputPath, JSON.stringify(result, null, 2) + '\n');
process.stdout.write(JSON.stringify(result, null, 2) + '\n');

if (!result.passed) process.exitCode = 1;

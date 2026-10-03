const fs = require('fs');
const path = require('path');

const auditPath = process.argv[2] || path.join('.release', 'npm-audit-production.json');
const outputPath = process.argv[3] || path.join('.release', 'npm-audit-policy.json');
const policy = process.env.AUTOPULSE_AUDIT_POLICY || 'NO_HIGH_OR_CRITICAL';

if (!['NO_CRITICAL', 'NO_HIGH_OR_CRITICAL'].includes(policy)) {
  throw new Error(`UNSUPPORTED_AUDIT_POLICY:${policy}`);
}

const audit = JSON.parse(fs.readFileSync(auditPath, 'utf8'));
const vulnerabilities = audit.vulnerabilities || {};

const isBlockingSeverity = severity =>
  policy === 'NO_CRITICAL'
    ? severity === 'critical'
    : severity === 'high' || severity === 'critical';

const blocking = Object.entries(vulnerabilities)
  .filter(([, value]) => isBlockingSeverity(value?.severity))
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
  policy,
  auditMetadata: audit.metadata || null,
  approvedExceptions: [],
  blocking,
  passed: blocking.length === 0,
};

fs.mkdirSync(path.dirname(outputPath), { recursive: true });
fs.writeFileSync(outputPath, JSON.stringify(result, null, 2) + '\n');
process.stdout.write(JSON.stringify(result, null, 2) + '\n');

if (!result.passed) process.exitCode = 1;

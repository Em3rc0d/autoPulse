const fs = require('fs');
const path = require('path');

const auditPath = process.argv[2] || path.join('.release', 'npm-audit-production.json');
const lockPath = process.argv[3] || 'package-lock.json';
const outputPath = process.argv[4] || path.join('.release', 'npm-audit-policy.json');

const audit = JSON.parse(fs.readFileSync(auditPath, 'utf8'));
const lock = JSON.parse(fs.readFileSync(lockPath, 'utf8'));

const APPROVED_IMAGE_SIZE = Object.freeze({
  packageName: 'image-size',
  version: '1.2.1',
  node: 'node_modules/image-size',
  parent: 'node_modules/metro',
  parentVersion: '0.80.12',
  parentDependency: '^1.0.2',
  advisories: Object.freeze([
    'https://github.com/advisories/GHSA-5p2g-fcmc-qvqq',
    'https://github.com/advisories/GHSA-w3rx-r6r6-pgpr',
  ]),
  rationale: 'Build-time Metro asset inspection only; upstream has no published patched image-size release as of the V1 closure review.',
});

function directAdvisoryUrls(vulnerability) {
  if (!Array.isArray(vulnerability.via)) return [];
  return vulnerability.via
    .filter(item => item && typeof item === 'object' && typeof item.url === 'string')
    .map(item => item.url)
    .sort();
}

function reverseParents(packageName) {
  const parents = [];
  for (const [packagePath, meta] of Object.entries(lock.packages || {})) {
    if (meta && meta.dependencies && Object.prototype.hasOwnProperty.call(meta.dependencies, packageName)) {
      parents.push({
        packagePath,
        version: meta.version || null,
        requested: meta.dependencies[packageName],
      });
    }
  }
  return parents.sort((a, b) => a.packagePath.localeCompare(b.packagePath));
}

function imageSizeException(vulnerability) {
  const packageMeta = lock.packages?.[APPROVED_IMAGE_SIZE.node];
  const parents = reverseParents(APPROVED_IMAGE_SIZE.packageName);
  const urls = directAdvisoryUrls(vulnerability);
  const expectedUrls = [...APPROVED_IMAGE_SIZE.advisories].sort();

  const valid = Boolean(
    vulnerability
    && vulnerability.name === APPROVED_IMAGE_SIZE.packageName
    && vulnerability.severity === 'high'
    && vulnerability.isDirect === false
    && packageMeta?.version === APPROVED_IMAGE_SIZE.version
    && Array.isArray(vulnerability.nodes)
    && vulnerability.nodes.length === 1
    && vulnerability.nodes[0] === APPROVED_IMAGE_SIZE.node
    && urls.length === expectedUrls.length
    && urls.every((value, index) => value === expectedUrls[index])
    && parents.length === 1
    && parents[0].packagePath === APPROVED_IMAGE_SIZE.parent
    && parents[0].version === APPROVED_IMAGE_SIZE.parentVersion
    && parents[0].requested === APPROVED_IMAGE_SIZE.parentDependency
  );

  return {
    approved: valid,
    package: APPROVED_IMAGE_SIZE.packageName,
    installedVersion: packageMeta?.version || null,
    advisories: urls,
    parents,
    rationale: APPROVED_IMAGE_SIZE.rationale,
  };
}

const vulnerabilities = audit.vulnerabilities || {};
const highOrCritical = Object.entries(vulnerabilities)
  .filter(([, value]) => value?.severity === 'high' || value?.severity === 'critical');

const approvedExceptions = [];
const blocking = [];

for (const [name, vulnerability] of highOrCritical) {
  if (name === APPROVED_IMAGE_SIZE.packageName) {
    const decision = imageSizeException(vulnerability);
    if (decision.approved) {
      approvedExceptions.push(decision);
      continue;
    }
    blocking.push({
      package: name,
      severity: vulnerability.severity,
      reason: 'IMAGE_SIZE_EXCEPTION_CONTRACT_MISMATCH',
      detail: decision,
    });
    continue;
  }

  blocking.push({
    package: name,
    severity: vulnerability.severity,
    via: vulnerability.via,
    nodes: vulnerability.nodes,
    fixAvailable: vulnerability.fixAvailable,
  });
}

const result = {
  schema: 'autopulse.npm-audit-policy/v1',
  generatedAt: new Date().toISOString(),
  auditMetadata: audit.metadata || null,
  approvedExceptions,
  blocking,
  passed: blocking.length === 0,
};

fs.mkdirSync(path.dirname(outputPath), { recursive: true });
fs.writeFileSync(outputPath, JSON.stringify(result, null, 2) + '\n');
process.stdout.write(JSON.stringify(result, null, 2) + '\n');

if (!result.passed) {
  process.exitCode = 1;
}

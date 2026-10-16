# Security review — AutoPulse V1 stabilization (2026-10-15)

Scope: npm production dependency audit for the release-hardening branch. Evidence: GitHub Actions PR #95, run 38817512784, artifact `autopulse-production-dependency-audit` (65 aggregated findings, including 13 critical chains).

## Remediations
- Upgrade the explicitly overridden `shell-quote` from 1.10.0 to **1.11.0**, which addresses the critical GHSA-pqg4-j6r4-53mv, and keep matching lockfile integrity.
- Upgrade direct runtime dependency `axios` from 1.18.1 to **1.20.0** with matching lockfile integrity; its HTTP/fetch security fixes apply to mobile app dependencies as well as developer tooling.
- Do not run `npm audit fix --force` or auto-upgrade React Native 0.74 / Expo SDK 51; this would be a different architecture/compatibility migration requiring its own certification.

## Approved icon provenance
The original user-approved image asset ZIP is committed at `mobile-app/assets/approved-icon-assets.zip` and checked against SHA-256 `8ade7116a2e6ea5f0b148c049fcab2e2b488ce2c14684a32fcd1f18a51420341`; each extracted image is independently checked against `scripts/approved-icon-hashes.json` before release builds. No regenerated logo may replace these files.

## Gate
```
cd mobile-app
npm ci
npm run verify
npm audit --omit=dev --audit-level=critical
```

Release gate remains **PENDING** until CI confirms these commands on the updated exact commit; no inferred closure, no suppression of advisories. Even if the critical gate passes, all remaining high/moderate findings must be evaluated for exploitability and reachability before **public** release. A green critical gate certifies neither general absence of vulnerabilities nor runtime physical safety.

## CI evidence and risk
GitHub npm audit labels transitive tooling packages such as `@react-native-community/cli-tools`, `react-devtools-core` and Metro as production in the Node dependency graph, though they are primarily used in tooling and do not automatically imply the corresponding code is in the standalone APK. This is **not** a waiver: verify bundle/native reachability before assigning runtime exploitability. No telemetry export should be added as part of this security hardening.

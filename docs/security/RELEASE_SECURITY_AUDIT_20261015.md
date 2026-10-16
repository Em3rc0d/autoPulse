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
GitHub npm audit labels transitive tooling packages such as `@react-native-community/cli-tools`, `react-devtools-core` and Metro as production in the Node dependency graph, though they are primarily used in tooling and do not automatically imply the corresponding code is in the standalone APK. This is **not** a waiver: verify bundle/native reachability before assigning runtime exploitability. Security-hardening changes alone should not introduce telemetry export. **MK10.5 subsequently introduced a separate, deliberately scoped user-initiated post-session local JSON export** documented in `docs/release/ROAD_TEST_001_MEASUREMENT_SPEC.md`. That feature uses the existing `expo-file-system` + `expo-crypto` dependencies and SANITIZES ECU evidence (no raw frames, VIN, route, vehicle identity or direct session ID). Real Android Storage Access Framework behavior and effective permissions still require review on the QA APK; do not treat this historic audit as certifying that feature.

## QA internal audit gate refresh — 2026-10-16

The last previously published **internal** APK PR workflow on the stabilization line was [#38827578398](https://github.com/Em3rc0d/autoPulse/actions/runs/38827578398), with its `NO_CRITICAL` policy, tests, bundle, signature and effective-permission checks all green for **that older SHA**. The MK10.5 code adds no runtime dependency and does not independently change the `package-lock.json` used on the stabilization line, but **this is not a substitute for a fresh npm audit on the exact QA candidate**.

QA build must:
- record the current `npm audit --omit=dev` result and fail the internal `NO_CRITICAL` gate if critical packages remain;
- archive vulnerability-reachability evidence without suppressing or silently waiving advisories;
- capture merged APK permissions, embedded JS bundle, SHA-256, signer class, candidate/merge SHA and full provenance receipt;
- remain `release-internal` only, with no public distribution or Play Store claim.

Public production still has the stricter `NO_HIGH_OR_CRITICAL` gate, non-debug signing and a separate v4.3 physical certification requirement. No historical audit is upgraded retroactively to a public release PASS.

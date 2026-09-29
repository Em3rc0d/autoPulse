# AutoPulse V1 — Closure Authority

**Status:** CURRENT RELEASE AUTHORITY  
**Date:** 2026-09-29  
**Closure branch:** `release/v1-closure-20260929`  
**Closure PR:** #91

This document is the current authority for V1 closure. Older RC3/RC4/RC5 documents remain historical evidence. Where an older document says that backgrounding an active session must always produce `APP_BACKGROUND`, this document supersedes that policy for the v4.3 closure candidate.

## Product promise

AutoPulse V1 is a local-first, read-only Android vehicle-evidence product. Within its certified hardware/protocol envelope it can:

- connect to a supported BLE GATT ELM-compatible adapter;
- establish real standard OBD/ECU evidence before claiming Live;
- present available telemetry without converting missing/stale/invalid data to zero/current truth;
- preserve source semantics for ECU, adapter, phone and derived evidence;
- persist Live sessions and reconstruct History/Summary from durable SQLite evidence;
- recover bounded BLE/ECU path interruptions without inventing telemetry for missing intervals;
- run descriptor-gated read-only Check;
- persist each completed direct Check as an immutable SHA-256-sealed report;
- expose English by default and Spanish as a supported driver/UI language;
- use short voice/color/icon/haptic communication in the low-distraction driving surface.

AutoPulse does not claim universal vehicle/adapter compatibility, mechanical certification, OEM-enhanced module coverage, or root-cause diagnosis from DTCs alone.

## Background acquisition policy

The v4.3 closure candidate promotes service-gated background continuity.

An active Live session may continue while the application is not visible only when Android's connected-device foreground service starts and remains healthy.

Rules:

1. The foreground service is part of the acquisition contract, not a cosmetic notification.
2. A foreground-service start/native failure is an explicit terminal condition.
3. Background continuity never fabricates samples for an acquisition gap.
4. Process death is still recovered from durable evidence on the next boot.
5. Physical certification on the exact frozen APK is required before this behavior enters the public compatibility claim.

The historical `APP_BACKGROUND` terminal policy remains valid only for artifacts built under the older foreground-only contract.

## Check V1 closure

The direct Check path is the primary Check product surface.

A successful Check v4 run now has to persist before the UI may declare completion. The immutable snapshot includes:

- vehicle/workspace identity;
- Check/pilot version;
- protocol and protocol evidence;
- capability assessment;
- stored/pending/permanent DTC evidence returned by promoted services;
- PID 0101 readiness evidence when validated;
- promoted concern-driven Mode 01 observations;
- diagnostic concerns with endpoint provenance;
- bounded raw diagnostic evidence;
- limitations;
- canonical JSON and SHA-256 integrity seal.

Mode 06, Freeze Frame, UDS/OEM-enhanced modules, ABS, SRS and other unpromoted surfaces remain outside the public V1 claim unless separately promoted and certified.

The older session-derived Vehicle Check report remains a Session Evidence Report and does not replace the direct Check report.

## Release artifact classes

### Internal physical-validation artifact

May use Android Debug signing only when all of the following are explicit:

- artifact class is `release-internal`;
- SHA-256 is frozen;
- CI-tested source SHA is recorded;
- permission contract passed;
- dependency evidence is captured;
- the artifact is used only for controlled physical certification.

It is never public-release eligible.

### Production artifact

Production `assembleRelease` / `bundleRelease` fails closed unless non-debug release signing is configured.

Required signing inputs are external secrets:

- `AUTOPULSE_RELEASE_KEYSTORE_BASE64`
- `AUTOPULSE_RELEASE_STORE_PASSWORD`
- `AUTOPULSE_RELEASE_KEY_ALIAS`
- `AUTOPULSE_RELEASE_KEY_PASSWORD`

Private signing material must never be committed to the repository.

The production workflow also blocks HIGH and CRITICAL production dependency findings and generates APK + AAB provenance receipts.

## Mandatory closure gates

### A — Automated software gate

- TypeScript PASS.
- All Jest suites PASS.
- Replay/golden Check contracts PASS.
- Android standalone bundle PASS.
- Effective permission contract PASS.
- External-storage permissions absent.
- Artifact signature verified and classified.
- Product migrations, sealed Check reopen/integrity and Live recovery regressions PASS.

### B — Internal physical gate

Run `docs/test/V43_DRIVING_CERTIFICATION_RECEIPT.md` on the exact hash-pinned internal APK.

At minimum validate:

- known Logan lane;
- known Duster lane;
- at least one additional vehicle when available;
- normal driving telemetry continuity;
- motion-data loss semantics;
- foreground/background/lock behavior;
- clean Stop -> Summary;
- Check -> sealed report -> reopen;
- Live -> Check -> Live handoff;
- bounded recovery;
- process-kill recovery.

Physical claims remain scoped to the exact tested vehicle + adapter + Android + protocol combination.

### C — Public security gate

- production dependency audit has no HIGH or CRITICAL finding;
- effective permission surface is approved;
- production release is signed with NON_DEBUG certificate;
- APK/AAB hashes are frozen;
- production receipt points to the exact source commit.

### D — Final release reconciliation

If production signing, dependency changes or any post-physical fix changes the APK bytes, the resulting artifact receives a new identity. Claims from the internal physical artifact must be reconciled explicitly before release.

## Release stop conditions

Do not publish if any of these is true:

- stale/missing telemetry appears current;
- adapter voltage is presented as ECU PID 0142;
- a recovery hides a telemetry gap or silently creates a new session;
- Check emits a mechanical health verdict beyond observed evidence;
- a direct Check cannot reopen with the same SHA-256;
- foreground-service failure leaves the UI claiming background acquisition is healthy;
- process-kill evidence is irreconstructable;
- public APK is debug-signed;
- HIGH/CRITICAL production dependency gate is red;
- public documentation describes a different runtime contract than the released artifact.

## Current release sequence

```text
Closure code + CI
→ exact internal APK receipt
→ driving/physical certification
→ fix only physical blockers, if any
→ freeze new exact candidate if bytes changed
→ production security/signing workflow
→ reconcile artifact identity
→ public V1
```

No new feature MK enters before this sequence closes.

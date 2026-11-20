# AutoPulse Core Certification — Current Status

**Updated:** 2026-11-19  
**Execution branch:** `chore/p0-core-certification-20261118`  
**Authority:** `docs/release/AUTOPULSE_CORE_CERTIFICATION_GATE.md`

## Current truth

### Source / hardening

- exact-artifact provenance tooling: implemented on this branch;
- installed-APK identity verifier: implemented;
- structured flight recorder: implemented;
- certification gate hierarchy: frozen;
- RC003 behavioral validation pack: frozen;
- no Vehicle Memory production build authorized.

### Physical evidence

A stationary G1 defect verification run produced a clean local observability JSON:

- evidence: `autopulse-roadtest-20261120-005541365Z.json`;
- SHA-256: `11675D570F2559526E52863C9BAD4DB4A68FCE50D819A1B2431DEF7B125A44B7`;
- blocks: 5/5;
- events/readings: 38/38;
- trust: `COMPLETE`;
- valid OBD responses: 100%;
- persistence issues: none reported.

Receipt:

- `docs/test/G1_STATIONARY_DEFECT_VERIFICATION_20261119.md`

Verdict:

```text
SCOPED G1 DEFECT PASS
```

## What is NOT yet claimed

The following are not promoted by that scoped result:

```text
FULL G1 CERTIFICATION      OPEN
G2 CONTROLLED DRIVING      OPEN
G3 LIFECYCLE/RESILIENCE    OPEN
PUBLIC RELEASE             OPEN
UNIVERSAL COMPATIBILITY    NOT CLAIMED
```

## Artifact linkage

The physical JSON hash is frozen.

Before a broader artifact-level G1 claim, the tested installed APK must be tied to its exact local build receipt / source tuple. No source commit or APK SHA is inferred here.

## Change-control rule after this PASS

The successful acquisition/persistence path must remain unchanged unless:

1. a later mandatory gate exposes a defect; or
2. an evidence-backed change is explicitly required.

Any runtime change that can affect the passed behavior creates a new artifact identity and requires rerunning affected physical gates.

Documentation-only receipts/status updates do not invalidate the physical behavior that was observed.

## Next certification work

The next certification work is not feature development.

It is to close the remaining open gates against one exact artifact:

```text
artifact provenance
→ remaining mandatory G1 cases
→ G2 controlled driving
→ G3 stationary lifecycle/recovery
→ scoped Core certification verdict
```

Only after Core certification should product expansion move from RC003 experiments toward a new CONTRACT/BUILD cycle.

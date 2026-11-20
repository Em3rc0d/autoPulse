# AutoPulse — G1 Stationary Defect Verification Receipt — 2026-11-19

**Status:** SCOPED PASS  
**Scope:** one stationary G1 defect verification run only  
**Authority:** `docs/release/AUTOPULSE_CORE_CERTIFICATION_GATE.md`  
**Raw evidence:** retained locally/private; not committed to the public repository

## 1. Evidence object

- Evidence file: `autopulse-roadtest-20261120-005541365Z.json`
- Evidence class: `LOCAL_POST_SESSION_OBSERVABILITY_JSON`
- SHA-256: `11675D570F2559526E52863C9BAD4DB4A68FCE50D819A1B2431DEF7B125A44B7`
- Raw/private local source path: intentionally not committed
- Reported validation: JSON downloaded and validated successfully

## 2. Observed integrity

| Metric | Result |
|---|---:|
| Persisted blocks | 5 / 5 |
| Events | 38 / 38 |
| Readings | 38 / 38 |
| Trust | `COMPLETE` |
| OBD valid-response rate | 100% |
| Persistence issues | none reported |

## 3. Observed stationary values

| Signal / presentation | Observed |
|---|---|
| RPM raw | 238 RPM |
| Engine load | 0% |
| Vehicle speed | 0 km/h |
| Physical presentation | `Sospechoso / gris` |

These values are recorded as observations from this run. This receipt does not reinterpret them into a diagnosis or universal vehicle-health claim.

## 4. Verdict

```text
G1 STATIONARY DEFECT VERIFICATION: PASS
```

The specific defect under stationary verification is considered closed for this run because:

- persisted block integrity was complete;
- event/read count reconstructed exactly;
- report trust was `COMPLETE`;
- OBD valid-response rate was 100%;
- no persistence issue was reported;
- the physical presentation observed during the run matched the tested behavior.

## 5. Scope boundary

This PASS means only:

> the stationary defect exercised in this run did not reproduce as a failing condition under the captured evidence.

It does **not** by itself certify:

- all G1 mandatory cases;
- G2 controlled driving;
- G3 lifecycle/recovery;
- another vehicle;
- another adapter;
- another Android device;
- another APK;
- universal AutoPulse compatibility;
- public release readiness.

## 6. Artifact provenance state

The evidence hash is frozen above.

The exact APK/source tuple must remain linked through the local artifact receipt / `apk:identify` evidence before this receipt can be used as proof for a broader artifact-level certification claim.

Until that linkage is present, the correct claim is:

```text
SCOPED DEFECT PASS
≠ FULL ARTIFACT G1 CERTIFICATION
```

No artifact identity is invented in this receipt.

## 7. Next action

No additional physical test is required for this defect now.

Next engineering action:

1. preserve this receipt and evidence hash;
2. keep the successful Live/OBD/persistence path unchanged unless a later defect requires modification;
3. continue certification against the remaining mandatory G1/G2/G3 gates using exact artifact provenance;
4. only after Core certification, resume RC003 product-validation experiments.


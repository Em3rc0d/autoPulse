# ROAD TEST-001 — Controlled on-road pilot contract

**State:** CONTRACT FROZEN FOR PLANNING · EXECUTION NOT AUTHORIZED YET
**Created:** 2026-10-16
**Authority:** `docs/release/AUTOPULSE_V1_CLOSURE_AUTHORITY.md`
**Physical certification parent:** `docs/test/V43_DRIVING_CERTIFICATION_RECEIPT.md`
**Read-only measured metrics:** `docs/release/ROAD_TEST_001_MEASUREMENT_SPEC.md`
**Fill-in receipt:** `docs/test/ROAD_TEST_001_RECEIPT.md`
**Candidate source:** PR #96 `audit/ci-smoke-recovery-i18n-20261016` at the time of planning. Do not treat this historical SHA as a future build's verified identity.

## 0. Purpose and truth boundary

This is a **single-vehicle controlled pilot**, intended to find defects in real motion, establish a first hardware-specific acquisition baseline and verify end-to-end evidence durability. It is **not** public-release certification, OEM diagnostic validation or a universal compatibility claim. Later public certification remains governed by V1 closure authority and the v4.3 physical matrix.

**No APK has been authorized by this contract.** Frozen planning `!=` artifact generation `!=` stationary GO `!=` ROAD GO. Existing screenshots from the Logan and Duster support hypotheses only; they cannot certify the next artifact.

## 1. In-scope technical system

Android + BLE GATT + ELM-compatible adapter + standard OBD ECU path, local-first persistence. All ECU requests are **read-only**; Mode 04, Mode 08, actuator tests, DTC clear, OEM writes and UDS/security access are forbidden.

**Live bounded request set** from `LiveObdPollingPolicy.ts`:

| Request | Primary interpretation | Road objective |
|---|---|---|
| `0105` | coolant temperature | actual ECU-origin evidence and no false hot/healthy claims |
| `010D` | vehicle speed | true motion-source evidence, unknown/stale semantics |
| `010C` | engine RPM | continuity of a high-priority signal |
| `0104` | calculated load | optional, only if directly valid |
| `0111` | throttle position | optional, only if directly valid |
| `0142` | control-module voltage | optional, never confused with adapter `ATRV` |

`ATRV` is an **ELM adapter measurement, not an ECU PID**. The 114-PID Mode 01 catalog is reference knowledge, not the Road Test polling scope; Check's 13-PID allowlist is not a blanket vehicle support claim. No manufacturer-specific DTC decoding guarantee is within this pilot.

Poll-set selection can be narrower than six; for an inconclusive discovery result the policy may probe the bounded six without promoting unobserved support. Record the *actual* polled subset and per-command results. A missing optional signal is not a failure if appropriately marked unavailable. For this **Logan motion-validation lane**, new valid evidence for `0105`, `010C` and `010D` must first be established on the actual candidate while stationary; otherwise HOLD road motion certification and continue stationary evidence collection.

## 2. Gates — sequential, independently auditable

### G0 — Pre-artifact release-control gate (current stage)

- [ ] Final commit/source branch and exact CI-tested SHA frozen; TypeScript, Jest, adversarial replay and native Kotlin source status verified *for matching code*.
- [ ] No unresolved P0/P1 safety, evidence-provenance, acquisition or persistence defect; existing SafeArea and Android TTS changes remain **physically unverified** before installation.
- [ ] Candidate compilation, signing class, merged permission inspection and hash/provenance plan approved.
- [ ] No new change to the six-signal Live request contract without revisiting this document.
- [ ] User separately **authorizes one QA APK**. This document gives no such authorization.

**Current verdict: HOLD_ARTIFACT.** G0 cannot be backfilled as PASS from an earlier Kotlin compile or old screenshots.

### G1 — Stationary pre-drive qualification (on exact candidate)

Parked, engine operated only in a safe/ventilated setting, all phone interactions stationary.

- [ ] APK SHA-256, exact HEAD, CI run, signing class, Android model/version, BLE adapter identity and vehicle identity recorded.
- [ ] Cold start + BLE handshake + first valid ECU sample; adapter success alone must not imply ECU live.
- [ ] Demonstrate valid `0105`, `010C`, `010D` responses on the tested artifact (speed may validly read 0 while parked); document other three as observed/unavailable.
- [ ] No safety-blocking overlay/clipped status bar, nonresponsive controls or false healthy/current data.
- [ ] At least one safely completed **2–5 minute** Live sample, followed by Stop → History → Summary → app restart → same Summary.
- [ ] Local Check performed only parked: descriptor-gated read-only commands, limited-scope truth, sealed report and SHA-256 verification after reopening.
- [ ] Android native voice verified through a **nonhazardous preview/approved test path** in English and Spanish if a test path exists; never provoke real engine distress. If untestable, mark `BLOCKED` and keep the voice gate open, not silently PASS.
- [ ] No unresolved P0/P1; explicit passenger plan or driver-alone no-interaction mode.

**G1 failure/HOLD prevents G2** until corrected and re-tested using the exact candidate.

### G2 — Controlled road observation

**Only when G1 is PASS and the pilot operator confirms safe conditions.** Prefer a licensed driver plus a separate passenger/operator who observes/logs; the driver **must not interact with, read diagnostic detail on, or adjust the phone while moving**. When alone, configure and mount while stationary, drive normally without reading the screen and inspect only after parking.

- [ ] Begin Live and note session ID while parked.
- [ ] Target an ordinary **10–15 minute** session, only if traffic/road/safety permit; safety overrides duration. A shorter session can provide partial functional evidence but does not meet the planned duration/coverage benchmark; report `NOT_EXERCISED` for missing scenarios.
- [ ] Observe normal idle, safe acceleration, steady travel, deceleration and parked stop; no artificial hazard, forced overspeed, sudden maneuvers or deliberate BLE failure on-road.
- [ ] Passenger notes naturally occurring signal loss/return, voice/haptic behavior, motion transition and UI condition; no screen interaction by driver.
- [ ] No `PARKED` claim while credible moving evidence exists; lost speed with other ECU evidence becomes limited/unknown motion, **not** fabricated zero or total ECU death.
- [ ] No fabricated reading, stale value presented as current, unbounded alert spam, hidden app crash or duplicate concurrent session.

Do **not** induce connector loss, app kill, Bluetooth toggles, deep Check or settings changes while the car is moving.

### G3 — Stationary post-drive and resilience

- [ ] After safe parking: Stop once; verify `COMPLETED/USER_INITIATED` or honest `INTERRUPTED` with exactly one terminal reason.
- [ ] Summary and History reopen after a cold process restart; compare stored block counts, sequence gaps, signal counts and integrity.
- [ ] Perform one safe Live → Stop → Check → sealed report → Live handoff while parked. Three repetitions belong to the broader v4.3 certification gate, **not** a fabricated first-pilot pass.
- [ ] Run BLE disconnect/recovery, recovery exhaustion, background/lock and process-kill as **distinct parked sessions**, only if operator/equipment conditions are safe. The v4.3 parent receipt retains any case not exercised as OPEN.
- [ ] Save raw/private evidence locally, sanitize only necessary derivatives for source control and retain artifact/receipt hashes.

## 3. GO/HOLD/FAIL decision table

| Decision | Necessary evidence |
|---|---|
| `GO_BUILD_REQUEST` | G0 technical checks complete and user separately authorizes one candidate; this is **not** granted now |
| `GO_STATIONARY` | exact artifact provenance verified; no P0/P1 at install preflight |
| `GO_ROAD` | G1 PASS, all three core Logan signals validated on that artifact, UX and operator safety conditions met |
| `HOLD` | missing prerequisite/measurement, untested critical condition, or unresolved ambiguity; `NOT_EXERCISED` cannot become PASS |
| `FAIL` / `NO_GO` | observed P0/P1 truth, lifecycle, persistence or driver-distraction defect; preserve reproduction and block further driving |
| `PILOT_PASS_SCOPED` | mandatory exercised rows for this exact hardware tuple PASS, data traceable and limitations recorded; does **not** close v4.3/public gates |

A P0/P1 includes fabricated telemetry, silent block/data loss, active-looking UI after terminal failure, unconstrained recovery, forbidden ECU write, false healthy state or a driving distraction that requires interaction. Stop the pilot when safety or normal driving conditions demand; do not keep driving merely to satisfy a measurement duration.

## 4. Evidence, privacy and reproducibility

Each measurement/evidence entry must link to `runId`, artifact SHA-256, `sessionId`, vehicle+adapter+Android tuple, stage, timestamps, original source class and hash. A screenshot supports visible behavior but is **not** a raw ECU stream or proof of response timing. The current Session Summary contains block integrity and per-signal counts; latency percentiles now appear in the completed-session UI through the MK10.5 post-session analysis/export flow (six bounded Mode 01 commands; full-session only); that UI and Android SAF export remain **physically unverified** until testing the exact QA APK. See measurement spec for `MEASUREMENT_BLOCKED` treatment.

Do not upload VIN/plate, personal routes/GPS traces, account identifiers, raw voice recordings, secrets or unredacted vehicle/user metadata to the public repository. Keep original evidence private and publish hashes/sanitized descriptions.

## 5. Change control

- Planning contract changes before artifact freeze require an explicit revision/diff.
- Any runtime change after a failed physical run creates a new SHA/artifact identity and reruns affected physical gates.
- A QA pilot may proceed only on a separately authorized exact candidate. No GO from this document triggers GitHub Actions APK workflow.
- This contract supplements, does not supersede, `AUTOPULSE_V1_CLOSURE_AUTHORITY.md`, `V43_DRIVING_CERTIFICATION_RECEIPT.md` or the general `RELEASE_CANDIDATE_RUNBOOK.md`.

## MK10.5 observability implementation status

- Deterministic offline metrics for the six bounded Mode 01 Live requests are implemented and tested; includes outcome counts, yield, latency p50/p95/max, valid per-PID update gaps and explicit duplicate/sequence/corruption issues.
- The Session Summary UI exposes a **post-session-only** button for user-selected Android local JSON export; underlying terminal/workspace/real-BLE gates are checked again in the service.
- Exported JSON contains safe per-command timestamp/result/value rows, **not** raw ELM fragments, VIN, exact route, vehicle identity, adapter identity or un-hashed session ID.
- **No background export and no Live polling changes.** Export UI, Android SAF and actual measured values remain subject to device-level verification on the separately authorized QA candidate.

# AutoPulse Product Brainstorm

**Lane:** Brainstorming
**Authority:** NON-AUTHORITATIVE
**Rule:** Nothing in this document becomes product scope, implementation truth or release promise until explicitly promoted to Design/Plan.

This document preserves the major product ideas that have shaped AutoPulse while protecting the repository from accidental scope inflation.

## 1. Product thesis

AutoPulse is envisioned as a mobile automotive co-driver that turns raw vehicle and device evidence into understandable, timely driver information.

The desired experience is not “an OBD scanner with more cards.” The smartphone should monitor quietly and call attention to meaningful changes through visual priority, color, haptics and voice.

The long-term aspiration is broad vehicle/adapter portability, but the present release promise remains bounded by tested support.

## 2. Core experience ideas

### 2.1 Glanceable smartphone cockpit

The screen is a phone, not a tablet. The driver should not be required to scan a wall of metrics.

Ideas:

- one or two primary signals dominate the visible viewport;
- secondary signals remain compact and scrollable;
- normal healthy state should consume very little chrome;
- large status banners should appear only for transitional/degraded/critical states;
- driver modes should be compact selectors rather than large dashboard panels;
- charts are supporting context rather than the main interaction surface;
- the current vehicle and elapsed session time should remain easy to identify;
- controls that are not actionable after session termination should disappear.

These principles have partially been promoted into Design and RC3 implementation.

### 2.2 Voice-first attention model

AutoPulse should use voice when the driver should not need to look down.

Candidate voice patterns:

- startup briefing after enough evidence is available;
- significant engine/thermal/electrical warning;
- diagnostic condition that deserves attention;
- adapter/session interruption;
- recovery confirmation when a serious state returns to normal;
- document-expiration reminder when relevant.

The voice should explain meaning, not recite raw PIDs. Example style:

> “AutoPulse ready. One engine warning detected.”

> “Engine temperature is getting high. Reduce load and monitor coolant temperature.”

> “AutoPulse lost the diagnostic adapter. Your recorded vehicle data has been saved.”

Candidate anti-patterns:

- reading RPM every few seconds;
- repeating the same warning continuously;
- speaking every minor PARTIAL/UNKNOWN evidence state;
- turning unavailable evidence into a spoken failure claim.

### 2.3 Color and haptic language

Exploratory model later promoted into Design:

- green: healthy/available/normal; usually silent;
- amber/orange: waiting, partial, degraded or attention state;
- red: critical/interrupted/failure state;
- short haptic: attention;
- stronger/double haptic: critical/terminal state.

The exact thresholds and alert policy must be evidence-backed and separately tested.

## 3. Driver mode ideas

The current mode family includes:

- Essential;
- Family / Daily;
- Performance;
- Off-Road;
- Diagnostic.

The conceptual rule is that modes change **prioritization and interpretation**, never the underlying truth of the vehicle data.

### Essential

Show the few states that matter most right now. Intended as the default low-cognitive-load experience.

### Family / Daily

Prioritize engine health, driving state, maintenance/document reminders and calm explanations.

### Performance

Prioritize engine state, thermal behavior, RPM trend and signals useful for higher-load driving where genuinely available.

No mode may imply motorsport-grade measurement precision unless certified.

### Off-Road

Combine vehicle evidence with phone-origin context such as pitch, roll, heading and altitude.

Important exploratory principle now promoted into Design: phone sensors are a sidecar; they must never interfere with the OBD acquisition path.

### Diagnostic

Prioritize diagnostic truth, evidence quality, faults and available ECU-origin signals. This is still intended for a normal user; raw AT-command configuration is not the desired product UX.

## 4. Vehicle + adapter portability ideas

Long-term AutoPulse should not be hardcoded to one Renault or one ELM clone.

Ideas:

- behavioral adapter discovery rather than trusting branding;
- compatibility grading;
- adaptive PID capability discovery;
- progressive support envelopes by transport/dialect;
- explicit differentiation between standard definition, vehicle-advertised capability, probe result and live observation;
- eventual support for additional connector/transport families only after each is separately implemented and certified.

Current product implementation/certification does **not** prove all connectors or all vehicles.

## 5. Cold-start and startup intelligence

Idea: an initial vehicle start is a high-value observation period.

AutoPulse can watch warm-up and stable-engine evidence before making stronger statements. Candidate UX includes:

- “Startup observation” state;
- cold-start maturity;
- delayed judgment until enough samples exist;
- detection of meaningful abnormal behavior only after evidence is sufficient;
- short startup voice briefing.

This avoids treating the first transient samples after engine start as stable baselines.

## 6. Documents and local vehicle obligations

For markets such as Peru, AutoPulse may help track manually entered or image-derived dates such as:

- CITV;
- SOAT;
- GNV-related certification/inspection where applicable.

Because official external sources may involve CAPTCHA or restricted access, the product idea is to accept user-supplied evidence rather than pretending an unreliable automated lookup is authoritative.

Current UI already exercises CITV reminder concepts. Broader document ingestion/verification remains subject to Design/Plan promotion.

## 7. TPMS / tire intelligence exploration

Future idea only. A separate TPMS receiver/display can obtain pressure/temperature from wheel sensors. If AutoPulse can legally and technically access equivalent sensor data through a supported interface, a future system could learn vehicle-scoped pressure/temperature trends.

Potential future questions:

- pressure drop rate;
- temperature-compensated pressure behavior;
- predicted short-horizon pressure trend;
- tire-specific anomaly detection;
- correlation with speed, ambient conditions and trip state.

This idea is **not part of the current release**, and AutoPulse currently has no certified path to arbitrary third-party TPMS sensor radio data. It must not be used as an assumption in current application logic.

## 8. Predictive intelligence ideas

Longer-term value may come from temporal patterns rather than single readings.

Examples:

- thermal trajectory;
- voltage trend;
- repeated startup signatures;
- degradation over multiple sessions;
- tire-pressure trend if a certified TPMS data source exists;
- anomaly detection based on vehicle-specific baselines.

Guardrail: predictive output must disclose source, confidence and limitations. Prediction cannot be relabeled as ECU measurement.

## 9. Data ownership / local-first idea

Current direction favors local-first operation for release 1:

- vehicle profile stored locally;
- telemetry sessions persisted locally;
- History reconstructs from durable evidence;
- cloud account is not required for core operation.

Future synchronization, sharing or professional reports may be explored separately.

## 10. Professional / workshop extensions

Possible future tracks:

- signed diagnostic reports;
- shareable evidence package;
- professional technician mode;
- fleet/maintenance trends;
- workshop handoff.

These are deliberately outside the current Live v1 boundary unless promoted later.

## 11. Non-negotiable ideas that have been promoted

These concepts have moved beyond brainstorming and are repeated in Design because they now govern implementation:

- phone-first cockpit;
- normal is quiet, exceptions are loud;
- voice conveys meaning, not constant numbers;
- color/haptic severity language;
- driver modes change prioritization, not truth;
- Off-Road sensors are subordinate to ECU acquisition;
- missing data is not zero;
- adapter voltage and ECU voltage are different sources;
- adaptive discovery is preferable to hardcoded vehicle assumptions.

## 12. Brainstorming quarantine rule

When adding a new idea here, use one of these labels:

- `IDEA` — no implementation commitment;
- `HYPOTHESIS` — requires evidence/research;
- `EXPERIMENT` — approved for isolated investigation, not product scope;
- `PROMOTION_CANDIDATE` — mature enough to propose into Design/Plan.

Do not add `IMPLEMENTED`, `SUPPORTED`, `CERTIFIED` or release claims to this file. Those belong to later lanes.

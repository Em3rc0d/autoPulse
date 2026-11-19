# AutoPulse RC003 — Behavioral Validation Pack

**Status:** READY FOR EXECUTION — no behavioral validation result is claimed by this file  
**Purpose:** validate or falsify the product hypotheses that survived REALITY CHECK before a full Vehicle Memory build  
**Core rule:** stated interest is weak evidence; actual behavior is the target.

## 1. Hypotheses under test

### H1 — Recurring problem
Owners with recurring/intermittent faults will repeatedly capture evidence because the problem remains unresolved.

### H2 — Repair lifecycle
Owners who have just paid for a repair will return to compare evidence before and after the intervention.

### H3 — Evidence-linked memory
Accumulated evidence tied to the same vehicle increases return behavior and usefulness over time.

### H4 — Mechanic continuity
A structured evidence package is actually used during workshop interaction rather than merely considered interesting.

### H5 — Low-friction intervention input
Users will contribute minimal repair context when AutoPulse already captured most technical evidence automatically.

## 2. Evidence hierarchy

Strongest to weakest:

```text
actual payment
actual repeated use
actual follow-up after repair
actual evidence shown to mechanic
actual adapter connection
actual data contribution
scheduled commitment
past-behavior account
stated intention
general opinion
```

Do not convert compliments into validation.

## 3. Target participant mix — Round 1

Target approximately 21–25 participants:

| Segment | Target |
|---|---:|
| recurring/intermittent vehicle problem | 5 |
| recently repaired vehicle | 5 |
| older/high-mileage vehicle | 5 |
| enthusiast/DIY | 3–5 |
| healthy-car control | 3–5 |

This round is exploratory/falsification-oriented, not a statistically representative market survey.

## 4. Participant screener

Record only what is necessary.

```text
participantId:
vehicleAgeBand:
vehicleMileageBand:
recentRepairWithin6Months: YES/NO
recurringProblem: YES/NO
usesWorkshop: YES/NO
DIYMaintenance: YES/NO
ownsObdAdapter: YES/NO
willingToConnectAdapter: YES/NO
currentVehicleConcern:
```

Do not collect VIN, plate, exact home/work address or unrelated personal data.

## 5. EXP-001 — Problem History Interview

### Do not introduce AutoPulse first.

Ask about the last real vehicle problem:

1. What was the last serious or annoying problem with the car?
2. What did you notice first?
3. What did you do next?
4. How did you explain it to the mechanic?
5. What did the mechanic say?
6. What was repaired or changed?
7. Roughly how much did it cost?
8. How did you decide afterward that it was fixed?
9. Did the problem return?
10. How do you remember what was done?
11. Do you keep receipts, photos, screenshots, WhatsApp messages or notes?
12. Have two workshops ever given you different explanations?
13. Have you ever wished you had evidence of what the car was doing before visiting the workshop?

### Strong positive behaviors

Examples:

- saved screenshots/codes;
- recorded video/audio;
- kept invoices;
- rescanned later;
- returned to workshop with evidence;
- maintained spreadsheet/notes;
- struggled to explain intermittent symptom;
- paid again after recurrence.

### Strong negative behaviors

Examples:

- no interest in retaining history;
- full reliance on mechanic without desire for evidence;
- unwillingness to connect hardware;
- no follow-up even after costly repairs.

## 6. EXP-002 — Evidence Package Test

Use existing AutoPulse Core data where possible.

Minimum package:

```text
Vehicle context
Reported symptom
Date/time window
Relevant Check evidence
Relevant Live evidence
Observed conditions
Previous occurrence if known
What was verified
What was NOT verified
```

Measure:

- user actually shows package to mechanic: YES/NO;
- mechanic reads/uses it: YES/NO;
- mechanic asks evidence-driven follow-up: YES/NO;
- package reduces explanation effort: YES/NO;
- package causes confusion: YES/NO;
- decision/workflow changed: description.

### Initial signal threshold

A strong signal exists if at least half of relevant participants actually use/show the package and meaningful usefulness is observed among those uses.

This is an internal learning threshold, not a population statistic.

## 7. EXP-003 — Post-Repair Before/After Concierge

### Flow

```text
T0 — pre-repair Check/Live evidence
→ intervention
→ minimal intervention record
→ T1 — comparable post-repair Check/Live evidence
→ manual AutoPulse-style comparison
```

### Manual comparison template

```text
BEFORE
Observed:
Coverage:
Relevant limitations:

INTERVENTION
What was done:
Source:
Date:

AFTER
Observed:
Coverage:
Relevant limitations:

CHANGE
Observed difference:

CAUSALITY
Not established / plausible / supported only when justified.

OPEN QUESTIONS
```

### Primary behavior metric

`followUpCompletionRate`

Initial internal interpretation:

- >= 60%: strong signal;
- 30–59%: ambiguous;
- < 30%: hypothesis materially weakened.

Never alter the threshold after seeing results without recording the revision.

## 8. EXP-004 — Memory Return Test

Create a lightweight manual timeline:

```text
Vehicle
├─ session/problem
├─ check
├─ intervention
├─ post-repair session
└─ current state
```

When a new event occurs, measure:

- participant returns to same vehicle record;
- prior history is reopened;
- new evidence is added;
- previous event is referenced in a decision;
- elapsed time to return.

Question under test:

> Does accumulated same-vehicle context change behavior?

## 9. EXP-005 — Repair Entry Friction

Compare three input modes:

### A — structured form
Date, category, cost optional, workshop optional, component/notes.

### B — receipt/photo
User captures the document; structured interpretation may be manual during research.

### C — voice
User describes what was done; structured interpretation may be manual during research.

Measure:

- completion rate;
- completion time;
- missing critical information;
- corrections required;
- abandonment.

### Internal usability target

Common repair entry should generally be completable in about one minute or less.

Failure of this target does not automatically kill Vehicle Memory, but it requires redesign of how intervention context is obtained.

## 10. EXP-006 — Hardware Friction

Cohorts:

```text
already owns adapter
recommended adapter
random inexpensive adapter
```

Measure:

- connection success;
- time to first trusted ECU evidence;
- human support needed;
- initialization failures;
- abandonment;
- detected protocol/capability.

Primary onboarding metric:

`timeToFirstTrustedEvidence`

For recommended adapters and declared compatible vehicles, the long-term target should approach >=90% successful onboarding without technical assistance before broad consumer claims.

## 11. EXP-007 — Compatibility Trust Communication

Compare communication styles.

### A
```text
Your vehicle is compatible.
```

### B
```text
Verified:
✓ RPM
✓ Coolant
✓ Vehicle speed

Not verified:
? ABS
? Airbag
? Manufacturer-specific modules
```

Measure:

- comprehension;
- trust;
- perceived usefulness;
- perceived defectiveness/confusion.

Truth semantics cannot be weakened merely because an overconfident message tests better. If B confuses users, improve communication rather than fabricate certainty.

## 12. EXP-008 — Price Signal

Only after the participant experiences actual value.

Example concept:

```text
Free
- compatibility check
- Live
- Check

Premium hypothesis
- longitudinal vehicle memory
- repair tracking
- before/after
- advanced evidence reports
```

Measure actions rather than asking only “would you pay?”:

- continue Free;
- request Premium trial;
- join paid-interest/waitlist flow;
- later, when product/legal/payment readiness exists, real checkout conversion.

No subscription infrastructure is authorized by this experiment pack.

## 13. EXP-009 — Competitive Replacement

Ask after real use:

> What would you stop using if AutoPulse worked well for this job?

Record:

- nothing;
- Car Scanner/other scanner;
- spreadsheet;
- notes;
- photos;
- WhatsApp;
- paper receipts;
- maintenance app;
- other.

A valid outcome may be that AutoPulse complements rather than replaces a scanner, provided it owns a distinct vehicle-record job.

## 14. EXP-010 — Accumulated Memory Value

Compare:

### Current-state view
Current Check + current Live.

### Memory view
Previous issue + intervention + previous/current evidence + comparison.

Give real tasks:

- Has this happened before?
- When?
- What was done?
- What changed?
- What remains uncertain?

Measure:

- task success;
- time;
- confidence;
- incorrect conclusions.

This tests whether structured memory is objectively more useful than raw session history.

## 15. Core behavioral funnel

```text
REAL CONCERN
→ CONNECT
→ FIRST TRUSTED EVIDENCE
→ UNDERSTAND
→ SAVE TO SAME VEHICLE
→ ACT / REPAIR
→ RETURN
→ FOLLOW-UP EVIDENCE
→ COMPARE
→ RETAIN
```

Suggested metrics:

```text
connectionSuccess
timeToFirstTrustedEvidence
firstCompletedCheck
firstCompletedLive
secondSessionSameVehicle
interventionRecorded
postRepairSession
beforeAfterOpened
beforeAfterCompleted
30/60/90-day same-vehicle return
```

Do not optimize for DAU by default.

## 16. Product-validation decision matrix

| Hypothesis | Interview | Behavior | Physical | Payment signal | Verdict |
|---|---|---|---|---|---|
| recurring-problem pain | | | n/a | | |
| repair follow-up | | | | | |
| Before/After usefulness | | | | | |
| evidence-linked memory retention | | | n/a | | |
| mechanic continuity | | | n/a | | |
| hardware tolerance | | | | n/a | |

Allowed verdicts:

- `SURVIVES`
- `WEAKENED`
- `FAILS`
- `UNPROVEN`

## 17. GO / PIVOT / KILL gates

### GO toward full Vehicle Memory

Requires convergence, not one impressive interview:

- repeated real pain;
- actual repair follow-up;
- actual use of previous history;
- low-friction intervention capture;
- Before/After changes understanding;
- hardware onboarding acceptable;
- some behavioral monetization signal.

### PIVOT examples

- Check gets strong repeated use but memory does not → diagnostic product;
- used-car inspection dominates → inspection/report product;
- mechanics value evidence far more than owners → investigate B2B;
- enthusiasts dominate → investigate advanced enthusiast positioning.

### KILL longitudinal product bet

Strongly consider KILL/P3 when repeated evidence shows:

- low pain;
- low return;
- high input friction;
- history rarely reopened;
- Before/After does not improve decisions;
- mechanic evidence consistently ignored;
- no credible payment signal.

## 18. Research record template

Create one record per participant/experiment:

```text
recordId:
date:
participantSegment:
sanitizedVehicleContext:
experiment:
hypothesis:
existingWorkaround:
observedBehavior:
directQuotes:
technicalEvidenceRefs:
result:
contradictions:
privacyNotes:
decisionImpact:
nextAction:
```

Quotes should be short and necessary. Do not publish personal identifiers.

## 19. Technical vs product validation

Keep separate:

```text
TECHNICAL CERTIFICATION
Did AutoPulse observe correctly?

PRODUCT VALIDATION
Did that observation help the person?
```

A technically correct feature with no behavioral value is not validated product.

A highly desired feature with unreliable evidence is not releaseable product.

## 20. Build boundary

Allowed to support RC003:

- small prototype/timeline;
- manual evidence package;
- minimal intervention input;
- manual Before/After;
- research-only screens/artifacts if strictly necessary.

Not authorized by this pack:

- full Episode Engine;
- automatic Baseline Engine;
- causal inference;
- predictive maintenance;
- LLM vehicle advisor;
- mechanic portal;
- subscription backend;
- cloud architecture.

## 21. Round-1 close condition

RC003 Round 1 closes only when actual participant records populate the decision matrix.

Until then:

```text
Vehicle Memory       UNPROVEN
Repair lifecycle     UNPROVEN
Before / After       UNPROVEN
Mechanic continuity  UNPROVEN
Willingness to pay   UNPROVEN
```

The absence of negative evidence is not a PASS.

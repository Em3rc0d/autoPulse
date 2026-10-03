# AutoPulse v4.3 — Pre-release Driving Gate

Status: REQUIRED BEFORE PUBLIC RELEASE  
Candidate line: v4.3 Closure Run  
Authority date: 2026-09-29

## Purpose

This gate validates the exact Android artifact intended to become the public release candidate. It does not expand product scope. It certifies lifecycle, acquisition truth, persistence, recovery and low-distraction behavior under real driving conditions.

## Artifact identity

Every physical receipt must record:

- source branch and source HEAD;
- CI-tested SHA / merge SHA;
- APK SHA-256;
- workflow run ID;
- vehicle make/model/year;
- adapter identity/firmware when observable;
- Android device/model/version;
- session ID(s);
- Check/report hash when produced.

A screenshot without artifact identity is supporting evidence, not release certification.

## Safety boundary

- Park before starting, stopping, reconnecting, opening diagnostics, changing settings or reviewing details.
- While moving, interact with neither the phone nor AutoPulse.
- Use voice/color/icon output only as informational assistance.
- AutoPulse remains read-only; no mutating ECU command is permitted.

## Required run

### A. Cold start and connection

1. Launch from a cold process.
2. Select vehicle.
3. Connect the intended OBD adapter.
4. Establish real ECU evidence.
5. Confirm RPM/speed/coolant only when actually observed.
6. Confirm absent values remain unavailable rather than zero.

### B. Normal drive

Drive long enough to exercise:

- idle;
- acceleration;
- steady motion;
- deceleration;
- stopped/parked transition.

Pass criteria:

- no fabricated signal;
- motion state does not promote PARKED while moving evidence exists;
- partial speed loss becomes limited motion evidence rather than global telemetry death when other ECU evidence remains usable;
- voice/haptic behavior remains bounded and non-spammy.

### C. Background and lock screen

With Live active:

1. background the app;
2. lock the screen;
3. continue driving without touching the phone;
4. restore the app when safely parked.

Pass criteria:

- session continues only if foreground-service protection was successfully established;
- no fake telemetry fills the background gap;
- restored UI reflects current evidence;
- no duplicate session is created.

### D. Transport recovery

While safely parked:

1. interrupt the BLE/adapter path;
2. observe bounded recovery;
3. restore the adapter/path;
4. confirm same Live session resumes.

Then repeat with recovery intentionally exhausted.

Pass criteria:

- recovery does not fabricate telemetry;
- successful recovery preserves the same session;
- exhausted recovery produces one terminal interruption reason;
- durable evidence remains reopenable.

### E. Stop and persistence

1. Stop normally while parked.
2. Open Summary.
3. Return to History.
4. kill/restart the app.
5. reopen the same Summary.

Pass criteria:

- clean stop is COMPLETE;
- block integrity and sequence checks remain valid;
- reconstructed summary is stable after restart.

### F. Live → Check → Live

While parked:

1. complete a Live session;
2. run read-only Check;
3. inspect standard DTC/readiness/targeted evidence;
4. return to Live and reconnect.

Pass criteria:

- no lease/connection deadlock;
- Check never sends mutating OBD services;
- unsupported/unknown evidence remains explicitly limited;
- subsequent Live works without app restart.

## Vehicle matrix

The first driving gate may use the already available Renault vehicles, but public compatibility claims are not generalized from them. Before broad release claims, repeat the exact artifact on at least one non-Renault vehicle and expand adapter/Android diversity as hardware becomes available.

## Release decision

The artifact is rejected for P0/P1 defects involving:

- fabricated vehicle evidence;
- silent persistence loss;
- unsafe/mutating diagnostic command;
- unrecoverable connection ownership deadlock;
- background behavior contradicting the certified policy;
- terminal UI continuing to look operational;
- corrupted/reopened summary reported as complete.

Any fix after a rejected physical run creates a new artifact identity and requires rerunning the affected gate.

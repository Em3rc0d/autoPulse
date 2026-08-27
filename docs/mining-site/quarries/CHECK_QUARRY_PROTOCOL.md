# AutoPulse Check — Quarry Protocol

Purpose: preserve raw/minimally interpreted physical Check evidence before any claim is promoted into the Golden Dataset or release documentation.

## One quarry receipt per physical evaluation fixture

Each receipt must record:
- quarry ID;
- date/time;
- exact app/build commit or APK digest;
- vehicle make/model/year and non-sensitive configuration needed for reproduction;
- adapter identity/profile evidence;
- phone/Android version when relevant;
- Check purpose;
- requested scope;
- observed capability snapshot;
- executed steps;
- skipped/unavailable/unknown steps;
- session/evaluation IDs where available;
- raw screenshots/log references;
- connection recoveries/gaps;
- stop/restart/reopen behavior;
- report outcome;
- defects discovered.

## Interpretation boundary

A quarry receipt may say:
- `010C produced a decoded RPM observation`;
- `readiness was not available in this fixture`;
- `adapter reconnected after N attempts`;
- `the final report reconstructed after restart`.

It may not silently promote that into:
- all Renaults support the same signals;
- all ELM327 adapters recover;
- the complete vehicle was mechanically inspected;
- an unevaluated module passed.

## Check-specific evidence promotion

A physical quarry case may become a Golden case only after:
1. the build identity is frozen;
2. the raw receipt is complete;
3. observed vs inferred statements are separated;
4. expected semantics match the authoritative Check design;
5. any known defect is either part of a negative golden case or physically revalidated after the fix.

## Reserved first physical Check cases

- `Q-CHECK-001` — Logan preventive evaluation.
- `Q-CHECK-002` — Duster preventive evaluation.
- `Q-CHECK-003` — bounded adapter recovery during a Check evidence window.

These IDs are reserved only. No physical PASS is implied until receipts exist.
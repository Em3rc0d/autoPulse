# AutoPulse Check — Research Wave A closure receipt

**Wave:** `CHECK-CORE-WAVE-A-20260904`  
**Branch:** `research/check-core-wave-a-20260904`  
**Base:** CHECK-MK0 documentation freeze  
**Runtime impact:** none

## Goal

Close the semantic boundaries on the shortest critical path to the first real read-only DTC Core scan, while keeping runtime blocked until fixture and physical evidence gates are satisfied.

Wave A contains:

```text
Q-CHECK-001  Standard OBD DTC services
Q-CHECK-007  ECU / endpoint attribution
Q-CHECK-008  Diagnostic command safety evidence
Q-CHECK-011  Transport behavior
```

## Closure result

### Q-CHECK-001 DTC services

```text
service purpose                 CLOSED
DTC/PID parser boundary         CLOSED
zero-code semantics             CLOSED
status semantics                CLOSED
CAN count-byte hazard           CLOSED AS CONSTRAINT
fixtures                        OPEN
runtime                         BLOCKED
```

### Q-CHECK-007 endpoint attribution

```text
endpoint vs role                CLOSED
functional/multi-responder      CLOSED
UNATTRIBUTED fallback           CLOSED
per-evidence source requirement CLOSED
fixtures                        OPEN
physical CAN proof              OPEN
runtime                         BLOCKED
```

### Q-CHECK-008 diagnostic safety

```text
default deny                    CLOSED
Mode 04 mutating boundary       CLOSED
Mode 08 control boundary        CLOSED
raw/vendor/UDS default block    CLOSED
exact-descriptor architecture   CLOSED
policy implementation           OPEN
adversarial tests               OPEN
runtime                         BLOCKED
```

### Q-CHECK-011 transport behavior

```text
semantic vs physical request    CLOSED
serial default                  CLOSED
NO DATA semantics               CLOSED
Response Pending semantics      CLOSED
variable-response rule          CLOSED
budget dimensions               CLOSED
concrete timing values          OPEN
transport fixtures              OPEN
runtime                         BLOCKED
```

## Important defect discovered before implementation

The current `ObdFrameParser` is shaped around positive responses that contain `service + PID + payload`. DTC-list services do not contain a PID. The current connector recovers DTC data by treating the parser's `pid` byte as the first code byte.

This is not safe as the final Check parser contract because ISO15765/CAN Mode 03 can add a DTC-item-count byte after service `43`.

The defect is intentionally **not patched on this research branch**. It has become a CHECK-MK4 fixture/parser acceptance requirement.

## What Wave A authorizes

Wave A authorizes the next documentation/research and fixture work. It does not authorize production diagnostic requests.

The first runtime DTC Core remains gated by:

```text
Wave A fixture corpus
+ basic readiness semantics (Q-CHECK-003)
+ promoted exact read-only descriptors
+ safety policy implementation/tests
+ service-aware DTC parser
+ replay scan PASS
```

## Next closure wave

Proceed in this order:

```text
1. PID quarry hardening
2. Q-CHECK-003 readiness
3. Q-CHECK-002 supported PID discovery
4. Q-CHECK-004 freeze frame
5. build diagnostic golden fixture skeleton
6. only then evaluate CHECK-MK3/MK4 hammer readiness
```

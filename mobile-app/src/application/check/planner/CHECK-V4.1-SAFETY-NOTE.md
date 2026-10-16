# CHECK v4.1 safety hardening

This note records the integration boundary exposed by the Logan physical v4 run.

The v4 evidence planner selected PID `0101`, but the v2 safety authority recognized only descriptor registries v1/v2. The result was a correct fail-closed `REGISTRY_NOT_ALLOWLISTED` outcome and zero v4-targeted commands.

v4.1 changes the authority boundary, not the read-only policy:

- the canonical registry v3 is planner/safety-owned;
- only exact canonical descriptors are authorized;
- alternate registry versions remain blocked;
- same-version descriptor tampering remains blocked;
- new v3 Mode 01 descriptors remain KWP-only;
- Mode 04/08 and non-OBD-standard request kinds remain blocked;
- the planner remains bounded and concern-driven; the wallet is not a scan list;
- physical compatibility is not certified by synthetic/replay tests and requires a new vehicle run.

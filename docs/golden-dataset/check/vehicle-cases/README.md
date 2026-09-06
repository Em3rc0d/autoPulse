# Check Vehicle Evidence Cases

Vehicle Evidence Cases record physical observations produced by AutoPulse Check without silently upgrading them into stronger claims.

## Evidence states

- `SCREENSHOT_TRANSCRIBED_PHYSICAL_OBSERVATION`: values and raw response text were visibly presented by a physical AutoPulse run and transcribed from screenshots. This is physical observation evidence, but it is **not** a cryptographically sealed transport capture.
- `RAW_CAPTURE_REVIEWED`: a replayable/raw capture archive exists, its provenance is known, and the normalized fixture has been independently reviewed.
- `PHYSICALLY_CERTIFIED`: the physical evidence package satisfies the Golden Diagnostic Dataset promotion contract, including raw capture, integrity hash, vehicle/adapter/protocol metadata, parser/engine version, and review receipt.

Passing application tests or a successful screenshot-transcribed run does not promote a case to `PHYSICALLY_CERTIFIED`.

## Truth boundaries

Vehicle cases must preserve these distinctions:

`REFERENCE_DEFINED != ECU_ADVERTISED != QUERIED != OBSERVED_DIRECTLY`

An empty Mode 01 support bitmap is evidence about the bitmap response only. It must not be converted into a claim that an individual PID is unsupported. Conversely, a PID observed directly must not be rewritten as ECU-advertised support.

Responder attribution is evidence-scoped. `UNATTRIBUTED` remains valid when the physical response does not carry a trustworthy source identity. A compatibility snapshot that discovered several ECUs does not authorize assigning an unattributed Check response to one of them.

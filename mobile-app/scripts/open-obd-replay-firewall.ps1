$ErrorActionPreference = "Stop"

netsh advfirewall firewall add rule name="AutoPulse OBD Replay 8765" dir=in action=allow protocol=TCP localport=8765 | Out-Host

Write-Output "Firewall rule ready: AutoPulse OBD Replay 8765"
Write-Output "Mobile URL example: ws://192.168.18.111:8765/obd"

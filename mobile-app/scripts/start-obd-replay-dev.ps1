$ErrorActionPreference = "Stop"

$repoRoot = Resolve-Path (Join-Path $PSScriptRoot "..")

Start-Process -FilePath "cmd.exe" `
  -ArgumentList @("/k", "node scripts\obd-replay-server.js") `
  -WorkingDirectory $repoRoot `
  -WindowStyle Hidden | Out-Null

Start-Sleep -Seconds 2

$health = Invoke-WebRequest -UseBasicParsing http://localhost:8765/health -TimeoutSec 5
$body = '{"id":"test-010c","command":"010C"}'
$command = Invoke-WebRequest -UseBasicParsing http://localhost:8765/command -Method POST -ContentType 'application/json' -Body $body -TimeoutSec 5

adb reverse tcp:8765 tcp:8765 | Out-Null

Write-Output "Replay health:"
Write-Output $health.Content
Write-Output ""
Write-Output "Replay command test:"
Write-Output $command.Content
Write-Output ""
Write-Output "ADB reverse:"
adb reverse --list

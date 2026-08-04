$ErrorActionPreference = "Stop"

$packageJsonPath = "package.json"
$backupPath = "package.json.bak"

Write-Host "AutoPulse: Preparando entorno reproducible para Benchmark Nativo..." -ForegroundColor Cyan

# 1. Verificar árbol limpio (simplificado para este entorno)
$gitStatus = git status --porcelain
if ($gitStatus) {
    Write-Host "ADVERTENCIA: El árbol de trabajo de git no está limpio." -ForegroundColor Yellow
}

# 2. Hacer backup del package.json
Copy-Item $packageJsonPath $backupPath -Force

try {
    # 3. Cambiar entry point
    $content = Get-Content $packageJsonPath -Raw
    $newContent = $content -replace '"main": "index.js"', '"main": "index.benchmark.js"'
    Set-Content -Path $packageJsonPath -Value $newContent -NoNewline
    
    Write-Host "✅ entryPoint modificado a index.benchmark.js" -ForegroundColor Green
    Write-Host "=== DIFF GENERADO ==="
    git diff package.json
    Write-Host "====================="

    Write-Host "Iniciando Expo (presiona Ctrl+C para detener el servidor y restaurar)..." -ForegroundColor Cyan
    npx expo start -c
}
finally {
    # 4. Restaurar package.json
    Write-Host "Restaurando package.json original..." -ForegroundColor Cyan
    Move-Item -Path $backupPath -Destination $packageJsonPath -Force
    Write-Host "✅ Entorno comercial restaurado." -ForegroundColor Green
}

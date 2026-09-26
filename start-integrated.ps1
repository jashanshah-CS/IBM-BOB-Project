$ErrorActionPreference = 'Stop'
$root = $PSScriptRoot
$backend = Join-Path $root 'TestForge'
$dashboard = Join-Path $root 'Dashboard'
$python = Join-Path $dashboard 'venv\Scripts\python.exe'

if (-not (Test-Path (Join-Path $backend 'node_modules'))) {
    Push-Location $backend
    try { npm install } finally { Pop-Location }
}

if (-not (Test-Path $python)) {
    python -m venv (Join-Path $dashboard 'venv')
    & $python -m pip install -r (Join-Path $dashboard 'requirements.txt')
}

Start-Process -FilePath 'npm' -ArgumentList @('run', 'dev') -WorkingDirectory $backend -WindowStyle Hidden
Start-Process -FilePath $python -ArgumentList @('-m', 'streamlit', 'run', 'app.py') -WorkingDirectory $dashboard -WindowStyle Hidden

Write-Host 'TestForge backend: http://127.0.0.1:3000'
Write-Host 'Integrated dashboard: http://127.0.0.1:8501'

param(
  [string]$HostAddress = "127.0.0.1",
  [int]$Port = 8000
)

$ErrorActionPreference = "Stop"

$root = Split-Path -Parent $MyInvocation.MyCommand.Path
$venvPython = Join-Path $root ".venv\Scripts\python.exe"

if (!(Test-Path $venvPython)) {
  throw "Virtualenv Python not found at: $venvPython. Create it with: python -m venv .venv"
}

Set-Location $root

function Test-ApiHealth {
  param([string]$Url)
  try {
    $res = Invoke-WebRequest -UseBasicParsing -Method Get -Uri "$Url/health" -TimeoutSec 2
    return $res.StatusCode -ge 200 -and $res.StatusCode -lt 300
  } catch {
    return $false
  }
}

$baseUrl = "http://$HostAddress`:$Port"
if (Test-ApiHealth -Url $baseUrl) {
  Write-Host "API is already running at $baseUrl" -ForegroundColor Green
  Write-Host "Open: $baseUrl/ (console) or $baseUrl/docs (OpenAPI)" -ForegroundColor DarkGreen
  exit 0
}

Write-Host "Starting API on $baseUrl ..." -ForegroundColor Cyan

& $venvPython -m uvicorn app.main:app --host $HostAddress --port $Port

param(
    [string]$BaseUrl = "http://127.0.0.1:8000",
    [string]$PythonExe = "C:/Users/91823/AppData/Local/Programs/Python/Python313/python.exe"
)

$ErrorActionPreference = "Stop"

$scriptDir = Split-Path -Parent $MyInvocation.MyCommand.Path
$projectRoot = Split-Path -Parent $scriptDir
$serverProcess = $null

function Test-ApiHealth {
    param([string]$Url)
    try {
        Invoke-RestMethod -Method Get -Uri "$Url/health" | Out-Null
        return $true
    } catch {
        return $false
    }
}

function Ensure-ServerRunning {
    param([string]$Url)
    if (Test-ApiHealth -Url $Url) {
        Write-Host "Using existing API server at $Url" -ForegroundColor Yellow
        return $null
    }

    Write-Host "Starting API server..." -ForegroundColor Yellow
    $process = Start-Process -FilePath $PythonExe -ArgumentList "-m", "uvicorn", "app.main:app", "--host", "127.0.0.1", "--port", "8000" -WorkingDirectory $projectRoot -PassThru
    for ($attempt = 0; $attempt -lt 30; $attempt++) {
        Start-Sleep -Milliseconds 500
        if (Test-ApiHealth -Url $Url) {
            Write-Host "API server is ready." -ForegroundColor Green
            return $process
        }
    }

    if ($process -and !$process.HasExited) {
        Stop-Process -Id $process.Id -Force
    }
    throw "API server did not become healthy in time."
}

function Read-JsonFile {
    param([string]$RelativePath)
    return Get-Content -Raw -Path (Join-Path $projectRoot $RelativePath)
}

function Show-Section {
    param([string]$Title)
    Write-Host "`n=== $Title ===" -ForegroundColor Cyan
}

try {
    $serverProcess = Ensure-ServerRunning -Url $BaseUrl

    Show-Section "Workflow Catalog"
    $workflows = Invoke-RestMethod -Method Get -Uri "$BaseUrl/workflows"
    $workflows | ConvertTo-Json -Depth 6

    Show-Section "Application Success"
    $success = Invoke-RestMethod -Method Post -Uri "$BaseUrl/workflows/application_approval/requests" -Headers @{"Idempotency-Key" = "demo-success-001"} -ContentType "application/json" -Body (Read-JsonFile -RelativePath "demo/application_success.json")
    $success | ConvertTo-Json -Depth 8

    Show-Section "Duplicate Replay"
    $replay = Invoke-RestMethod -Method Post -Uri "$BaseUrl/workflows/application_approval/requests" -Headers @{"Idempotency-Key" = "demo-success-001"} -ContentType "application/json" -Body (Read-JsonFile -RelativePath "demo/application_success.json")
    $replay | ConvertTo-Json -Depth 8

    Show-Section "Invalid Input"
    try {
        Invoke-RestMethod -Method Post -Uri "$BaseUrl/workflows/application_approval/requests" -Headers @{"Idempotency-Key" = "demo-invalid-001"} -ContentType "application/json" -Body (Read-JsonFile -RelativePath "demo/application_invalid.json")
    } catch {
        $reader = New-Object System.IO.StreamReader($_.Exception.Response.GetResponseStream())
        $body = $reader.ReadToEnd()
        $reader.Close()
        $body
    }

    Show-Section "Retry Flow"
    $retryPending = Invoke-RestMethod -Method Post -Uri "$BaseUrl/workflows/application_approval/requests" -Headers @{"Idempotency-Key" = "demo-retry-001"} -ContentType "application/json" -Body (Read-JsonFile -RelativePath "demo/application_retry.json")
    $retryPending | ConvertTo-Json -Depth 8

    $retried = Invoke-RestMethod -Method Post -Uri "$BaseUrl/requests/$($retryPending.request_id)/retry"
    $retried | ConvertTo-Json -Depth 8

    Show-Section "Explanation"
    $explanation = Invoke-RestMethod -Method Get -Uri "$BaseUrl/requests/$($retried.request_id)/explanation"
    $explanation | ConvertTo-Json -Depth 10

    Show-Section "Claim Workflow"
    $claim = Invoke-RestMethod -Method Post -Uri "$BaseUrl/workflows/claim_processing/requests" -Headers @{"Idempotency-Key" = "demo-claim-001"} -ContentType "application/json" -Body (Read-JsonFile -RelativePath "demo/claim_success.json")
    $claim | ConvertTo-Json -Depth 8
} finally {
    if ($serverProcess -and !$serverProcess.HasExited) {
        Stop-Process -Id $serverProcess.Id -Force
    }
}

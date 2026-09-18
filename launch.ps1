# Launch Strategic Memory Dashboard on localhost:4242
$ScriptDir = Split-Path -Parent $MyInvocation.MyCommand.Path
Set-Location $ScriptDir

Write-Host "==========================================================" -ForegroundColor Cyan
Write-Host "   🧠 STRATEGIC MEMORY & KNOWLEDGE BASE DASHBOARD" -ForegroundColor Cyan
Write-Host "   LanceDB Vector & Cavemem SQLite Observability Tool" -ForegroundColor DarkGray
Write-Host "==========================================================" -ForegroundColor Cyan
Write-Host "Starting on http://localhost:4242 ..." -ForegroundColor Green

# Launch browser after 2 seconds
Start-Job -ScriptBlock {
    Start-Sleep -Seconds 2
    Start-Process "http://localhost:4242"
} | Out-Null

npx next start -p 4242

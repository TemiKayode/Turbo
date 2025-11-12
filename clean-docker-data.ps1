# Clean Docker Data Script
# Use this if Docker Desktop won't start and you need to reset Docker state
# WARNING: This will delete all Docker images, containers, and volumes

param(
    [switch]$Force
)

Write-Host "=== Docker Data Cleanup Script ===" -ForegroundColor Cyan
Write-Host "WARNING: This will delete all Docker data!" -ForegroundColor Red
Write-Host ""

if (-not $Force) {
    $confirm = Read-Host "Are you sure you want to delete all Docker data? (yes/no)"
    if ($confirm -ne "yes") {
        Write-Host "Cancelled." -ForegroundColor Yellow
        exit 0
    }
}

Write-Host "Stopping Docker Desktop..." -ForegroundColor Yellow
Get-Process "*Docker*" -ErrorAction SilentlyContinue | Stop-Process -Force
Start-Sleep -Seconds 5

Write-Host "`nBacking up Docker data directories..." -ForegroundColor Yellow

$dockerAppData = "$env:APPDATA\Docker"
$dockerLocalData = "$env:LOCALAPPDATA\Docker"

if (Test-Path $dockerAppData) {
    $backupApp = "$dockerAppData.backup.$(Get-Date -Format 'yyyyMMdd-HHmmss')"
    Write-Host "Backing up: $dockerAppData -> $backupApp" -ForegroundColor Gray
    Rename-Item $dockerAppData $backupApp -ErrorAction SilentlyContinue
    Write-Host "Backed up AppData Docker directory" -ForegroundColor Green
}

if (Test-Path $dockerLocalData) {
    $backupLocal = "$dockerLocalData.backup.$(Get-Date -Format 'yyyyMMdd-HHmmss')"
    Write-Host "Backing up: $dockerLocalData -> $backupLocal" -ForegroundColor Gray
    Rename-Item $dockerLocalData $backupLocal -ErrorAction SilentlyContinue
    Write-Host "Backed up LocalAppData Docker directory" -ForegroundColor Green
}

Write-Host "`nCleaning Docker-related registry keys (optional)..." -ForegroundColor Yellow
Write-Host "Skipping registry cleanup (requires admin and is risky)" -ForegroundColor Gray

Write-Host "`n=== Cleanup Complete ===" -ForegroundColor Green
Write-Host "`nNext steps:" -ForegroundColor Cyan
Write-Host "1. Restart your computer (recommended)" -ForegroundColor Yellow
Write-Host "2. Start Docker Desktop from Start menu" -ForegroundColor Yellow
Write-Host "3. Wait for Docker to fully initialize (30-60 seconds)" -ForegroundColor Yellow
Write-Host "4. Verify: docker info" -ForegroundColor Yellow
Write-Host "5. Pull fresh images: docker pull redis:7-alpine" -ForegroundColor Yellow
Write-Host "6. Rebuild: docker compose build --no-cache" -ForegroundColor Yellow
Write-Host ""
Write-Host "Backup locations:" -ForegroundColor Cyan
if (Test-Path $backupApp) { Write-Host "  - $backupApp" -ForegroundColor Gray }
if (Test-Path $backupLocal) { Write-Host "  - $backupLocal" -ForegroundColor Gray }






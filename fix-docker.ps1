# Docker Desktop Troubleshooting Script
# This script helps diagnose and fix Docker Desktop startup issues on Windows

Write-Host "=== Docker Desktop Troubleshooting Script ===" -ForegroundColor Cyan
Write-Host ""

# Step 0: Check WSL2 (required for Docker Desktop on Windows)
Write-Host "Step 0: Checking WSL2 installation..." -ForegroundColor Yellow
$wslStatus = wsl --status 2>&1
if ($LASTEXITCODE -ne 0 -or $wslStatus -match "kernel file is not found") {
    Write-Host "WSL2 kernel is missing or outdated. Updating..." -ForegroundColor Yellow
    Write-Host "This requires administrator privileges. Please run PowerShell as Administrator." -ForegroundColor Yellow
    Write-Host "Updating WSL kernel..." -ForegroundColor Yellow
    wsl --update
    if ($LASTEXITCODE -eq 0) {
        Write-Host "WSL2 kernel updated successfully!" -ForegroundColor Green
        Write-Host "Please restart your computer and run this script again." -ForegroundColor Yellow
        exit 0
    } else {
        Write-Host "WSL update failed. Please run as Administrator: wsl --update" -ForegroundColor Red
    }
} else {
    Write-Host "WSL2 is properly configured" -ForegroundColor Green
}

# Step 1: Check if Docker Desktop process is running
Write-Host "Step 1: Checking Docker Desktop status..." -ForegroundColor Yellow
$dockerProcess = Get-Process -Name "Docker Desktop" -ErrorAction SilentlyContinue

if ($dockerProcess) {
    Write-Host "Docker Desktop process found. Attempting to stop it..." -ForegroundColor Yellow
    Stop-Process -Name "Docker Desktop" -Force -ErrorAction SilentlyContinue
    Start-Sleep -Seconds 3
}

# Step 2: Check if Docker daemon is accessible
Write-Host "`nStep 2: Testing Docker daemon..." -ForegroundColor Yellow
try {
    $dockerVersion = docker --version 2>&1
    if ($LASTEXITCODE -eq 0) {
        Write-Host "Docker CLI is accessible: $dockerVersion" -ForegroundColor Green
    } else {
        Write-Host "Docker CLI not accessible" -ForegroundColor Red
        Write-Host "Please ensure Docker Desktop is installed and in your PATH" -ForegroundColor Red
        exit 1
    }
} catch {
    Write-Host "Docker CLI not found. Please install Docker Desktop." -ForegroundColor Red
    exit 1
}

# Step 3: Try to start Docker Desktop
Write-Host "`nStep 3: Starting Docker Desktop..." -ForegroundColor Yellow
$dockerDesktopPath = "${env:ProgramFiles}\Docker\Docker\Docker Desktop.exe"
if (Test-Path $dockerDesktopPath) {
    Write-Host "Launching Docker Desktop..." -ForegroundColor Green
    Start-Process -FilePath $dockerDesktopPath
    Write-Host "Waiting for Docker Desktop to start (this may take 30-60 seconds)..." -ForegroundColor Yellow
    
    # Wait for Docker to be ready (max 2 minutes)
    $timeout = 120
    $elapsed = 0
    $interval = 5
    
    while ($elapsed -lt $timeout) {
        Start-Sleep -Seconds $interval
        $elapsed += $interval
        
        try {
            docker info 2>&1 | Out-Null
            if ($LASTEXITCODE -eq 0) {
                Write-Host "Docker Desktop is ready!" -ForegroundColor Green
                break
            }
        } catch {
            # Continue waiting
        }
        
        if ($elapsed -lt $timeout) {
            Write-Host "Still waiting... ($elapsed/$timeout seconds)" -ForegroundColor Gray
        }
    }
    
    if ($elapsed -ge $timeout) {
        Write-Host "`nDocker Desktop did not start within timeout period." -ForegroundColor Red
        Write-Host "Please check Docker Desktop manually:" -ForegroundColor Yellow
        Write-Host "1. Open Docker Desktop from Start menu" -ForegroundColor Yellow
        Write-Host "2. Check system tray for Docker icon" -ForegroundColor Yellow
        Write-Host "3. Look for error messages in Docker Desktop" -ForegroundColor Yellow
        exit 1
    }
} else {
    Write-Host "Docker Desktop not found at expected location: $dockerDesktopPath" -ForegroundColor Red
    Write-Host "Please install Docker Desktop from: https://www.docker.com/products/docker-desktop/" -ForegroundColor Yellow
    exit 1
}

# Step 4: Clean up Docker state if needed
Write-Host "`nStep 4: Checking Docker state..." -ForegroundColor Yellow
try {
    docker system prune -f 2>&1 | Out-Null
    Write-Host "Docker system cleaned up" -ForegroundColor Green
} catch {
    Write-Host "Could not clean Docker system (this is okay)" -ForegroundColor Yellow
}

# Step 5: Test pulling the Redis image
Write-Host "`nStep 5: Testing image pull..." -ForegroundColor Yellow
Write-Host "Attempting to pull redis:7-alpine..." -ForegroundColor Yellow
try {
    docker pull redis:7-alpine
    if ($LASTEXITCODE -eq 0) {
        Write-Host "Successfully pulled redis:7-alpine!" -ForegroundColor Green
    } else {
        Write-Host "Failed to pull image. Trying alternative..." -ForegroundColor Yellow
        docker pull redis:7
    }
} catch {
    Write-Host "Error pulling image: $_" -ForegroundColor Red
}

# Step 6: Final verification
Write-Host "`nStep 6: Final verification..." -ForegroundColor Yellow
try {
    docker info | Select-String -Pattern "Server Version" | Out-Null
    if ($LASTEXITCODE -eq 0) {
        Write-Host "`n=== Docker is ready! ===" -ForegroundColor Green
        Write-Host "You can now run: docker compose up --build" -ForegroundColor Cyan
    } else {
        Write-Host "Docker may not be fully ready yet." -ForegroundColor Yellow
    }
} catch {
    Write-Host "Docker verification failed: $_" -ForegroundColor Red
}

Write-Host "`n=== Troubleshooting Complete ===" -ForegroundColor Cyan

# Docker Desktop "Unable to Start" - Fix Guide

## Common Causes & Solutions

### Issue: Docker Desktop Cannot Start

This error typically occurs when:
1. WSL2 is not properly configured
2. Docker Desktop service is corrupted
3. Virtualization is disabled in BIOS
4. Hyper-V conflicts with other virtualization software

## Solution Steps (Try in Order)

### Step 1: Check WSL2 Installation

Docker Desktop on Windows requires WSL2. Verify it's installed:

```powershell
# Check WSL version
wsl --list --verbose

# If WSL2 is not installed or default, install it:
wsl --install
wsl --set-default-version 2

# Restart your computer after installation
```

### Step 2: Restart Docker Desktop Service

```powershell
# Stop Docker Desktop completely
Get-Process "*Docker*" | Stop-Process -Force

# Wait a few seconds
Start-Sleep -Seconds 5

# Start Docker Desktop manually from Start menu
# OR use this command:
Start-Process "${env:ProgramFiles}\Docker\Docker\Docker Desktop.exe"
```

### Step 3: Reset Docker Desktop

If Docker Desktop still won't start:

1. **Close Docker Desktop completely** (check system tray)
2. **Reset Docker Desktop to factory defaults**:
   - Press `Win + R`
   - Type: `%APPDATA%\Docker`
   - Rename or delete the `settings.json` file
   - Restart Docker Desktop

### Step 4: Check Virtualization

Ensure virtualization is enabled in BIOS:
- Restart your computer
- Enter BIOS/UEFI settings (usually F2, F10, or Del during boot)
- Enable "Virtualization Technology" or "VT-x"
- Save and exit

### Step 5: Clean Docker Installation

If nothing works, try a clean reinstall:

```powershell
# Uninstall Docker Desktop
# 1. Go to Settings > Apps > Docker Desktop > Uninstall
# 2. OR use PowerShell (run as Administrator):
Get-AppxPackage *docker* | Remove-AppxPackage

# Clean Docker data
Remove-Item -Recurse -Force "$env:APPDATA\Docker"
Remove-Item -Recurse -Force "$env:LOCALAPPDATA\Docker"

# Reinstall Docker Desktop from: https://www.docker.com/products/docker-desktop/
```

### Step 6: Alternative - Use Development Mode Without Docker

If Docker continues to fail, you can run the application without Docker:

See the [Development Mode (Without Docker)](SETUP.md#development-mode-without-docker) section in SETUP.md.

## Quick Fix Commands

Run these commands in PowerShell (as Administrator if needed):

```powershell
# 1. Check WSL2
wsl --status

# 2. Restart Docker Desktop
Get-Process "*Docker*" | Stop-Process -Force
Start-Sleep -Seconds 5
Start-Process "${env:ProgramFiles}\Docker\Docker\Docker Desktop.exe"

# 3. Wait and test
Start-Sleep -Seconds 30
docker info
```

## Still Having Issues?

1. **Check Docker Desktop logs**:
   - Open Docker Desktop
   - Go to Settings > Troubleshoot
   - View logs for specific errors

2. **Check Windows Event Viewer**:
   - Open Event Viewer
   - Look for Docker-related errors in Application/System logs

3. **Common Windows-specific fixes**:
   ```powershell
   # Disable Windows Defender exclusions (temporarily)
   # Add Docker paths to Windows Defender exclusions
   
   # Check for port conflicts
   netstat -ano | findstr :2375
   netstat -ano | findstr :2376
   ```

4. **Update Windows**:
   - Ensure Windows is up to date
   - Docker Desktop requires Windows 10 64-bit: Pro, Enterprise, or Education (Build 19041 or higher)
   - OR Windows 11 64-bit

## Temporary Workaround

If you need to continue development immediately, use the non-Docker setup:

1. Install PostgreSQL, Redis, Go, Node.js, and Rust separately
2. Follow the "Development Mode (Without Docker)" section in SETUP.md
3. This allows you to continue working while troubleshooting Docker

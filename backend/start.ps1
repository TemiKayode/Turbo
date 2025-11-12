<#
Start.ps1 - Convenience script to run the backend with Supabase env vars set in the current session.

Usage:
  1) Edit the variables below (or set them in your environment) — do NOT commit secrets.
  2) Run this script in PowerShell: .\start.ps1

This script does NOT write secrets to disk; it only sets them for the current session.
#>

# --- Interactive prompt for sensitive env vars (safer than editing files) ---
Write-Host "If you want to connect to a Supabase Postgres DB, paste the full connection string when prompted."
Write-Host "Format example: postgres://postgres:<PASSWORD>@db.<region>.supabase.co:5432/postgres?sslmode=require"

if (-not $env:SUPABASE_DB_URL) {
  while ($true) {
    $s = Read-Host -Prompt "Enter SUPABASE_DB_URL (Postgres URI) OR paste your SUPABASE project URL starting with https:// (press Enter to skip)"
    if (-not $s -or $s.Trim() -eq "") { break }
    $s = $s.Trim()
    if ($s -like 'postgres://*') {
      $env:SUPABASE_DB_URL = $s
      break
    }
    if ($s -like 'https://*') {
      # User pasted the Supabase project URL by mistake; set SUPABASE_URL and re-prompt for DB URI.
      $env:SUPABASE_URL = $s
      Write-Host "Detected an HTTP Supabase URL; set SUPABASE_URL."
      Write-Host "You still need to provide the Postgres connection string (postgres://...)."
      continue
    }
    Write-Host "Input doesn't look like a postgres:// URI or https:// URL. Please paste the full Postgres connection string or the Supabase project URL."
  }
}

if (-not $env:SUPABASE_SERVICE_ROLE_KEY) {
  $sr = Read-Host -Prompt "(Optional) Enter SUPABASE_SERVICE_ROLE_KEY (server-only, press Enter to skip)"
  if ($sr -and $sr.Trim() -ne "") { $env:SUPABASE_SERVICE_ROLE_KEY = $sr }
}

# Ensure we have a redis address or default
if (-not $env:REDIS_ADDR) { $env:REDIS_ADDR = 'localhost:6379' }

Write-Host "Starting backend with the following environment variables (masked):"
Write-Host "  SUPABASE_DB_URL = " -NoNewline; if ($env:SUPABASE_DB_URL) { Write-Host "(set)" } else { Write-Host "(not set)" }
Write-Host "  SUPABASE_SERVICE_ROLE_KEY = " -NoNewline; if ($env:SUPABASE_SERVICE_ROLE_KEY) { Write-Host "(set - hidden)" } else { Write-Host "(not set)" }
Write-Host "  REDIS_ADDR = $($env:REDIS_ADDR)"

# Run the backend
cd (Split-Path -Parent $MyInvocation.MyCommand.Path)
cd "..\backend\go"
Write-Host "Running: go run main.go"
go run main.go

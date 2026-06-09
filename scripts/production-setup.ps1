# Run on the WINDOWS PC (PowerShell).
$ErrorActionPreference = "Stop"
Set-Location (Join-Path $PSScriptRoot "..")

if (-not (Test-Path ".env.production")) {
  Copy-Item "deploy\env.production.example" ".env.production"
  Write-Host "Created .env.production — edit it with your API keys, then re-run."
  exit 1
}

Write-Host "Installing dependencies…"
npm ci

Write-Host "Building…"
npm run build

Write-Host "Done. Start with: npm run start"
Write-Host "Then add redstone.deoxylabs.com to your Cloudflare tunnel (see deploy/windows-setup.md)."

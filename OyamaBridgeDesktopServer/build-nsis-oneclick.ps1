Set-StrictMode -Version Latest
$ErrorActionPreference = "Stop"

Set-Location -Path $PSScriptRoot

Write-Host ""
Write-Host "=============================================" -ForegroundColor Green
Write-Host "Oyama Bridge - NSIS One-Click Installer Build" -ForegroundColor Green
Write-Host "=============================================" -ForegroundColor Green
Write-Host ""

if (-not (Test-Path -Path "node_modules")) {
  Write-Host "[1/4] Installing dependencies..."
  npm install
  if ($LASTEXITCODE -ne 0) {
    throw "Dependency install failed."
  }
} else {
  Write-Host "[1/4] Dependencies already installed."
}

Write-Host "[2/4] Cleaning previous release output..."
if (Test-Path -Path "release") {
  Remove-Item -Recurse -Force "release"
}
New-Item -ItemType Directory -Path "release" -Force | Out-Null

Write-Host "[3/4] Building one-click NSIS installer..."
npx electron-builder --win nsis --x64 --publish never
if ($LASTEXITCODE -ne 0) {
  throw "NSIS installer build failed."
}

Write-Host "[4/4] Build complete." -ForegroundColor Green
Write-Host "Output folder: $PSScriptRoot\\release" -ForegroundColor Green

$latestInstaller = Get-ChildItem -Path "$PSScriptRoot\release" -Filter "Oyama-Bridge-Setup-*.exe" -ErrorAction SilentlyContinue |
  Sort-Object LastWriteTime -Descending |
  Select-Object -First 1

if ($null -ne $latestInstaller) {
  Write-Host "Installer: $($latestInstaller.FullName)" -ForegroundColor Green
}

Write-Host ""

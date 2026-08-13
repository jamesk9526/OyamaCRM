[CmdletBinding()]
param(
    [switch]$Clean
)

$ErrorActionPreference = "Stop"
$ProjectRoot = Split-Path -Parent $MyInvocation.MyCommand.Path
Set-Location $ProjectRoot

if ($Clean) {
    Remove-Item -LiteralPath (Join-Path $ProjectRoot "build") -Recurse -Force -ErrorAction SilentlyContinue
    Remove-Item -LiteralPath (Join-Path $ProjectRoot "dist") -Recurse -Force -ErrorAction SilentlyContinue
}

python -m pip install --upgrade pip
python -m pip install -r requirements.txt
python -m PyInstaller --noconfirm --clean --windowed --onefile --name "OyamaCRM-Desktop" oyama_desktop.py

Write-Host "Build complete: $ProjectRoot\dist\OyamaCRM-Desktop.exe" -ForegroundColor Green

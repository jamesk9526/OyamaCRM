@echo off
setlocal EnableExtensions
cd /d "%~dp0"

set "PROJECT=OyamaPrint.csproj"
set "INSTALLER=Installer\OyamaPrint.Installer.wixproj"
set "PUBLISH_DIR=%CD%\artifacts\publish"
set "MSI_DIR=%CD%\artifacts\msi"

for /f %%V in ('powershell -NoProfile -Command "$now = Get-Date; $rolling = $now.Day * 2000 + $now.Hour * 60 + $now.Minute; '{0}.{1}.{2}' -f ($now.Year %% 100), $now.Month, $rolling"') do set "PRODUCT_VERSION=%%V"

echo.
echo ==========================================
echo Building OyamaPrint %PRODUCT_VERSION% MSI
echo ==========================================
echo.

if exist "%PUBLISH_DIR%" rmdir /s /q "%PUBLISH_DIR%"
if not exist "%PUBLISH_DIR%" mkdir "%PUBLISH_DIR%"
if not exist "%MSI_DIR%" mkdir "%MSI_DIR%"

echo Restoring .NET and WiX dependencies...
dotnet restore "%PROJECT%"
if errorlevel 1 goto :fail
dotnet restore "%INSTALLER%"
if errorlevel 1 goto :fail

echo Publishing x64 desktop application...
dotnet publish "%PROJECT%" -c Release -r win-x64 --self-contained false -p:Version=%PRODUCT_VERSION% -o "%PUBLISH_DIR%"
if errorlevel 1 goto :fail

echo Packaging rolling MSI...
dotnet build "%INSTALLER%" -c Release --no-restore -p:ProductVersion=%PRODUCT_VERSION% -p:PublishDir="%PUBLISH_DIR%" -p:OutputPath="%MSI_DIR%\"
if errorlevel 1 goto :fail

echo.
echo Build complete.
echo Version: %PRODUCT_VERSION%
echo MSI: %MSI_DIR%\OyamaPrint-%PRODUCT_VERSION%-x64.msi
echo.
exit /b 0

:fail
echo.
echo Build failed. Review the error above.
exit /b 1

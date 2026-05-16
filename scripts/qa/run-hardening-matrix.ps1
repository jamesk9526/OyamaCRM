param(
  [string]$ArtifactDate = "2026-05-16"
)

$ErrorActionPreference = "Continue"
Set-Location "C:\Users\James\Documents\GitHub\OyamaCRM"
$artifactDir = Join-Path "docs/status/audit-artifacts" $ArtifactDate
New-Item -ItemType Directory -Force -Path $artifactDir | Out-Null
Get-ChildItem -Path $artifactDir -Filter "*.log" -ErrorAction SilentlyContinue | Remove-Item -Force
$summaryPath = Join-Path $artifactDir "command-summary.jsonl"
if (Test-Path $summaryPath) { Remove-Item -Path $summaryPath -Force }

$lanes = @(
  @{ label = "lint"; command = "pnpm lint" },
  @{ label = "typecheck"; command = "pnpm typecheck" },
  @{ label = "typecheck:web"; command = "pnpm typecheck:web" },
  @{ label = "typecheck:server"; command = "pnpm typecheck:server" },
  @{ label = "test:smoke"; command = "pnpm test:smoke" },
  @{ label = "test:smoke:critical"; command = "pnpm test:smoke:critical" },
  @{ label = "test:e2e"; command = "pnpm test:e2e" },
  @{ label = "test:e2e:mobile"; command = "pnpm test:e2e:mobile" },
  @{ label = "test:e2e:livecom"; command = "pnpm test:e2e:livecom" },
  @{ label = "test:e2e:responsive"; command = "pnpm test:e2e:responsive" },
  @{ label = "test"; command = "pnpm test" },
  @{ label = "test:coverage"; command = "pnpm test:coverage" },
  @{ label = "build"; command = "pnpm build" },
  @{ label = "build:server"; command = "pnpm build:server" },
  @{ label = "db:generate"; command = "pnpm db:generate" },
  @{ label = "db:verify:linux-casing"; command = "pnpm db:verify:linux-casing" },
  @{ label = "test:e2e:auth"; command = "pnpm test:e2e:auth" },
  @{ label = "test:e2e:watchdog"; command = "pnpm test:e2e:watchdog" }
)

$results = @()
foreach ($lane in $lanes) {
  $startUtc = (Get-Date).ToUniversalTime().ToString("o")
  $safeName = ($lane.label -replace "[: ]", "_")
  $logPath = Join-Path $artifactDir ("{0}.log" -f $safeName)
  Write-Host ("=== Running {0} ===" -f $lane.label)
  $cmdLine = "{0} > `"{1}`" 2>&1" -f $lane.command, $logPath
  cmd.exe /c $cmdLine
  $exitCode = $LASTEXITCODE
  $endUtc = (Get-Date).ToUniversalTime().ToString("o")

  $entry = [ordered]@{
    label = $lane.label
    command = $lane.command
    startUtc = $startUtc
    endUtc = $endUtc
    exitCode = $exitCode
    logPath = $logPath
  }
  ($entry | ConvertTo-Json -Compress) | Add-Content -Path $summaryPath -Encoding utf8
  $results += [pscustomobject]$entry
  Write-Host ("=== Completed {0} (exit {1}) ===" -f $lane.label, $exitCode)
}

$results | Format-Table -Property label, exitCode, logPath -AutoSize
$passCount = ($results | Where-Object { $_.exitCode -eq 0 }).Count
$failCount = ($results | Where-Object { $_.exitCode -ne 0 }).Count
Write-Host ("TOTAL: {0} passed, {1} failed" -f $passCount, $failCount)

$failed = $results | Where-Object { $_.exitCode -ne 0 }
foreach ($f in $failed) {
  Write-Host ("--- Failed lane: {0} ---" -f $f.label)
  if (Test-Path $f.logPath) {
    Get-Content -Path $f.logPath -Tail 25
  } else {
    Write-Host "Log file missing"
  }
}

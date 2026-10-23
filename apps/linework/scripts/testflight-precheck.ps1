# Linework TestFlight pre-check (oversight D112-2). Started by TESTFLIGHT_PRECHECK.cmd.
# Runs install, npx tsc --noEmit and npx expo export --platform ios BEFORE the owner
# runs TESTFLIGHT_LINEWORK.cmd, and writes testflight-precheck.txt with each step's
# exit code and its first 40 error lines. Stops at the first failed step so the
# report is short and readable. It only touches this folder.
$ErrorActionPreference = 'Continue'
$root = Split-Path -Parent $PSScriptRoot
Set-Location -LiteralPath $root
$report = Join-Path $root 'testflight-precheck.txt'
$logDir = Join-Path $root '.verify-logs'
New-Item -ItemType Directory -Force -Path $logDir | Out-Null

$nodeVersion = (& node -v) 2>$null
Set-Content -LiteralPath $report -Value "Linework TestFlight pre-check, $(Get-Date -Format 'yyyy-MM-dd HH:mm')"
Add-Content -LiteralPath $report -Value "node $nodeVersion"
$head = (& git rev-parse --short HEAD) 2>$null
if ($head) { Add-Content -LiteralPath $report -Value "commit $head" }

$install = if (Test-Path -LiteralPath (Join-Path $root 'package-lock.json')) { 'npm ci' } else { 'npm install' }
$steps = @(
  @{ name = 'install'; cmd = $install },
  @{ name = 'typecheck'; cmd = 'npx tsc --noEmit' },
  @{ name = 'export-ios'; cmd = 'npx expo export --platform ios --output-dir .verify' }
)
$errorPattern = 'error|ERR!|fail|cannot find|unable to resolve'
$allOk = $true

foreach ($s in $steps) {
  Write-Host ''
  Write-Host "== $($s.name): $($s.cmd)"
  $log = Join-Path $logDir "precheck-$($s.name).txt"
  cmd /c "$($s.cmd) 2>&1" | Tee-Object -FilePath $log
  $code = $LASTEXITCODE
  Add-Content -LiteralPath $report -Value ''
  Add-Content -LiteralPath $report -Value "== $($s.name) ($($s.cmd)): exit $code"
  $lines = @(Get-Content -LiteralPath $log -ErrorAction SilentlyContinue)
  $errs = @($lines | Where-Object { $_ -match $errorPattern } | Select-Object -First 40)
  if ($code -ne 0 -and $errs.Count -eq 0) { $errs = @($lines | Select-Object -Last 40) }
  foreach ($l in $errs) { Add-Content -LiteralPath $report -Value "  $l" }
  if ($code -ne 0) { $allOk = $false; break }
}

Add-Content -LiteralPath $report -Value ''
if ($allOk) {
  Add-Content -LiteralPath $report -Value 'RESULT: ready for TESTFLIGHT_LINEWORK.cmd'
  Write-Host ''
  Write-Host 'Pre-check passed. You can run TESTFLIGHT_LINEWORK.cmd now.'
  exit 0
}
Add-Content -LiteralPath $report -Value 'RESULT: stopped at the failed step above - do not build yet'
Write-Host ''
Write-Host 'Pre-check failed. Please paste testflight-precheck.txt (in this folder) into a comment on the Linework Build page.'
exit 1

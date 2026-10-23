# Linework PC verification (oversight D65-1, clears T13). Started by VERIFY.cmd.
# Runs install, type check, tests and an iOS export, and writes verify-report.txt
# with each step's exit code and its first 40 error lines. It only touches this folder.
$ErrorActionPreference = 'Continue'
$root = Split-Path -Parent $PSScriptRoot
Set-Location -LiteralPath $root
$report = Join-Path $root 'verify-report.txt'
$logDir = Join-Path $root '.verify-logs'
New-Item -ItemType Directory -Force -Path $logDir | Out-Null

$nodeVersion = (& node -v) 2>$null
Set-Content -LiteralPath $report -Value "Linework verify report, $(Get-Date -Format 'yyyy-MM-dd HH:mm')"
Add-Content -LiteralPath $report -Value "node $nodeVersion"
$head = (& git rev-parse --short HEAD) 2>$null
if ($head) { Add-Content -LiteralPath $report -Value "commit $head" }

$install = if (Test-Path -LiteralPath (Join-Path $root 'package-lock.json')) { 'npm ci' } else { 'npm install' }
$steps = @(
  @{ name = 'install'; cmd = $install },
  @{ name = 'expo-modules'; cmd = 'npx expo install expo-blur expo-linear-gradient' },
  @{ name = 'typecheck'; cmd = 'npx tsc --noEmit' },
  @{ name = 'tests'; cmd = 'npm test' },
  @{ name = 'export-ios'; cmd = 'npx expo export --platform ios --output-dir .verify' }
)
$errorPattern = 'error|ERR!|fail|not ok|cannot find|unable to resolve|✖'
$allOk = $true

foreach ($s in $steps) {
  Write-Host ''
  Write-Host "== $($s.name): $($s.cmd)"
  $log = Join-Path $logDir "$($s.name).txt"
  cmd /c "$($s.cmd) 2>&1" | Tee-Object -FilePath $log
  $code = $LASTEXITCODE
  if ($code -ne 0) { $allOk = $false }
  Add-Content -LiteralPath $report -Value ''
  Add-Content -LiteralPath $report -Value "== $($s.name) ($($s.cmd)): exit $code"
  $lines = @(Get-Content -LiteralPath $log -ErrorAction SilentlyContinue)
  $errs = @($lines | Where-Object { $_ -match $errorPattern } | Select-Object -First 40)
  if ($code -ne 0 -and $errs.Count -eq 0) { $errs = @($lines | Select-Object -Last 40) }
  foreach ($l in $errs) { Add-Content -LiteralPath $report -Value "  $l" }
}

Add-Content -LiteralPath $report -Value ''
if ($allOk) {
  Add-Content -LiteralPath $report -Value 'RESULT: all steps passed'
  Write-Host ''
  Write-Host 'All checks passed.'
} else {
  Add-Content -LiteralPath $report -Value 'RESULT: some steps failed (see above)'
  Write-Host ''
  Write-Host 'Some checks failed.'
}
Write-Host 'Please paste verify-report.txt (in this folder) into a comment on the Linework Build page.'
if ($allOk) { exit 0 } else { exit 1 }

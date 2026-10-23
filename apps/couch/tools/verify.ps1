# Couch PC verification (oversight D65-1, clears backlog T18).
# Run by VERIFY.cmd. Each step runs in turn; nothing stops early, so one report covers everything.
# Writes verify-report.txt next to VERIFY.cmd: per step the exit code and the first 40 error lines.
$ErrorActionPreference = 'Continue'
$root = Split-Path -Parent $PSScriptRoot
Set-Location $root
$report = Join-Path $root 'verify-report.txt'
$tmp = Join-Path $root '.verify-step.txt'

$steps = @(
  @{ name = 'npm install';                 cmd = 'npm install' },
  @{ name = 'expo install expo@latest';    cmd = 'npx --yes expo install expo@latest' },
  @{ name = 'expo install blur+gradient';  cmd = 'npx --yes expo install expo-blur expo-linear-gradient' },
  @{ name = 'expo install --fix';          cmd = 'npx --yes expo install --fix' },
  @{ name = 'typecheck (tsc --noEmit)';    cmd = 'npx --no-install tsc --noEmit' },
  @{ name = 'tests (npm test)';            cmd = 'npm test -- --ci' },
  @{ name = 'bundle (expo export ios)';    cmd = 'npx --yes expo export --platform ios --output-dir .verify' }
)

"Couch verify report" | Out-File -FilePath $report -Encoding utf8
"Started: $(Get-Date -Format 'yyyy-MM-dd HH:mm:ss')" | Out-File -FilePath $report -Append -Encoding utf8
"Node: $(node --version)  npm: $(npm --version)" | Out-File -FilePath $report -Append -Encoding utf8
"" | Out-File -FilePath $report -Append -Encoding utf8

$summary = @()
$i = 0
foreach ($s in $steps) {
  $i++
  Write-Host ""
  Write-Host "[$i/$($steps.Count)] $($s.name)..."
  cmd /c "$($s.cmd) 2>&1" | Tee-Object -FilePath $tmp
  $code = $LASTEXITCODE
  $lines = @(Get-Content $tmp -ErrorAction SilentlyContinue)
  $errs = @($lines | Where-Object { $_ -match '(?i)\berror\b|ERR!|\bfail(ed|ing)?\b|Cannot find|not found|TS\d{4}' } | Select-Object -First 40)
  if ($errs.Count -eq 0 -and $code -ne 0) { $errs = @($lines | Select-Object -Last 40) }
  $status = if ($code -eq 0) { 'OK' } else { 'FAILED' }
  $summary += "$status  exit $code  $($s.name)"
  "==== [$i] $($s.name): exit code $code ($status) ====" | Out-File -FilePath $report -Append -Encoding utf8
  if ($errs.Count -gt 0) {
    "-- first $($errs.Count) error lines --" | Out-File -FilePath $report -Append -Encoding utf8
    $errs | Out-File -FilePath $report -Append -Encoding utf8
  } else {
    "(no error lines)" | Out-File -FilePath $report -Append -Encoding utf8
  }
  "" | Out-File -FilePath $report -Append -Encoding utf8
}
Remove-Item $tmp -ErrorAction SilentlyContinue

"==== Summary ====" | Out-File -FilePath $report -Append -Encoding utf8
$summary | Out-File -FilePath $report -Append -Encoding utf8
"Finished: $(Get-Date -Format 'yyyy-MM-dd HH:mm:ss')" | Out-File -FilePath $report -Append -Encoding utf8

Write-Host ""
Write-Host "==== Summary ===="
$summary | ForEach-Object { Write-Host $_ }
Write-Host ""
Write-Host "Report saved to verify-report.txt. Paste it into a comment on the Couch build page."

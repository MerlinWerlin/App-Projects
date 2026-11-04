param(
    [Parameter(Mandatory=$true)][string]$UnsignedBundle,
    [Parameter(Mandatory=$true)][string]$SignedBundle
)
$ErrorActionPreference = 'Stop'
$taskKeyRoot = Join-Path $env:USERPROFILE '.android-signing\backspin'
$taskSigner = Join-Path $env:USERPROFILE '.cache\backspin-java17\jdk-17.0.21+9\bin\jarsigner.exe'
$taskJava = Join-Path (Split-Path $taskSigner) 'java.exe'
$taskBundletool = Join-Path $env:USERPROFILE '.cache\backspin-bundletool\bundletool-all-1.18.3.jar'
$taskInput = (Resolve-Path -LiteralPath $UnsignedBundle).Path
$taskOutput = [IO.Path]::GetFullPath($SignedBundle)
if (Test-Path -LiteralPath $taskOutput) { throw 'Output already exists; refusing to overwrite a release artifact.' }
if (-not(Test-Path -LiteralPath $taskSigner)) { throw 'Verified local Temurin JDK17 signer is required.' }
if ((Get-FileHash -LiteralPath $taskBundletool -Algorithm SHA256).Hash.ToLower() -ne 'a099cfa1543f55593bc2ed16a70a7c67fe54b1747bb7301f37fdfd6d91028e29') { throw 'Official Google bundletool checksum mismatch.' }
& $taskJava -Xms16m -Xmx256m -XX:+UseSerialGC -jar $taskBundletool validate --bundle=$taskInput *> ($taskOutput+'.bundletool-validation.txt')
if ($LASTEXITCODE -ne 0) { throw 'Google bundletool validation failed.' }
$taskActualPackage = (& $taskJava -Xms16m -Xmx256m -XX:+UseSerialGC -jar $taskBundletool dump manifest --bundle=$taskInput --xpath=/manifest/@package | Out-String).Trim()
if ($LASTEXITCODE -ne 0 -or $taskActualPackage -ne 'com.jared797.backspin') { throw 'Actual compiled manifest is not the production package.' }
$taskKey = Join-Path $taskKeyRoot 'upload-key.jks'
$taskReceipt = Get-Content -LiteralPath (Join-Path (Split-Path $taskInput) 'receipt.json') -Raw | ConvertFrom-Json
$taskConfig = Get-Content -LiteralPath (Join-Path (Split-Path $taskInput) 'config.json') -Raw | ConvertFrom-Json
if ($taskReceipt.status -ne 'UNSIGNED_NOT_UPLOADABLE' -or $taskConfig.android.package -ne 'com.jared797.backspin' -or $taskConfig.updates.enabled -ne $false) { throw 'Expected production-package, embedded-only unsigned bundle receipt.' }
if ((Get-FileHash -LiteralPath $taskInput -Algorithm SHA256).Hash.ToLower() -ne $taskReceipt.sha256) { throw 'Unsigned bundle hash does not match its CI receipt.' }
Add-Type -AssemblyName System.IO.Compression.FileSystem
$taskArchive = [IO.Compression.ZipFile]::OpenRead($taskInput)
try {
    if (-not ($taskArchive.Entries.FullName -contains 'base/assets/index.android.bundle')) { throw 'Embedded JavaScript missing.' }
    if ($taskArchive.Entries.FullName -match '^META-INF/.*\.(RSA|DSA|EC)$') { throw 'Input is already signed.' }
} finally { $taskArchive.Dispose() }
$taskSecure = (Get-Content -LiteralPath (Join-Path $taskKeyRoot 'store-password.dpapi') -Raw).Trim() | ConvertTo-SecureString
try {
    $env:BACKSPIN_UPLOAD_PASSWORD = [System.Net.NetworkCredential]::new('', $taskSecure).Password
    & $taskSigner -J-Xms16m -J-Xmx256m -J-XX:+UseSerialGC -keystore $taskKey -storepass:env BACKSPIN_UPLOAD_PASSWORD -keypass:env BACKSPIN_UPLOAD_PASSWORD -sigalg SHA256withRSA -digestalg SHA-256 -signedjar $taskOutput $taskInput backspin-upload
    if ($LASTEXITCODE -ne 0) { throw 'Bundle signing failed.' }
    & $taskSigner -J-Xms16m -J-Xmx256m -J-XX:+UseSerialGC -verify -strict -keystore $taskKey -storepass:env BACKSPIN_UPLOAD_PASSWORD $taskOutput
    if ($LASTEXITCODE -ne 0) { throw 'Strict signature verification failed; do not upload output.' }
    [ordered]@{
        status='SIGNATURE_VERIFIED_STORE_GATES_PENDING'
        unsignedSha256=(Get-FileHash -LiteralPath $taskInput -Algorithm SHA256).Hash.ToLower()
        signedSha256=(Get-FileHash -LiteralPath $taskOutput -Algorithm SHA256).Hash.ToLower()
        bytes=(Get-Item -LiteralPath $taskOutput).Length
        certificateSha256='1e87ec4c603a4b12721add35c75d2753a37a5fc6edc59357e226ce4f03bb3db8'
        note='Local upload signature only; account verification, Play App Signing registration, billing and review remain required.'
    } | ConvertTo-Json | Set-Content -LiteralPath ($taskOutput+'.receipt.json') -Encoding utf8
} finally {
    Remove-Item Env:BACKSPIN_UPLOAD_PASSWORD -ErrorAction SilentlyContinue
}

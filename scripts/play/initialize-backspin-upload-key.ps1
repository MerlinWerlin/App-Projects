$ErrorActionPreference = 'Stop'
$taskKeyRoot = Join-Path $env:USERPROFILE '.android-signing\backspin'
$taskKeyFile = Join-Path $taskKeyRoot 'upload-key.jks'
$taskPasswordFile = Join-Path $taskKeyRoot 'store-password.dpapi'
$taskKeytool = 'C:\Program Files\Java\jre1.8.0_431\bin\keytool.exe'
if (-not (Test-Path -LiteralPath $taskKeytool)) { throw 'A trusted JDK/JRE keytool is required.' }
if (-not (Test-Path -LiteralPath $taskKeyRoot)) {
    New-Item -ItemType Directory -Path $taskKeyRoot | Out-Null
    $taskAcl = New-Object System.Security.AccessControl.DirectorySecurity
    $taskAcl.SetAccessRuleProtection($true, $false)
    foreach ($taskSid in @([System.Security.Principal.WindowsIdentity]::GetCurrent().User,
                          [System.Security.Principal.SecurityIdentifier]'S-1-5-18',
                          [System.Security.Principal.SecurityIdentifier]'S-1-5-32-544')) {
        $taskRule = New-Object System.Security.AccessControl.FileSystemAccessRule($taskSid, 'FullControl', 'ContainerInherit,ObjectInherit', 'None', 'Allow')
        $taskAcl.AddAccessRule($taskRule)
    }
    Set-Acl -LiteralPath $taskKeyRoot -AclObject $taskAcl
}
if ((Test-Path -LiteralPath $taskKeyFile) -and -not (Test-Path -LiteralPath $taskPasswordFile)) {
    throw 'Existing key has no saved password record. Refusing to replace or guess it.'
}
if (-not (Test-Path -LiteralPath $taskPasswordFile)) {
    $taskRandom = New-Object byte[] 32
    [System.Security.Cryptography.RandomNumberGenerator]::Fill($taskRandom)
    $taskPassword = [Convert]::ToBase64String($taskRandom)
    $taskSecure = ConvertTo-SecureString $taskPassword -AsPlainText -Force
    $taskSecure | ConvertFrom-SecureString | Set-Content -LiteralPath $taskPasswordFile -Encoding ascii
} else {
    $taskSecure = (Get-Content -LiteralPath $taskPasswordFile -Raw).Trim() | ConvertTo-SecureString
    $taskPassword = [System.Net.NetworkCredential]::new('', $taskSecure).Password
}
try {
    $env:BACKSPIN_UPLOAD_PASSWORD = $taskPassword
    if (-not (Test-Path -LiteralPath $taskKeyFile)) {
        & $taskKeytool -J-Xms16m -J-Xmx128m -J-XX:+UseSerialGC -genkeypair -keystore $taskKeyFile -storetype JKS -alias backspin-upload -keyalg RSA -keysize 4096 -sigalg SHA256withRSA -validity 10000 -dname 'CN=Backspin Upload, O=Jared James Bradley, C=AU' -storepass:env BACKSPIN_UPLOAD_PASSWORD -keypass:env BACKSPIN_UPLOAD_PASSWORD
        if ($LASTEXITCODE -ne 0) { throw 'Key generation failed; password record retained for recovery.' }
    }
    & $taskKeytool -J-Xms16m -J-Xmx128m -J-XX:+UseSerialGC -exportcert -rfc -keystore $taskKeyFile -alias backspin-upload -storepass:env BACKSPIN_UPLOAD_PASSWORD -file (Join-Path $taskKeyRoot 'upload-certificate.pem')
    if ($LASTEXITCODE -ne 0) { throw 'Certificate readback failed.' }
    @'
# Backspin upload signing

Private upload-key.jks and its Windows current-user DPAPI password record. Alias: backspin-upload. Keep this folder out of Git, public build artifacts and Google identity-document uploads. The PEM is an app-signing certificate, not a business registration document.

The password can be recovered only with the owning Windows user/profile. Preserve an owner-controlled secure backup of the key and a recoverable password before first store upload. No private key or password has been copied to GitHub. No Play application or upload-key registration is implied by generating the key.
'@ | Set-Content -LiteralPath (Join-Path $taskKeyRoot 'README.md') -Encoding utf8
    Write-Output 'Backspin upload key and public certificate verified. Private key and DPAPI password stay outside Git.'
} finally {
    Remove-Item Env:BACKSPIN_UPLOAD_PASSWORD -ErrorAction SilentlyContinue
    $taskPassword = $null
}



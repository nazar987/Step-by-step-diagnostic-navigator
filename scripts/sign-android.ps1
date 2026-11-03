param(
    [Parameter(Mandatory)][string]$UnsignedApk,
    [Parameter(Mandatory)][string]$OutputApk,
    [Parameter(Mandatory)][string]$JavaBin,
    [Parameter(Mandatory)][string]$BuildTools
)
$ErrorActionPreference = 'Stop'
$repoPath = Split-Path $PSScriptRoot
$signingPath = Join-Path $repoPath '.release-signing'
$keyPath = Join-Path $signingPath 'android-release.p12'
$passwordPath = Join-Path $signingPath 'password.dpapi'
$keyAlias = 'navigator-release'
$java = Join-Path $JavaBin 'java.exe'
$keytool = Join-Path $JavaBin 'keytool.exe'
$apksigner = Join-Path $BuildTools 'lib\apksigner.jar'
$zipalign = Join-Path $BuildTools 'zipalign.exe'
$sourceApk = (Resolve-Path -LiteralPath $UnsignedApk).Path
$destinationApk = [System.IO.Path]::GetFullPath($OutputApk)
foreach ($requiredFile in @($java, $keytool, $apksigner, $zipalign)) {
    if (!(Test-Path -LiteralPath $requiredFile -PathType Leaf)) { throw "Missing signing tool: $requiredFile" }
}
if ($sourceApk -eq $destinationApk) { throw 'Input and output APK paths must differ.' }
if (Test-Path -LiteralPath $destinationApk) { throw 'Output APK already exists; refusing to overwrite a published artifact.' }
New-Item -ItemType Directory -Path (Split-Path $destinationApk) -Force | Out-Null
New-Item -ItemType Directory -Path $signingPath -Force | Out-Null

if (Test-Path -LiteralPath $keyPath) {
    if (!(Test-Path -LiteralPath $passwordPath)) { throw 'Existing key has no saved password; refusing to replace it.' }
    $securePassword = Get-Content -LiteralPath $passwordPath -Raw | ConvertTo-SecureString
    $keyPassword = [System.Net.NetworkCredential]::new('', $securePassword).Password
} else {
    $keyPassword = [Convert]::ToBase64String([System.Security.Cryptography.RandomNumberGenerator]::GetBytes(32))
    $securePassword = ConvertTo-SecureString $keyPassword -AsPlainText -Force
    $securePassword | ConvertFrom-SecureString | Set-Content -LiteralPath $passwordPath -Encoding utf8
}

$env:NAVIGATOR_SIGNING_PASS = $keyPassword
try {
    if (!(Test-Path -LiteralPath $keyPath)) {
        & $keytool -genkeypair -keystore $keyPath -storetype PKCS12 -alias $keyAlias -keyalg RSA -keysize 4096 -sigalg SHA256withRSA -validity 10950 -dname 'CN=DC Navigator' -storepass:env NAVIGATOR_SIGNING_PASS -keypass:env NAVIGATOR_SIGNING_PASS -noprompt
        if ($LASTEXITCODE -ne 0) { throw 'Keystore creation failed.' }
    }
    # Alignment must precede signing; any later change would invalidate the APK.
    $alignedApk = Join-Path (Split-Path $destinationApk) 'app-release-aligned-unsigned.apk'
    & $zipalign -P 16 -f 4 $sourceApk $alignedApk
    if ($LASTEXITCODE -ne 0) { throw 'APK alignment failed.' }
    & $java -jar $apksigner sign --ks $keyPath --ks-type PKCS12 --ks-key-alias $keyAlias --ks-pass env:NAVIGATOR_SIGNING_PASS --key-pass env:NAVIGATOR_SIGNING_PASS --out $destinationApk $alignedApk
    if ($LASTEXITCODE -ne 0) { throw 'APK signing failed.' }
    & $java -jar $apksigner verify --verbose --print-certs $destinationApk
    if ($LASTEXITCODE -ne 0) { throw 'APK signature verification failed.' }
    & $zipalign -c -P 16 4 $destinationApk
    if ($LASTEXITCODE -ne 0) { throw 'Signed APK alignment verification failed.' }
} finally {
    Remove-Item Env:NAVIGATOR_SIGNING_PASS -ErrorAction SilentlyContinue
    $keyPassword = $null
    $securePassword = $null
}

@'
Android signing key for ru.navigator.dc. Alias: navigator-release.
android-release.p12 is the permanent PKCS12 key. password.dpapi protects the
password with Windows DPAPI for this Windows account. Keep BOTH files.
These files must never be committed or uploaded to GitHub/Actions/Release assets.
For migration to another PC, back up the key and password in a password manager
while signed into this Windows account; DPAPI alone is not a portable backup.
Updates must use this same signing certificate. Do not regenerate the key.
'@ | Set-Content -LiteralPath (Join-Path $signingPath 'README.txt') -Encoding utf8
Write-Output "Signed and verified APK: $destinationApk"

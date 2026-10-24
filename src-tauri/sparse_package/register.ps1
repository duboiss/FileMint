param(
    [string]$AppDir,
    [string]$MsixPath,
    [string]$CerPath
)

$ErrorActionPreference = "SilentlyContinue"

if (-not $AppDir) {
    $AppDir = (Resolve-Path "src-tauri\target\debug").Path
}
if (-not $MsixPath) {
    $MsixPath = (Resolve-Path "src-tauri\sparse_package\FileMint.msix").Path
}
if (-not $CerPath) {
    $CerPath = (Resolve-Path "src-tauri\sparse_package\filemint.cer").Path
}

# 1. Extraction du Thumbprint avec .NET natif (aucun module externe requis)
$thumbprint = $null
if (Test-Path $CerPath) {
    try {
        $certObj = [System.Security.Cryptography.X509Certificates.X509Certificate2]::new($CerPath)
        $thumbprint = $certObj.Thumbprint
    } catch {}
}

# 2. Vérification de la présence dans LocalMachine\TrustedPeople en .NET pur
$isTrusted = $false
if ($thumbprint) {
    try {
        $store = [System.Security.Cryptography.X509Certificates.X509Store]::new("TrustedPeople", [System.Security.Cryptography.X509Certificates.StoreLocation]::LocalMachine)
        $store.Open([System.Security.Cryptography.X509Certificates.OpenFlags]::ReadOnly)
        $found = $store.Certificates.Find([System.Security.Cryptography.X509Certificates.X509FindType]::FindByThumbprint, $thumbprint, $false)
        if ($found.Count -gt 0) {
            $isTrusted = $true
        }
        $store.Close()
    } catch {}
}

# 3. Si non encore approuvé, demande d'élévation UAC
if (-not $isTrusted) {
    $importCmd = "certutil.exe -addstore TrustedPeople `"$CerPath`""
    $proc = Start-Process powershell -Verb RunAs -ArgumentList "-NoProfile -Command `"$importCmd`"" -PassThru -Wait
    if ($proc.ExitCode -ne 0) {
        Write-Error "Élévation UAC refusée ou erreur d'import."
        exit 1
    }
}

# 4. S'assure que filemint_lib.dll est bien présent dans AppDir pour le serveur COM
$sparseDll = Join-Path $PSScriptRoot "filemint_lib.dll"
$targetDll = Join-Path $AppDir "filemint_lib.dll"
if ((-not (Test-Path $targetDll)) -and (Test-Path $sparseDll)) {
    Copy-Item $sparseDll $targetDll -Force -ErrorAction SilentlyContinue
}

# 5. Supprime toute éventuelle version précédente pour garantir un enregistrement propre
Get-AppxPackage -Name "FileMint.ModernContextMenu" -ErrorAction SilentlyContinue | Remove-AppxPackage -ErrorAction SilentlyContinue

# 6. Enregistre le Sparse Package
Add-AppxPackage -Path $MsixPath -ExternalLocation $AppDir -ForceApplicationShutdown -ErrorAction SilentlyContinue

Write-Output "SUCCESS"

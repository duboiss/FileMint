$ErrorActionPreference = "SilentlyContinue"
Get-AppxPackage -Name "FileMint.ModernContextMenu" | Remove-AppxPackage
Write-Output "Désenregistrement du package MSIX effectué."

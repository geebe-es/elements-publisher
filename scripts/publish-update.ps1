# Publica uma atualização do Elements Publisher no GitHub
# Uso (PowerShell, na raiz do projeto):
#   .\scripts\publish-update.ps1 -Notes "Resumo das novidades"
#
# O que faz:
#   1. Lê a versão do src-tauri/tauri.conf.json
#   2. Localiza o instalador NSIS + assinatura (.sig) gerados pelo run-build.bat
#   3. Cria a tag Annotated, o push e a GitHub Release
#   4. Gera e anexa o latest.json que o app consulta Windows
param(
    [Parameter(Mandatory = $false)]
    [string]$Notes = "Nova versão do Elements Publisher."
)

$ErrorActionPreference = "Stop"
$root = Split-Path $PSScriptRoot -Parent

# 1. Versão
$conf = Get-Content "$root\src-tauri\tauri.conf.json" -Raw | ConvertFrom-Json
$version = $conf.version
$product = $conf.productName
$tag = "v$version"
Write-Host "Publicando atualização do $product $tag" -ForegroundColor Cyan

# 2. Instalador e assinatura
$exeName = "$product`_$($version)_x64-setup.exe"
$sigName = "$exeName.sig"
$exePath = "$root\src-tauri\target\release\bundle\nsis\$exeName"
$sigPath = "$root\src-tauri\target\release\bundle\nsis\$sigName"

if (!(Test-Path $exePath)) { throw "Instalador não encontrado: $exePath. Execute .\run-build.bat antes." }
if (!(Test-Path $sigPath)) { throw "Assinatura não encontrada: $sigPath. O build precisa das variáveis TAURI_SIGNING_* (run-build.bat)." }

# Nome do asset no GitHub troca espaços por pontos
$assetName = $exeName -replace ' ', '.'
$repo = "geebe-es/elements-publisher"

# 3. Tag + release
$existing = & "C:\Program Files\GitHub CLI\gh.exe" release list --repo $repo --json tagName -q ".[].tagName" 2>$null
if ($existing -contains $tag) { throw "A release $tag já existe no GitHub." }
git tag -a $tag -m "$product $tag"
git push origin $tag

# 4. latest.json (e o app busca em: releases/latest/download/latest.json)
$signature = Get-Content $sigPath -Raw
$now = (Get-Date).ToUniversalTime().ToString("yyyy-MM-ddTHH:mm:ssZ")
$latest = [ordered]@{
    version   = $version
    notes     = $Notes
    pub_date  = $now
    platforms = [ordered]@{
        "windows-x86_64" = [ordered]@{
            signature = $signature.Trim()
            url       = "https://github.com/$repo/releases/download/$tag/$assetName"
        }
    }
}
# Salva o latest.json sem BOM (necessário para o updater do Tauri não falhar)
$utf8NoBom = New-Object System.Text.UTF8Encoding $false
[System.IO.File]::WriteAllText($latestPath, ($latest | ConvertTo-Json -Depth 5), $utf8NoBom)

# Notas em arquivo (evita travar com aspas do PowerShell)
$notesPath = "$env:TEMP\latest-notes.md"
Set-Content -Path $notesPath -Value $Notes -Encoding UTF8

# 5. Cria a release com instalador + latest.json
$url = & "C:\Program Files\GitHub CLI\gh.exe" release create $tag --repo $repo `
    --title "$product $tag" --notes-file $notesPath $exePath $latestPath

Write-Host ""
Write-Host "✅ Atualização publicada: $url" -ForegroundColor Green
Write-Host "   Endpoints que o app consulta automaticamente:" -ForegroundColor Gray
Write-Host "   https://github.com/$repo/releases/latest/download/latest.json" -ForegroundColor Gray

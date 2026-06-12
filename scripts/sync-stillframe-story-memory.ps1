<#
.SYNOPSIS
    Sync Stillframe story memory markdown files into Foundry IQ (Azure AI Search) long-term memory.

.DESCRIPTION
    Collects story.md memory files written by the manual Stillframe demo flow
    (memories/stillframe-stories/*.md) and uploads them into the existing
    Hyroglyphis Foundry IQ knowledge container.

    Run this from the repo root after saving stories you want continuations to
    retrieve through Foundry IQ:

        ./scripts/sync-stillframe-story-memory.ps1
#>
[CmdletBinding()]
param(
    [string]$ResourceGroupName = 'm2022artist',
    [string]$StorageAccountName = 'hyroglyphisiq2026sa',
    [string]$ContainerName = 'knowledge',
    [string]$BlobFolderPath = 'kb',
    [string]$SearchServiceName = 'hyroglyphisiq2026',
    [string]$MemoryDir = 'memories/stillframe-stories',
    [switch]$IncludeStylePack,
    [switch]$RecreateKnowledgeBase
)

$ErrorActionPreference = 'Stop'

$repoRoot = (Resolve-Path (Join-Path $PSScriptRoot '..')).Path

function Import-DotEnvFile {
    param([string]$Path)

    if (-not (Test-Path $Path)) {
        return
    }

    foreach ($line in Get-Content -Path $Path) {
        $trimmed = $line.Trim()
        if (-not $trimmed -or $trimmed.StartsWith('#')) {
            continue
        }

        $separatorIndex = $trimmed.IndexOf('=')
        if ($separatorIndex -lt 1) {
            continue
        }

        $name = $trimmed.Substring(0, $separatorIndex).Trim()
        $value = $trimmed.Substring($separatorIndex + 1).Trim()

        if (($value.StartsWith('"') -and $value.EndsWith('"')) -or
            ($value.StartsWith("'") -and $value.EndsWith("'"))) {
            $value = $value.Substring(1, $value.Length - 2)
        }

        if ($name -and -not [Environment]::GetEnvironmentVariable($name, 'Process')) {
            [Environment]::SetEnvironmentVariable($name, $value, 'Process')
        }
    }
}

Import-DotEnvFile -Path (Join-Path $repoRoot '.env.local')
Import-DotEnvFile -Path (Join-Path $repoRoot '.env')

$memoryPath = Join-Path $repoRoot $MemoryDir
if (-not (Test-Path $memoryPath)) {
    Write-Warning "No stillframe story memory directory found at $memoryPath. Save a manual demo story first."
    return
}

$memoryFiles = Get-ChildItem -Path $memoryPath -Filter '*.md' -File -ErrorAction SilentlyContinue
if (-not $memoryFiles) {
    Write-Warning "No stillframe story memory files (*.md) found in $memoryPath. Nothing to sync."
    return
}

$knowledgeFiles = $memoryFiles | ForEach-Object { $_.FullName }

if ($IncludeStylePack) {
    $stylePackDocs = @(
        'arv-foundry-iq-style-pack/README.md',
        'audio_titel_liste.md',
        'graffitti_morph_style.md'
    ) | ForEach-Object { Join-Path $repoRoot $_ } | Where-Object { Test-Path $_ }

    $knowledgeFiles += $stylePackDocs
}

Write-Host "Syncing $($knowledgeFiles.Count) stillframe story memory document(s) into Foundry IQ ..." -ForegroundColor Cyan

if ($RecreateKnowledgeBase) {
    $syncScript = Join-Path $repoRoot 'infra/foundry-iq/scripts/sync-search-kb.ps1'
    if (-not (Test-Path $syncScript)) {
        throw "Underlying sync script not found at $syncScript."
    }

    & $syncScript `
        -ResourceGroupName $ResourceGroupName `
        -StorageAccountName $StorageAccountName `
        -ContainerName $ContainerName `
        -BlobFolderPath $BlobFolderPath `
        -SearchServiceName $SearchServiceName `
        -KnowledgeFiles $knowledgeFiles
    return
}

$storageKey = az storage account keys list -g $ResourceGroupName --account-name $StorageAccountName --query "[0].value" -o tsv
if (-not $storageKey) {
    throw "Unable to resolve a storage key for $StorageAccountName. Run 'az login' and check the resource group."
}

$normalizedFolder = $BlobFolderPath.Trim('/')

foreach ($filePath in $knowledgeFiles) {
    $fileName = [System.IO.Path]::GetFileName($filePath)
    $blobName = if ($normalizedFolder) { "$normalizedFolder/$fileName" } else { $fileName }

    az storage blob upload `
        --account-name $StorageAccountName `
        --account-key $storageKey `
        --container-name $ContainerName `
        --file $filePath `
        --name $blobName `
        --overwrite true | Out-Null

    Write-Host "  uploaded $blobName" -ForegroundColor DarkGray
}

Write-Host "Done. $($knowledgeFiles.Count) document(s) uploaded to '$ContainerName/$normalizedFolder'." -ForegroundColor Green
Write-Host "The existing Foundry IQ knowledge base will index them on its next run." -ForegroundColor Green
Write-Host "(Use -RecreateKnowledgeBase to also redefine the knowledge source/base.)" -ForegroundColor DarkGray

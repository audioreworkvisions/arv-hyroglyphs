<#
.SYNOPSIS
    Sync ARV Thumbnail Studio memory cards into Foundry IQ (Azure AI Search) long-term memory.

.DESCRIPTION
    Collects the markdown memory cards written by the ARV Thumbnail Studio
    (memories/thumbnail-studio/*.md) and uploads them into the existing
    Hyroglyphis Foundry IQ knowledge base by delegating to sync-search-kb.ps1.

    Run this from the repo root after generating thumbnails you want the
    Creative Brand Memory to remember:

        ./scripts/sync-thumbnail-memory.ps1

    Requires the Azure CLI (az) to be logged in and AZURE_OPENAI_KEY (or
    AZURE_AI_FOUNDRY_KEY) to be set, exactly like sync-search-kb.ps1.
#>
[CmdletBinding()]
param(
    [string]$ResourceGroupName = 'm2022artist',
    [string]$StorageAccountName = 'hyroglyphisiq2026sa',
    [string]$ContainerName = 'knowledge',
    [string]$BlobFolderPath = 'kb',
    [string]$SearchServiceName = 'hyroglyphisiq2026',
    [string]$MemoryDir = 'memories/thumbnail-studio',
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

# Load local env files so the underlying sync script can resolve Azure keys
# the same way the Node dev server does (via dotenv). Existing session values win.
Import-DotEnvFile -Path (Join-Path $repoRoot '.env.local')
Import-DotEnvFile -Path (Join-Path $repoRoot '.env')
$memoryPath = Join-Path $repoRoot $MemoryDir

if (-not (Test-Path $memoryPath)) {
    Write-Warning "No thumbnail memory directory found at $memoryPath. Generate and save a thumbnail concept first."
    return
}

$memoryFiles = Get-ChildItem -Path $memoryPath -Filter '*.md' -File -ErrorAction SilentlyContinue
if (-not $memoryFiles) {
    Write-Warning "No thumbnail memory cards (*.md) found in $memoryPath. Nothing to sync."
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

Write-Host "Syncing $($knowledgeFiles.Count) thumbnail memory document(s) into Foundry IQ ..." -ForegroundColor Cyan

if ($RecreateKnowledgeBase) {
    # Full path: delegate to the shared KB sync (re-creates knowledge source + base).
    # Note: this can fail on an existing index whose vector fields cannot be redefined.
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

# Default path: just upload the memory cards into the existing knowledge container.
# The existing Foundry IQ knowledge base indexer picks them up automatically, so we
# avoid the destructive knowledge-source/base re-creation that fails on existing
# vector fields (e.g. 'snippet_vector cannot be deleted').
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

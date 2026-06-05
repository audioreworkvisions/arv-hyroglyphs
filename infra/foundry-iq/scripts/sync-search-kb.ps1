[CmdletBinding()]
param(
    [string]$ResourceGroupName = 'm2022artist',
    [string]$StorageAccountName = 'hyroglyphisiq2026sa',
    [string]$ContainerName = 'knowledge',
    [string]$BlobFolderPath = 'kb',
    [string]$SearchServiceName = 'hyroglyphisiq2026',
    [string]$KnowledgeSourceName = 'hyroglyphis-style-blob',
    [string]$KnowledgeBaseName = 'hyroglyphis-iq-kb',
    [string]$QueryKeyName = 'hyroglyphis-iq-agent',
    [string]$AzureOpenAIResourceUri = 'https://m2022-mcbihu3w-eastus2.openai.azure.com',
    [string]$AzureOpenAIDeploymentId = 'gpt-4.1',
    [string]$AzureOpenAIModelName = 'gpt-4.1',
    [string]$AzureOpenAIKey = $env:AZURE_OPENAI_KEY,
    [string]$FoundryAccountName,
    [string]$FoundryProjectName,
    [string]$ConnectionName = 'hyroglyphis-iq-kb-mcp',
    [string]$SearchKnowledgeSourceApiVersion = '2025-08-01-preview',
    [string]$SearchKnowledgeBaseApiVersion = '2026-04-01',
    [string]$ConnectionDeploymentFile = (Join-Path $PSScriptRoot '..\foundry-connection.bicep'),
    [switch]$UploadDefaultRepoDocs,
    [string[]]$KnowledgeFiles,
    [switch]$DeployFoundryConnection
)

$ErrorActionPreference = 'Stop'

$repoRoot = (Resolve-Path (Join-Path $PSScriptRoot '..\..\..')).Path

if (-not $AzureOpenAIKey) {
    $AzureOpenAIKey = $env:AZURE_AI_FOUNDRY_KEY
}

if (-not $AzureOpenAIKey) {
    throw 'AzureOpenAIKey is required. Set AZURE_OPENAI_KEY or pass -AzureOpenAIKey.'
}

if ($UploadDefaultRepoDocs -and -not $KnowledgeFiles) {
    $KnowledgeFiles = @(
        'memories/repo/arv-style.md',
        'memories/repo/story-generation.md',
        'prompt_storys.md',
        'story_prompts.md',
        'stillframe_rituals_sketches.md',
        'audio_titel_liste.md',
        'README.md'
    ) | ForEach-Object {
        Join-Path $repoRoot $_
    }
}

if ($KnowledgeFiles) {
    $storageKey = az storage account keys list -g $ResourceGroupName --account-name $StorageAccountName --query "[0].value" -o tsv
    if (-not $storageKey) {
        throw "Unable to resolve a storage key for $StorageAccountName."
    }

    foreach ($entry in $KnowledgeFiles) {
        $filePath = $entry
        if (-not [System.IO.Path]::IsPathRooted($filePath)) {
            $filePath = Join-Path $repoRoot $filePath
        }

        if (-not (Test-Path $filePath)) {
            throw "Knowledge file not found: $filePath"
        }

        $normalizedFolder = $BlobFolderPath.Trim('/')
        $blobName = if ($normalizedFolder) {
            "$normalizedFolder/$([System.IO.Path]::GetFileName($filePath))"
        }
        else {
            [System.IO.Path]::GetFileName($filePath)
        }

        az storage blob upload --account-name $StorageAccountName --account-key $storageKey --container-name $ContainerName --file $filePath --name $blobName --overwrite true | Out-Null
    }
}

$searchAdminKey = az search admin-key show -g $ResourceGroupName --service-name $SearchServiceName --query primaryKey -o tsv
if (-not $searchAdminKey) {
    throw "Unable to resolve an admin key for search service $SearchServiceName."
}

$queryKey = az search query-key list -g $ResourceGroupName --service-name $SearchServiceName --query "[?name=='$QueryKeyName'].key | [0]" -o tsv
if (-not $queryKey) {
    $queryKey = az search query-key create -g $ResourceGroupName --service-name $SearchServiceName --name $QueryKeyName --query key -o tsv
}

if (-not $queryKey) {
    throw "Unable to resolve or create the query key named $QueryKeyName."
}

$storageConnectionString = az storage account show-connection-string -g $ResourceGroupName -n $StorageAccountName --query connectionString -o tsv
if (-not $storageConnectionString) {
    throw "Unable to resolve a storage connection string for $StorageAccountName."
}

$headers = @{
    'api-key' = $searchAdminKey
    'Content-Type' = 'application/json'
    'Prefer' = 'return=representation'
}

$normalizedFolder = $BlobFolderPath.Trim('/')
$azureBlobParameters = @{
    connectionString = $storageConnectionString
    containerName = $ContainerName
}

if ($normalizedFolder) {
    $azureBlobParameters.folderPath = $normalizedFolder
}

$knowledgeSourceBody = @{
    name = $KnowledgeSourceName
    description = 'Hyroglyphis ARV style lore story and ritual documents from Azure Blob Storage'
    kind = 'azureBlob'
    azureBlobParameters = $azureBlobParameters
} | ConvertTo-Json -Depth 20

$knowledgeSourceUri = "https://$SearchServiceName.search.windows.net/knowledgesources('$KnowledgeSourceName')?api-version=$SearchKnowledgeSourceApiVersion"
Invoke-RestMethod -Method Put -Uri $knowledgeSourceUri -Headers $headers -Body $knowledgeSourceBody | Out-Null

$knowledgeBaseBody = @{
    name = $KnowledgeBaseName
    description = 'Hyroglyphis ARV style story and ritual knowledge base'
    knowledgeSources = @(
        @{
            name = $KnowledgeSourceName
        }
    )
    models = @(
        @{
            kind = 'azureOpenAI'
            azureOpenAIParameters = @{
                resourceUri = $AzureOpenAIResourceUri
                deploymentId = $AzureOpenAIDeploymentId
                apiKey = $AzureOpenAIKey
                modelName = $AzureOpenAIModelName
            }
        }
    )
} | ConvertTo-Json -Depth 20

$knowledgeBaseUri = "https://$SearchServiceName.search.windows.net/knowledgebases('$KnowledgeBaseName')?api-version=$SearchKnowledgeBaseApiVersion"
Invoke-RestMethod -Method Put -Uri $knowledgeBaseUri -Headers $headers -Body $knowledgeBaseBody | Out-Null

if ($DeployFoundryConnection) {
    if (-not $FoundryAccountName -or -not $FoundryProjectName) {
        throw 'FoundryAccountName and FoundryProjectName are required when -DeployFoundryConnection is set.'
    }

    $connectionTemplatePath = (Resolve-Path $ConnectionDeploymentFile).Path
    $searchEndpoint = "https://$SearchServiceName.search.windows.net"

    az deployment group create -g $ResourceGroupName --template-file $connectionTemplatePath --parameters aiServicesAccountName=$FoundryAccountName projectName=$FoundryProjectName connectionName=$ConnectionName searchEndpoint=$searchEndpoint knowledgeBaseName=$KnowledgeBaseName knowledgeBaseApiKey=$queryKey -o json | Out-Null
}

[pscustomobject]@{
    searchEndpoint = "https://$SearchServiceName.search.windows.net"
    knowledgeSourceName = $KnowledgeSourceName
    knowledgeBaseName = $KnowledgeBaseName
    queryKeyName = $QueryKeyName
    foundryConnectionDeployed = [bool]$DeployFoundryConnection
} | ConvertTo-Json -Depth 10
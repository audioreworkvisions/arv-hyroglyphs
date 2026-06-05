targetScope = 'resourceGroup'

@description('Azure region for the storage account that holds the Hyroglyphis knowledge documents.')
param storageLocation string = resourceGroup().location

@description('Azure region for Azure AI Search. East US was required for capacity for the current live stack.')
param searchLocation string = 'eastus'

@description('Globally unique name for the storage account.')
param storageAccountName string

@description('Blob container name used for knowledge documents.')
param containerName string = 'knowledge'

@description('Globally unique name for the Azure AI Search service.')
param searchServiceName string

@allowed([
  'basic'
  'standard'
  'standard2'
  'standard3'
  'storage_optimized_l1'
  'storage_optimized_l2'
])
@description('Search SKU name.')
param searchSkuName string = 'basic'

@description('Optional tag overrides.')
param tags object = {}

var defaultTags = {
  app: 'hyroglyphis'
  environment: 'prod'
  purpose: 'foundry-iq'
}

resource storageAccount 'Microsoft.Storage/storageAccounts@2023-05-01' = {
  name: storageAccountName
  location: storageLocation
  tags: union(defaultTags, tags)
  kind: 'StorageV2'
  sku: {
    name: 'Standard_LRS'
  }
  properties: {
    accessTier: 'Hot'
    allowBlobPublicAccess: false
    allowCrossTenantReplication: false
    minimumTlsVersion: 'TLS1_2'
    supportsHttpsTrafficOnly: true
  }
}

resource blobService 'Microsoft.Storage/storageAccounts/blobServices@2023-05-01' = {
  parent: storageAccount
  name: 'default'
}

resource knowledgeContainer 'Microsoft.Storage/storageAccounts/blobServices/containers@2023-05-01' = {
  parent: blobService
  name: containerName
  properties: {
    publicAccess: 'None'
  }
}

resource searchService 'Microsoft.Search/searchServices@2025-05-01' = {
  name: searchServiceName
  location: searchLocation
  tags: union(defaultTags, tags)
  sku: {
    name: searchSkuName
  }
  identity: {
    type: 'SystemAssigned'
  }
  properties: {
    authOptions: {
      aadOrApiKey: {
        aadAuthFailureMode: 'http401WithBearerChallenge'
      }
    }
    disableLocalAuth: false
    hostingMode: 'Default'
    networkRuleSet: {
      bypass: 'None'
      ipRules: []
    }
    partitionCount: 1
    publicNetworkAccess: 'Enabled'
    replicaCount: 1
    semanticSearch: 'free'
  }
}

output storageAccountId string = storageAccount.id
output storageAccountName string = storageAccount.name
output storageBlobEndpoint string = storageAccount.properties.primaryEndpoints.blob
output knowledgeContainerName string = knowledgeContainer.name
output searchServiceId string = searchService.id
output searchEndpoint string = searchService.properties.endpoint
output searchPrincipalId string = searchService.identity.principalId

targetScope = 'resourceGroup'

@description('Azure AI Services / Foundry account name that hosts the target project.')
param aiServicesAccountName string

@description('Azure AI Foundry project name inside the AI Services account.')
param projectName string

@description('Project connection name to create or update.')
param connectionName string = 'hyroglyphis-iq-kb-mcp'

@description('Azure AI Search endpoint, for example https://mysearch.search.windows.net')
param searchEndpoint string

@description('Knowledge base name exposed through the Search MCP endpoint.')
param knowledgeBaseName string

@secure()
@description('Query key or other KB-compatible API key used by the Foundry MCP connection.')
param knowledgeBaseApiKey string

resource project 'Microsoft.CognitiveServices/accounts/projects@2026-03-15-preview' existing = {
  name: '${aiServicesAccountName}/${projectName}'
}

resource connection 'Microsoft.CognitiveServices/accounts/projects/connections@2026-03-15-preview' = {
  parent: project
  name: connectionName
  properties: {
    authType: 'CustomKeys'
    category: 'RemoteTool'
    credentials: {
      keys: {
        'api-key': knowledgeBaseApiKey
      }
    }
    group: 'GenericProtocol'
    isDefault: true
    isSharedToAll: false
    metadata: {
      knowledgeBaseName: knowledgeBaseName
      type: 'knowledgeBase_MCP'
    }
    target: '${searchEndpoint}/knowledgebases/${knowledgeBaseName}/mcp?api-version=2026-05-01-preview'
    useWorkspaceManagedIdentity: false
  }
}

output connectionId string = connection.id

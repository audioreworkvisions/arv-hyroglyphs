# Foundry IQ Export

This folder captures the current Hyroglyphis Foundry IQ setup as a reusable repo-local export.

What is covered declaratively:

- Azure Storage account and blob container for knowledge documents
- Azure AI Search service
- Azure AI Foundry project connection that points to the Search MCP endpoint

What is still data-plane driven in the current platform surface:

- Search knowledge source creation
- Search knowledge base creation
- Prompt agent creation and versioning

That split is intentional. The Search knowledge resources are not exposed as normal ARM child resources in the registered Microsoft.Search provider, and the prompt agent is not currently materialized as a normal ARM resource in this project surface.

## 1. Deploy base infrastructure

Run the base Bicep template:

```powershell
az deployment group create \
  -g m2022artist \
  --template-file infra/foundry-iq/main.bicep \
  --parameters @infra/foundry-iq/main.parameters.example.json
```

The live export keeps storage in East US 2 and Search in East US because East US 2 was capacity-constrained for new Search services when this stack was built.

## 2. Upload docs, create KB resources, and optionally deploy the Foundry connection

The PowerShell helper can upload the repo documents used for the current knowledge base, create or update the Search knowledge source, create or update the Search knowledge base, and then deploy the Foundry connection once the Search query key exists.

It expects an Azure OpenAI key either from `AZURE_OPENAI_KEY` or from an explicit `-AzureOpenAIKey` argument.

```powershell
pwsh -File infra/foundry-iq/scripts/sync-search-kb.ps1 \
  -ResourceGroupName m2022artist \
  -StorageAccountName hyroglyphisiq2026sa \
  -SearchServiceName hyroglyphisiq2026 \
  -UploadDefaultRepoDocs \
  -DeployFoundryConnection \
  -FoundryAccountName m2022-mcbihu3w-eastus2 \
  -FoundryProjectName m2022-mcbihu3w-eastus2_project
```

If you only want to sync custom files, omit `-UploadDefaultRepoDocs` and pass `-KnowledgeFiles` with repo-relative or absolute paths.

## 3. Create or roll the prompt agent

Activate the repo virtual environment first and then run the agent helper:

```powershell
.venv\Scripts\Activate.ps1
python infra/foundry-iq/scripts/create-agent.py \
  --project-endpoint https://m2022-mcbihu3w-eastus2.services.ai.azure.com/api/projects/m2022-mcbihu3w-eastus2_project \
  --search-endpoint https://hyroglyphisiq2026.search.windows.net \
  --knowledge-base-name hyroglyphis-iq-kb \
  --connection-name hyroglyphis-iq-kb-mcp
```

## Files

- `main.bicep`: Storage, container, and Search service
- `foundry-connection.bicep`: Foundry project connection for the KB MCP endpoint
- `scripts/sync-search-kb.ps1`: Search knowledge source and knowledge base sync, optional doc upload, optional connection deployment
- `scripts/create-agent.py`: Prompt-agent creation or version rollout through the Projects SDK

## Current exported names

- Storage account: `hyroglyphisiq2026sa`
- Blob container: `knowledge`
- Search service: `hyroglyphisiq2026`
- Knowledge source: `hyroglyphis-style-blob`
- Knowledge base: `hyroglyphis-iq-kb`
- Foundry connection: `hyroglyphis-iq-kb-mcp`
- Agent: `hyroglyphis-iq-agent`

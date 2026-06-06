# Run this from anywhere inside the workspace.
# It creates or rolls the Hyroglyphis Foundry IQ prompt agent using the curated ARV style-pack instructions.

$RepoRoot = Split-Path -Parent $PSScriptRoot
$EnvFilePath = Join-Path $RepoRoot ".env.local"
$ActivateScriptPath = Join-Path $RepoRoot ".venv\Scripts\Activate.ps1"
$CreateAgentScriptPath = Join-Path $RepoRoot "infra\foundry-iq\scripts\create-agent.py"
$InstructionsFilePath = Join-Path $PSScriptRoot "infra\foundry-iq\knowledge\arv-style-pack\12_agent_instructions.md"

if (Test-Path $EnvFilePath) {
  foreach ($line in Get-Content $EnvFilePath) {
    if ([string]::IsNullOrWhiteSpace($line) -or $line.TrimStart().StartsWith("#")) {
      continue
    }

    $name, $value = $line -split '=', 2
    if (-not $name -or -not $value) {
      continue
    }

    if (
      ($name -eq "AZURE_AI_FOUNDRY_ENDPOINT" -or $name -eq "AZURE_FOUNDRY_IQ_AGENT_NAME") -and
      -not (Get-Item "Env:$name" -ErrorAction SilentlyContinue)
    ) {
      Set-Item -Path "Env:$name" -Value ($value.Trim().Trim('"'))
    }
  }
}

if (-not (Test-Path $ActivateScriptPath)) {
  throw "Virtual environment activation script not found: $ActivateScriptPath"
}

if (-not (Test-Path $CreateAgentScriptPath)) {
  throw "Foundry create-agent script not found: $CreateAgentScriptPath"
}

if (-not (Test-Path $InstructionsFilePath)) {
  throw "Style-pack instructions file not found: $InstructionsFilePath"
}

$projectEndpoint = $env:AZURE_AI_FOUNDRY_ENDPOINT
if (-not $projectEndpoint) {
  throw "AZURE_AI_FOUNDRY_ENDPOINT is required. Set it in .env.local or in the current shell."
}

$agentName = if ($env:AZURE_FOUNDRY_IQ_AGENT_NAME) {
  $env:AZURE_FOUNDRY_IQ_AGENT_NAME
} else {
  "hyroglyphis-iq-agent"
}

. $ActivateScriptPath

python $CreateAgentScriptPath `
  --project-endpoint $projectEndpoint `
  --agent-name $agentName `
  --connection-name "hyroglyphis-iq-kb-mcp" `
  --search-endpoint "https://hyroglyphisiq2026.search.windows.net" `
  --knowledge-base-name "hyroglyphis-iq-kb" `
  --model "gpt-4.1" `
  --server-label "hyroglyphis_iq" `
  --instructions-file $InstructionsFilePath `
  --description "Hyroglyphis IQ agent grounded by the curated ARV style pack." `
  --metadata-source "arv-foundry-iq-style-pack"
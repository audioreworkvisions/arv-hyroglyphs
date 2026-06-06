# Run this from anywhere inside the workspace.
# It uploads only the curated ARV style pack files to the Foundry IQ Search KB.
# Activate your repo venv only for create-agent.py; this sync script uses pwsh + az CLI.

$RepoRoot = Split-Path -Parent $PSScriptRoot
$KnowledgeRoot = Join-Path $PSScriptRoot "infra\foundry-iq\knowledge\arv-style-pack"
$SyncScriptPath = Join-Path $RepoRoot "infra\foundry-iq\scripts\sync-search-kb.ps1"
$EnvFilePath = Join-Path $RepoRoot ".env.local"

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
      ($name -eq "AZURE_OPENAI_KEY" -or $name -eq "AZURE_AI_FOUNDRY_KEY") -and
      -not (Get-Item "Env:$name" -ErrorAction SilentlyContinue)
    ) {
      Set-Item -Path "Env:$name" -Value ($value.Trim().Trim('"'))
    }
  }
}

$KnowledgeFiles = @(
  "01_arv_style_identity.md",
  "02_palette_material_texture.md",
  "03_motion_loop_grammar.md",
  "04_xerox_ritual_boogie.md",
  "05_sci_fi_graffiti_fusion.md",
  "06_story_dramaturgy.md",
  "07_remix_extend_rules.md",
  "08_negative_rules.md",
  "09_prompt_dna_fragments.md",
  "10_scene_examples.md",
  "11_iq_runtime_examples.md",
  "12_agent_instructions.md"
) | ForEach-Object {
  Join-Path $KnowledgeRoot $_
}

& $SyncScriptPath `
  -ResourceGroupName m2022artist `
  -StorageAccountName hyroglyphisiq2026sa `
  -SearchServiceName hyroglyphisiq2026 `
  -KnowledgeSourceName "hyroglyphis-style-blob-arv-style-pack" `
  -BlobFolderPath "kb/arv-style-pack" `
  -KnowledgeFiles $KnowledgeFiles `
  -DeployFoundryConnection `
  -FoundryAccountName m2022-mcbihu3w-eastus2 `
  -FoundryProjectName m2022-mcbihu3w-eastus2_project

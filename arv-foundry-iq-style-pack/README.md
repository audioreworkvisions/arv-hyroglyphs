# ARV Foundry IQ Style Pack

Kuratierte Knowledge-Dateien für den Audioreworkvisions / HeroGlyphs ARV Style.

## Ziel

Diese Dateien sind für Azure AI Foundry IQ / Azure AI Search Grounding gedacht. Sie beschreiben nicht nur einzelne Prompts, sondern stabile Regeln:

- Style Identity
- Palette / Material / Texture
- Motion Loop Grammar
- Xerox Ritual Boogie
- Sci-Fi x Graffiti Fusion
- Story Dramaturgy
- Remix / Extend Rules
- Negative Rules
- Prompt DNA
- Scene Examples
- Runtime IQ Examples
- Agent Instructions

## Installation im Repo

Den Inhalt dieses ZIPs in den Root des Hyroglyphis-Repos kopieren.

Danach:

```powershell
Unblock-File .\sync-arv-style-pack.ps1
pwsh -File .\sync-arv-style-pack.ps1
```

Wenn die Datei nicht aus dem Internet-Marker heraus entblockt wurde, blockiert Windows PowerShell den Start unter `RemoteSigned` mit einem Signaturfehler.

Danach den Agenten mit den kuratierten Style-Pack-Instruktionen neu anlegen oder als neue Version rollen:

```powershell
Unblock-File .\create-arv-style-agent.ps1
pwsh -File .\create-arv-style-agent.ps1
```

Der Wrapper liest `AZURE_AI_FOUNDRY_ENDPOINT` und optional `AZURE_FOUNDRY_IQ_AGENT_NAME` aus der `.env.local`, aktiviert die Repo-`.venv` und ruft den bestehenden Python-Helper mit der Style-Pack-Instruktionsdatei auf.

Oder manuell:

```powershell
pwsh -File infra/foundry-iq/scripts/sync-search-kb.ps1 `
  -ResourceGroupName m2022artist `
  -StorageAccountName hyroglyphisiq2026sa `
  -SearchServiceName hyroglyphisiq2026 `
  -KnowledgeSourceName "hyroglyphis-style-blob-arv-style-pack" `
  -BlobFolderPath "kb/arv-style-pack" `
  -KnowledgeFiles @(
    "infra/foundry-iq/knowledge/arv-style-pack/01_arv_style_identity.md",
    "infra/foundry-iq/knowledge/arv-style-pack/02_palette_material_texture.md",
    "infra/foundry-iq/knowledge/arv-style-pack/03_motion_loop_grammar.md",
    "infra/foundry-iq/knowledge/arv-style-pack/04_xerox_ritual_boogie.md",
    "infra/foundry-iq/knowledge/arv-style-pack/05_sci_fi_graffiti_fusion.md",
    "infra/foundry-iq/knowledge/arv-style-pack/06_story_dramaturgy.md",
    "infra/foundry-iq/knowledge/arv-style-pack/07_remix_extend_rules.md",
    "infra/foundry-iq/knowledge/arv-style-pack/08_negative_rules.md",
    "infra/foundry-iq/knowledge/arv-style-pack/09_prompt_dna_fragments.md",
    "infra/foundry-iq/knowledge/arv-style-pack/10_scene_examples.md",
    "infra/foundry-iq/knowledge/arv-style-pack/11_iq_runtime_examples.md",
    "infra/foundry-iq/knowledge/arv-style-pack/12_agent_instructions.md"
  )
```

## Empfehlung

Die vorhandenen Default-Repo-Dokumente können weiter genutzt werden. Dieses Pack ist aber enger kuratiert und sollte für ARV-Style-Grounding höherwertige Retrieval-Treffer liefern.

Der Wrapper verwendet absichtlich einen separaten Knowledge-Source-Namen für das Style-Pack, damit ein bestehender Search-Knowledge-Source-Eintrag mit anderem `folderPath` nicht geändert werden muss.

Der Agent-Wrapper verwendet weiterhin den bestehenden Knowledge-Base- und Connection-Namen `hyroglyphis-iq-kb` beziehungsweise `hyroglyphis-iq-kb-mcp`, damit die Runtime in [server/utils/iq.ts](../server/utils/iq.ts) ohne weitere Änderungen denselben Agenten weiterverwenden kann.

import React, { useEffect, useRef, useState } from 'react';
import { Loader2, Download, Wand2, Play, CheckCircle2, AlertCircle, Film, RefreshCw, Cpu, ChevronsDown } from 'lucide-react';
import { CURATED_PRESET_IDS, CURATED_PRESETS, PRESETS } from '../lib/presets';
import {
  CURATED_STORY_IDENT_TEMPLATE_IDS,
  CURATED_STORY_WORLD_TEMPLATE_IDS,
  filterPromptTemplates,
  getPromptTemplateById,
  getPromptTemplates,
} from '../lib/promptTemplates';
import { buildFinalStoryPrompt, getStorySceneBeatByIndex, getStorySceneBeatLabel } from '../lib/storyboardTuning';
import { StoryArcMode, StorySequence, StoryScene } from '../lib/types';
import { ARVNarrativePhase, ARVStorySequence } from '../lib/arvTypes';
import { AzureUsageEntry } from '../hooks/useAzureUsage';
import { extractPromptCore } from '../lib/styleTaste';

const STORY_IDEA_PLACEHOLDER =
  'A quiet signal bloom opens above a forgotten chamber while one figure keeps moving toward the center.';

const CURATED_PRESET_ID_SET = new Set<string>(CURATED_PRESET_IDS);
const NON_CURATED_PRESETS = PRESETS.filter((preset) => !CURATED_PRESET_ID_SET.has(preset.id));
const CURATED_STORY_IDENT_TEMPLATE_ID_SET = new Set<string>(CURATED_STORY_IDENT_TEMPLATE_IDS);
const CURATED_STORY_WORLD_TEMPLATE_ID_SET = new Set<string>(CURATED_STORY_WORLD_TEMPLATE_IDS);

const STORY_ARC_OPTIONS: Array<{
  id: StoryArcMode;
  label: string;
  description: string;
}> = [
  {
    id: 'iconic',
    label: 'Iconic Loop Arc',
    description: 'Posterhafte Hero-Momente mit dominantem Motiv, klarem Impact-Beat und harter Loop-Closure.',
  },
  {
    id: 'cinematic',
    label: 'Cinematic Arc',
    description: 'Staerker verbundene Sequenz mit mehr Raum fuer Atmosphaere, Uebergaenge und filmische Kontinuitaet.',
  },
];

import { LibraryItem } from '../lib/libraryDB';

interface StoryModeProps {
  model: 'openai' | 'foundry';
  setModel: (model: 'openai' | 'foundry') => void;
  saveToLibrary: (item: LibraryItem) => Promise<void>;
  onStorySaved: () => void;
  preloadedStoryboard?: ARVStorySequence | null;
  onAzureUsage?: (entry: Omit<AzureUsageEntry, 'id' | 'timestamp'>) => void;
  embedded?: boolean;
}

type SaveFilePickerWindow = Window & typeof globalThis & {
  showSaveFilePicker?: (options?: {
    suggestedName?: string;
    types?: Array<{
      description?: string;
      accept: Record<string, string[]>;
    }>;
  }) => Promise<{
    createWritable: () => Promise<{
      write: (data: Blob) => Promise<void>;
      close: () => Promise<void>;
    }>;
  }>;
};

const ARV_PHASE_LABELS: Record<ARVNarrativePhase, string> = {
  emergence: 'Emergence',
  tension: 'Tension',
  expansion: 'Expansion',
  collapse: 'Collapse',
};

const ARV_PHASE_BADGE_STYLES: Record<ARVNarrativePhase, string> = {
  emergence: 'border-indigo-200 bg-indigo-50 text-indigo-700 dark:border-indigo-900/50 dark:bg-indigo-950/30 dark:text-indigo-300',
  tension: 'border-amber-200 bg-amber-50 text-amber-700 dark:border-amber-900/50 dark:bg-amber-950/30 dark:text-amber-300',
  expansion: 'border-violet-200 bg-violet-50 text-violet-700 dark:border-violet-900/50 dark:bg-violet-950/30 dark:text-violet-300',
  collapse: 'border-rose-200 bg-rose-50 text-rose-700 dark:border-rose-900/50 dark:bg-rose-950/30 dark:text-rose-300',
};

type StoryModeApiPayload = {
  error?: string;
};

type StoryboardPromptDebug = {
  rawPrompt: string;
  normalizedPrompt: string;
  promptTemplateId?: string | null;
  matchedTemplateId?: string;
  normalizationNotes?: string[];
};

type StoryboardRequestDebug = {
  storyboardPrompt?: StoryboardPromptDebug;
  systemInstruction?: string;
  modelInput?: string;
};

type VideoTransformMode = 'remix' | 'extend';
type VideoRenderMode = 'create' | VideoTransformMode;

type VideoPromptDebug = {
  rawPrompt: string;
  cleanedPrompt: string;
  finalPrompt: string;
  presetId?: string | null;
  renderMode?: VideoRenderMode;
  sourceVideoId?: string | null;
  resultVideoId?: string | null;
  iqBrief?: {
    provider: 'foundry-iq-agent' | 'local-knowledge';
    query: string;
    promptBlock: string;
    citations: Array<{ source: string; excerpt: string }>;
    usedRemote: boolean;
  } | null;
};

type SceneRenderResult = {
  gifData: string;
  videoId: string | null;
  remixedFromVideoId: string | null;
  videoTransformMode: VideoTransformMode | null;
  debug: VideoPromptDebug | null;
};

type SceneRenderError = Error & {
  partialScene?: {
    videoId?: string | null;
    remixedFromVideoId?: string | null;
    videoTransformMode?: VideoTransformMode | null;
  };
  debug?: VideoPromptDebug | null;
};

const parseApiJsonResponse = async <T extends StoryModeApiPayload>(response: Response) => {
  const rawText = (await response.text()).trim();

  if (!rawText) {
    return { data: null as T | null, rawText };
  }

  try {
    return { data: JSON.parse(rawText) as T, rawText };
  } catch {
    return { data: null as T | null, rawText };
  }
};

const buildApiErrorMessage = (
  response: Response,
  data: StoryModeApiPayload | null,
  rawText: string,
  fallbackMessage: string,
) => {
  if (typeof data?.error === 'string' && data.error.trim()) {
    return data.error;
  }

  if (rawText) {
    if (rawText.startsWith('<')) {
      return `${fallbackMessage} Der Server lieferte HTML statt JSON (${response.status}).`;
    }

    return `${fallbackMessage} ${rawText.slice(0, 240)}`;
  }

  return `${fallbackMessage} Leere Serverantwort (${response.status}${response.statusText ? ` ${response.statusText}` : ''}).`;
};

const buildARVBackedStory = (
  storyboard: ARVStorySequence,
  options: {
    presetId: string;
    colorPalette: string;
    motionGrammar: string;
  },
): StorySequence => ({
  title: storyboard.title,
  storyArcMode: 'iconic',
  presetName: 'ARV Engine Storyboard',
  mainMotif: storyboard.title,
  visualDNA: 'ARV satire theatre, modular character engine, retro-surreal loop logic, controlled machine irony.',
  colorPalette: options.colorPalette,
  motionGrammar: options.motionGrammar,
  hookTitle: storyboard.title,
  negativePrompt: 'avoid obvious text overlays, logo artifacts, watermark artifacts, and harsh flashing',
  settingDescription: storyboard.concept,
  characterDefinition: storyboard.characterId
    ? `ARV Character Layer: ${storyboard.characterId}`
    : 'ARV Ensemble',
  tone: 'ARV Satire · Retro-Surreal Loop Theatre · Dry Machine Irony',
  presetId: options.presetId,
  arv: {
    source: 'arv',
    sequenceId: storyboard.id,
    sequenceTitle: storyboard.title,
    concept: storyboard.concept,
    characterId: storyboard.characterId,
    createdAt: storyboard.createdAt,
  },
  scenes: storyboard.scenes.map((scene, index) => ({
    id: `arv-${scene.phase}-${scene.sceneNumber}-${storyboard.id}-${index}`,
    sceneBeat: getStorySceneBeatByIndex(index),
    action: `[${scene.phase.toUpperCase()} ${scene.sceneNumber}] ${scene.title} — ${scene.narration}`,
    motionDescription: `ARV Phase: ${scene.phase}`,
    continuityNotes: scene.narration,
    gifSpecification: scene.prompt,
    finalPrompt: buildFinalStoryPrompt(scene.prompt, { arcMode: 'iconic' }),
    status: 'pending',
    videoId: null,
    remixedFromVideoId: null,
    arv: {
      source: 'arv',
      sequenceId: storyboard.id,
      sequenceTitle: storyboard.title,
      sequenceConcept: storyboard.concept,
      sceneNumber: scene.sceneNumber,
      phase: scene.phase,
      sceneTitle: scene.title,
      narration: scene.narration,
      characterId: storyboard.characterId,
      createdAt: storyboard.createdAt,
    },
  })),
});

export default function StoryMode({ model, setModel, saveToLibrary, onStorySaved, preloadedStoryboard, onAzureUsage, embedded = false }: StoryModeProps) {
  const [prompt, setPrompt] = useState('');
  const [selectedPreset, setSelectedPreset] = useState<string | null>(null);
  const [isPresetEnabled, setIsPresetEnabled] = useState(false);
  const [promptTemplateSearch, setPromptTemplateSearch] = useState('');
  const [selectedPromptTemplateId, setSelectedPromptTemplateId] = useState('');
  const [storyboardEngine, setStoryboardEngine] = useState<'foundry' | 'openai'>('foundry');
  const [storyArcMode, setStoryArcMode] = useState<StoryArcMode>('iconic');
  const [openAIVideoRatio, setOpenAIVideoRatio] = useState<'16:9' | '1:1'>('16:9');
  const [openAIGifSize, setOpenAIGifSize] = useState<480 | 720 | 1080>(720);
  const [isGeneratingStory, setIsGeneratingStory] = useState(false);
  const [story, setStory] = useState<StorySequence | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [downloadMessage, setDownloadMessage] = useState<string | null>(null);
  const [isARVPreload, setIsARVPreload] = useState(false);
  const [storyRequestDebug, setStoryRequestDebug] = useState<StoryboardRequestDebug | null>(null);
  const [sceneVideoPromptDebugs, setSceneVideoPromptDebugs] = useState<Record<string, VideoPromptDebug>>({});

  // Per-Szene Bearbeitungs-State
  const [scenePromptDrafts, setScenePromptDrafts] = useState<Record<string, string>>({});
  const [generatingSceneIds, setGeneratingSceneIds] = useState<Set<string>>(new Set());
  const [rewritingSceneIds, setRewritingSceneIds] = useState<Set<string>>(new Set());
  const [editingSceneIds, setEditingSceneIds] = useState<Set<string>>(new Set());
  const [isDownloadingZip, setIsDownloadingZip] = useState(false);
  const storyLibrarySnapshotRef = useRef<{ id: string; createdAt: number } | null>(null);

  const isAnyGenerating = generatingSceneIds.size > 0;
  const storyPromptTemplates = filterPromptTemplates(getPromptTemplates('story'), promptTemplateSearch);
  const curatedStoryIdentTemplates = storyPromptTemplates.filter((template) => CURATED_STORY_IDENT_TEMPLATE_ID_SET.has(template.id));
  const curatedStoryWorldTemplates = storyPromptTemplates.filter((template) => CURATED_STORY_WORLD_TEMPLATE_ID_SET.has(template.id));
  const remainingStoryTemplates = storyPromptTemplates.filter(
    (template) => !CURATED_STORY_IDENT_TEMPLATE_ID_SET.has(template.id) && !CURATED_STORY_WORLD_TEMPLATE_ID_SET.has(template.id),
  );
  const activePreset = isPresetEnabled && selectedPreset
    ? (PRESETS.find((preset) => preset.id === selectedPreset) ?? null)
    : null;

  const applySelectedPromptTemplate = () => {
    const template = getPromptTemplateById(selectedPromptTemplateId);
    if (!template) return;

    setPrompt(template.prompt);
    setPromptTemplateSearch('');

    if (template.suggestedPresetId) {
      setSelectedPreset(template.suggestedPresetId);
      setIsPresetEnabled(true);
    }
  };

  const resetStoryLibrarySnapshot = () => {
    storyLibrarySnapshotRef.current = null;
  };

  const getStoryLibrarySnapshot = () => {
    if (!storyLibrarySnapshotRef.current) {
      storyLibrarySnapshotRef.current = {
        id: `story-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`,
        createdAt: Date.now(),
      };
    }

    return storyLibrarySnapshotRef.current;
  };

  const applyStoryToEditor = (nextStory: StorySequence) => {
    setStory(nextStory);
    const drafts: Record<string, string> = {};
    nextStory.scenes.forEach((scene) => {
      drafts[scene.id] = scene.finalPrompt;
    });
    setScenePromptDrafts(drafts);
    setEditingSceneIds(new Set(nextStory.scenes.map((scene) => scene.id)));
    setGeneratingSceneIds(new Set());
    setRewritingSceneIds(new Set());
    setSceneVideoPromptDebugs({});
  };

  const recordStoryboardUsage = (
    usage: { promptTokens?: number; completionTokens?: number; totalTokens?: number } | null | undefined,
    usageModel?: string,
  ) => {
    if (!usage || !onAzureUsage) {
      return;
    }

    onAzureUsage({
      type: 'storyboard',
      model: usageModel || 'azure-story-model',
      promptTokens: usage.promptTokens,
      completionTokens: usage.completionTokens,
      totalTokens: usage.totalTokens,
    });
  };

  const buildStoryRegenerationContext = (currentStory: StorySequence) => ({
    title: currentStory.title,
    settingDescription: currentStory.settingDescription,
    characterDefinition: currentStory.characterDefinition,
    tone: currentStory.tone,
    storyArcMode: currentStory.storyArcMode,
    presetId: currentStory.presetId,
    presetName: currentStory.presetName,
    mainMotif: currentStory.mainMotif,
    visualDNA: currentStory.visualDNA,
    colorPalette: currentStory.colorPalette,
    motionGrammar: currentStory.motionGrammar,
    hookTitle: currentStory.hookTitle,
    negativePrompt: currentStory.negativePrompt,
    arv: currentStory.arv,
    scenes: currentStory.scenes.map((scene) => ({
      id: scene.id,
      sceneBeat: scene.sceneBeat,
      action: scene.action,
      motionDescription: scene.motionDescription,
      continuityNotes: scene.continuityNotes,
      gifSpecification: scene.gifSpecification,
      videoId: scene.videoId,
      remixedFromVideoId: scene.remixedFromVideoId,
      arv: scene.arv,
    })),
  });

  const resolveVideoTransformMode = (
    sourceVideoId?: string | null,
    requestedMode?: VideoTransformMode | null,
  ): VideoTransformMode | null => {
    if (!sourceVideoId?.trim()) {
      return null;
    }

    return requestedMode === 'extend' ? 'extend' : 'remix';
  };

  const buildSceneIQContext = (scene: StoryScene, index: number, remixVideoId?: string | null, videoTransform?: VideoTransformMode | null) => ({
    mode: 'story' as const,
    renderTarget: 'video' as const,
    purpose: videoTransform ?? (remixVideoId ? 'remix' as const : 'create' as const),
    prompt: extractPromptCore(scene.finalPrompt) || scene.gifSpecification,
    sceneIndex: index,
    sceneTitle: `Szene ${index + 1}`,
    sceneBeat: scene.sceneBeat,
    action: scene.action,
    motion: scene.motionDescription,
    continuityNotes: scene.continuityNotes,
    storyTitle: story?.title,
    storyConcept: prompt || story?.mainMotif || story?.settingDescription,
    settingDescription: story?.settingDescription,
    characterDefinition: story?.characterDefinition,
    tone: story?.tone,
    presetId: activePreset?.id ?? story?.presetId ?? null,
    presetName: activePreset?.name ?? story?.presetName ?? null,
    stylePresetIds: activePreset?.id
      ? [activePreset.id]
      : (story?.presetId ? [story.presetId] : []),
    remixVideoId: remixVideoId ?? null,
    chronology: story?.scenes.slice(0, index + 1).map((storyScene, sceneIndex) => ({
      sceneIndex,
      sceneTitle: `Szene ${sceneIndex + 1}`,
      sceneBeat: storyScene.sceneBeat,
      action: storyScene.action,
      continuityNotes: storyScene.continuityNotes,
    })) ?? [],
  });

  const rewriteStoryWithAzureModel = async (currentStory: StorySequence) => {
    const response = await fetch('/api/foundry/storyboard/regenerate', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        prompt,
        presetId: isPresetEnabled ? selectedPreset ?? undefined : undefined,
        promptTemplateId: selectedPromptTemplateId || undefined,
        storyArcMode,
        scope: 'story',
        currentStory: buildStoryRegenerationContext(currentStory),
        variationSeed: `${Date.now()}-${Math.random().toString(36).slice(2, 8)}`,
      }),
    });

    const { data, rawText } = await parseApiJsonResponse<{
      story?: StorySequence;
      model?: string;
      usage?: { promptTokens?: number; completionTokens?: number; totalTokens?: number };
      debug?: StoryboardRequestDebug;
      error?: string;
    }>(response);

    if (!response.ok) {
      throw new Error(
        buildApiErrorMessage(
          response,
          data,
          rawText,
          'Azure Story Model konnte das Storyboard nicht neu schreiben.',
        ),
      );
    }

    if (!data) {
      throw new Error(
        buildApiErrorMessage(
          response,
          null,
          rawText,
          'Azure Story Model lieferte keine gueltige JSON-Antwort.',
        ),
      );
    }

    if (!data.story) {
      throw new Error('Azure Story Model lieferte kein neues Storyboard zurueck.');
    }

    return data as {
      story: StorySequence;
      model?: string;
      usage?: { promptTokens?: number; completionTokens?: number; totalTokens?: number };
      debug?: StoryboardRequestDebug;
    };
  };

  const rewriteSceneWithAzureModel = async (
    currentStory: StorySequence,
    sceneIndex: number,
    draftPrompt: string,
  ) => {
    const response = await fetch('/api/foundry/storyboard/regenerate', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        prompt,
        presetId: isPresetEnabled ? selectedPreset ?? undefined : undefined,
        promptTemplateId: selectedPromptTemplateId || undefined,
        storyArcMode,
        scope: 'scene',
        currentStory: buildStoryRegenerationContext(currentStory),
        sceneIndex,
        sceneDraftPrompt: draftPrompt,
        variationSeed: `${Date.now()}-${Math.random().toString(36).slice(2, 8)}`,
      }),
    });

    const { data, rawText } = await parseApiJsonResponse<{
      scene?: StoryScene;
      model?: string;
      usage?: { promptTokens?: number; completionTokens?: number; totalTokens?: number };
      debug?: StoryboardRequestDebug;
      error?: string;
    }>(response);

    if (!response.ok) {
      throw new Error(
        buildApiErrorMessage(
          response,
          data,
          rawText,
          'Azure Story Model konnte den Szenenprompt nicht neu schreiben.',
        ),
      );
    }

    if (!data) {
      throw new Error(
        buildApiErrorMessage(
          response,
          null,
          rawText,
          'Azure Story Model lieferte keine gueltige JSON-Antwort.',
        ),
      );
    }

    if (!data.scene) {
      throw new Error('Azure Story Model lieferte keine neue Szene zurueck.');
    }

    return data as {
      scene: StoryScene;
      model?: string;
      usage?: { promptTokens?: number; completionTokens?: number; totalTokens?: number };
      debug?: StoryboardRequestDebug;
    };
  };

  const storyFileName = story?.title.replace(/[^a-z0-9]/gi, '_').toLowerCase() || 'story';
  const isEmbeddedBrowser = typeof navigator !== 'undefined' && /Code\/|Electron\//.test(navigator.userAgent);

  const dataUrlToBytes = (dataUrl: string): Uint8Array => {
    const separatorIndex = dataUrl.indexOf(',');
    if (separatorIndex === -1) {
      throw new Error('GIF data is not a valid data URL.');
    }

    const base64Data = dataUrl.slice(separatorIndex + 1);
    const binary = window.atob(base64Data);
    const bytes = new Uint8Array(binary.length);

    for (let index = 0; index < binary.length; index += 1) {
      bytes[index] = binary.charCodeAt(index);
    }

    return bytes;
  };

  const downloadBlob = (blob: Blob, fileName: string) => {
    const objectUrl = window.URL.createObjectURL(blob);
    const anchor = document.createElement('a');
    anchor.href = objectUrl;
    anchor.download = fileName;
    document.body.appendChild(anchor);
    anchor.click();
    document.body.removeChild(anchor);
    window.setTimeout(() => window.URL.revokeObjectURL(objectUrl), 60000);
  };

  const bytesToBlob = (bytes: Uint8Array, type: string) => {
    const buffer = new ArrayBuffer(bytes.byteLength);
    new Uint8Array(buffer).set(bytes);
    return new Blob([buffer], { type });
  };

  const requestSaveFile = (fileName: string, mimeType: string, extension: string) => {
    const pickerWindow = window as SaveFilePickerWindow;
    if (!pickerWindow.showSaveFilePicker) {
      return null;
    }

    return pickerWindow.showSaveFilePicker({
      suggestedName: fileName,
      types: [
        {
          description: mimeType,
          accept: {
            [mimeType]: [extension],
          },
        },
      ],
    });
  };

  const saveBlobToPickedFile = async (
    fileRequest: ReturnType<typeof requestSaveFile>,
    blob: Blob,
    fallbackFileName: string,
  ) => {
    if (!fileRequest) {
      triggerHttpDownload(fallbackFileName);
      return;
    }

    const fileHandle = await fileRequest;
    const writable = await fileHandle.createWritable();
    await writable.write(blob);
    await writable.close();
  };

  const triggerHttpDownload = (downloadUrl: string) => {
    const anchor = document.createElement('a');
    anchor.href = downloadUrl;
    anchor.rel = 'noopener';
    anchor.style.display = 'none';
    document.body.appendChild(anchor);
    anchor.click();
    document.body.removeChild(anchor);
  };

  // ARV Engine Storyboard direkt laden
  useEffect(() => {
    if (!preloadedStoryboard) return;
    resetStoryLibrarySnapshot();
    const arvStory = buildARVBackedStory(preloadedStoryboard, {
      presetId: activePreset?.id ?? 'neutral',
      colorPalette: activePreset?.colorPalette ?? 'Velvet black, cyan accents, muted amber glow, controlled analog noise.',
      motionGrammar: activePreset?.motionStyle ?? 'Slow staged reveals, clean scene transitions, calm loop logic, modular broadcast framing.',
    });
    setStoryArcMode('iconic');
    setPrompt(preloadedStoryboard.concept);
    setIsARVPreload(true);
    applyStoryToEditor(arvStory);
  }, [activePreset?.colorPalette, activePreset?.id, activePreset?.motionStyle, preloadedStoryboard]);

  useEffect(() => {
    setStoryboardEngine(model);
  }, [model]);

  const handleGenerateStory = async () => {
    if (!prompt.trim()) return;

    setIsGeneratingStory(true);
    setError(null);
    setStoryRequestDebug(null);
    resetStoryLibrarySnapshot();
    setIsARVPreload(false);
    setStory(null);

    try {
      if (storyboardEngine === 'foundry') {
        const foundryResponse = await fetch('/api/foundry/storyboard', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            prompt,
            presetId: isPresetEnabled ? selectedPreset ?? undefined : undefined,
            promptTemplateId: selectedPromptTemplateId || undefined,
            storyArcMode,
          }),
        });

        const foundryData = await foundryResponse.json();
        if (!foundryResponse.ok) {
          throw new Error(foundryData.error || 'Failed to generate storyboard with Azure Foundry');
        }

        if (!foundryData.story) {
          throw new Error('Azure Foundry storyboard generation returned no story data.');
        }

        setStoryRequestDebug(foundryData.debug ?? null);
        applyStoryToEditor(foundryData.story);
      } else {
        const openAIResponse = await fetch('/api/openai/storyboard', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            prompt,
            presetId: isPresetEnabled ? selectedPreset ?? undefined : undefined,
            promptTemplateId: selectedPromptTemplateId || undefined,
            storyArcMode,
          }),
        });

        const openAIData = await openAIResponse.json();
        if (!openAIResponse.ok) {
          throw new Error(openAIData.error || 'Failed to generate storyboard with OpenAI');
        }

        if (!openAIData.story) {
          throw new Error('OpenAI storyboard generation returned no story data.');
        }

        setStoryRequestDebug(openAIData.debug ?? null);
        applyStoryToEditor(openAIData.story);

        recordStoryboardUsage(openAIData.usage, openAIData.model || 'gpt-5.2-chat');
      }
    } catch (err: any) {
      setError(err.message);
    } finally {
      setIsGeneratingStory(false);
    }
  };

  const handleRegenerateStoryWithAzure = async () => {
    if (!story || !prompt.trim()) return;

    setIsGeneratingStory(true);
    setError(null);
    resetStoryLibrarySnapshot();
    setIsARVPreload(false);

    try {
      const previousStory = story;
      const regenerationResult = await rewriteStoryWithAzureModel(previousStory);
      const nextStory: StorySequence = previousStory.arv && !regenerationResult.story.arv
        ? { ...regenerationResult.story, arv: previousStory.arv }
        : regenerationResult.story;

      setStoryRequestDebug(regenerationResult.debug ?? null);
      applyStoryToEditor(nextStory);
      recordStoryboardUsage(regenerationResult.usage, regenerationResult.model || 'azure-story-model');
    } catch (err: any) {
      setError(err.message || 'Azure Story Model konnte das Storyboard nicht neu schreiben.');
    } finally {
      setIsGeneratingStory(false);
    }
  };

  const generateGifForScene = async (
    scene: StoryScene,
    index: number,
    options: { remixVideoId?: string | null; videoTransform?: VideoTransformMode | null } = {},
  ): Promise<SceneRenderResult> => {
    const promptToSend = extractPromptCore(scene.finalPrompt) || scene.gifSpecification;
    const remixedFromVideoId = options.remixVideoId ?? null;
    const videoTransform = resolveVideoTransformMode(remixedFromVideoId, options.videoTransform);
    let convertPayload: any = {};
    let videoId: string | null = null;
    let debug: VideoPromptDebug | null = null;

    if (model === 'foundry') {
      const foundryResponse = await fetch('/api/foundry/video', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          prompt: promptToSend,
          size: '1280x720',
          presetId: activePreset?.id,
          remixVideoId: remixedFromVideoId || undefined,
          videoTransform: videoTransform || undefined,
          iqContext: buildSceneIQContext(scene, index, remixedFromVideoId, videoTransform),
        }),
      });
      const foundryData = await foundryResponse.json();
      if (!foundryResponse.ok) {
        throw new Error(foundryData.error || 'Foundry video generation failed');
      }
      videoId = typeof foundryData.videoId === 'string' ? foundryData.videoId : null;
      debug = foundryData.debug || null;
      if (foundryData.videoBase64) {
        convertPayload = { videoBase64: foundryData.videoBase64 };
      } else if (foundryData.videoUrl) {
        convertPayload = { videoUrl: foundryData.videoUrl };
      } else {
        throw new Error('Foundry video generation returned no downloadable output.');
      }
      setSceneVideoPromptDebugs((prev) => ({ ...prev, [scene.id]: debug }));
      if (onAzureUsage) {
        onAzureUsage({
          type: 'video',
          model: foundryData.deployment || 'sora-2',
          videoSeconds: foundryData.seconds ?? 4,
          videoSize: foundryData.size || '1280x720',
        });
      }
    } else {
      const openAIResponse = await fetch('/api/openai/video', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          prompt: promptToSend,
          size: '1280x720',
          presetId: activePreset?.id,
          remixVideoId: remixedFromVideoId || undefined,
          videoTransform: videoTransform || undefined,
          iqContext: buildSceneIQContext(scene, index, remixedFromVideoId, videoTransform),
        })
      });

      const openAIData = await openAIResponse.json();
      if (!openAIResponse.ok) {
        throw new Error(openAIData.error || 'Failed to generate video with OpenAI');
      }

      videoId = typeof openAIData.videoId === 'string' ? openAIData.videoId : null;
      debug = openAIData.debug || null;
      if (openAIData.videoBase64) {
        convertPayload = { videoBase64: openAIData.videoBase64 };
      } else if (openAIData.videoUrl) {
        convertPayload = { videoUrl: openAIData.videoUrl };
      } else {
        throw new Error('OpenAI video generation returned no downloadable output.');
      }
      setSceneVideoPromptDebugs((prev) => ({ ...prev, [scene.id]: debug }));
    }

    try {
      const convertResponse = await fetch('/api/convert-gif', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          ...convertPayload,
          ...(model === 'openai' || model === 'foundry'
            ? { aspectRatio: openAIVideoRatio, outputSize: openAIGifSize }
            : {}),
        }),
      });

      const data = await convertResponse.json();
      if (!convertResponse.ok) {
        throw new Error(data.error || 'Failed to convert video to GIF');
      }

      return {
        gifData: data.gifData,
        videoId,
        remixedFromVideoId: remixedFromVideoId || null,
        videoTransformMode: videoTransform ?? null,
        debug,
      };
    } catch (error: any) {
      const renderError = new Error(error?.message || 'Failed to convert video to GIF') as SceneRenderError;
      renderError.partialScene = {
        videoId,
        remixedFromVideoId: remixedFromVideoId || null,
        videoTransformMode: videoTransform ?? null,
      };
      renderError.debug = debug;
      throw renderError;
    }
  };

  // Einzelne Szene generieren (mit aktuellem Draft-Prompt)
  const handleGenerateScene = async (index: number, options: { rewriteWithAzure?: boolean; remixVideoId?: string | null; videoTransform?: VideoTransformMode | null } = {}) => {
    if (!story) return;
    const currentStory = story;
    const scene = currentStory.scenes[index];
    const sceneId = scene.id;
    const draftPrompt = (scenePromptDrafts[sceneId] ?? scene.finalPrompt).trim() || scene.finalPrompt;
    const activeVideoTransform = resolveVideoTransformMode(options.remixVideoId ?? null, options.videoTransform ?? null);

    setStory(prev => {
      if (!prev) return prev;
      return {
        ...prev,
        scenes: prev.scenes.map((s, i) =>
          i === index
            ? {
                ...s,
                finalPrompt: draftPrompt,
                status: 'generating' as const,
                error: undefined,
                videoTransformMode: activeVideoTransform ?? null,
              }
            : s
        ),
      };
    });
    setGeneratingSceneIds(prev => new Set([...prev, sceneId]));
    setEditingSceneIds(prev => { const ns = new Set(prev); ns.delete(sceneId); return ns; });
    setSceneVideoPromptDebugs(prev => {
      const next = { ...prev };
      delete next[sceneId];
      return next;
    });

    try {
      let sceneWithDraft: StoryScene = { ...scene, finalPrompt: draftPrompt };

      if (options.rewriteWithAzure) {
        setRewritingSceneIds(prev => new Set([...prev, sceneId]));
        const regenerationResult = await rewriteSceneWithAzureModel(currentStory, index, extractPromptCore(draftPrompt) || scene.gifSpecification);
        recordStoryboardUsage(regenerationResult.usage, regenerationResult.model || 'azure-story-model');
        sceneWithDraft = regenerationResult.scene;
        setStoryRequestDebug(regenerationResult.debug ?? null);

        setScenePromptDrafts(prev => ({ ...prev, [sceneId]: sceneWithDraft.finalPrompt }));
        setStory(prev => {
          if (!prev) return prev;
          return {
            ...prev,
            scenes: prev.scenes.map((s, i) =>
              i === index
                ? { ...sceneWithDraft, status: 'generating' as const, error: undefined }
                : s
            ),
          };
        });
      }

      const renderResult = await generateGifForScene(sceneWithDraft, index, {
        remixVideoId: options.remixVideoId ?? null,
        videoTransform: activeVideoTransform ?? undefined,
      });

      let savedStory: StorySequence | null = null;
      setStory(prev => {
        if (!prev) return prev;
        const scenes = prev.scenes.map((s, i) =>
          i === index ? {
            ...s,
            ...sceneWithDraft,
            gifData: renderResult.gifData,
            videoId: renderResult.videoId,
            remixedFromVideoId: renderResult.remixedFromVideoId,
            videoTransformMode: renderResult.videoTransformMode,
            status: 'completed' as const,
            error: undefined,
          } : s
        );
        savedStory = { ...prev, scenes };
        return savedStory;
      });

      if (savedStory) {
        const st = savedStory as StorySequence;
        if (st.scenes.some(s => s.gifData)) {
          const snapshot = getStoryLibrarySnapshot();
          await saveToLibrary({
            id: snapshot.id,
            type: 'story',
            createdAt: snapshot.createdAt,
            prompt,
            model,
            title: st.title,
            scenes: st.scenes.map(s => ({
              scenePrompt: s.action,
              finalPrompt: s.finalPrompt,
              gifData: s.gifData,
              videoId: s.videoId,
              remixedFromVideoId: s.remixedFromVideoId,
              videoTransformMode: s.videoTransformMode ?? null,
            })),
          });
          onStorySaved();
        }
      }
    } catch (err: any) {
      const renderError = err as SceneRenderError;
      if (renderError.debug) {
        setSceneVideoPromptDebugs((prev) => ({ ...prev, [sceneId]: renderError.debug || prev[sceneId] }));
      }
      setStory(prev => {
        if (!prev) return prev;
        return {
          ...prev,
          scenes: prev.scenes.map((s, i) =>
            i === index ? {
              ...s,
              videoId: renderError.partialScene?.videoId ?? s.videoId ?? null,
              remixedFromVideoId: renderError.partialScene?.remixedFromVideoId ?? s.remixedFromVideoId ?? null,
              videoTransformMode: renderError.partialScene?.videoTransformMode ?? s.videoTransformMode ?? null,
              status: 'error' as const,
              error: err.message,
            } : s
          ),
        };
      });
    } finally {
      setRewritingSceneIds(prev => { const ns = new Set(prev); ns.delete(sceneId); return ns; });
      setGeneratingSceneIds(prev => { const ns = new Set(prev); ns.delete(sceneId); return ns; });
    }
  };

  // Alle ausstehenden/fehlerhaften Szenen der Reihe nach generieren
  const handleGenerateAllPending = async () => {
    if (!story) return;
    for (let i = 0; i < story.scenes.length; i++) {
      const s = story.scenes[i];
      if (s.status === 'completed' && s.gifData) continue;
      if (generatingSceneIds.has(s.id)) continue;
      await handleGenerateScene(i);
    }
  };

  const handleDownloadSingle = (scene: StoryScene, index: number) => {
    if (!scene.gifData) return;
    const gifBlob = bytesToBlob(dataUrlToBytes(scene.gifData), 'image/gif');
    downloadBlob(gifBlob, `${storyFileName}_scene_${index + 1}.gif`);
  };

  const handleDownloadZip = async () => {
    if (!story) return;

    const downloadableScenes = story.scenes
      .map((scene, index) => ({ scene, index }))
      .filter(({ scene }) => Boolean(scene.gifData));

    if (downloadableScenes.length === 0) {
      setError('Es sind noch keine fertigen GIFs fuer den ZIP-Download vorhanden.');
      return;
    }

    const zipFileName = `${storyFileName}.zip`;
    const zipFileRequest = requestSaveFile(zipFileName, 'application/zip', '.zip');

    setIsDownloadingZip(true);
    setError(null);
    setDownloadMessage(null);

    try {
      const useLocalServerSave = isEmbeddedBrowser;
      const zipResponse = await fetch('/api/story-zip', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          storyName: storyFileName,
          deliveryMode: useLocalServerSave ? 'save-local' : 'download',
          scenes: downloadableScenes.map(({ scene, index }) => ({
            fileName: `${storyFileName}_scene_${index + 1}`,
            gifData: scene.gifData,
          })),
        }),
      });
      const zipData = await zipResponse.json();

      if (!zipResponse.ok) {
        throw new Error(zipData.error || 'ZIP-Download fehlgeschlagen.');
      }

      if (useLocalServerSave) {
        if (!zipData.savedPath || typeof zipData.savedPath !== 'string') {
          throw new Error('ZIP wurde lokal gespeichert, aber der Pfad fehlt in der Antwort.');
        }

        setDownloadMessage(`ZIP gespeichert unter: ${zipData.savedPath}`);
        return;
      }

      if (!zipData.downloadUrl || typeof zipData.downloadUrl !== 'string') {
        throw new Error('ZIP-Download URL fehlt.');
      }

      if (!zipFileRequest) {
        triggerHttpDownload(zipData.downloadUrl);
        return;
      }

      const fileResponse = await fetch(zipData.downloadUrl);
      if (!fileResponse.ok) {
        throw new Error('ZIP-Datei konnte nicht vom Server geladen werden.');
      }

      await saveBlobToPickedFile(zipFileRequest, await fileResponse.blob(), zipData.downloadUrl);
    } catch (err: any) {
      if (err?.name === 'AbortError') {
        return;
      }
      setError(err?.message || 'ZIP-Download fehlgeschlagen.');
    } finally {
      setIsDownloadingZip(false);
    }
  };

  return (
    <div className="space-y-8">
      {!embedded && (
        <div>
          <h2 className="text-3xl font-bold mb-2 tracking-tight">Auto Story Generator</h2>
          <p className="text-stone-500 dark:text-stone-400">
            Enter a single sentence and let AI generate a cohesive, multi-scene GIF story with perfect continuity.
          </p>
        </div>
      )}

      {/* ARV Storyboard Banner */}
      {isARVPreload && story && (
        <div className="flex items-center justify-between gap-3 px-5 py-3.5 rounded-xl border border-violet-500/40 bg-violet-950/30">
          <div className="flex items-center gap-2">
            <Cpu size={16} className="text-violet-400 shrink-0" />
            <span className="text-xs font-mono font-bold text-violet-300">
              ARV STORYBOARD GELADEN
            </span>
            <span className="text-xs text-stone-400 font-mono">— {story.title} · 4 Szenen fertig</span>
          </div>
          <button
            onClick={() => { setStory(null); setIsARVPreload(false); setPrompt(''); }}
            className="text-[10px] font-mono text-stone-500 hover:text-stone-300 transition-colors"
          >
            × Zurücksetzen
          </button>
        </div>
      )}

      <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
        <div className="space-y-4">
          <div className="space-y-2">
            <label className="text-sm font-medium text-stone-700 dark:text-stone-300">
              Video Provider
            </label>
            <div className="grid grid-cols-2 gap-2">
              <button
                onClick={() => setModel('openai')}
                disabled={isGeneratingStory || isAnyGenerating}
                className={`p-3 text-left rounded-xl border transition-all ${
                  model === 'openai'
                    ? 'border-indigo-500 bg-indigo-50 dark:bg-indigo-900/20 text-indigo-700 dark:text-indigo-300'
                    : 'border-stone-200 dark:border-zinc-800 bg-white dark:bg-zinc-900 hover:border-indigo-300 dark:hover:border-indigo-700'
                }`}
              >
                <div className="font-bold text-sm">OpenAI Video</div>
                <div className="text-xs opacity-70 mt-1">Sora endpoint</div>
              </button>
              <button
                onClick={() => setModel('foundry')}
                disabled={isGeneratingStory || isAnyGenerating}
                className={`p-3 text-left rounded-xl border transition-all ${
                  model === 'foundry'
                    ? 'border-sky-500 bg-sky-50 dark:bg-sky-900/20 text-sky-700 dark:text-sky-300'
                    : 'border-stone-200 dark:border-zinc-800 bg-white dark:bg-zinc-900 hover:border-sky-300 dark:hover:border-sky-700'
                }`}
              >
                <div className="font-bold text-sm">Azure Foundry</div>
                <div className="text-xs opacity-70 mt-1">Sora via Foundry</div>
              </button>
            </div>
          </div>

          <div className="space-y-2">
            <label className="text-sm font-medium text-stone-700 dark:text-stone-300">
              Storyboard Engine
            </label>
            <div className="grid grid-cols-2 gap-2">
              <button
                onClick={() => setStoryboardEngine('foundry')}
                disabled={isGeneratingStory || isAnyGenerating}
                className={`p-3 text-left rounded-xl border transition-all ${
                  storyboardEngine === 'foundry'
                    ? 'border-sky-500 bg-sky-50 dark:bg-sky-900/20 text-sky-700 dark:text-sky-300'
                    : 'border-stone-200 dark:border-zinc-800 bg-white dark:bg-zinc-900 hover:border-sky-300 dark:hover:border-sky-700'
                }`}
              >
                <div className="font-bold text-sm">Azure Foundry Storyboard</div>
                <div className="text-xs opacity-70 mt-1">Uses /api/foundry/storyboard</div>
              </button>
              <button
                onClick={() => setStoryboardEngine('openai')}
                disabled={isGeneratingStory || isAnyGenerating}
                className={`p-3 text-left rounded-xl border transition-all ${
                  storyboardEngine === 'openai'
                    ? 'border-indigo-500 bg-indigo-50 dark:bg-indigo-900/20 text-indigo-700 dark:text-indigo-300'
                    : 'border-stone-200 dark:border-zinc-800 bg-white dark:bg-zinc-900 hover:border-indigo-300 dark:hover:border-indigo-700'
                }`}
              >
                <div className="font-bold text-sm">OpenAI Storyboard</div>
                <div className="text-xs opacity-70 mt-1">Uses /api/openai/storyboard</div>
              </button>
            </div>
            <p className="text-xs text-stone-500 dark:text-stone-400">
              Renderer und Storyboard koennen identisch laufen, lassen sich aber bewusst gegeneinander testen.
            </p>
          </div>

          <div className="space-y-2">
            <label className="text-sm font-medium text-stone-700 dark:text-stone-300">
              Story Arc Mode
            </label>
            <div className="grid grid-cols-2 gap-2">
              {STORY_ARC_OPTIONS.map((option) => (
                <button
                  key={option.id}
                  onClick={() => setStoryArcMode(option.id)}
                  disabled={isGeneratingStory || isAnyGenerating}
                  className={`p-3 text-left rounded-xl border transition-all ${
                    storyArcMode === option.id
                      ? 'border-indigo-500 bg-indigo-50 dark:bg-indigo-900/20 text-indigo-700 dark:text-indigo-300'
                      : 'border-stone-200 dark:border-zinc-800 bg-white dark:bg-zinc-900 hover:border-indigo-300 dark:hover:border-indigo-700'
                  }`}
                >
                  <div className="font-bold text-sm">{option.label}</div>
                  <div className="text-xs opacity-70 mt-1">{option.description}</div>
                </button>
              ))}
            </div>
            <p className="text-xs text-stone-500 dark:text-stone-400">
              Wirkt auf das naechste erzeugte Storyboard. Iconic Loop Arc drueckt staerker auf Serien-Ident-Bilder, Cinematic Arc auf verbundenen Sequenzfluss.
            </p>
          </div>

          {model === 'openai' && (
            <div className="space-y-2">
              <label className="text-sm font-medium text-stone-700 dark:text-stone-300">
                OpenAI Video Ratio
              </label>
              <div className="grid grid-cols-2 gap-2">
                <button
                  onClick={() => setOpenAIVideoRatio('16:9')}
                  disabled={isGeneratingStory || isAnyGenerating}
                  className={`p-3 text-left rounded-xl border transition-all ${
                    openAIVideoRatio === '16:9'
                      ? 'border-indigo-500 bg-indigo-50 dark:bg-indigo-900/20 text-indigo-700 dark:text-indigo-300'
                      : 'border-stone-200 dark:border-zinc-800 bg-white dark:bg-zinc-900 hover:border-indigo-300 dark:hover:border-indigo-700'
                  }`}
                >
                  <div className="font-bold text-sm">16:9</div>
                  <div className="text-xs opacity-70 mt-1">Landscape</div>
                </button>
                <button
                  onClick={() => setOpenAIVideoRatio('1:1')}
                  disabled={isGeneratingStory || isAnyGenerating}
                  className={`p-3 text-left rounded-xl border transition-all ${
                    openAIVideoRatio === '1:1'
                      ? 'border-indigo-500 bg-indigo-50 dark:bg-indigo-900/20 text-indigo-700 dark:text-indigo-300'
                      : 'border-stone-200 dark:border-zinc-800 bg-white dark:bg-zinc-900 hover:border-indigo-300 dark:hover:border-indigo-700'
                  }`}
                >
                  <div className="font-bold text-sm">1:1</div>
                  <div className="text-xs opacity-70 mt-1">Square</div>
                </button>
              </div>
              <p className="text-xs text-stone-500 dark:text-stone-400">
                OpenAI Sora is generated in supported landscape format; 1:1 is created during GIF conversion.
              </p>
            </div>
          )}

          {model === 'openai' && (
            <div className="space-y-2">
              <label className="text-sm font-medium text-stone-700 dark:text-stone-300">
                OpenAI GIF Size
              </label>
              <div className="grid grid-cols-3 gap-2">
                {[480, 720, 1080].map((size) => (
                  <button
                    key={size}
                    onClick={() => setOpenAIGifSize(size as 480 | 720 | 1080)}
                    disabled={isGeneratingStory || isAnyGenerating}
                    className={`p-3 text-left rounded-xl border transition-all ${
                      openAIGifSize === size
                        ? 'border-indigo-500 bg-indigo-50 dark:bg-indigo-900/20 text-indigo-700 dark:text-indigo-300'
                        : 'border-stone-200 dark:border-zinc-800 bg-white dark:bg-zinc-900 hover:border-indigo-300 dark:hover:border-indigo-700'
                    }`}
                  >
                    <div className="font-bold text-sm">{size}px</div>
                    <div className="text-xs opacity-70 mt-1">Output edge</div>
                  </button>
                ))}
              </div>
            </div>
          )}

          <div className="space-y-2">
            <label className="text-sm font-medium text-stone-700 dark:text-stone-300">
              Vorlagen-Prompts
            </label>
            <div className="grid gap-2 md:grid-cols-[minmax(0,1fr)_minmax(0,1fr)_auto]">
              <input
                value={promptTemplateSearch}
                onChange={(event) => setPromptTemplateSearch(event.target.value)}
                placeholder="Vorlagen durchsuchen..."
                className="w-full rounded-xl border border-stone-200 dark:border-zinc-800 bg-white dark:bg-zinc-900 px-4 py-3 text-sm focus:ring-2 focus:ring-indigo-500 focus:border-transparent transition-all"
                disabled={isGeneratingStory || isAnyGenerating}
              />
              <select
                aria-label="Story-Vorlage auswaehlen"
                title="Story-Vorlage auswaehlen"
                value={selectedPromptTemplateId}
                onChange={(event) => setSelectedPromptTemplateId(event.target.value)}
                className="w-full rounded-xl border border-stone-200 dark:border-zinc-800 bg-white dark:bg-zinc-900 px-4 py-3 text-sm focus:ring-2 focus:ring-indigo-500 focus:border-transparent transition-all"
                disabled={isGeneratingStory || isAnyGenerating}
              >
                <option value="">Vorlage auswaehlen ({storyPromptTemplates.length})</option>
                {curatedStoryIdentTemplates.length > 0 && (
                  <optgroup label="Kuratierte Storys · Ident Loops">
                    {curatedStoryIdentTemplates.map((template) => (
                      <option key={template.id} value={template.id}>
                        {template.label} · {template.category}
                      </option>
                    ))}
                  </optgroup>
                )}
                {curatedStoryWorldTemplates.length > 0 && (
                  <optgroup label="Kuratierte Storys · Sequenzwelten">
                    {curatedStoryWorldTemplates.map((template) => (
                      <option key={template.id} value={template.id}>
                        {template.label} · {template.category}
                      </option>
                    ))}
                  </optgroup>
                )}
                {remainingStoryTemplates.length > 0 && (
                  <optgroup label="Alle weiteren Story-Vorlagen">
                    {remainingStoryTemplates.map((template) => (
                      <option key={template.id} value={template.id}>
                        {template.label} · {template.category}
                      </option>
                    ))}
                  </optgroup>
                )}
              </select>
              <button
                type="button"
                onClick={applySelectedPromptTemplate}
                disabled={!selectedPromptTemplateId || isGeneratingStory || isAnyGenerating}
                className="rounded-xl border border-stone-200 dark:border-zinc-800 bg-white dark:bg-zinc-900 px-4 py-3 text-sm font-medium hover:border-indigo-300 dark:hover:border-indigo-700 transition-all disabled:opacity-50"
              >
                Uebernehmen
              </button>
            </div>
            <p className="text-xs text-stone-500 dark:text-stone-400">
              Filtert alle eingebauten Vorlagen. Kuratierte Ident-Loops und atmosphaerische Sequenzwelten stehen oben, der Rest bleibt darunter erhalten.
            </p>
          </div>

          <div className="space-y-2">
            <label className="text-sm font-medium text-stone-700 dark:text-stone-300">
              Story Idea
            </label>
            <textarea
              value={prompt}
              onChange={(e) => setPrompt(e.target.value)}
              placeholder={STORY_IDEA_PLACEHOLDER}
              className="w-full h-24 p-4 rounded-xl border border-stone-200 dark:border-zinc-800 bg-white dark:bg-zinc-900 focus:ring-2 focus:ring-indigo-500 focus:border-transparent resize-none transition-all"
              disabled={isGeneratingStory || isAnyGenerating}
            />
          </div>

          <div className="space-y-2">
            <div className="flex items-center justify-between gap-4">
              <label className="text-sm font-medium text-stone-700 dark:text-stone-300">
                Visual Style Preset
              </label>
              <button
                type="button"
                aria-label="Visual Style Preset aktivieren oder deaktivieren"
                onClick={() => setIsPresetEnabled((current) => !current)}
                disabled={isGeneratingStory || isAnyGenerating}
                className={`inline-flex items-center gap-2 rounded-full border px-3 py-1.5 text-xs font-semibold transition-all ${
                  isPresetEnabled
                    ? 'border-indigo-400 bg-indigo-50 text-indigo-700 dark:border-indigo-700 dark:bg-indigo-900/20 dark:text-indigo-300'
                    : 'border-stone-300 bg-stone-100 text-stone-600 dark:border-zinc-700 dark:bg-zinc-900 dark:text-stone-300'
                }`}
              >
                <span>{isPresetEnabled ? 'AN' : 'AUS'}</span>
              </button>
            </div>
            <select
              aria-label="Visual Style Preset auswaehlen"
              title="Visual Style Preset auswaehlen"
              value={selectedPreset ?? ''}
              onChange={(event) => {
                const nextPresetId = event.target.value || null;
                setSelectedPreset(nextPresetId);
                if (nextPresetId) {
                  setIsPresetEnabled(true);
                }
              }}
              disabled={isGeneratingStory || isAnyGenerating}
              className="w-full rounded-xl border border-stone-200 dark:border-zinc-800 bg-white dark:bg-zinc-900 px-4 py-3 text-sm focus:ring-2 focus:ring-indigo-500 focus:border-transparent transition-all"
            >
              <option value="">Kein Preset ausgewaehlt</option>
              <optgroup label="Kuratierte ARV Auswahl">
                {CURATED_PRESETS.map((preset) => (
                  <option key={preset.id} value={preset.id}>
                    {preset.name}
                  </option>
                ))}
              </optgroup>
              {NON_CURATED_PRESETS.length > 0 && (
                <optgroup label="Gesamtkatalog">
                  {NON_CURATED_PRESETS.map((preset) => (
                    <option key={preset.id} value={preset.id}>
                      {preset.name}
                    </option>
                  ))}
                </optgroup>
              )}
            </select>
            <p className="text-xs text-stone-500 dark:text-stone-400">
              Presets sind optional. Die kuratierte Auswahl steht oben, der Gesamtkatalog bleibt darunter erhalten.
            </p>
          </div>

          <button
            onClick={handleGenerateStory}
            disabled={!prompt.trim() || isGeneratingStory || isAnyGenerating}
            className="w-full py-4 px-6 rounded-xl bg-indigo-600 hover:bg-indigo-700 disabled:bg-stone-300 dark:disabled:bg-zinc-800 disabled:text-stone-500 text-white font-bold text-lg transition-all flex items-center justify-center gap-2 shadow-lg shadow-indigo-600/20"
          >
            {isGeneratingStory ? (
              <>
                <Loader2 className="animate-spin" size={24} />
                Writing Storyboard...
              </>
            ) : (
              <>
                <Wand2 size={24} />
                Generate Storyboard ({storyboardEngine === 'openai' ? 'OpenAI' : 'Azure Foundry'})
              </>
            )}
          </button>

          {story && (
            <button
              onClick={handleRegenerateStoryWithAzure}
              disabled={!prompt.trim() || isGeneratingStory || isAnyGenerating}
              className="w-full py-3.5 px-6 rounded-xl bg-sky-600 hover:bg-sky-700 disabled:bg-stone-300 dark:disabled:bg-zinc-800 disabled:text-stone-500 text-white font-bold text-base transition-all flex items-center justify-center gap-2 shadow-lg shadow-sky-600/20"
            >
              {isGeneratingStory ? (
                <>
                  <Loader2 className="animate-spin" size={22} />
                  Azure Story Model schreibt neu...
                </>
              ) : (
                <>
                  <Cpu size={20} />
                  Storyboard mit Azure neu schreiben
                </>
              )}
            </button>
          )}

          {downloadMessage && (
            <div className="p-4 rounded-xl bg-emerald-50 dark:bg-emerald-900/20 text-emerald-700 dark:text-emerald-300 text-sm border border-emerald-100 dark:border-emerald-900/50 break-all">
              {downloadMessage}
            </div>
          )}

          {error && (
            <div className="p-4 rounded-xl bg-red-50 dark:bg-red-900/20 text-red-600 dark:text-red-400 text-sm border border-red-100 dark:border-red-900/50">
              {error}
            </div>
          )}

          {storyRequestDebug?.storyboardPrompt && (
            <details className="rounded-xl border border-stone-200 dark:border-zinc-800 bg-stone-50/80 dark:bg-zinc-950/40 p-4 text-sm">
              <summary className="cursor-pointer font-semibold text-stone-800 dark:text-stone-100 select-none">
                Prompt-Debug · letzter Storyboard-Request
              </summary>
              <div className="mt-4 grid gap-4">
                <div>
                  <div className="text-[11px] uppercase tracking-[0.18em] text-stone-500 dark:text-stone-400 font-semibold">Rohprompt</div>
                  <pre className="mt-2 whitespace-pre-wrap rounded-lg border border-stone-200 dark:border-zinc-800 bg-white dark:bg-zinc-900 p-3 text-xs leading-6 text-stone-700 dark:text-stone-300 overflow-x-auto">
                    {storyRequestDebug.storyboardPrompt.rawPrompt}
                  </pre>
                </div>
                <div>
                  <div className="text-[11px] uppercase tracking-[0.18em] text-indigo-500 dark:text-indigo-300 font-semibold">Bereinigter Story-Request</div>
                  <pre className="mt-2 whitespace-pre-wrap rounded-lg border border-indigo-200/70 dark:border-indigo-900/50 bg-indigo-50/80 dark:bg-indigo-950/20 p-3 text-xs leading-6 text-stone-800 dark:text-stone-100 overflow-x-auto">
                    {storyRequestDebug.storyboardPrompt.normalizedPrompt}
                  </pre>
                </div>
                {storyRequestDebug.modelInput && (
                  <div>
                    <div className="text-[11px] uppercase tracking-[0.18em] text-stone-500 dark:text-stone-400 font-semibold">Model Input</div>
                    <pre className="mt-2 whitespace-pre-wrap rounded-lg border border-stone-200 dark:border-zinc-800 bg-white dark:bg-zinc-900 p-3 text-xs leading-6 text-stone-700 dark:text-stone-300 overflow-x-auto">
                      {storyRequestDebug.modelInput}
                    </pre>
                  </div>
                )}
                {storyRequestDebug.systemInstruction && (
                  <div>
                    <div className="text-[11px] uppercase tracking-[0.18em] text-stone-500 dark:text-stone-400 font-semibold">System Instruction</div>
                    <pre className="mt-2 max-h-72 overflow-auto whitespace-pre-wrap rounded-lg border border-stone-200 dark:border-zinc-800 bg-white dark:bg-zinc-900 p-3 text-xs leading-6 text-stone-700 dark:text-stone-300">
                      {storyRequestDebug.systemInstruction}
                    </pre>
                  </div>
                )}
                {storyRequestDebug.storyboardPrompt.normalizationNotes && storyRequestDebug.storyboardPrompt.normalizationNotes.length > 0 && (
                  <div className="flex flex-wrap gap-2">
                    {storyRequestDebug.storyboardPrompt.normalizationNotes.map((note) => (
                      <span
                        key={note}
                        className="rounded-full border border-stone-200 dark:border-zinc-700 bg-white dark:bg-zinc-900 px-3 py-1 text-[11px] font-medium text-stone-600 dark:text-stone-300"
                      >
                        {note}
                      </span>
                    ))}
                  </div>
                )}
              </div>
            </details>
          )}
        </div>

        {/* Storyboard Preview */}
        {story && (
          <div className="space-y-6 bg-white dark:bg-zinc-900 p-6 rounded-2xl border border-stone-200 dark:border-zinc-800 shadow-sm">
            <div>
              <h3 className="text-2xl font-bold text-indigo-600 dark:text-indigo-400">{story.title}</h3>
              <p className="text-sm text-stone-500 dark:text-stone-400 mt-1 italic">{story.tone}</p>
            </div>

            {(story.hookTitle || story.presetName || story.mainMotif) && (
              <div className="grid gap-3 md:grid-cols-3 text-sm">
                {story.hookTitle && (
                  <div className="rounded-xl border border-indigo-200/70 bg-indigo-50/80 dark:border-indigo-900/50 dark:bg-indigo-950/30 p-3">
                    <div className="text-[11px] uppercase tracking-[0.18em] text-indigo-500 dark:text-indigo-300 font-semibold">Hook</div>
                    <div className="mt-1 font-semibold text-stone-900 dark:text-stone-100">{story.hookTitle}</div>
                  </div>
                )}
                {story.presetName && (
                  <div className="rounded-xl border border-stone-200 dark:border-zinc-800 bg-stone-50 dark:bg-zinc-800/50 p-3">
                    <div className="text-[11px] uppercase tracking-[0.18em] text-stone-500 dark:text-stone-400 font-semibold">ARV Universe</div>
                    <div className="mt-1 font-semibold text-stone-900 dark:text-stone-100">{story.presetName}</div>
                  </div>
                )}
                {story.mainMotif && (
                  <div className="rounded-xl border border-stone-200 dark:border-zinc-800 bg-stone-50 dark:bg-zinc-800/50 p-3">
                    <div className="text-[11px] uppercase tracking-[0.18em] text-stone-500 dark:text-stone-400 font-semibold">Main Motif</div>
                    <div className="mt-1 text-stone-800 dark:text-stone-200">{story.mainMotif}</div>
                  </div>
                )}
              </div>
            )}

            <div className="rounded-xl border border-indigo-200/70 bg-indigo-50/80 dark:border-indigo-900/50 dark:bg-indigo-950/30 p-3 text-sm">
              <div className="text-[11px] uppercase tracking-[0.18em] text-indigo-500 dark:text-indigo-300 font-semibold">Story Arc</div>
              <div className="mt-1 font-semibold text-stone-900 dark:text-stone-100">
                {story.storyArcMode === 'cinematic' ? 'Cinematic Arc' : 'Iconic Loop Arc'}
              </div>
              <div className="mt-1 text-xs text-stone-600 dark:text-stone-300">
                {story.storyArcMode === 'cinematic'
                  ? 'Verbundene Viererszene mit mehr Atmosphaere und Uebergangsfluss.'
                  : 'Dominante Hero-Motive mit klaren Impact-Beats und harter Afterimage-Closure.'}
              </div>
            </div>
            
            <div className="space-y-3 text-sm">
              <div className="bg-stone-50 dark:bg-zinc-800/50 p-3 rounded-lg">

            <div className="rounded-xl border border-stone-200 dark:border-zinc-800 bg-stone-50/80 dark:bg-zinc-950/40 p-4">
              <div className="flex flex-col gap-2 md:flex-row md:items-center md:justify-between">
                <div>
                  <div className="text-[11px] uppercase tracking-[0.18em] text-stone-500 dark:text-stone-400 font-semibold">Shared scene timeline</div>
                  <div className="mt-1 text-sm text-stone-600 dark:text-stone-300">
                    Beat-Struktur und ARV-Seed-Metadaten laufen hier in einer gemeinsamen Szenenleiste zusammen.
                  </div>
                </div>
                {story.arv && (
                  <div className="inline-flex items-center gap-2 rounded-full border border-violet-200 bg-violet-50 px-3 py-1.5 text-xs font-semibold text-violet-700 dark:border-violet-900/50 dark:bg-violet-950/30 dark:text-violet-300">
                    <Cpu size={14} />
                    ARV Source aktiv
                  </div>
                )}
              </div>
              <div className="mt-4 grid gap-3 md:grid-cols-2 xl:grid-cols-4">
                {story.scenes.map((scene, index) => {
                  const arvMeta = scene.arv;
                  const statusTone = scene.status === 'completed'
                    ? 'border-emerald-200 bg-emerald-50 text-emerald-700 dark:border-emerald-900/50 dark:bg-emerald-950/30 dark:text-emerald-300'
                    : scene.status === 'error'
                      ? 'border-red-200 bg-red-50 text-red-700 dark:border-red-900/50 dark:bg-red-950/30 dark:text-red-300'
                      : scene.status === 'generating'
                        ? 'border-indigo-200 bg-indigo-50 text-indigo-700 dark:border-indigo-900/50 dark:bg-indigo-950/30 dark:text-indigo-300'
                        : 'border-stone-200 bg-white text-stone-600 dark:border-zinc-700 dark:bg-zinc-900 dark:text-stone-300';

                  return (
                    <button
                      key={scene.id}
                      type="button"
                      onClick={() => document.getElementById(`story-scene-${scene.id}`)?.scrollIntoView({ behavior: 'smooth', block: 'start' })}
                      className="rounded-2xl border border-stone-200 dark:border-zinc-800 bg-white dark:bg-zinc-900 p-4 text-left shadow-sm transition-all hover:-translate-y-0.5 hover:border-indigo-300 dark:hover:border-indigo-700"
                    >
                      <div className="flex items-center justify-between gap-3">
                        <span className="text-xs font-semibold uppercase tracking-[0.18em] text-stone-500 dark:text-stone-400">Szene {index + 1}</span>
                        <span className={`rounded-full border px-2 py-1 text-[10px] font-semibold uppercase tracking-[0.18em] ${statusTone}`}>
                          {scene.status === 'completed' ? 'Done' : scene.status === 'error' ? 'Error' : scene.status === 'generating' ? 'Running' : 'Ready'}
                        </span>
                      </div>
                      <div className="mt-3 text-sm font-semibold text-stone-900 dark:text-stone-100">
                        {getStorySceneBeatLabel(scene.sceneBeat, 'de')}
                      </div>
                      {arvMeta ? (
                        <>
                          <div className={`mt-3 inline-flex items-center rounded-full border px-2.5 py-1 text-[10px] font-semibold uppercase tracking-[0.18em] ${ARV_PHASE_BADGE_STYLES[arvMeta.phase]}`}>
                            {ARV_PHASE_LABELS[arvMeta.phase]} · {arvMeta.sceneNumber}
                          </div>
                          <div className="mt-3 text-sm font-semibold text-stone-800 dark:text-stone-200 line-clamp-2">{arvMeta.sceneTitle}</div>
                          <p className="mt-2 text-xs leading-5 text-stone-600 dark:text-stone-400 line-clamp-3">{arvMeta.narration}</p>
                        </>
                      ) : (
                        <p className="mt-3 text-xs leading-5 text-stone-600 dark:text-stone-400 line-clamp-4">{scene.action}</p>
                      )}
                    </button>
                  );
                })}
              </div>
            </div>
                <span className="font-semibold text-stone-700 dark:text-stone-300">Setting:</span> {story.settingDescription}
              </div>
              <div className="bg-stone-50 dark:bg-zinc-800/50 p-3 rounded-lg">
                <span className="font-semibold text-stone-700 dark:text-stone-300">Charaktere:</span> {story.characterDefinition}
              </div>
              {story.visualDNA && (
                <div className="bg-stone-50 dark:bg-zinc-800/50 p-3 rounded-lg">
                  <span className="font-semibold text-stone-700 dark:text-stone-300">Visual DNA:</span> {story.visualDNA}
                </div>
              )}
              {story.colorPalette && (
                <div className="bg-stone-50 dark:bg-zinc-800/50 p-3 rounded-lg">
                  <span className="font-semibold text-stone-700 dark:text-stone-300">Color Palette:</span> {story.colorPalette}
                </div>
              )}
              {story.motionGrammar && (
                <div className="bg-stone-50 dark:bg-zinc-800/50 p-3 rounded-lg">
                  <span className="font-semibold text-stone-700 dark:text-stone-300">Motion Grammar:</span> {story.motionGrammar}
                </div>
              )}
              {story.negativePrompt && (
                <div className="bg-stone-950 text-stone-100 dark:bg-black p-3 rounded-lg border border-stone-800 font-mono text-xs leading-6">
                  <span className="font-semibold text-stone-300">Negative Prompt:</span> {story.negativePrompt}
                </div>
              )}
            </div>

            <div className="flex flex-col gap-2">
              <button
                onClick={handleGenerateAllPending}
                disabled={isAnyGenerating || !story.scenes.some(s => s.status !== 'completed' || !s.gifData)}
                className="w-full py-3 px-4 rounded-xl bg-stone-900 dark:bg-white text-white dark:text-stone-900 font-bold transition-all flex items-center justify-center gap-2 hover:bg-stone-800 dark:hover:bg-stone-100 disabled:opacity-40 text-sm"
              >
                {isAnyGenerating ? <Loader2 className="animate-spin" size={16} /> : <Film size={16} />}
                Alle ausstehenden generieren
              </button>
              {story.scenes.some(s => s.status === 'completed' && s.gifData) && (
                <button
                  onClick={handleDownloadZip}
                  disabled={isDownloadingZip}
                  className="w-full py-2.5 px-4 rounded-xl bg-emerald-600 text-white font-bold transition-all flex items-center justify-center gap-2 hover:bg-emerald-700 text-sm disabled:opacity-50"
                >
                  {isDownloadingZip ? <Loader2 className="animate-spin" size={16} /> : <Download size={16} />}
                  {isDownloadingZip ? 'ZIP wird vorbereitet...' : 'ZIP herunterladen'}
                </button>
              )}
            </div>
          </div>
        )}
      </div>

      {/* Szenen — Einzeln bearbeiten & generieren */}
      {story && (
        <div className="space-y-4 mt-8">
          <h3 className="text-xl font-bold flex items-center gap-2">
            <Film size={20} />
            Storyboard Szenen ({story.scenes.length})
          </h3>
          <div className="flex flex-col gap-5">
            {story.scenes.map((scene, index) => {
              const isGenerating = generatingSceneIds.has(scene.id);
              const isRewriting = rewritingSceneIds.has(scene.id);
              const isEditing = editingSceneIds.has(scene.id);
              const draft = scenePromptDrafts[scene.id] ?? scene.finalPrompt;
              const arvMeta = scene.arv;
              const sceneVideoPromptDebug = sceneVideoPromptDebugs[scene.id];

              return (
                <div id={`story-scene-${scene.id}`} key={scene.id} className="bg-white dark:bg-zinc-900 border border-stone-200 dark:border-zinc-800 rounded-2xl overflow-hidden flex flex-col shadow-sm scroll-mt-24">
                  {/* Header */}
                  <div className="px-5 py-3 border-b border-stone-100 dark:border-zinc-800 flex justify-between items-center bg-stone-50 dark:bg-zinc-900/60">
                    <div className="flex items-center gap-3 flex-wrap">
                      <span className="font-bold text-stone-800 dark:text-stone-200 flex items-center gap-2">
                        <Film size={15} className="text-indigo-500" />
                        Szene {index + 1}
                      </span>
                      <span className="text-[11px] uppercase tracking-[0.18em] px-2.5 py-1 rounded-full border border-indigo-200 dark:border-indigo-900/50 bg-indigo-50 dark:bg-indigo-950/30 text-indigo-600 dark:text-indigo-300 font-semibold">
                        {getStorySceneBeatLabel(scene.sceneBeat, 'de')}
                      </span>
                      {arvMeta && (
                        <span className={`text-[11px] uppercase tracking-[0.18em] px-2.5 py-1 rounded-full border font-semibold ${ARV_PHASE_BADGE_STYLES[arvMeta.phase]}`}>
                          {ARV_PHASE_LABELS[arvMeta.phase]} · {arvMeta.sceneNumber}
                        </span>
                      )}
                    </div>
                    <div className="flex items-center gap-2">
                      {isGenerating && (
                        <span className="text-xs px-2.5 py-1 rounded-full bg-indigo-100 dark:bg-indigo-900/30 text-indigo-600 dark:text-indigo-400 flex items-center gap-1.5">
                          <Loader2 size={11} className="animate-spin" /> {isRewriting ? 'Azure schreibt…' : 'Generiert…'}
                        </span>
                      )}
                      {!isGenerating && scene.status === 'pending' && (
                        <span className="text-xs px-2.5 py-1 rounded-full bg-stone-200 dark:bg-zinc-700 text-stone-600 dark:text-stone-300">Bereit</span>
                      )}
                      {!isGenerating && scene.status === 'completed' && (
                        <>
                          <span className="text-xs px-2.5 py-1 rounded-full bg-emerald-100 dark:bg-emerald-900/30 text-emerald-700 dark:text-emerald-400 flex items-center gap-1.5">
                            <CheckCircle2 size={11} /> Fertig
                          </span>
                          <button onClick={() => handleDownloadSingle(scene, index)} className="p-1 text-stone-400 hover:text-stone-900 dark:hover:text-white transition-colors" title="Szene herunterladen">
                            <Download size={14} />
                          </button>
                        </>
                      )}
                      {!isGenerating && scene.status === 'error' && (
                        <span className="text-xs px-2.5 py-1 rounded-full bg-red-100 dark:bg-red-900/30 text-red-600 dark:text-red-400 flex items-center gap-1.5">
                          <AlertCircle size={11} /> Fehler
                        </span>
                      )}
                    </div>
                  </div>

                  {/* Body */}
                  <div className="p-5 flex flex-col gap-4">
                    {/* Action / Motion Info */}
                    <div className="space-y-1.5 text-sm">
                      <p className="text-[11px] uppercase tracking-[0.18em] text-indigo-500 dark:text-indigo-300 font-semibold">
                        Beat: {getStorySceneBeatLabel(scene.sceneBeat, 'de')} · {scene.sceneBeat}
                      </p>
                      <p className="text-stone-700 dark:text-stone-300"><span className="font-semibold">Aktion:</span> {scene.action}</p>
                      <p className="text-stone-500 dark:text-stone-400 text-xs"><span className="font-medium text-stone-600 dark:text-stone-400">Motion:</span> {scene.motionDescription}</p>
                    </div>

                    {arvMeta && (
                      <div className="rounded-xl border border-violet-200/70 bg-violet-50/80 dark:border-violet-900/50 dark:bg-violet-950/20 p-4 text-sm">
                        <div className="flex flex-col gap-3 md:flex-row md:items-start md:justify-between">
                          <div>
                            <div className="text-[11px] uppercase tracking-[0.18em] text-violet-600 dark:text-violet-300 font-semibold">ARV Source Layer</div>
                            <div className="mt-2 font-semibold text-stone-900 dark:text-stone-100">{arvMeta.sceneTitle}</div>
                            <p className="mt-2 text-sm leading-6 text-stone-700 dark:text-stone-300">{arvMeta.narration}</p>
                          </div>
                          <div className="grid gap-2 text-xs min-w-[220px]">
                            <div className="rounded-lg bg-white/80 dark:bg-zinc-950/60 border border-violet-100 dark:border-violet-900/40 px-3 py-2">
                              <span className="font-semibold text-stone-600 dark:text-stone-300">Phase:</span> {ARV_PHASE_LABELS[arvMeta.phase]} · {arvMeta.sceneNumber}
                            </div>
                            <div className="rounded-lg bg-white/80 dark:bg-zinc-950/60 border border-violet-100 dark:border-violet-900/40 px-3 py-2">
                              <span className="font-semibold text-stone-600 dark:text-stone-300">Sequenz:</span> {arvMeta.sequenceTitle}
                            </div>
                            {arvMeta.characterId && (
                              <div className="rounded-lg bg-white/80 dark:bg-zinc-950/60 border border-violet-100 dark:border-violet-900/40 px-3 py-2">
                                <span className="font-semibold text-stone-600 dark:text-stone-300">Charakter:</span> {arvMeta.characterId}
                              </div>
                            )}
                          </div>
                        </div>
                      </div>
                    )}

                    {/* GIF-Vorschau */}
                    {scene.gifData && !isEditing && (
                      <div className="rounded-xl overflow-hidden border border-stone-100 dark:border-zinc-800 bg-stone-50 dark:bg-zinc-950 flex justify-center">
                        <img src={scene.gifData} alt={`Szene ${index + 1}`} className="max-h-56 object-contain" />
                      </div>
                    )}

                    {(scene.videoId || scene.remixedFromVideoId) && (
                      <div className="rounded-xl border border-stone-200 dark:border-zinc-800 bg-stone-50/80 dark:bg-zinc-950/40 p-4 text-xs text-stone-600 dark:text-stone-300 space-y-1.5">
                        {scene.videoId && <div><span className="font-semibold">Video-ID:</span> {scene.videoId}</div>}
                        {scene.remixedFromVideoId && <div><span className="font-semibold">{scene.videoTransformMode === 'extend' ? 'Extension von:' : 'Remix von:'}</span> {scene.remixedFromVideoId}</div>}
                      </div>
                    )}

                    {/* Fehlermeldung */}
                    {scene.error && (
                      <div className="text-xs p-3 rounded-lg bg-red-50 dark:bg-red-900/20 text-red-600 dark:text-red-400 border border-red-100 dark:border-red-900/40">
                        {scene.error}
                      </div>
                    )}

                    {/* Prompt-Bearbeitung */}
                    {(scene.status === 'pending' || scene.status === 'error' || isEditing) && !isGenerating && (
                      <div className="flex flex-col gap-2">
                        <label className="text-xs font-semibold text-stone-600 dark:text-stone-400 uppercase tracking-wide">
                          Prompt bearbeiten
                        </label>
                        <textarea
                          value={draft}
                          onChange={e => setScenePromptDrafts(prev => ({ ...prev, [scene.id]: e.target.value }))}
                          rows={5}
                          className="w-full p-3 rounded-xl text-sm font-mono border border-stone-200 dark:border-zinc-700 bg-stone-50 dark:bg-zinc-950 text-stone-800 dark:text-stone-200 resize-y focus:outline-none focus:ring-2 focus:ring-indigo-400 dark:focus:ring-indigo-600"
                          placeholder="Prompt für diese Szene…"
                        />
                      </div>
                    )}

                    {/* Kollabierter Prompt-Anzeige (completed, nicht im Edit-Modus) */}
                    {scene.status === 'completed' && !isEditing && (
                      <details className="text-xs">
                        <summary className="cursor-pointer text-indigo-500 dark:text-indigo-400 font-medium select-none">Prompt anzeigen</summary>
                        <pre className="mt-2 p-3 bg-stone-100 dark:bg-zinc-950 rounded-lg text-xs overflow-x-auto whitespace-pre-wrap text-stone-600 dark:text-stone-400 border border-stone-200 dark:border-zinc-800">
                          {scene.finalPrompt}
                        </pre>
                      </details>
                    )}

                    {sceneVideoPromptDebug && (
                      <details className="rounded-xl border border-stone-200 dark:border-zinc-800 bg-stone-50/80 dark:bg-zinc-950/40 p-4 text-xs">
                        <summary className="cursor-pointer font-semibold text-stone-700 dark:text-stone-200 select-none">
                          Prompt-Debug
                        </summary>
                        <div className="mt-3 grid gap-3">
                          <div>
                            <div className="text-[11px] uppercase tracking-[0.18em] text-stone-500 dark:text-stone-400 font-semibold">Rohprompt</div>
                            <pre className="mt-2 whitespace-pre-wrap rounded-lg border border-stone-200 dark:border-zinc-800 bg-white dark:bg-zinc-900 p-3 leading-6 text-stone-700 dark:text-stone-300 overflow-x-auto">
                              {sceneVideoPromptDebug.rawPrompt}
                            </pre>
                          </div>
                          <div>
                            <div className="text-[11px] uppercase tracking-[0.18em] text-indigo-500 dark:text-indigo-300 font-semibold">Bereinigt</div>
                            <pre className="mt-2 whitespace-pre-wrap rounded-lg border border-indigo-200/70 dark:border-indigo-900/50 bg-indigo-50/80 dark:bg-indigo-950/20 p-3 leading-6 text-stone-800 dark:text-stone-100 overflow-x-auto">
                              {sceneVideoPromptDebug.cleanedPrompt}
                            </pre>
                          </div>
                          <div>
                            <div className="text-[11px] uppercase tracking-[0.18em] text-stone-500 dark:text-stone-400 font-semibold">Finaler Modellprompt</div>
                            <pre className="mt-2 max-h-72 overflow-auto whitespace-pre-wrap rounded-lg border border-stone-200 dark:border-zinc-800 bg-white dark:bg-zinc-900 p-3 leading-6 text-stone-700 dark:text-stone-300">
                              {sceneVideoPromptDebug.finalPrompt}
                            </pre>
                          </div>
                          {(sceneVideoPromptDebug.renderMode || sceneVideoPromptDebug.sourceVideoId || sceneVideoPromptDebug.resultVideoId) && (
                            <div className="rounded-lg border border-stone-200 dark:border-zinc-800 bg-white dark:bg-zinc-900 px-3 py-2 text-stone-600 dark:text-stone-300">
                              Rendermodus: {sceneVideoPromptDebug.renderMode === 'extend' ? 'Extension' : sceneVideoPromptDebug.renderMode === 'remix' ? 'Remix' : 'Neurender'}
                              {sceneVideoPromptDebug.sourceVideoId ? ` · Quelle: ${sceneVideoPromptDebug.sourceVideoId}` : ''}
                              {sceneVideoPromptDebug.resultVideoId ? ` · Ergebnis: ${sceneVideoPromptDebug.resultVideoId}` : ''}
                            </div>
                          )}
                          {sceneVideoPromptDebug.iqBrief && (
                            <div>
                              <div className="text-[11px] uppercase tracking-[0.18em] text-emerald-500 dark:text-emerald-300 font-semibold">
                                IQ Brief · {sceneVideoPromptDebug.iqBrief.usedRemote ? 'Foundry IQ' : 'Workspace KB'}
                              </div>
                              <pre className="mt-2 whitespace-pre-wrap rounded-lg border border-emerald-200/70 dark:border-emerald-900/50 bg-emerald-50/80 dark:bg-emerald-950/20 p-3 leading-6 text-stone-800 dark:text-stone-100 overflow-x-auto">
                                {sceneVideoPromptDebug.iqBrief.promptBlock}
                              </pre>
                              {sceneVideoPromptDebug.iqBrief.citations.length > 0 && (
                                <div className="mt-2 space-y-2">
                                  {sceneVideoPromptDebug.iqBrief.citations.map((citation) => (
                                    <div key={`${citation.source}-${citation.excerpt.slice(0, 24)}`} className="rounded-lg border border-stone-200 dark:border-zinc-800 bg-white dark:bg-zinc-900 p-3">
                                      <div className="font-semibold text-stone-700 dark:text-stone-200">{citation.source}</div>
                                      <div className="mt-1 text-stone-600 dark:text-stone-300">{citation.excerpt}</div>
                                    </div>
                                  ))}
                                </div>
                              )}
                            </div>
                          )}
                        </div>
                      </details>
                    )}

                    {/* Aktions-Buttons */}
                    <div className="flex gap-2 flex-wrap">
                      {/* Pending / Error: Generieren-Button */}
                      {(scene.status === 'pending' || scene.status === 'error') && !isGenerating && (
                        <button
                          onClick={() => handleGenerateScene(index)}
                          className="flex-1 py-2.5 px-4 rounded-xl bg-indigo-600 hover:bg-indigo-700 text-white font-bold text-sm flex items-center justify-center gap-2 transition-all"
                        >
                          <Film size={15} />
                          {scene.status === 'error' ? 'Erneut versuchen' : 'Szene generieren'}
                        </button>
                      )}

                      {/* Completed + kein Edit-Modus: Bearbeiten & Neu generieren */}
                      {scene.status === 'completed' && !isEditing && !isGenerating && (
                        <>
                          <button
                            onClick={() => {
                              setEditingSceneIds(prev => new Set([...prev, scene.id]));
                              setScenePromptDrafts(prev => ({ ...prev, [scene.id]: scene.finalPrompt }));
                            }}
                            className="flex-1 py-2.5 px-4 rounded-xl border border-stone-300 dark:border-zinc-600 text-stone-700 dark:text-stone-300 hover:bg-stone-100 dark:hover:bg-zinc-800 font-medium text-sm flex items-center justify-center gap-2 transition-all"
                          >
                            <RefreshCw size={14} />
                            Prompt bearbeiten & neu generieren
                          </button>
                          {scene.videoId && (
                            <>
                              <button
                                onClick={() => handleGenerateScene(index, { remixVideoId: scene.videoId, videoTransform: 'remix' })}
                                className="py-2.5 px-4 rounded-xl border border-emerald-300 dark:border-emerald-700 text-emerald-700 dark:text-emerald-300 hover:bg-emerald-50 dark:hover:bg-emerald-950/20 font-medium text-sm flex items-center justify-center gap-2 transition-all"
                              >
                                <RefreshCw size={14} />
                                Remix
                              </button>
                              <button
                                onClick={() => handleGenerateScene(index, { remixVideoId: scene.videoId, videoTransform: 'extend' })}
                                className="py-2.5 px-4 rounded-xl border border-sky-300 dark:border-sky-700 text-sky-700 dark:text-sky-300 hover:bg-sky-50 dark:hover:bg-sky-950/20 font-medium text-sm flex items-center justify-center gap-2 transition-all"
                              >
                                <ChevronsDown size={14} />
                                Extend
                              </button>
                            </>
                          )}
                        </>
                      )}

                      {/* Edit-Modus (completed): Neu generieren + Abbrechen */}
                      {scene.status === 'completed' && isEditing && !isGenerating && (
                        <>
                          <button
                            onClick={() => handleGenerateScene(index, { rewriteWithAzure: true })}
                            className="flex-1 py-2.5 px-4 rounded-xl bg-indigo-600 hover:bg-indigo-700 text-white font-bold text-sm flex items-center justify-center gap-2 transition-all"
                          >
                            <RefreshCw size={14} />
                            Neu generieren
                          </button>
                          <button
                            onClick={() => setEditingSceneIds(prev => { const ns = new Set(prev); ns.delete(scene.id); return ns; })}
                            className="py-2.5 px-4 rounded-xl border border-stone-300 dark:border-zinc-600 text-stone-600 dark:text-stone-400 hover:bg-stone-100 dark:hover:bg-zinc-800 text-sm transition-all"
                          >
                            Abbrechen
                          </button>
                          {scene.videoId && (
                            <>
                              <button
                                onClick={() => handleGenerateScene(index, { remixVideoId: scene.videoId, videoTransform: 'remix' })}
                                className="py-2.5 px-4 rounded-xl border border-emerald-300 dark:border-emerald-700 text-emerald-700 dark:text-emerald-300 hover:bg-emerald-50 dark:hover:bg-emerald-950/20 text-sm transition-all"
                              >
                                Remix
                              </button>
                              <button
                                onClick={() => handleGenerateScene(index, { remixVideoId: scene.videoId, videoTransform: 'extend' })}
                                className="py-2.5 px-4 rounded-xl border border-sky-300 dark:border-sky-700 text-sky-700 dark:text-sky-300 hover:bg-sky-50 dark:hover:bg-sky-950/20 text-sm transition-all"
                              >
                                Extend
                              </button>
                            </>
                          )}
                        </>
                      )}

                      {scene.status === 'error' && !isGenerating && scene.videoId && (
                        <>
                          <button
                            onClick={() => handleGenerateScene(index, { remixVideoId: scene.videoId, videoTransform: 'remix' })}
                            className="py-2.5 px-4 rounded-xl border border-emerald-300 dark:border-emerald-700 text-emerald-700 dark:text-emerald-300 hover:bg-emerald-50 dark:hover:bg-emerald-950/20 text-sm transition-all"
                          >
                            Remix aus Video-ID
                          </button>
                          <button
                            onClick={() => handleGenerateScene(index, { remixVideoId: scene.videoId, videoTransform: 'extend' })}
                            className="py-2.5 px-4 rounded-xl border border-sky-300 dark:border-sky-700 text-sky-700 dark:text-sky-300 hover:bg-sky-50 dark:hover:bg-sky-950/20 text-sm transition-all"
                          >
                            Extend aus Video-ID
                          </button>
                        </>
                      )}

                      {/* Generating: Lade-Indicator */}
                      {isGenerating && (
                        <div className="flex-1 py-2.5 px-4 rounded-xl bg-stone-100 dark:bg-zinc-800 text-stone-500 dark:text-stone-400 text-sm flex items-center justify-center gap-2">
                          <Loader2 size={15} className="animate-spin" />
                          {isRewriting ? 'Prompt wird mit Azure neu geschrieben…' : 'Wird generiert…'}
                        </div>
                      )}
                    </div>
                  </div>
                </div>
              );
            })}
          </div>
        </div>
      )}
    </div>
  );
}

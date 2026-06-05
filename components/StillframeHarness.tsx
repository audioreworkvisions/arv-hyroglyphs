import React, { useCallback, useEffect, useRef, useState } from 'react';
import {
  ArrowLeft,
  BookOpen,
  Camera,
  ChevronsDown,
  CheckCircle2,
  Copy,
  Download,
  Film,
  ImagePlus,
  Loader2,
  RefreshCw,
  Sparkles,
  Tags,
  TriangleAlert,
  X,
} from 'lucide-react';
import { ARV_CHARACTERS } from '../lib/arvCharacters';
import type { ARVSatireSketch } from '../lib/arvTypes';
import { PROMPT_TEMPLATES } from '../lib/promptTemplates';
import {
  DEFAULT_STILLFRAME_SATIRE_PRESET_PROFILE_ID,
  getStillframeSatireElement,
  getStillframeSatirePresetProfile,
  STILLFRAME_SATIRE_ELEMENT_OPTIONS,
  STILLFRAME_SATIRE_PRESET_PROFILES,
  type StillframeSatireElementCategory,
} from '../lib/stillframeSatire';
import { saveItem, type LibraryIdeaItem } from '../lib/libraryDB';

// ── Types ────────────────────────────────────────────────────────────────────

type BeatType = 'freeze' | 'onset' | 'hold' | 'return';
type AssetStatus = 'idle' | 'loading' | 'converting' | 'done' | 'error';
type GenerationMode = 'ritual' | 'satire';
type VideoTransformMode = 'remix' | 'extend';
type VideoRenderMode = 'create' | VideoTransformMode;

interface SceneBeat {
  beat: BeatType;
  title: string;
  prompt: string;
  motion: string;
}

interface SceneState {
  beat: BeatType;
  title: string;
  prompt: string;
  motion: string;
  polishStatus: AssetStatus;
  sketchStatus: AssetStatus;
  sketchData: string | null;
  videoStatus: AssetStatus;
  videoId: string | null;
  remixedFromVideoId: string | null;
  videoTransformMode: VideoTransformMode | null;
  videoBase64: string | null;
  gifData: string | null;
  errorPolish: string | null;
  errorSketch: string | null;
  errorVideo: string | null;
  renderPromptDebug: StillframeRenderPromptDebug | null;
}

interface StillframeStylePresetSummary {
  id: string;
  name: string;
  visualIdentity: string;
  colorPalette: string;
  lighting: string;
  motionStyle: string;
  shortPrompt: string;
}

interface StillframeReferenceStyleSummary {
  summary: string;
  subjectFocus: string;
  palette: string;
  motion: string;
  promptDNA: string;
  keywords: string[];
}

interface StillframeRenderPromptDebug {
  target: 'sketch' | 'video';
  rawPrompt: string;
  cleanedPrompt: string;
  finalPrompt: string;
  beatStyle?: string;
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
  stylePresetIds: string[];
  referenceStyleSummary?: string | null;
}

interface ReferenceImageAsset {
  id: string;
  name: string;
  mimeType: 'image/png' | 'image/gif';
  source: 'png' | 'gif';
  previewDataUrl: string;
  analysisDataUrl: string;
  width: number;
  height: number;
}

interface StillframeIdeaVision {
  title: string;
  theme: string;
  character: string;
  event: string;
  action: string;
  story: string;
  style: string;
  promptSeed: string;
  presetSeed: string;
}

interface StillframeIdeaPack {
  mode: GenerationMode;
  themes: string[];
  characters: string[];
  events: string[];
  actions: string[];
  stories: string[];
  styles: string[];
  promptSeeds: string[];
  presetSeeds: string[];
  visions: StillframeIdeaVision[];
  clipboardText: string;
}

interface StillframeIdeaRemixPayload {
  mode?: GenerationMode;
  seed?: string;
  sourceTitle?: string;
  referenceStyle?: Partial<StillframeReferenceStyleSummary> | null;
}

type StillframeIdeaListKey = 'themes' | 'characters' | 'events' | 'actions' | 'stories' | 'styles' | 'promptSeeds' | 'presetSeeds';

// ── Constants ────────────────────────────────────────────────────────────────

const BEAT_LABELS: Record<BeatType, string> = {
  freeze: '① Freeze',
  onset: '② Onset',
  hold: '③ Hold',
  return: '④ Return',
};

const BEAT_COLORS: Record<BeatType, string> = {
  freeze: 'bg-cobalt/20 text-[#7db4e8] border-[#3a6090]/50',
  onset: 'bg-[#1a2e1a]/60 text-[#72d9a0] border-[#2a5a3a]/50',
  hold: 'bg-[#2a1a00]/60 text-[#e8a94a] border-[#6a4010]/50',
  return: 'bg-[#1a0e2a]/60 text-[#b08af0] border-[#4a2a80]/50',
};

const BEAT_RING: Record<BeatType, string> = {
  freeze: 'border-[#3a6090]/40',
  onset: 'border-[#2a5a3a]/40',
  hold: 'border-[#6a4010]/40',
  return: 'border-[#4a2a80]/40',
};

const PLACEHOLDER_CONCEPTS = [
  'A suspended glass engine breathing over a dark floor grid',
  'A miniature weather system forming above a silent machine basin',
  'A signal aperture opening once inside a fogged steel chamber',
  'A kinetic structure folding light through dust and residue',
  'A synthetic organism drifting through a restrained industrial void',
];

// Group templates by category for the dropdown
const TEMPLATE_OPTIONS = PROMPT_TEMPLATES.reduce<{ category: string; options: { id: string; label: string; prompt: string }[] }[]>(
  (acc, t) => {
    let group = acc.find((g) => g.category === t.category);
    if (!group) { group = { category: t.category, options: [] }; acc.push(group); }
    group.options.push({ id: t.id, label: t.label, prompt: t.prompt });
    return acc;
  },
  [],
);

const SATIRE_ELEMENT_CATEGORY_ORDER: StillframeSatireElementCategory[] = ['subject', 'surface', 'motion', 'transformation'];
const STILLFRAME_IDEA_REMIX_STORAGE_KEY = 'hyroglyphis:stillframe-ideas-remix';
const SATIRE_ELEMENT_CATEGORY_LABELS: Record<StillframeSatireElementCategory, string> = {
  subject: 'Subjekt',
  surface: 'Oberflaeche',
  motion: 'Bewegung',
  transformation: 'Transformation',
};

const MIN_KEYWORDS = 3;
const MAX_KEYWORDS = 5;
const MAX_REFERENCE_STYLE_KEYWORDS = 8;
const MAX_REFERENCE_IMAGES = 4;
const MAX_REFERENCE_FILE_BYTES = 15 * 1024 * 1024;
const REFERENCE_ANALYSIS_MAX_DIMENSION = 1024;

const IDEA_SECTION_CONFIG: Array<{ key: StillframeIdeaListKey; label: string; useTarget?: 'ritual' | 'satire' | 'both' }> = [
  { key: 'themes', label: 'Themen' },
  { key: 'characters', label: 'Charaktere' },
  { key: 'events', label: 'Ereignisse' },
  { key: 'actions', label: 'Handlungen' },
  { key: 'stories', label: 'Geschichten', useTarget: 'both' },
  { key: 'styles', label: 'Styles' },
  { key: 'promptSeeds', label: 'Prompt Seeds', useTarget: 'both' },
  { key: 'presetSeeds', label: 'Preset Seeds' },
];

const parseKeywords = (value: string): string[] =>
  value
    .split(/[\n,]/)
    .map((entry) => entry.trim())
    .filter((entry) => entry.length > 0);

const mergeLimitedTokens = (currentValues: string[], draftValue: string, limit: number): string[] =>
  Array.from(new Set([...currentValues, ...parseKeywords(draftValue)])).slice(0, limit);

const mergeKeywords = (currentKeywords: string[], draftValue: string): string[] =>
  mergeLimitedTokens(currentKeywords, draftValue, MAX_KEYWORDS);

const buildStillframeIQContext = (
  scenes: SceneState[],
  index: number,
  storyTitle: string,
  storyConcept: string,
  referenceStyle: StillframeReferenceStyleSummary | null,
  stylePresets: StillframeStylePresetSummary[],
  remixVideoId?: string | null,
  videoTransform?: VideoTransformMode | null,
) => {
  const scene = scenes[index];
  return {
    mode: 'stillframe' as const,
    renderTarget: 'video' as const,
    purpose: videoTransform ?? (remixVideoId ? 'remix' as const : 'create' as const),
    prompt: scene?.prompt || '',
    sceneIndex: index,
    sceneTitle: scene?.title,
    sceneBeat: scene?.beat,
    action: scene?.prompt,
    motion: scene?.motion,
    storyTitle: storyTitle.trim() || undefined,
    storyConcept: storyConcept.trim() || undefined,
    referenceStyleSummary: referenceStyle?.summary ?? null,
    referenceStylePalette: referenceStyle?.palette ?? null,
    referenceStyleMotion: referenceStyle?.motion ?? null,
    stylePresetIds: stylePresets.map((preset) => preset.id),
    remixVideoId: remixVideoId ?? null,
    chronology: scenes.slice(0, index + 1).map((entry, sceneIndex) => ({
      sceneIndex,
      sceneTitle: entry.title,
      sceneBeat: entry.beat,
      action: entry.prompt,
      continuityNotes: entry.motion,
    })),
  };
};

const resolveVideoTransformMode = (
  remixVideoId?: string | null,
  requestedMode?: VideoTransformMode | null,
): VideoTransformMode | null => {
  if (!remixVideoId?.trim()) {
    return null;
  }

  return requestedMode === 'extend' ? 'extend' : 'remix';
};

// ── Helpers ──────────────────────────────────────────────────────────────────

const downloadDataUrl = (dataUrl: string, filename: string) => {
  const a = document.createElement('a');
  a.href = dataUrl;
  a.download = filename;
  a.click();
};

const copyText = async (value: string): Promise<boolean> => {
  try {
    if (navigator.clipboard?.writeText) {
      await navigator.clipboard.writeText(value);
      return true;
    }

    const textarea = document.createElement('textarea');
    textarea.value = value;
    textarea.setAttribute('readonly', 'true');
    textarea.style.position = 'fixed';
    textarea.style.opacity = '0';
    document.body.appendChild(textarea);
    textarea.select();
    const success = document.execCommand('copy');
    document.body.removeChild(textarea);
    return success;
  } catch {
    return false;
  }
};

const readFileAsDataUrl = (file: File): Promise<string> => new Promise((resolve, reject) => {
  const reader = new FileReader();
  reader.onload = () => {
    if (typeof reader.result !== 'string') {
      reject(new Error('Datei konnte nicht gelesen werden.'));
      return;
    }
    resolve(reader.result);
  };
  reader.onerror = () => reject(reader.error || new Error('Datei konnte nicht gelesen werden.'));
  reader.readAsDataURL(file);
});

const loadImageFromDataUrl = (dataUrl: string): Promise<HTMLImageElement> => new Promise((resolve, reject) => {
  const image = new Image();
  image.onload = () => resolve(image);
  image.onerror = () => reject(new Error('Bild konnte nicht geladen werden.'));
  image.src = dataUrl;
});

const rasterizeImageForAnalysis = async (dataUrl: string): Promise<{ analysisDataUrl: string; width: number; height: number }> => {
  const image = await loadImageFromDataUrl(dataUrl);
  const largestDimension = Math.max(image.naturalWidth || 1, image.naturalHeight || 1);
  const scale = Math.min(1, REFERENCE_ANALYSIS_MAX_DIMENSION / largestDimension);
  const width = Math.max(1, Math.round((image.naturalWidth || 1) * scale));
  const height = Math.max(1, Math.round((image.naturalHeight || 1) * scale));
  const canvas = document.createElement('canvas');
  canvas.width = width;
  canvas.height = height;

  const context = canvas.getContext('2d');
  if (!context) {
    throw new Error('Canvas-Kontext fuer Bildanalyse nicht verfuegbar.');
  }

  context.drawImage(image, 0, 0, width, height);
  return {
    analysisDataUrl: canvas.toDataURL('image/png'),
    width,
    height,
  };
};

const createReferenceId = () => `${Date.now()}-${Math.random().toString(36).slice(2, 8)}`;

const prepareReferenceImage = async (file: File): Promise<ReferenceImageAsset> => {
  if (file.type !== 'image/png' && file.type !== 'image/gif') {
    throw new Error(`${file.name}: Nur PNG und GIF werden unterstuetzt.`);
  }

  if (file.size > MAX_REFERENCE_FILE_BYTES) {
    throw new Error(`${file.name}: Datei ist groesser als 15 MB.`);
  }

  const previewDataUrl = await readFileAsDataUrl(file);
  const rasterizedImage = await rasterizeImageForAnalysis(previewDataUrl);

  return {
    id: createReferenceId(),
    name: file.name,
    mimeType: file.type === 'image/gif' ? 'image/gif' : 'image/png',
    source: file.type === 'image/gif' ? 'gif' : 'png',
    previewDataUrl,
    analysisDataUrl: rasterizedImage.analysisDataUrl,
    width: rasterizedImage.width,
    height: rasterizedImage.height,
  };
};

const initScenes = (beats: SceneBeat[]): SceneState[] =>
  beats.map((b) => ({
    ...b,
    polishStatus: 'idle',
    sketchStatus: 'idle',
    sketchData: null,
    videoStatus: 'idle',
    videoId: null,
    remixedFromVideoId: null,
    videoTransformMode: null,
    videoBase64: null,
    gifData: null,
    errorPolish: null,
    errorSketch: null,
    errorVideo: null,
    renderPromptDebug: null,
  }));

// ── Component ────────────────────────────────────────────────────────────────

interface StillframeHarnessProps {
  onNavigateBack: () => void;
}

export default function StillframeHarness({ onNavigateBack }: StillframeHarnessProps) {
  const [generationMode, setGenerationMode] = useState<GenerationMode>('ritual');
  const [outputMode, setOutputMode] = useState<GenerationMode | null>(null);
  const [concept, setConcept] = useState('');
  const [ideaSeed, setIdeaSeed] = useState('');
  const [keywordInput, setKeywordInput] = useState('');
  const [keywords, setKeywords] = useState<string[]>([]);
  const [referenceImages, setReferenceImages] = useState<ReferenceImageAsset[]>([]);
  const [satirePrompt, setSatirePrompt] = useState('');
  const [satirePresetProfileId, setSatirePresetProfileId] = useState<string>(DEFAULT_STILLFRAME_SATIRE_PRESET_PROFILE_ID);
  const [satireSelectedElementIds, setSatireSelectedElementIds] = useState<string[]>(
    getStillframeSatirePresetProfile(DEFAULT_STILLFRAME_SATIRE_PRESET_PROFILE_ID)?.defaultElementIds ?? [],
  );
  const [appliedSatirePresetProfileId, setAppliedSatirePresetProfileId] = useState<string | null>(null);
  const [appliedSatireElementIds, setAppliedSatireElementIds] = useState<string[]>([]);
  const [satireSketch, setSatireSketch] = useState<ARVSatireSketch | null>(null);
  const [selectedTemplateId, setSelectedTemplateId] = useState('');
  const [isGeneratingConcept, setIsGeneratingConcept] = useState(false);
  const [isGeneratingIdeas, setIsGeneratingIdeas] = useState(false);
  const [isSavingIdeaPack, setIsSavingIdeaPack] = useState(false);
  const [isPolishingAll, setIsPolishingAll] = useState(false);
  const [isSketchingAll, setIsSketchingAll] = useState(false);
  const [isRenderingAllVideos, setIsRenderingAllVideos] = useState(false);
  const [isPreparingReferences, setIsPreparingReferences] = useState(false);
  const [conceptError, setConceptError] = useState<string | null>(null);
  const [referenceError, setReferenceError] = useState<string | null>(null);
  const [ideasError, setIdeasError] = useState<string | null>(null);
  const [ideaPackSaveMessage, setIdeaPackSaveMessage] = useState<string | null>(null);
  const [storyTitle, setStoryTitle] = useState<string | null>(null);
  const [storyConcept, setStoryConcept] = useState<string | null>(null);
  const [stylePresets, setStylePresets] = useState<StillframeStylePresetSummary[]>([]);
  const [referenceStyle, setReferenceStyle] = useState<StillframeReferenceStyleSummary | null>(null);
  const [referenceKeywordInput, setReferenceKeywordInput] = useState('');
  const [ideaPack, setIdeaPack] = useState<StillframeIdeaPack | null>(null);
  const [tokenUsage, setTokenUsage] = useState<{ prompt: number; completion: number; total: number } | null>(null);
  const [runId, setRunId] = useState<string>('');
  const [subject, setSubject] = useState<string | null>(null);
  const [microMotion, setMicroMotion] = useState<string | null>(null);
  const [scenes, setScenes] = useState<SceneState[]>([]);
  const scenesRef = useRef<SceneState[]>([]);
  const inputRef = useRef<HTMLTextAreaElement>(null);
  const referenceInputRef = useRef<HTMLInputElement>(null);
  const didBootstrapIdeaRemixRef = useRef(false);

  const placeholderIndex = useRef(Math.floor(Math.random() * PLACEHOLDER_CONCEPTS.length));
  const pendingKeywords = mergeKeywords(keywords, keywordInput);
  const canGenerateConcept = Boolean(concept.trim()) || pendingKeywords.length >= MIN_KEYWORDS || referenceImages.length > 0;
  const selectedSatirePresetProfile = getStillframeSatirePresetProfile(satirePresetProfileId)
    ?? getStillframeSatirePresetProfile(DEFAULT_STILLFRAME_SATIRE_PRESET_PROFILE_ID)
    ?? STILLFRAME_SATIRE_PRESET_PROFILES[0]!;
  const displayedSatirePresetProfile = getStillframeSatirePresetProfile(appliedSatirePresetProfileId)
    ?? selectedSatirePresetProfile;
  const selectedSatireElements = satireSelectedElementIds
    .map((elementId) => getStillframeSatireElement(elementId))
    .filter((element): element is NonNullable<ReturnType<typeof getStillframeSatireElement>> => Boolean(element));
  const displayedSatireElements = (appliedSatireElementIds.length > 0 ? appliedSatireElementIds : satireSelectedElementIds)
    .map((elementId) => getStillframeSatireElement(elementId))
    .filter((element): element is NonNullable<ReturnType<typeof getStillframeSatireElement>> => Boolean(element));
  const canGenerateSatire = Boolean(selectedSatirePresetProfile);

  // keep ref in sync so handleSketchAll can read latest prompts
  const updateScene = useCallback(
    (index: number, patch: Partial<SceneState>) => {
      setScenes((prev) => {
        const next = prev.map((s, i) => (i === index ? { ...s, ...patch } : s));
        scenesRef.current = next;
        return next;
      });
    },
    [],
  );

  const flushKeywordInput = () => {
    if (!keywordInput.trim()) {
      return keywords;
    }

    const nextKeywords = mergeKeywords(keywords, keywordInput);
    setKeywords(nextKeywords);
    setKeywordInput('');
    return nextKeywords;
  };

  const handleKeywordKeyDown = (event: React.KeyboardEvent<HTMLInputElement>) => {
    if (event.key === 'Enter' || event.key === ',') {
      event.preventDefault();
      flushKeywordInput();
      return;
    }

    if (event.key === 'Backspace' && !keywordInput && keywords.length > 0) {
      event.preventDefault();
      setKeywords((previous) => previous.slice(0, -1));
    }
  };

  const handleRemoveKeyword = (keywordToRemove: string) => {
    setKeywords((previous) => previous.filter((keyword) => keyword !== keywordToRemove));
  };

  const handleReferenceFilesSelected = async (event: React.ChangeEvent<HTMLInputElement>) => {
    const files = Array.from(event.target.files ?? []);
    event.target.value = '';

    if (files.length === 0) {
      return;
    }

    if (referenceImages.length >= MAX_REFERENCE_IMAGES) {
      setReferenceError(`Maximal ${MAX_REFERENCE_IMAGES} Referenzbilder erlaubt.`);
      return;
    }

    setIsPreparingReferences(true);
    setReferenceError(null);

    const availableSlots = MAX_REFERENCE_IMAGES - referenceImages.length;
    const acceptedFiles = files.slice(0, availableSlots);

    const preparedImages: ReferenceImageAsset[] = [];
    const errors: string[] = [];

    for (const file of acceptedFiles) {
      try {
        preparedImages.push(await prepareReferenceImage(file));
      } catch (error: any) {
        errors.push(error?.message || `${file.name}: Referenzbild konnte nicht verarbeitet werden.`);
      }
    }

    if (preparedImages.length > 0) {
      setReferenceImages((previous) => [...previous, ...preparedImages].slice(0, MAX_REFERENCE_IMAGES));
      setReferenceStyle(null);
      setReferenceKeywordInput('');
    }

    if (files.length > availableSlots) {
      errors.unshift(`Es wurden nur ${availableSlots} weitere Referenzbilder uebernommen.`);
    }

    if (errors.length > 0) {
      setReferenceError(errors.join(' '));
    }

    setIsPreparingReferences(false);
  };

  const handleRemoveReferenceImage = (referenceId: string) => {
    setReferenceImages((previous) => previous.filter((referenceImage) => referenceImage.id !== referenceId));
    setReferenceStyle(null);
    setReferenceKeywordInput('');
    setReferenceError(null);
  };

  const handleReferenceStyleFieldChange = useCallback(
    (field: keyof Omit<StillframeReferenceStyleSummary, 'keywords'>, value: string) => {
      setReferenceStyle((previous) => (previous ? { ...previous, [field]: value } : previous));
    },
    [],
  );

  const flushReferenceKeywordInput = useCallback(() => {
    if (!referenceStyle) {
      setReferenceKeywordInput('');
      return [];
    }

    if (!referenceKeywordInput.trim()) {
      return referenceStyle.keywords;
    }

    const nextKeywords = mergeLimitedTokens(referenceStyle.keywords, referenceKeywordInput, MAX_REFERENCE_STYLE_KEYWORDS);
    setReferenceStyle((previous) => (previous ? { ...previous, keywords: nextKeywords } : previous));
    setReferenceKeywordInput('');
    return nextKeywords;
  }, [referenceKeywordInput, referenceStyle]);

  const handleReferenceKeywordKeyDown = (event: React.KeyboardEvent<HTMLInputElement>) => {
    if (event.key === 'Enter' || event.key === ',') {
      event.preventDefault();
      flushReferenceKeywordInput();
      return;
    }

    if (event.key === 'Backspace' && !referenceKeywordInput && referenceStyle && referenceStyle.keywords.length > 0) {
      event.preventDefault();
      setReferenceStyle((previous) => (previous ? { ...previous, keywords: previous.keywords.slice(0, -1) } : previous));
    }
  };

  const handleRemoveReferenceKeyword = useCallback((keywordToRemove: string) => {
    setReferenceStyle((previous) => (
      previous
        ? { ...previous, keywords: previous.keywords.filter((keyword) => keyword !== keywordToRemove) }
        : previous
    ));
  }, []);

  const applyIdeaToRitual = useCallback((value: string) => {
    setGenerationMode('ritual');
    setConcept(value);
    setConceptError(null);
    inputRef.current?.focus();
  }, []);

  const applyIdeaToSatire = useCallback((value: string) => {
    setGenerationMode('satire');
    setSatirePrompt(value);
    setConceptError(null);
  }, []);

  const serializeReferenceImages = useCallback(() => (
    referenceImages.map((referenceImage) => ({
      id: referenceImage.id,
      name: referenceImage.name,
      mimeType: referenceImage.mimeType,
      source: referenceImage.source,
      previewDataUrl: referenceImage.previewDataUrl,
      analysisDataUrl: referenceImage.analysisDataUrl,
    }))
  ), [referenceImages]);

  const buildReferenceStyleOverride = useCallback(() => (
    referenceImages.length > 0 && referenceStyle
      ? {
        summary: referenceStyle.summary,
        subjectFocus: referenceStyle.subjectFocus,
        palette: referenceStyle.palette,
        motion: referenceStyle.motion,
        promptDNA: referenceStyle.promptDNA,
        keywords: referenceStyle.keywords,
      }
      : undefined
  ), [referenceImages.length, referenceStyle]);

  const applyUsageSummary = useCallback((usage: any) => {
    if (!usage) {
      return;
    }

    setTokenUsage({
      prompt: usage.promptTokens ?? 0,
      completion: usage.completionTokens ?? 0,
      total: usage.totalTokens ?? 0,
    });
  }, []);

  const buildIdeaLibraryItem = useCallback((pack: StillframeIdeaPack): LibraryIdeaItem => {
    const trimmedSeed = ideaSeed.trim();
    return {
      id: `ideas-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`,
      type: 'ideas',
      createdAt: Date.now(),
      prompt: trimmedSeed || pack.stories[0] || pack.promptSeeds[0] || pack.themes[0] || 'Stillframe Ideenpack',
      title: trimmedSeed
        ? `Stillframe Ideenpack - ${trimmedSeed.slice(0, 72)}`
        : `Stillframe Ideenpack - ${pack.mode === 'satire' ? 'Satire' : 'Ritual'}`,
      mode: pack.mode,
      seed: trimmedSeed || undefined,
      referenceSummary: referenceStyle?.summary || undefined,
      clipboardText: pack.clipboardText,
      themes: pack.themes,
      characters: pack.characters,
      events: pack.events,
      actions: pack.actions,
      stories: pack.stories,
      styles: pack.styles,
      promptSeeds: pack.promptSeeds,
      presetSeeds: pack.presetSeeds,
      visions: pack.visions.map((vision) => ({ ...vision })),
    };
  }, [ideaSeed, referenceStyle]);

  const handleSaveIdeaPack = useCallback(async () => {
    if (!ideaPack || isSavingIdeaPack) {
      return;
    }

    setIsSavingIdeaPack(true);
    setIdeaPackSaveMessage(null);

    try {
      await saveItem(buildIdeaLibraryItem(ideaPack));
      setIdeaPackSaveMessage('Ideenpack in Bibliothek gespeichert.');
    } catch (error: any) {
      setIdeaPackSaveMessage(error?.message || 'Ideenpack konnte nicht gespeichert werden.');
    } finally {
      setIsSavingIdeaPack(false);
    }
  }, [buildIdeaLibraryItem, ideaPack, isSavingIdeaPack]);

  const normalizeRemixReferenceStyle = useCallback((value: Partial<StillframeReferenceStyleSummary> | null | undefined): StillframeReferenceStyleSummary | null => {
    if (!value) {
      return null;
    }

    const summary = typeof value.summary === 'string' ? value.summary.trim() : '';
    const subjectFocus = typeof value.subjectFocus === 'string' ? value.subjectFocus.trim() : '';
    const palette = typeof value.palette === 'string' ? value.palette.trim() : '';
    const motion = typeof value.motion === 'string' ? value.motion.trim() : '';
    const promptDNA = typeof value.promptDNA === 'string' ? value.promptDNA.trim() : '';
    const keywords = Array.isArray(value.keywords)
      ? value.keywords
        .filter((keyword): keyword is string => typeof keyword === 'string')
        .map((keyword) => keyword.trim())
        .filter(Boolean)
      : [];

    if (!summary && !subjectFocus && !palette && !motion && !promptDNA && keywords.length === 0) {
      return null;
    }

    return {
      summary,
      subjectFocus,
      palette,
      motion,
      promptDNA,
      keywords,
    };
  }, []);

  const runGenerateIdeas = useCallback(async (options?: {
    mode?: GenerationMode;
    seed?: string;
    referenceStyle?: StillframeReferenceStyleSummary | null;
  }) => {
    const nextMode = options?.mode ?? generationMode;
    const nextSeed = options?.seed ?? ideaSeed.trim();
    const nextReferenceStyle = options?.referenceStyle ?? referenceStyle;

    setIsGeneratingIdeas(true);
    setIdeasError(null);
    setIdeaPackSaveMessage(null);

    if (options?.mode) {
      setGenerationMode(options.mode);
    }

    if (typeof options?.seed === 'string') {
      setIdeaSeed(options.seed);
    }

    if (options?.referenceStyle) {
      setReferenceStyle(options.referenceStyle);
      setReferenceKeywordInput('');
    }

    try {
      const res = await fetch('/api/stillframe/ideas', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          mode: nextMode,
          seed: nextSeed || undefined,
          variationSeed: `${Date.now()}-${Math.random().toString(36).slice(2, 8)}`,
          keywords,
          referenceStyle: nextReferenceStyle,
        }),
      });

      const data = await res.json();
      if (!res.ok) throw new Error(data.error || 'Idea generation failed.');

      setIdeaPack({
        mode: data.mode === 'satire' ? 'satire' : 'ritual',
        themes: Array.isArray(data.themes) ? data.themes : [],
        characters: Array.isArray(data.characters) ? data.characters : [],
        events: Array.isArray(data.events) ? data.events : [],
        actions: Array.isArray(data.actions) ? data.actions : [],
        stories: Array.isArray(data.stories) ? data.stories : [],
        styles: Array.isArray(data.styles) ? data.styles : [],
        promptSeeds: Array.isArray(data.promptSeeds) ? data.promptSeeds : [],
        presetSeeds: Array.isArray(data.presetSeeds) ? data.presetSeeds : [],
        visions: Array.isArray(data.visions) ? data.visions : [],
        clipboardText: typeof data.clipboardText === 'string' ? data.clipboardText : '',
      });
    } catch (err: any) {
      setIdeasError(err.message || 'Idea generation failed.');
    } finally {
      setIsGeneratingIdeas(false);
    }
  }, [generationMode, ideaSeed, keywords, referenceStyle]);

  const handleGenerateIdeas = useCallback(async () => {
    await runGenerateIdeas();
  }, [runGenerateIdeas]);

  useEffect(() => {
    if (didBootstrapIdeaRemixRef.current || typeof window === 'undefined') {
      return;
    }

    didBootstrapIdeaRemixRef.current = true;

    const rawPayload = window.sessionStorage.getItem(STILLFRAME_IDEA_REMIX_STORAGE_KEY);
    if (!rawPayload) {
      return;
    }

    window.sessionStorage.removeItem(STILLFRAME_IDEA_REMIX_STORAGE_KEY);

    try {
      const parsedPayload = JSON.parse(rawPayload) as StillframeIdeaRemixPayload;
      const nextMode = parsedPayload.mode === 'satire' ? 'satire' : 'ritual';
      const nextSeed = typeof parsedPayload.seed === 'string' ? parsedPayload.seed.trim() : '';
      const nextReferenceStyle = normalizeRemixReferenceStyle(parsedPayload.referenceStyle);

      if (!nextSeed && !nextReferenceStyle) {
        return;
      }

      void runGenerateIdeas({
        mode: nextMode,
        seed: nextSeed,
        referenceStyle: nextReferenceStyle,
      });
    } catch {
      window.sessionStorage.removeItem(STILLFRAME_IDEA_REMIX_STORAGE_KEY);
    }
  }, [normalizeRemixReferenceStyle, runGenerateIdeas]);

  const resetGeneratedOutput = useCallback(() => {
    scenesRef.current = [];
    setScenes([]);
    setStoryTitle(null);
    setStoryConcept(null);
    setStylePresets([]);
    setReferenceStyle(null);
    setReferenceKeywordInput('');
    setSatireSketch(null);
    setAppliedSatirePresetProfileId(null);
    setAppliedSatireElementIds([]);
    setSubject(null);
    setMicroMotion(null);
    setTokenUsage(null);
    setOutputMode(null);
  }, []);

  const handleSatirePresetProfileChange = useCallback((nextProfileId: string) => {
    const nextProfile = getStillframeSatirePresetProfile(nextProfileId);
    if (!nextProfile) {
      return;
    }

    setSatirePresetProfileId(nextProfile.id);
    setSatireSelectedElementIds(nextProfile.defaultElementIds);
  }, []);

  const handleSatireElementChange = useCallback((category: StillframeSatireElementCategory, nextElementId: string) => {
    setSatireSelectedElementIds((previous) => {
      const filtered = previous.filter((elementId) => getStillframeSatireElement(elementId)?.category !== category);
      return [...filtered, nextElementId];
    });
  }, []);

  // ── Template selection ─────────────────────────────────────────────────────

  const handleTemplateChange = (e: React.ChangeEvent<HTMLSelectElement>) => {
    const id = e.target.value;
    setSelectedTemplateId(id);
    if (!id) return;
    const found = PROMPT_TEMPLATES.find((t) => t.id === id);
    if (found) setConcept(found.prompt);
  };

  // ── Concept generation ─────────────────────────────────────────────────────

  const runGenerateConcept = useCallback(async (conceptSeed: string, preparedKeywords: string[]) => {
    const trimmedConcept = conceptSeed.trim();
    const referenceStyleOverride = buildReferenceStyleOverride();

    if (!trimmedConcept && preparedKeywords.length < MIN_KEYWORDS && referenceImages.length === 0) {
      setConceptError(`Bitte mindestens ${MIN_KEYWORDS} Schlagwoerter, ein Referenzbild oder einen freien Concept-Text eingeben.`);
      return;
    }

    setIsGeneratingConcept(true);
    setConceptError(null);
    setReferenceError(null);
    resetGeneratedOutput();
    const newRunId = new Date().toISOString().slice(0, 19).replace(/[T:]/g, '-');
    setRunId(newRunId);

    try {
      const res = await fetch('/api/stillframe/concept', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          concept: trimmedConcept || undefined,
          keywords: preparedKeywords,
          referenceStyleOverride,
          referenceImages: serializeReferenceImages(),
        }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || 'Concept generation failed.');

      setStoryTitle(data.storyTitle || null);
      setStoryConcept(data.storyConcept || null);
      setSubject(data.subject);
      setMicroMotion(data.microMotion);
      setKeywords(Array.isArray(data.keywords) ? data.keywords : preparedKeywords);
      setStylePresets(Array.isArray(data.stylePresets) ? data.stylePresets : []);
      setReferenceStyle(data.referenceStyle || null);
      setReferenceKeywordInput('');
      applyUsageSummary(data.usage);
      const initialized = initScenes(data.scenes);
      scenesRef.current = initialized;
      setScenes(initialized);
      setOutputMode('ritual');
    } catch (err: any) {
      if (referenceStyleOverride) {
        setReferenceStyle(referenceStyleOverride);
      }
      setConceptError(err.message || 'Concept generation failed.');
    } finally {
      setIsGeneratingConcept(false);
    }
  }, [applyUsageSummary, buildReferenceStyleOverride, referenceImages.length, resetGeneratedOutput, serializeReferenceImages]);

  const runGenerateSatire = useCallback(async (satireSeed: string) => {
    if (!canGenerateSatire) {
      setConceptError('Bitte eine gueltige Satire-Voreinstellung waehlen.');
      return;
    }

    const referenceStyleOverride = buildReferenceStyleOverride();

    setIsGeneratingConcept(true);
    setConceptError(null);
    setReferenceError(null);
    resetGeneratedOutput();
    const newRunId = new Date().toISOString().slice(0, 19).replace(/[T:]/g, '-');
    setRunId(newRunId);

    try {
      const res = await fetch('/api/stillframe/satire', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          prompt: satireSeed.trim() || undefined,
          presetProfileId: selectedSatirePresetProfile.id,
          selectedElementIds: satireSelectedElementIds,
          referenceStyleOverride,
          referenceImages: serializeReferenceImages(),
          currentSketch: satireSketch,
        }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || 'Satire generation failed.');

      setSatireSketch(data.satireSketch || null);
      setAppliedSatirePresetProfileId(data.presetProfileId || selectedSatirePresetProfile.id);
      setAppliedSatireElementIds(Array.isArray(data.selectedElementIds) ? data.selectedElementIds : satireSelectedElementIds);
      setStoryTitle(data.storyTitle || null);
      setStoryConcept(data.storyConcept || null);
      setSubject(data.subject || null);
      setMicroMotion(data.microMotion || null);
      setStylePresets(Array.isArray(data.stylePresets) ? data.stylePresets : []);
      setReferenceStyle(data.referenceStyle || null);
      setReferenceKeywordInput('');
      applyUsageSummary(data.usage);

      const initialized = initScenes(Array.isArray(data.scenes) ? data.scenes : []);
      scenesRef.current = initialized;
      setScenes(initialized);
      setOutputMode('satire');
    } catch (err: any) {
      if (referenceStyleOverride) {
        setReferenceStyle(referenceStyleOverride);
      }
      setConceptError(err.message || 'Satire generation failed.');
    } finally {
      setIsGeneratingConcept(false);
    }
  }, [applyUsageSummary, buildReferenceStyleOverride, canGenerateSatire, resetGeneratedOutput, satireSelectedElementIds, satireSketch, selectedSatirePresetProfile.id, serializeReferenceImages]);

  const handleGenerateConcept = async () => {
    const trimmed = concept.trim();
    const preparedKeywords = keywordInput.trim() ? mergeKeywords(keywords, keywordInput) : keywords;

    if (keywordInput.trim()) {
      setKeywords(preparedKeywords);
      setKeywordInput('');
    }

    await runGenerateConcept(trimmed, preparedKeywords);
  };

  const handleGenerateSatire = async () => {
    await runGenerateSatire(satirePrompt.trim());
  };

  const handleGenerateVisionRitual = useCallback(async (vision: StillframeIdeaVision) => {
    const preparedKeywords = keywordInput.trim() ? mergeKeywords(keywords, keywordInput) : keywords;
    const ritualSeed = [
      vision.title,
      vision.story,
      vision.character,
      vision.event,
      vision.action,
      vision.style,
      vision.promptSeed,
    ].filter((value) => value.trim().length > 0).join('. ');

    if (keywordInput.trim()) {
      setKeywords(preparedKeywords);
      setKeywordInput('');
    }

    setGenerationMode('ritual');
    setConcept(ritualSeed);
    await runGenerateConcept(ritualSeed, preparedKeywords);
  }, [keywordInput, keywords, runGenerateConcept]);

  const handleGenerateVisionSatire = useCallback(async (vision: StillframeIdeaVision) => {
    const satireSeed = [
      vision.title,
      vision.theme,
      vision.character,
      vision.event,
      vision.action,
      vision.style,
      vision.promptSeed,
    ].filter((value) => value.trim().length > 0).join('. ');

    setGenerationMode('satire');
    setSatirePrompt(satireSeed);
    await runGenerateSatire(satireSeed);
  }, [runGenerateSatire]);

  // ── Sketch generation ──────────────────────────────────────────────────────

  const handleSketch = async (index: number) => {
    const scene = scenes[index];
    if (!scene?.prompt.trim()) return;

    updateScene(index, { sketchStatus: 'loading', sketchData: null, errorSketch: null, renderPromptDebug: null });

    try {
      const res = await fetch('/api/stillframe/sketch', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          prompt: scene.prompt,
          beatIndex: index,
          stylePresetIds: stylePresets.map((preset) => preset.id),
          referenceStyle,
          iqContext: {
            ...buildStillframeIQContext(scenesRef.current, index, storyTitle, storyConcept, referenceStyle, stylePresets),
            renderTarget: 'sketch',
            purpose: 'create',
          },
        }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || 'Sketch generation failed.');

      updateScene(index, { sketchStatus: 'done', sketchData: data.imageData, renderPromptDebug: data.debug || null });
    } catch (err: any) {
      updateScene(index, { sketchStatus: 'error', errorSketch: err.message || 'Sketch failed.' });
    }
  };

  // ── Video + GIF generation ─────────────────────────────────────────────────

  const renderVideoForScene = useCallback(async (
    scenePrompt: string,
    index: number,
    options: { remixVideoId?: string | null; videoTransform?: VideoTransformMode | null } = {},
  ) => {
    const remixVideoId = options.remixVideoId?.trim() || undefined;
    const videoTransform = resolveVideoTransformMode(remixVideoId, options.videoTransform);
    const videoRes = await fetch('/api/stillframe/video', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        prompt: scenePrompt,
        seconds: 5,
        beatIndex: index,
        stylePresetIds: stylePresets.map((preset) => preset.id),
        referenceStyle,
        iqContext: buildStillframeIQContext(
          scenesRef.current,
          index,
          storyTitle,
          storyConcept,
          referenceStyle,
          stylePresets,
          remixVideoId ?? null,
          videoTransform,
        ),
        ...(remixVideoId ? { remixVideoId, videoTransform } : {}),
      }),
    });
    const videoData = await videoRes.json();
    if (!videoRes.ok) throw new Error(videoData.error || 'Video generation failed.');
    const resolvedVideoId = videoData.videoId || videoData.jobId || null;

    updateScene(index, {
      videoStatus: 'converting',
      videoId: resolvedVideoId,
      remixedFromVideoId: remixVideoId ?? null,
      videoTransformMode: videoTransform ?? null,
      renderPromptDebug: videoData.debug || null,
    });

    const gifRes = await fetch('/api/convert-gif', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        ...(videoData.videoBase64 ? { videoBase64: videoData.videoBase64 } : { videoUrl: videoData.videoUrl }),
        aspectRatio: '16:9',
        outputSize: 720,
      }),
    });
    const gifData = await gifRes.json();
    if (!gifRes.ok) throw new Error(gifData.error || 'GIF conversion failed.');

    updateScene(index, {
      videoStatus: 'done',
      videoId: resolvedVideoId,
      remixedFromVideoId: remixVideoId ?? null,
      videoTransformMode: videoTransform ?? null,
      videoBase64: videoData.videoBase64 || null,
      gifData: gifData.gifData,
      renderPromptDebug: videoData.debug || null,
    });
  }, [referenceStyle, storyConcept, storyTitle, stylePresets, updateScene]);

  const handleVideo = async (index: number) => {
    const scene = scenes[index];
    if (!scene?.prompt.trim()) return;

    updateScene(index, {
      videoStatus: 'loading',
      videoBase64: null,
      gifData: null,
      errorVideo: null,
      remixedFromVideoId: null,
      videoTransformMode: null,
      renderPromptDebug: null,
    });

    try {
      await renderVideoForScene(scene.prompt, index);
    } catch (err: any) {
      updateScene(index, { videoStatus: 'error', errorVideo: err.message || 'Video/GIF failed.' });
    }
  };

  const handleVideoRemix = async (index: number) => {
    const scene = scenes[index];
    if (!scene?.prompt.trim() || !scene.videoId) return;

    updateScene(index, {
      videoStatus: 'loading',
      errorVideo: null,
      videoTransformMode: 'remix',
      renderPromptDebug: null,
    });

    try {
      await renderVideoForScene(scene.prompt, index, { remixVideoId: scene.videoId, videoTransform: 'remix' });
    } catch (err: any) {
      updateScene(index, { videoStatus: 'error', errorVideo: err.message || 'Video-Remix failed.' });
    }
  };

  const handleVideoExtension = async (index: number) => {
    const scene = scenes[index];
    if (!scene?.prompt.trim() || !scene.videoId) return;

    updateScene(index, {
      videoStatus: 'loading',
      errorVideo: null,
      videoTransformMode: 'extend',
      renderPromptDebug: null,
    });

    try {
      await renderVideoForScene(scene.prompt, index, { remixVideoId: scene.videoId, videoTransform: 'extend' });
    } catch (err: any) {
      updateScene(index, { videoStatus: 'error', errorVideo: err.message || 'Video-Extension failed.' });
    }
  };

  const handlePromptChange = (index: number, value: string) => {
    updateScene(index, {
      prompt: value,
      polishStatus: 'idle',
      sketchStatus: 'idle',
      sketchData: null,
      videoStatus: 'idle',
      videoBase64: null,
      gifData: null,
      videoTransformMode: null,
      errorPolish: null,
      errorSketch: null,
      errorVideo: null,
      renderPromptDebug: null,
    });
  };

  const polishScenePrompt = useCallback(async (index: number) => {
    const scene = scenesRef.current[index];
    if (!scene?.prompt.trim()) {
      return;
    }

    updateScene(index, { polishStatus: 'loading', errorPolish: null });

    try {
      const res = await fetch('/api/stillframe/polish', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          mode: outputMode === 'satire' ? 'satire' : 'ritual',
          beat: scene.beat,
          title: scene.title,
          motion: scene.motion,
          prompt: scene.prompt,
          storyTitle,
          storyConcept,
          stylePresetIds: stylePresets.map((preset) => preset.id),
          referenceStyle,
          presetProfileId: outputMode === 'satire'
            ? (appliedSatirePresetProfileId || selectedSatirePresetProfile.id)
            : undefined,
          selectedElementIds: outputMode === 'satire'
            ? (appliedSatireElementIds.length > 0 ? appliedSatireElementIds : satireSelectedElementIds)
            : undefined,
        }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || 'Prompt polishing failed.');

      updateScene(index, {
        prompt: data.prompt || scene.prompt,
        polishStatus: 'done',
        sketchStatus: 'idle',
        sketchData: null,
        videoStatus: 'idle',
        videoBase64: null,
        gifData: null,
        errorPolish: null,
        errorSketch: null,
        errorVideo: null,
        renderPromptDebug: null,
      });
    } catch (err: any) {
      updateScene(index, { polishStatus: 'error', errorPolish: err.message || 'Prompt polishing failed.' });
    }
  }, [
    appliedSatireElementIds,
    appliedSatirePresetProfileId,
    outputMode,
    referenceStyle,
    selectedSatirePresetProfile.id,
    satireSelectedElementIds,
    storyConcept,
    storyTitle,
    stylePresets,
    updateScene,
  ]);

  const handlePolishPrompt = async (index: number) => {
    await polishScenePrompt(index);
  };

  const handlePolishAll = async () => {
    if (scenesRef.current.length === 0 || isPolishingAll) return;

    setIsPolishingAll(true);
    for (let i = 0; i < scenesRef.current.length; i++) {
      const scene = scenesRef.current[i];
      if (!scene.prompt.trim() || scene.polishStatus === 'loading') continue;
      await polishScenePrompt(i);
    }
    setIsPolishingAll(false);
  };

  // ── Sketch All (sequential) ────────────────────────────────────────────────

  const handleSketchAll = async () => {
    if (scenesRef.current.length === 0 || isSketchingAll) return;
    setIsSketchingAll(true);
    for (let i = 0; i < scenesRef.current.length; i++) {
      const scene = scenesRef.current[i];
      if (!scene.prompt.trim() || scene.sketchStatus === 'loading') continue;
      updateScene(i, { sketchStatus: 'loading', sketchData: null, errorSketch: null, renderPromptDebug: null });
      try {
        const res = await fetch('/api/stillframe/sketch', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            prompt: scenesRef.current[i].prompt,
            beatIndex: i,
            stylePresetIds: stylePresets.map((preset) => preset.id),
            referenceStyle,
            iqContext: {
              ...buildStillframeIQContext(scenesRef.current, i, storyTitle, storyConcept, referenceStyle, stylePresets),
              renderTarget: 'sketch',
              purpose: 'create',
            },
          }),
        });
        const data = await res.json();
        if (!res.ok) throw new Error(data.error || 'Sketch generation failed.');
        updateScene(i, { sketchStatus: 'done', sketchData: data.imageData, renderPromptDebug: data.debug || null });
      } catch (err: any) {
        updateScene(i, { sketchStatus: 'error', errorSketch: err.message || 'Sketch failed.' });
      }
    }
    setIsSketchingAll(false);
  };

  const handleVideoAll = async () => {
    if (scenesRef.current.length === 0 || isRenderingAllVideos) return;

    setIsRenderingAllVideos(true);
    for (let i = 0; i < scenesRef.current.length; i++) {
      const scene = scenesRef.current[i];
      if (!scene.prompt.trim() || scene.videoStatus === 'loading' || scene.videoStatus === 'converting') continue;

      updateScene(i, {
        videoStatus: 'loading',
        videoBase64: null,
        gifData: null,
        errorVideo: null,
        renderPromptDebug: null,
      });

      try {
        await renderVideoForScene(scenesRef.current[i].prompt, i);
      } catch (err: any) {
        updateScene(i, { videoStatus: 'error', errorVideo: err.message || 'Video/GIF failed.' });
      }
    }
    setIsRenderingAllVideos(false);
  };

  // ── Render ─────────────────────────────────────────────────────────────────

  const activePolishBatchIndex = scenes.findIndex((scene) => scene.polishStatus === 'loading');
  const hasActivePolish = scenes.some((scene) => scene.polishStatus === 'loading');
  const activeVideoBatchIndex = scenes.findIndex((scene) => scene.videoStatus === 'loading' || scene.videoStatus === 'converting');
  const hasActiveVideoRender = scenes.some((scene) => scene.videoStatus === 'loading' || scene.videoStatus === 'converting');

  return (
    <div
      className="min-h-screen signal-shell bg-[#02040e]"
    >
      {/* ── Header ─────────────────────────────────────────────────────────── */}
      <header className="border-b border-[rgba(114,228,255,0.14)] bg-[rgba(4,6,16,0.88)] backdrop-blur-xl px-5 py-4">
        <div className="mx-auto max-w-[1400px] flex items-center gap-4">
          <button
            type="button"
            onClick={onNavigateBack}
            className="flex items-center gap-2 rounded-xl border border-[rgba(114,228,255,0.18)] bg-[rgba(10,18,35,0.7)] px-3 py-2 text-xs font-semibold text-[#8ea6c3] transition hover:text-[#72e4ff] hover:border-[rgba(114,228,255,0.35)]"
          >
            <ArrowLeft size={14} />
            Studio
          </button>

          <div className="flex items-center gap-3">
            <div className="h-7 w-px bg-[rgba(114,228,255,0.12)]" />
            <span className="font-mono text-[11px] uppercase tracking-[0.28em] text-[#4a7090]">Azure OpenAI Foundry</span>
            <span className="rounded-full border border-[rgba(114,228,255,0.2)] bg-[rgba(20,40,70,0.6)] px-2.5 py-0.5 font-mono text-[10px] text-[#72e4ff]">
              {generationMode === 'satire' ? 'Stillframe Satire' : 'Stillframe Rituals'}
            </span>
          </div>
        </div>
      </header>

      <main className="mx-auto max-w-[1400px] px-4 py-8 space-y-10">

        {/* ── Hero ─────────────────────────────────────────────────────────── */}
        <div className="space-y-2">
          <h1 className="font-mono text-2xl font-bold tracking-tight text-[#f3f8ff]">
            {generationMode === 'satire' ? 'Stillframe Satire Sketch' : 'Stillframe Rituals'}
          </h1>
          <p className="text-sm text-[#4a6a8a] max-w-2xl">
            {generationMode === 'satire'
              ? 'Einfacher ARV-Satiremodus mit zwei Figuren, einem optionalen Satire-Fokus und direkt generierten Sketch- plus GIF-Szenen.'
              : 'Hypnotic micro-motion stop-frame loops via Azure OpenAI Foundry. Gib 3 bis 5 Schlagwoerter, ein freies Konzept oder Referenzbilder an, lass dir passende Stil-Presets und 4 diverse Szenen-Prompts bauen und rendere daraus GIF-Loops.'}
          </p>
        </div>

        <section className="rounded-[24px] border border-[rgba(168,118,255,0.16)] bg-[linear-gradient(180deg,rgba(22,12,40,0.72),rgba(7,12,24,0.8))] p-6 space-y-5 backdrop-blur-sm">
          <div className="flex flex-wrap items-start justify-between gap-4">
            <div className="space-y-2 max-w-3xl">
              <div className="font-mono text-[11px] uppercase tracking-[0.24em] text-[#8f74c9]">
                Ideen Generator
              </div>
              <h2 className="font-mono text-xl font-semibold text-[#f3eaff]">
                Neue Visionen fuer Themen, Figuren, Ereignisse, Stories, Styles, Prompt- und Preset-Seeds
              </h2>
              <p className="text-sm leading-relaxed text-[#907aa8]">
                Generiert immer wieder neue ARV-Ideenpakete, die sofort kopiert oder direkt in Ritual-Concepts und Satire-Fokusfelder uebernommen werden koennen. Vorhandene Keywords und editierte Referenz-DNA wirken als weiche Stilanker mit.
              </p>
            </div>

            {ideaPack?.clipboardText && (
              <div className="flex flex-wrap items-center gap-2">
                <CopyTextButton
                  text={ideaPack.clipboardText}
                  label="Alles kopieren"
                  copiedLabel="Pack kopiert"
                />
                <button
                  type="button"
                  onClick={() => void handleSaveIdeaPack()}
                  disabled={isSavingIdeaPack}
                  className="inline-flex items-center justify-center gap-1.5 rounded-lg border border-[rgba(114,228,255,0.18)] bg-[rgba(10,26,46,0.72)] px-3 py-2 font-mono text-[10px] font-semibold text-[#72e4ff] transition hover:bg-[rgba(18,38,64,0.82)] disabled:cursor-not-allowed disabled:opacity-40"
                >
                  {isSavingIdeaPack ? <Loader2 size={12} className="animate-spin" /> : <BookOpen size={12} />}
                  {isSavingIdeaPack ? 'Speichert...' : 'In Bibliothek speichern'}
                </button>
              </div>
            )}
          </div>

          {ideaPackSaveMessage && (
            <div className={`rounded-lg border px-4 py-3 font-mono text-[11px] ${ideaPackSaveMessage.includes('gespeichert')
              ? 'border-[rgba(114,228,255,0.16)] bg-[rgba(10,26,46,0.56)] text-[#72e4ff]'
              : 'border-[rgba(255,80,60,0.2)] bg-[rgba(255,80,60,0.1)] text-[#ff6a4f]'}`}>
              {ideaPackSaveMessage}
            </div>
          )}

          <div className="grid gap-4 xl:grid-cols-[minmax(0,1.15fr)_minmax(340px,0.85fr)]">
            <div className="space-y-3">
              <label className="block font-mono text-[11px] uppercase tracking-[0.22em] text-[#8f74c9]">
                Ideen-Seed
              </label>
              <textarea
                value={ideaSeed}
                onChange={(event) => setIdeaSeed(event.target.value)}
                rows={3}
                placeholder={generationMode === 'satire'
                  ? 'z. B. pressure-core office meltdown, glass engine with procedural panic, signal field doing dry visual comedy'
                  : 'z. B. breathing storm lab above black water, micro-city under magnetic weather, kinetic aperture with delayed residue'}
                className="w-full resize-none rounded-xl border border-[rgba(168,118,255,0.18)] bg-[rgba(10,10,24,0.82)] px-4 py-3 font-mono text-sm text-[#f3eaff] placeholder-[#4d4162] outline-none transition focus:border-[rgba(199,167,255,0.55)] focus:ring-1 focus:ring-[rgba(199,167,255,0.24)]"
                onKeyDown={(event) => {
                  if (event.key === 'Enter' && !event.shiftKey) {
                    event.preventDefault();
                    void handleGenerateIdeas();
                  }
                }}
              />
            </div>

            <div className="rounded-[18px] border border-[rgba(168,118,255,0.14)] bg-[rgba(12,14,28,0.78)] p-4 space-y-3">
              <div className="font-mono text-[11px] uppercase tracking-[0.2em] text-[#705d92]">Generator Status</div>
              <div className="space-y-2 font-mono text-[11px] leading-relaxed text-[#8f74c9]">
                <div>Modus: <span className="text-[#f3eaff]">{generationMode === 'satire' ? 'Satire Vision Lab' : 'Ritual Vision Lab'}</span></div>
                <div>Keywords: <span className="text-[#c7a7ff]">{keywords.length > 0 ? keywords.join(', ') : 'keine'}</span></div>
                <div>Referenz-DNA: <span className="text-[#c7a7ff]">{referenceStyle ? 'aktiv' : 'keine'}</span></div>
                <div>Seed: <span className="text-[#c7a7ff]">{ideaSeed.trim() || 'frischer Lauf ohne expliziten Seed'}</span></div>
              </div>
              <button
                type="button"
                onClick={() => void handleGenerateIdeas()}
                disabled={isGeneratingIdeas}
                className="flex w-full items-center justify-center gap-2 rounded-xl border border-[rgba(168,118,255,0.24)] bg-[rgba(48,24,78,0.82)] px-4 py-3 font-mono text-[11px] font-semibold text-[#e6d6ff] transition hover:bg-[rgba(62,28,96,0.88)] disabled:cursor-not-allowed disabled:opacity-40"
              >
                {isGeneratingIdeas ? (
                  <><Loader2 size={14} className="animate-spin" />Visionen werden gebaut…</>
                ) : (
                  <><Sparkles size={14} />Neue Ideen generieren</>
                )}
              </button>
            </div>
          </div>

          {ideasError && (
            <div className="flex items-start gap-2 rounded-lg border border-[rgba(255,80,60,0.2)] bg-[rgba(255,80,60,0.1)] px-4 py-3 text-xs text-[#ff6a4f]">
              <TriangleAlert size={14} className="mt-0.5 shrink-0" />
              {ideasError}
            </div>
          )}

          {ideaPack && (
            <div className="space-y-5">
              <div className="grid gap-4 lg:grid-cols-2 xl:grid-cols-4">
                {IDEA_SECTION_CONFIG.map((section) => (
                  <IdeaListPanel
                    key={section.key}
                    label={section.label}
                    items={ideaPack[section.key]}
                    allowUse={section.useTarget}
                    onUseRitual={applyIdeaToRitual}
                    onUseSatire={applyIdeaToSatire}
                  />
                ))}
              </div>

              {ideaPack.visions.length > 0 && (
                <div className="space-y-3">
                  <div className="font-mono text-[11px] uppercase tracking-[0.22em] text-[#8f74c9]">
                    Vision Cards
                  </div>
                  <div className="grid gap-4 xl:grid-cols-2">
                    {ideaPack.visions.map((vision, index) => (
                      <IdeaVisionCard
                        key={`${vision.title}-${index}`}
                        vision={vision}
                        onUseRitual={applyIdeaToRitual}
                        onUseSatire={applyIdeaToSatire}
                        onGenerateRitual={handleGenerateVisionRitual}
                        onGenerateSatire={handleGenerateVisionSatire}
                        isGenerating={isGeneratingConcept}
                      />
                    ))}
                  </div>
                </div>
              )}
            </div>
          )}
        </section>

        {/* ── Concept input ─────────────────────────────────────────────────── */}
        <div className="rounded-[24px] border border-[rgba(114,228,255,0.12)] bg-[rgba(6,12,24,0.7)] p-6 space-y-4 backdrop-blur-sm">

          <div className="flex flex-wrap items-center justify-between gap-3">
            <label className="font-mono text-[11px] uppercase tracking-[0.22em] text-[#4a7090]">
              Modus
            </label>
            <div className="inline-flex rounded-xl border border-[rgba(114,228,255,0.16)] bg-[rgba(7,14,28,0.82)] p-1">
              {([
                { id: 'ritual', label: 'Ritual Story Beats' },
                { id: 'satire', label: 'Satire Sketch' },
              ] as const).map((mode) => (
                <button
                  key={mode.id}
                  type="button"
                  onClick={() => {
                    setGenerationMode(mode.id);
                    setConceptError(null);
                  }}
                  className={`rounded-lg px-3 py-2 font-mono text-[11px] font-semibold transition ${generationMode === mode.id
                    ? 'border border-[rgba(114,228,255,0.26)] bg-[rgba(18,38,64,0.9)] text-[#72e4ff]'
                    : 'border border-transparent text-[#4a7090] hover:text-[#c8ddf0]'}`}
                >
                  {mode.label}
                </button>
              ))}
            </div>
          </div>

          {generationMode === 'ritual' ? (
            <>

          {/* Template dropdown */}
          <div className="flex items-center gap-3">
            <label className="shrink-0 font-mono text-[11px] uppercase tracking-[0.22em] text-[#4a7090]">
              Vorlage
            </label>
            <div className="relative flex-1">
              <select
                value={selectedTemplateId}
                onChange={handleTemplateChange}
                aria-label="Promptvorlage auswählen"
                className="w-full appearance-none rounded-xl border border-[rgba(114,228,255,0.18)] bg-[#071221] px-4 py-2.5 pr-9 font-mono text-[11px] text-[#c8ddf0] outline-none focus:border-[#72e4ff] transition cursor-pointer"
              >
                <option value="">— Promptvorlage auswählen —</option>
                {TEMPLATE_OPTIONS.map((group) => (
                  <optgroup key={group.category} label={group.category}>
                    {group.options.map((opt) => (
                      <option key={opt.id} value={opt.id}>{opt.label}</option>
                    ))}
                  </optgroup>
                ))}
              </select>
              <ChevronsDown size={13} className="pointer-events-none absolute right-3 top-1/2 -translate-y-1/2 text-[#2a5070]" />
            </div>
          </div>

          <div className="space-y-3">
            <div className="flex items-center justify-between gap-3">
              <label className="font-mono text-[11px] uppercase tracking-[0.22em] text-[#4a7090]">
                Keywords 3-5
              </label>
              <span className={`rounded-full border px-2 py-0.5 font-mono text-[10px] ${pendingKeywords.length >= MIN_KEYWORDS ? 'border-[rgba(114,228,255,0.24)] bg-[rgba(24,50,78,0.45)] text-[#72e4ff]' : 'border-[rgba(255,214,120,0.2)] bg-[rgba(58,42,10,0.32)] text-[#e8c16a]'}`}>
                {pendingKeywords.length}/{MAX_KEYWORDS}
              </span>
            </div>

            <div className="rounded-xl border border-[rgba(114,228,255,0.16)] bg-[#071221] px-3 py-3">
              <div className="flex flex-wrap items-center gap-2">
                {keywords.map((keyword) => (
                  <span
                    key={keyword}
                    className="inline-flex items-center gap-1.5 rounded-full border border-[rgba(114,228,255,0.2)] bg-[rgba(16,32,58,0.85)] px-2.5 py-1 font-mono text-[11px] text-[#c8ddf0]"
                  >
                    <Tags size={11} className="text-[#72e4ff]" />
                    <span>{keyword}</span>
                    <button
                      type="button"
                      onClick={() => handleRemoveKeyword(keyword)}
                      className="rounded-full text-[#4a7090] transition hover:text-[#f3f8ff]"
                      aria-label={`Keyword ${keyword} entfernen`}
                    >
                      <X size={11} />
                    </button>
                  </span>
                ))}

                <input
                  value={keywordInput}
                  onChange={(event) => setKeywordInput(event.target.value)}
                  onKeyDown={handleKeywordKeyDown}
                  onBlur={flushKeywordInput}
                  disabled={keywords.length >= MAX_KEYWORDS}
                  placeholder={keywords.length >= MAX_KEYWORDS ? 'Max. 5 Keywords erreicht' : 'z. B. pressure, glass, storm'}
                  className="min-w-[220px] flex-1 bg-transparent px-1 py-1 font-mono text-sm text-[#f3f8ff] placeholder-[#2a4060] outline-none disabled:cursor-not-allowed disabled:text-[#36516e]"
                  aria-label="Keywords fuer die Story eingeben"
                />
              </div>
            </div>

            <p className="text-[11px] text-[#4a6a8a]">
              Mit Enter oder Komma uebernehmen. Ohne freien Concept-Text baut der Story-Generator eine neue Sequenz direkt aus deinen Schlagwoertern.
            </p>
          </div>

          <div className="space-y-3">
            <div className="flex flex-wrap items-center justify-between gap-3">
              <label className="font-mono text-[11px] uppercase tracking-[0.22em] text-[#4a7090]">
                Referenzbilder PNG / GIF
              </label>
              <div className="flex items-center gap-3">
                <span className={`rounded-full border px-2 py-0.5 font-mono text-[10px] ${referenceImages.length > 0 ? 'border-[rgba(114,228,255,0.24)] bg-[rgba(24,50,78,0.45)] text-[#72e4ff]' : 'border-[rgba(114,228,255,0.12)] bg-[rgba(14,24,40,0.45)] text-[#4a7090]'}`}>
                  {referenceImages.length}/{MAX_REFERENCE_IMAGES}
                </span>
                <button
                  type="button"
                  onClick={() => referenceInputRef.current?.click()}
                  disabled={isPreparingReferences || referenceImages.length >= MAX_REFERENCE_IMAGES}
                  className="inline-flex items-center gap-2 rounded-xl border border-[rgba(114,228,255,0.18)] bg-[rgba(10,26,46,0.72)] px-4 py-2 font-mono text-[11px] font-semibold text-[#72e4ff] transition hover:bg-[rgba(18,38,64,0.82)] disabled:opacity-40 disabled:cursor-not-allowed"
                >
                  {isPreparingReferences ? <Loader2 size={13} className="animate-spin" /> : <ImagePlus size={13} />}
                  Bilder hochladen
                </button>
              </div>
            </div>

            <input
              ref={referenceInputRef}
              type="file"
              accept="image/png,image/gif"
              multiple
              className="hidden"
              onChange={handleReferenceFilesSelected}
            />

            <p className="text-[11px] text-[#4a6a8a]">
              PNGs und GIFs definieren Stil, Material, Licht und Prompt-DNA. GIFs werden fuer die Analyse ueber ihr erstes sichtbares Frame stilistisch ausgewertet.
            </p>

            {referenceImages.length > 0 && (
              <div className="grid gap-3 md:grid-cols-2 xl:grid-cols-4">
                {referenceImages.map((referenceImage) => (
                  <article
                    key={referenceImage.id}
                    className="overflow-hidden rounded-[18px] border border-[rgba(114,228,255,0.12)] bg-[rgba(8,16,30,0.78)]"
                  >
                    <div className="aspect-video overflow-hidden border-b border-[rgba(114,228,255,0.08)] bg-[#030812]">
                      <img
                        src={referenceImage.previewDataUrl}
                        alt={referenceImage.name}
                        className="h-full w-full object-cover"
                      />
                    </div>
                    <div className="space-y-2 px-3 py-3">
                      <div className="flex items-start justify-between gap-2">
                        <div className="min-w-0">
                          <div className="truncate font-mono text-[11px] text-[#c8ddf0]">{referenceImage.name}</div>
                          <div className="font-mono text-[10px] text-[#4a7090]">
                            {referenceImage.source.toUpperCase()} · {referenceImage.width}×{referenceImage.height}
                          </div>
                        </div>
                        <button
                          type="button"
                          onClick={() => handleRemoveReferenceImage(referenceImage.id)}
                          className="rounded-full border border-[rgba(114,228,255,0.12)] p-1 text-[#4a7090] transition hover:text-[#f3f8ff] hover:border-[rgba(114,228,255,0.24)]"
                          aria-label={`${referenceImage.name} entfernen`}
                        >
                          <X size={12} />
                        </button>
                      </div>

                      <div className="font-mono text-[10px] leading-relaxed text-[#4a6a8a]">
                        {referenceImage.source === 'gif'
                          ? 'Stilreferenz aus GIF. Analyse laeuft ueber ein normalisiertes Still des Loops.'
                          : 'Stilreferenz aus PNG. Analyse laeuft ueber eine normalisierte PNG-Fassung.'}
                      </div>
                    </div>
                  </article>
                ))}
              </div>
            )}

            {referenceError && (
              <div className="flex items-start gap-2 rounded-lg bg-[rgba(255,80,60,0.1)] border border-[rgba(255,80,60,0.2)] px-4 py-3 text-xs text-[#ff6a4f]">
                <TriangleAlert size={14} className="mt-0.5 shrink-0" />
                {referenceError}
              </div>
            )}
          </div>

          <label className="block font-mono text-[11px] uppercase tracking-[0.22em] text-[#4a7090]">
            Concept / Subject
          </label>
          <textarea
            ref={inputRef}
            value={concept}
            onChange={(e) => setConcept(e.target.value)}
            placeholder={PLACEHOLDER_CONCEPTS[placeholderIndex.current]}
            rows={2}
            className="w-full resize-none rounded-xl border border-[rgba(114,228,255,0.18)] bg-[#071221] px-4 py-3 font-mono text-sm text-[#f3f8ff] placeholder-[#2a4060] outline-none focus:border-[#72e4ff] focus:ring-1 focus:ring-[rgba(114,228,255,0.25)] transition"
            onKeyDown={(e) => {
              if (e.key === 'Enter' && !e.shiftKey) {
                e.preventDefault();
                handleGenerateConcept();
              }
            }}
          />

          <div className="flex items-center gap-3">
            <button
              type="button"
              onClick={handleGenerateConcept}
              disabled={isGeneratingConcept || !canGenerateConcept}
              className="flex items-center gap-2 rounded-xl bg-[#0e3a5c] px-5 py-2.5 font-mono text-xs font-semibold text-[#72e4ff] border border-[rgba(114,228,255,0.28)] transition hover:bg-[#153f64] disabled:opacity-40 disabled:cursor-not-allowed"
            >
              {isGeneratingConcept ? (
                <>
                  <Loader2 size={14} className="animate-spin" />
                  Generating beats…
                </>
              ) : (
                <>
                  <Sparkles size={14} />
                  Generate Story Beats
                </>
              )}
            </button>

            {(storyTitle || subject) && (
              <div className="flex-1 min-w-0 space-y-0.5">
                {storyTitle && (
                  <span className="block truncate font-mono text-[11px] text-[#4a7090]">
                    Story: <span className="text-[#8ea6c3]">{storyTitle}</span>
                  </span>
                )}
                <span className="block truncate font-mono text-[11px] text-[#4a7090]">
                  Subject: <span className="text-[#8ea6c3]">{subject}</span>
                </span>
                {microMotion && (
                  <span className="block truncate font-mono text-[11px] text-[#4a7090]">
                    Micro-motion: <span className="text-[#8ea6c3]">{microMotion}</span>
                  </span>
                )}
                {tokenUsage && (
                  <span className="block font-mono text-[10px] text-[#2a4a6a]">
                    Tokens:{' '}
                    <span className="text-[#4a7090]">
                      {tokenUsage.prompt.toLocaleString()} prompt
                    </span>
                    {' + '}
                    <span className="text-[#4a7090]">
                      {tokenUsage.completion.toLocaleString()} completion
                    </span>
                    {' = '}
                    <span className="text-[#72e4ff] font-semibold">
                      {tokenUsage.total.toLocaleString()} total
                    </span>
                  </span>
                )}
              </div>
            )}
          </div>

          {!concept.trim() && pendingKeywords.length > 0 && pendingKeywords.length < MIN_KEYWORDS && (
            <div className="font-mono text-[10px] text-[#e8c16a]">
              Noch {MIN_KEYWORDS - pendingKeywords.length} Schlagwoert{MIN_KEYWORDS - pendingKeywords.length === 1 ? 'e' : 'er'}, dann kann die Keyword-Story generiert werden.
            </div>
          )}

          {conceptError && (
            <div className="flex items-start gap-2 rounded-lg bg-[rgba(255,80,60,0.1)] border border-[rgba(255,80,60,0.2)] px-4 py-3 text-xs text-[#ff6a4f]">
              <TriangleAlert size={14} className="mt-0.5 shrink-0" />
              {conceptError}
            </div>
          )}
            </>
          ) : (
            <>
              <div className="grid gap-4 lg:grid-cols-[minmax(0,1.1fr)_minmax(320px,0.9fr)]">
                <div className="space-y-3">
                  <label className="block font-mono text-[11px] uppercase tracking-[0.22em] text-[#4a7090]">
                    Satire-Fokus
                  </label>
                  <textarea
                    value={satirePrompt}
                    onChange={(event) => setSatirePrompt(event.target.value)}
                    placeholder="z. B. Krisenkommunikation als Formularritual, Innovationssprache ohne Inhalt oder Transparenz als geheim gestempelter Prozess"
                    rows={4}
                    className="w-full resize-none rounded-xl border border-[rgba(114,228,255,0.18)] bg-[#071221] px-4 py-3 font-mono text-sm text-[#f3f8ff] placeholder-[#2a4060] outline-none focus:border-[#72e4ff] focus:ring-1 focus:ring-[rgba(114,228,255,0.25)] transition"
                    onKeyDown={(event) => {
                      if (event.key === 'Enter' && !event.shiftKey) {
                        event.preventDefault();
                        handleGenerateSatire();
                      }
                    }}
                  />
                  <p className="text-[11px] text-[#4a6a8a]">
                    Ein kurzer Fokus reicht. Die Voreinstellung legt feste Style-Presets fest, die Elemente bestimmen Subjekt, Oberflaeche, Bewegung und Transformation.
                  </p>
                </div>

                <div className="grid gap-4 lg:grid-cols-[minmax(260px,0.85fr)_minmax(0,1.15fr)]">
                  <div className="rounded-[18px] border border-[rgba(114,228,255,0.12)] bg-[rgba(8,16,30,0.82)] p-4 space-y-3">
                    <label className="block font-mono text-[11px] uppercase tracking-[0.22em] text-[#4a7090]">
                      Voreinstellung
                    </label>
                    <div className="relative">
                      <select
                        value={selectedSatirePresetProfile.id}
                        onChange={(event) => handleSatirePresetProfileChange(event.target.value)}
                        className="w-full appearance-none rounded-xl border border-[rgba(114,228,255,0.18)] bg-[#071221] px-4 py-2.5 pr-9 font-mono text-[11px] text-[#c8ddf0] outline-none focus:border-[#72e4ff] transition cursor-pointer"
                      >
                        {STILLFRAME_SATIRE_PRESET_PROFILES.map((profile) => (
                          <option key={profile.id} value={profile.id}>{profile.name}</option>
                        ))}
                      </select>
                      <ChevronsDown size={13} className="pointer-events-none absolute right-3 top-1/2 -translate-y-1/2 text-[#2a5070]" />
                    </div>
                    <div className="space-y-2 font-mono text-[10px] leading-relaxed text-[#4a7090]">
                      <div className="text-[#c8ddf0]">{selectedSatirePresetProfile.description}</div>
                      <div className="flex flex-wrap gap-2 pt-1">
                        {selectedSatirePresetProfile.presetIds.map((presetId) => (
                          <span
                            key={presetId}
                            className="rounded-full border border-[rgba(114,228,255,0.16)] bg-[rgba(18,34,58,0.56)] px-2 py-0.5 font-mono text-[10px] uppercase tracking-[0.14em] text-[#72e4ff]"
                          >
                            {presetId}
                          </span>
                        ))}
                      </div>
                    </div>
                  </div>

                  <div className="rounded-[18px] border border-[rgba(114,228,255,0.12)] bg-[rgba(8,16,30,0.82)] p-4 space-y-4">
                    <label className="block font-mono text-[11px] uppercase tracking-[0.22em] text-[#4a7090]">
                      Elemente
                    </label>
                    <div className="space-y-4">
                      {SATIRE_ELEMENT_CATEGORY_ORDER.map((category) => {
                        const categoryOptions = STILLFRAME_SATIRE_ELEMENT_OPTIONS.filter((element) => element.category === category);
                        const activeElement = selectedSatireElements.find((element) => element.category === category);

                        return (
                          <div key={category} className="space-y-2">
                            <div className="font-mono text-[10px] uppercase tracking-[0.16em] text-[#36516e]">
                              {SATIRE_ELEMENT_CATEGORY_LABELS[category]}
                            </div>
                            <div className="flex flex-wrap gap-2">
                              {categoryOptions.map((option) => {
                                const isActive = activeElement?.id === option.id;
                                return (
                                  <button
                                    key={option.id}
                                    type="button"
                                    onClick={() => handleSatireElementChange(category, option.id)}
                                    className={`rounded-full border px-2.5 py-1 font-mono text-[10px] transition ${isActive
                                      ? 'border-[rgba(114,228,255,0.26)] bg-[rgba(18,42,64,0.58)] text-[#72e4ff]'
                                      : 'border-[rgba(114,228,255,0.12)] bg-[rgba(10,20,40,0.48)] text-[#4a7090] hover:text-[#c8ddf0] hover:border-[rgba(114,228,255,0.2)]'}`}
                                  >
                                    {option.label}
                                  </button>
                                );
                              })}
                            </div>
                          </div>
                        );
                      })}
                    </div>
                  </div>
                </div>

                <div className="space-y-3">
                  <div className="flex flex-wrap items-center justify-between gap-3">
                    <label className="font-mono text-[11px] uppercase tracking-[0.22em] text-[#4a7090]">
                      Referenzbilder PNG / GIF
                    </label>
                    <div className="flex items-center gap-3">
                      <span className={`rounded-full border px-2 py-0.5 font-mono text-[10px] ${referenceImages.length > 0 ? 'border-[rgba(114,228,255,0.24)] bg-[rgba(24,50,78,0.45)] text-[#72e4ff]' : 'border-[rgba(114,228,255,0.12)] bg-[rgba(14,24,40,0.45)] text-[#4a7090]'}`}>
                        {referenceImages.length}/{MAX_REFERENCE_IMAGES}
                      </span>
                      <button
                        type="button"
                        onClick={() => referenceInputRef.current?.click()}
                        disabled={isPreparingReferences || referenceImages.length >= MAX_REFERENCE_IMAGES}
                        className="inline-flex items-center gap-2 rounded-xl border border-[rgba(114,228,255,0.18)] bg-[rgba(10,26,46,0.72)] px-4 py-2 font-mono text-[11px] font-semibold text-[#72e4ff] transition hover:bg-[rgba(18,38,64,0.82)] disabled:opacity-40 disabled:cursor-not-allowed"
                      >
                        {isPreparingReferences ? <Loader2 size={13} className="animate-spin" /> : <ImagePlus size={13} />}
                        Bilder hochladen
                      </button>
                    </div>
                  </div>

                  <input
                    ref={referenceInputRef}
                    type="file"
                    accept="image/png,image/gif"
                    multiple
                    className="hidden"
                    onChange={handleReferenceFilesSelected}
                  />

                  <p className="text-[11px] text-[#4a6a8a]">
                    Satire nutzt PNGs und GIFs als Stilanker, um Material, Licht, Preset-Auswahl und die vier Szenenprompts auf deine Referenzwelt zu ziehen.
                  </p>

                  {referenceImages.length > 0 && (
                    <div className="grid gap-3 md:grid-cols-2 xl:grid-cols-4">
                      {referenceImages.map((referenceImage) => (
                        <article
                          key={referenceImage.id}
                          className="overflow-hidden rounded-[18px] border border-[rgba(114,228,255,0.12)] bg-[rgba(8,16,30,0.78)]"
                        >
                          <div className="aspect-video overflow-hidden border-b border-[rgba(114,228,255,0.08)] bg-[#030812]">
                            <img
                              src={referenceImage.previewDataUrl}
                              alt={referenceImage.name}
                              className="h-full w-full object-cover"
                            />
                          </div>
                          <div className="space-y-2 px-3 py-3">
                            <div className="flex items-start justify-between gap-2">
                              <div className="min-w-0">
                                <div className="truncate font-mono text-[11px] text-[#c8ddf0]">{referenceImage.name}</div>
                                <div className="font-mono text-[10px] text-[#4a7090]">
                                  {referenceImage.source.toUpperCase()} · {referenceImage.width}×{referenceImage.height}
                                </div>
                              </div>
                              <button
                                type="button"
                                onClick={() => handleRemoveReferenceImage(referenceImage.id)}
                                className="rounded-full border border-[rgba(114,228,255,0.12)] p-1 text-[#4a7090] transition hover:text-[#f3f8ff] hover:border-[rgba(114,228,255,0.24)]"
                                aria-label={`${referenceImage.name} entfernen`}
                              >
                                <X size={12} />
                              </button>
                            </div>

                            <div className="font-mono text-[10px] leading-relaxed text-[#4a6a8a]">
                              {referenceImage.source === 'gif'
                                ? 'GIF-Stilreferenz. Analyse laeuft ueber ein normalisiertes Still des Loops.'
                                : 'PNG-Stilreferenz. Analyse laeuft ueber eine normalisierte PNG-Fassung.'}
                            </div>
                          </div>
                        </article>
                      ))}
                    </div>
                  )}

                  {referenceError && (
                    <div className="flex items-start gap-2 rounded-lg bg-[rgba(255,80,60,0.1)] border border-[rgba(255,80,60,0.2)] px-4 py-3 text-xs text-[#ff6a4f]">
                      <TriangleAlert size={14} className="mt-0.5 shrink-0" />
                      {referenceError}
                    </div>
                  )}
                </div>
              </div>

              <div className="flex items-center gap-3">
                <button
                  type="button"
                  onClick={handleGenerateSatire}
                  disabled={isGeneratingConcept || !canGenerateSatire}
                  className="flex items-center gap-2 rounded-xl bg-[#0e3a5c] px-5 py-2.5 font-mono text-xs font-semibold text-[#72e4ff] border border-[rgba(114,228,255,0.28)] transition hover:bg-[#153f64] disabled:opacity-40 disabled:cursor-not-allowed"
                >
                  {isGeneratingConcept ? (
                    <>
                      <Loader2 size={14} className="animate-spin" />
                      Generating satire sketch…
                    </>
                  ) : (
                    <>
                      <Sparkles size={14} />
                      {satireSketch ? 'Satire Sketch neu schreiben' : 'Satire Sketch + 4 Beats'}
                    </>
                  )}
                </button>

                {(storyTitle || subject) && (
                  <div className="flex-1 min-w-0 space-y-0.5">
                    {storyTitle && (
                      <span className="block truncate font-mono text-[11px] text-[#4a7090]">
                        Sketch: <span className="text-[#8ea6c3]">{storyTitle}</span>
                      </span>
                    )}
                    {subject && (
                      <span className="block truncate font-mono text-[11px] text-[#4a7090]">
                        Setting: <span className="text-[#8ea6c3]">{subject}</span>
                      </span>
                    )}
                    {microMotion && (
                      <span className="block truncate font-mono text-[11px] text-[#4a7090]">
                        Loop arc: <span className="text-[#8ea6c3]">{microMotion}</span>
                      </span>
                    )}
                    {tokenUsage && (
                      <span className="block font-mono text-[10px] text-[#2a4a6a]">
                        Tokens:{' '}
                        <span className="text-[#4a7090]">{tokenUsage.prompt.toLocaleString()} prompt</span>
                        {' + '}
                        <span className="text-[#4a7090]">{tokenUsage.completion.toLocaleString()} completion</span>
                        {' = '}
                        <span className="text-[#72e4ff] font-semibold">{tokenUsage.total.toLocaleString()} total</span>
                      </span>
                    )}
                  </div>
                )}
              </div>

              {conceptError && (
                <div className="flex items-start gap-2 rounded-lg bg-[rgba(255,80,60,0.1)] border border-[rgba(255,80,60,0.2)] px-4 py-3 text-xs text-[#ff6a4f]">
                  <TriangleAlert size={14} className="mt-0.5 shrink-0" />
                  {conceptError}
                </div>
              )}
            </>
          )}
        </div>

        {(scenes.length > 0 || stylePresets.length > 0 || storyConcept || storyTitle || subject || referenceStyle || satireSketch) && (
          <section className="rounded-[24px] border border-[rgba(114,228,255,0.1)] bg-[rgba(5,10,20,0.72)] px-6 py-5 backdrop-blur-sm space-y-5">
            <div className="flex flex-wrap items-start justify-between gap-6">
              <div className="max-w-3xl space-y-2">
                <div className="font-mono text-[11px] uppercase tracking-[0.22em] text-[#4a7090]">
                  {outputMode === 'satire' ? 'Generated Satire Sketch' : 'Generated Story'}
                </div>
                {storyTitle && (
                  <h2 className="font-mono text-xl font-semibold text-[#f3f8ff]">
                    {storyTitle}
                  </h2>
                )}
                {storyConcept && (
                  <p className="text-sm leading-relaxed text-[#8ea6c3] max-w-2xl">
                    {storyConcept}
                  </p>
                )}
                {outputMode === 'ritual' && keywords.length > 0 && (
                  <div className="flex flex-wrap gap-2 pt-1">
                    {keywords.map((keyword) => (
                      <span
                        key={`generated-${keyword}`}
                        className="rounded-full border border-[rgba(114,228,255,0.18)] bg-[rgba(18,34,58,0.66)] px-2.5 py-1 font-mono text-[10px] uppercase tracking-[0.16em] text-[#72e4ff]"
                      >
                        {keyword}
                      </span>
                    ))}
                  </div>
                )}
                {referenceImages.length > 0 && (
                  <div className="font-mono text-[10px] text-[#36516e]">
                    {referenceImages.length} Referenzbild{referenceImages.length === 1 ? '' : 'er'} aktiv
                  </div>
                )}
              </div>

              <div className="min-w-[220px] space-y-1">
                {subject && (
                  <div className="font-mono text-[11px] text-[#4a7090]">
                    Subject: <span className="text-[#c8ddf0]">{subject}</span>
                  </div>
                )}
                {microMotion && (
                  <div className="font-mono text-[11px] leading-relaxed text-[#4a7090]">
                    Micro-motion: <span className="text-[#c8ddf0]">{microMotion}</span>
                  </div>
                )}
                {tokenUsage && (
                  <div className="font-mono text-[10px] text-[#36516e]">
                    {tokenUsage.total.toLocaleString()} Tokens via Foundry Story Model
                  </div>
                )}
              </div>
            </div>

            {outputMode === 'satire' && satireSketch && (
              <div className="space-y-4 rounded-[20px] border border-[rgba(114,228,255,0.12)] bg-[rgba(7,14,28,0.8)] px-4 py-4">
                <div className="flex flex-wrap items-center justify-between gap-3">
                  <div className="font-mono text-[11px] uppercase tracking-[0.22em] text-[#4a7090]">
                    ARV Satire Sketch
                  </div>
                  <span className="rounded-full border border-[rgba(232,169,74,0.18)] bg-[rgba(48,33,11,0.42)] px-2.5 py-1 font-mono text-[10px] uppercase tracking-[0.14em] text-[#e8c16a]">
                    {satireSketch.satireTarget}
                  </span>
                </div>

                <div className="space-y-1">
                  <div className="font-mono text-[10px] uppercase tracking-[0.16em] text-[#36516e]">
                    Setting
                  </div>
                  <p className="text-sm leading-relaxed text-[#c8ddf0]">
                    {satireSketch.setting}
                  </p>
                </div>

                <div className="grid gap-4 lg:grid-cols-[minmax(0,1.2fr)_minmax(280px,0.8fr)]">
                  <div className="space-y-3">
                    <div className="font-mono text-[10px] uppercase tracking-[0.16em] text-[#36516e]">
                      Dialog
                    </div>
                    <div className="space-y-2">
                      {satireSketch.dialogue.map((line, index) => (
                        <div
                          key={`${line.characterId}-${index}`}
                          className="rounded-xl border border-[rgba(114,228,255,0.08)] bg-[rgba(9,18,34,0.76)] px-3 py-3"
                        >
                          <div className="font-mono text-[10px] uppercase tracking-[0.16em] text-[#72e4ff]">
                            {ARV_CHARACTERS.find((character) => character.id === line.characterId)?.name ?? line.characterId}
                          </div>
                          <p className="mt-1 text-sm leading-relaxed text-[#c8ddf0]">
                            {line.line}
                          </p>
                        </div>
                      ))}
                    </div>
                  </div>

                  <div className="space-y-3">
                    <div className="rounded-[18px] border border-[rgba(114,228,255,0.1)] bg-[rgba(8,16,30,0.82)] px-4 py-4 space-y-2">
                      <div className="font-mono text-[10px] uppercase tracking-[0.16em] text-[#36516e]">
                        Abschluss
                      </div>
                      <p className="text-sm leading-relaxed text-[#c8ddf0]">
                        {satireSketch.conclusion}
                      </p>
                    </div>
                    <div className="rounded-[18px] border border-[rgba(114,228,255,0.1)] bg-[rgba(8,16,30,0.82)] px-4 py-4 space-y-2">
                      <div className="font-mono text-[10px] uppercase tracking-[0.16em] text-[#36516e]">
                        Voreinstellung
                      </div>
                      <div className="space-y-2 font-mono text-[10px] leading-relaxed text-[#4a7090]">
                        <div className="text-[#c8ddf0]">{displayedSatirePresetProfile.name}</div>
                        <div>{displayedSatirePresetProfile.description}</div>
                        <div className="flex flex-wrap gap-2 pt-1">
                          {displayedSatirePresetProfile.presetIds.map((presetId) => (
                            <span
                              key={`applied-${presetId}`}
                              className="rounded-full border border-[rgba(114,228,255,0.16)] bg-[rgba(18,34,58,0.56)] px-2 py-0.5 font-mono text-[10px] uppercase tracking-[0.14em] text-[#72e4ff]"
                            >
                              {presetId}
                            </span>
                          ))}
                        </div>
                      </div>
                    </div>
                    <div className="rounded-[18px] border border-[rgba(114,228,255,0.1)] bg-[rgba(8,16,30,0.82)] px-4 py-4 space-y-2">
                      <div className="font-mono text-[10px] uppercase tracking-[0.16em] text-[#36516e]">
                        Elemente
                      </div>
                      <div className="space-y-2 font-mono text-[10px] leading-relaxed text-[#4a7090]">
                        {SATIRE_ELEMENT_CATEGORY_ORDER.map((category) => {
                          const selectedElement = displayedSatireElements.find((element) => element.category === category);
                          if (!selectedElement) {
                            return null;
                          }

                          return (
                            <div key={`displayed-${category}`}>
                              <div className="text-[#36516e]">{SATIRE_ELEMENT_CATEGORY_LABELS[category]}</div>
                              <div className="text-[#c8ddf0]">{selectedElement.label}</div>
                            </div>
                          );
                        })}
                      </div>
                    </div>
                  </div>
                </div>
              </div>
            )}

            {referenceStyle && (
              <div className="space-y-3 rounded-[20px] border border-[rgba(114,228,255,0.12)] bg-[rgba(7,14,28,0.8)] px-4 py-4">
                <div className="flex flex-wrap items-start justify-between gap-3">
                  <div>
                    <div className="font-mono text-[11px] uppercase tracking-[0.22em] text-[#4a7090]">
                      {outputMode === 'satire' ? 'Editable Satire Reference DNA' : 'Editable Reference DNA'}
                    </div>
                    <div className="mt-1 font-mono text-[10px] leading-relaxed text-[#36516e]">
                      Kurzregeln und Chips koennen angepasst werden. Die DNA wird beim naechsten Generate und beim GPT-Polish erneut mitgesendet.
                    </div>
                  </div>
                  {referenceImages.length > 0 && (
                    <span className="rounded-full border border-[rgba(114,228,255,0.16)] bg-[rgba(18,34,58,0.56)] px-2.5 py-1 font-mono text-[10px] uppercase tracking-[0.14em] text-[#72e4ff]">
                      {referenceImages.length} Referenz{referenceImages.length === 1 ? '' : 'en'} aktiv
                    </span>
                  )}
                </div>
                <div className="grid gap-3 xl:grid-cols-[1.2fr_1fr]">
                  <label className="space-y-2 rounded-[16px] border border-[rgba(114,228,255,0.1)] bg-[rgba(8,16,30,0.72)] p-3">
                    <span className="font-mono text-[10px] uppercase tracking-[0.16em] text-[#36516e]">Summary</span>
                    <textarea
                      value={referenceStyle.summary}
                      onChange={(event) => handleReferenceStyleFieldChange('summary', event.target.value)}
                      rows={4}
                      className="w-full resize-none rounded-lg border border-[rgba(114,228,255,0.12)] bg-[#040d1a] px-3 py-2 font-mono text-[11px] leading-relaxed text-[#c8ddf0] outline-none transition focus:border-[rgba(114,228,255,0.3)]"
                    />
                  </label>
                  <label className="space-y-2 rounded-[16px] border border-[rgba(114,228,255,0.1)] bg-[rgba(8,16,30,0.72)] p-3">
                    <span className="font-mono text-[10px] uppercase tracking-[0.16em] text-[#36516e]">Prompt DNA</span>
                    <textarea
                      value={referenceStyle.promptDNA}
                      onChange={(event) => handleReferenceStyleFieldChange('promptDNA', event.target.value)}
                      rows={4}
                      className="w-full resize-none rounded-lg border border-[rgba(114,228,255,0.12)] bg-[#040d1a] px-3 py-2 font-mono text-[11px] leading-relaxed text-[#c8ddf0] outline-none transition focus:border-[rgba(114,228,255,0.3)]"
                    />
                  </label>
                </div>
                <div className="grid gap-3 lg:grid-cols-3">
                  <label className="space-y-2 rounded-[16px] border border-[rgba(114,228,255,0.1)] bg-[rgba(8,16,30,0.72)] p-3">
                    <span className="font-mono text-[10px] uppercase tracking-[0.16em] text-[#36516e]">Subject Focus</span>
                    <input
                      value={referenceStyle.subjectFocus}
                      onChange={(event) => handleReferenceStyleFieldChange('subjectFocus', event.target.value)}
                      className="w-full rounded-lg border border-[rgba(114,228,255,0.12)] bg-[#040d1a] px-3 py-2 font-mono text-[11px] text-[#c8ddf0] outline-none transition focus:border-[rgba(114,228,255,0.3)]"
                    />
                  </label>
                  <label className="space-y-2 rounded-[16px] border border-[rgba(114,228,255,0.1)] bg-[rgba(8,16,30,0.72)] p-3">
                    <span className="font-mono text-[10px] uppercase tracking-[0.16em] text-[#36516e]">Palette</span>
                    <input
                      value={referenceStyle.palette}
                      onChange={(event) => handleReferenceStyleFieldChange('palette', event.target.value)}
                      className="w-full rounded-lg border border-[rgba(114,228,255,0.12)] bg-[#040d1a] px-3 py-2 font-mono text-[11px] text-[#c8ddf0] outline-none transition focus:border-[rgba(114,228,255,0.3)]"
                    />
                  </label>
                  <label className="space-y-2 rounded-[16px] border border-[rgba(114,228,255,0.1)] bg-[rgba(8,16,30,0.72)] p-3">
                    <span className="font-mono text-[10px] uppercase tracking-[0.16em] text-[#36516e]">Motion Rule</span>
                    <input
                      value={referenceStyle.motion}
                      onChange={(event) => handleReferenceStyleFieldChange('motion', event.target.value)}
                      className="w-full rounded-lg border border-[rgba(114,228,255,0.12)] bg-[#040d1a] px-3 py-2 font-mono text-[11px] text-[#c8ddf0] outline-none transition focus:border-[rgba(114,228,255,0.3)]"
                    />
                  </label>
                </div>
                <div className="space-y-3 rounded-[16px] border border-[rgba(114,228,255,0.1)] bg-[rgba(8,16,30,0.72)] p-3">
                  <div className="flex flex-wrap items-center justify-between gap-2">
                    <span className="font-mono text-[10px] uppercase tracking-[0.16em] text-[#36516e]">DNA Chips</span>
                    <span className="font-mono text-[10px] text-[#36516e]">max. {MAX_REFERENCE_STYLE_KEYWORDS}</span>
                  </div>
                  {referenceStyle.keywords.length > 0 ? (
                    <div className="flex flex-wrap gap-2">
                      {referenceStyle.keywords.map((keyword) => (
                        <button
                          key={`reference-style-${keyword}`}
                          type="button"
                          onClick={() => handleRemoveReferenceKeyword(keyword)}
                          className="inline-flex items-center gap-1 rounded-full border border-[rgba(114,228,255,0.16)] bg-[rgba(18,34,58,0.56)] px-2 py-1 font-mono text-[10px] uppercase tracking-[0.14em] text-[#72e4ff] transition hover:border-[rgba(114,228,255,0.3)] hover:text-[#c8f4ff]"
                        >
                          {keyword}
                          <X size={10} />
                        </button>
                      ))}
                    </div>
                  ) : (
                    <div className="font-mono text-[10px] text-[#36516e]">
                      Noch keine DNA-Chips gesetzt. Fuege kurze Stilregeln oder Materialsignale hinzu.
                    </div>
                  )}
                  <div className="flex flex-col gap-2 sm:flex-row">
                    <input
                      value={referenceKeywordInput}
                      onChange={(event) => setReferenceKeywordInput(event.target.value)}
                      onKeyDown={handleReferenceKeywordKeyDown}
                      placeholder="z. B. fogged glass, pressure flare, lacquer grain"
                      className="flex-1 rounded-lg border border-[rgba(114,228,255,0.12)] bg-[#040d1a] px-3 py-2 font-mono text-[11px] text-[#c8ddf0] placeholder-[#27405e] outline-none transition focus:border-[rgba(114,228,255,0.3)]"
                    />
                    <button
                      type="button"
                      onClick={flushReferenceKeywordInput}
                      disabled={!referenceKeywordInput.trim()}
                      className="rounded-lg border border-[rgba(114,228,255,0.18)] bg-[rgba(14,30,56,0.7)] px-3 py-2 font-mono text-[11px] font-semibold text-[#72e4ff] transition hover:bg-[rgba(20,44,76,0.8)] disabled:cursor-not-allowed disabled:opacity-40"
                    >
                      Chip hinzufuegen
                    </button>
                  </div>
                </div>
              </div>
            )}

            {stylePresets.length > 0 && (
              <div className="space-y-3">
                <div className="font-mono text-[11px] uppercase tracking-[0.22em] text-[#4a7090]">
                  Style Presets
                </div>
                <div className="grid gap-4 lg:grid-cols-3">
                  {stylePresets.map((preset, index) => (
                    <article
                      key={preset.id}
                      className="rounded-[18px] border border-[rgba(114,228,255,0.12)] bg-[rgba(8,16,30,0.82)] p-4 space-y-3"
                    >
                      <div className="flex items-center justify-between gap-3">
                        <span className={`rounded-full border px-2 py-0.5 font-mono text-[10px] uppercase tracking-[0.16em] ${index === 0 ? 'border-[rgba(114,228,255,0.24)] bg-[rgba(18,42,64,0.45)] text-[#72e4ff]' : 'border-[rgba(232,169,74,0.18)] bg-[rgba(48,33,11,0.42)] text-[#e8c16a]'}`}>
                          {index === 0 ? 'Base' : `Accent ${index}`}
                        </span>
                        <span className="font-mono text-[10px] text-[#36516e]">{preset.id}</span>
                      </div>

                      <div>
                        <h3 className="font-mono text-sm font-semibold text-[#f3f8ff]">
                          {preset.name}
                        </h3>
                        <p className="mt-1 text-xs leading-relaxed text-[#8ea6c3]">
                          {preset.visualIdentity}
                        </p>
                      </div>

                      <div className="space-y-2 font-mono text-[10px] leading-relaxed text-[#4a7090]">
                        <div>
                          Palette: <span className="text-[#c8ddf0]">{preset.colorPalette}</span>
                        </div>
                        <div>
                          Lighting: <span className="text-[#c8ddf0]">{preset.lighting}</span>
                        </div>
                        <div>
                          Motion: <span className="text-[#c8ddf0]">{preset.motionStyle}</span>
                        </div>
                        <div>
                          Prompt DNA: <span className="text-[#8ea6c3]">{preset.shortPrompt}</span>
                        </div>
                      </div>
                    </article>
                  ))}
                </div>
              </div>
            )}
          </section>
        )}

        {/* ── Scene beat cards ──────────────────────────────────────────────── */}
        {scenes.length > 0 && (
          <div className="space-y-5">
            {/* Batch actions */}
            <div className="flex flex-wrap items-center gap-3">
              <button
                type="button"
                onClick={handlePolishAll}
                disabled={isPolishingAll || hasActivePolish || scenes.every((scene) => !scene.prompt.trim())}
                className="flex items-center gap-2 rounded-xl border border-[rgba(168,118,255,0.22)] bg-[rgba(33,18,56,0.72)] px-4 py-2 font-mono text-[11px] font-semibold text-[#c7a7ff] transition hover:bg-[rgba(48,24,78,0.82)] disabled:opacity-40 disabled:cursor-not-allowed"
              >
                {isPolishingAll ? (
                  <><Loader2 size={13} className="animate-spin" />Polish {Math.max(activePolishBatchIndex, 0) + 1} / {scenes.length}…</>
                ) : (
                  <><Sparkles size={13} />{outputMode === 'satire' ? 'Alle 4 Satire-Prompts polieren' : 'Alle 4 Prompts polieren'}</>
                )}
              </button>
              <button
                type="button"
                onClick={handleSketchAll}
                disabled={isSketchingAll || isPolishingAll || hasActivePolish || scenes.every((s) => s.sketchStatus === 'loading')}
                className="flex items-center gap-2 rounded-xl border border-[rgba(114,228,255,0.18)] bg-[rgba(14,30,56,0.7)] px-4 py-2 font-mono text-[11px] font-semibold text-[#72e4ff] transition hover:bg-[rgba(20,44,76,0.8)] disabled:opacity-40 disabled:cursor-not-allowed"
              >
                {isSketchingAll ? (
                  <><Loader2 size={13} className="animate-spin" />Sketching {scenes.findIndex((s) => s.sketchStatus === 'loading') + 1} / {scenes.length}…</>
                ) : (
                  <><Camera size={13} />{outputMode === 'satire' ? 'Alle 4 Satire-Szenen skizzieren' : 'Alle 4 Szenen skizzieren'}</>
                )}
              </button>
              <button
                type="button"
                onClick={handleVideoAll}
                disabled={isRenderingAllVideos || isPolishingAll || hasActivePolish || hasActiveVideoRender || scenes.every((scene) => !scene.prompt.trim())}
                className="flex items-center gap-2 rounded-xl border border-[rgba(232,169,74,0.22)] bg-[rgba(42,28,6,0.7)] px-4 py-2 font-mono text-[11px] font-semibold text-[#e8a94a] transition hover:bg-[rgba(58,38,8,0.8)] disabled:opacity-40 disabled:cursor-not-allowed"
              >
                {isRenderingAllVideos ? (
                  <><Loader2 size={13} className="animate-spin" />GIF {Math.max(activeVideoBatchIndex, 0) + 1} / {scenes.length}…</>
                ) : (
                  <><Film size={13} />{outputMode === 'satire' ? 'Alle 4 Satire-GIFs rendern' : 'Alle 4 GIFs rendern'}</>
                )}
              </button>
              <span className="font-mono text-[10px] text-[#2a4060]">
                {outputMode === 'satire'
                  ? 'Polish, Skizzen und GIFs laufen nacheinander durch denselben Vier-Beat-Satirebogen.'
                  : 'Polish, Skizzen und GIF-Loops werden nacheinander entlang der vier Beats erzeugt.'}
              </span>
            </div>

            <div className="grid gap-5 xl:grid-cols-4 lg:grid-cols-2">
              {scenes.map((scene, index) => (
                <SceneCard
                  key={`${scene.beat}-${index}`}
                  scene={scene}
                  index={index}
                  onPromptChange={handlePromptChange}
                  onPolish={handlePolishPrompt}
                  onSketch={handleSketch}
                  onVideo={handleVideo}
                  onVideoRemix={handleVideoRemix}
                  onVideoExtension={handleVideoExtension}
                  runId={runId}
                />
              ))}
            </div>
          </div>
        )}

        {/* ── Empty state ───────────────────────────────────────────────────── */}
        {scenes.length === 0 && !isGeneratingConcept && (
          <div className="rounded-[24px] border border-dashed border-[rgba(114,228,255,0.1)] bg-[rgba(6,12,24,0.4)] py-20 text-center">
            <div className="mx-auto mb-4 h-10 w-10 rounded-full border border-[rgba(114,228,255,0.15)] bg-[rgba(10,20,40,0.6)] flex items-center justify-center">
              <Film size={18} className="text-[#2a5a7a]" />
            </div>
            <p className="font-mono text-sm text-[#2a4060]">
              {generationMode === 'satire'
                ? <>Waehle eine Voreinstellung, optional Referenzbilder und einen Satire-Fokus, und starte oben <span className="text-[#4a7090]">Satire Sketch + 4 Beats</span></>
                : <>Gib ein Konzept, 3 bis 5 Keywords oder Referenzbilder oben ein und klicke auf <span className="text-[#4a7090]">Generate Story Beats</span></>}
            </p>
          </div>
        )}
      </main>
    </div>
  );
}

// ── Scene Card ───────────────────────────────────────────────────────────────

interface SceneCardProps {
  scene: SceneState;
  index: number;
  runId: string;
  onPromptChange: (index: number, value: string) => void;
  onPolish: (index: number) => void;
  onSketch: (index: number) => void;
  onVideo: (index: number) => void;
  onVideoRemix: (index: number) => void;
  onVideoExtension: (index: number) => void;
}

function SceneCard({ scene, index, runId, onPromptChange, onPolish, onSketch, onVideo, onVideoRemix, onVideoExtension }: SceneCardProps) {
  const beatLabel = BEAT_LABELS[scene.beat] ?? `Beat ${index + 1}`;
  const beatColorClass = BEAT_COLORS[scene.beat] ?? 'bg-zinc-800/60 text-zinc-300 border-zinc-700/50';
  const cardRingClass = BEAT_RING[scene.beat] ?? 'border-zinc-700/40';

  return (
    <article
      className={`flex flex-col rounded-[20px] border bg-[rgba(6,12,24,0.72)] backdrop-blur-sm overflow-hidden ${cardRingClass}`}
    >
      {/* Card header */}
      <div className="border-b border-[rgba(255,255,255,0.05)] px-4 py-3 flex items-center gap-2">
        <span
          className={`rounded-full border px-2.5 py-0.5 font-mono text-[10px] font-semibold tracking-widest ${beatColorClass}`}
        >
          {beatLabel}
        </span>
        <span className="ml-auto truncate font-mono text-[11px] text-[#3a5070]">{scene.title}</span>
      </div>

      {/* Motion description */}
      <div className="px-4 pt-3 pb-1">
        <p className="font-mono text-[10px] italic text-[#2a4a6a] leading-relaxed">
          {scene.motion}
        </p>
      </div>

      {/* Prompt textarea */}
      <div className="px-4 py-2 flex-1">
        <textarea
          value={scene.prompt}
          onChange={(e) => onPromptChange(index, e.target.value)}
          rows={6}
          className="w-full resize-none rounded-lg border border-[rgba(114,228,255,0.12)] bg-[#040d1a] px-3 py-2 font-mono text-[11px] text-[#c8ddf0] placeholder-[#1a3050] outline-none focus:border-[rgba(114,228,255,0.3)] transition leading-relaxed"
          placeholder="Generation prompt…"
        />
      </div>

      {/* Action row */}
      <div className="grid grid-cols-5 gap-2 px-4 pb-4 pt-1">
        <button
          type="button"
          onClick={() => onPolish(index)}
          disabled={scene.polishStatus === 'loading'}
          className="flex items-center justify-center gap-1.5 rounded-lg border border-[rgba(168,118,255,0.22)] bg-[rgba(33,18,56,0.72)] px-3 py-2 font-mono text-[11px] font-semibold text-[#c7a7ff] transition hover:bg-[rgba(48,24,78,0.82)] disabled:opacity-40 disabled:cursor-not-allowed"
        >
          {scene.polishStatus === 'loading' ? (
            <>
              <Loader2 size={12} className="animate-spin" />
              GPT…
            </>
          ) : (
            <>
              <Sparkles size={12} />
              Polish
            </>
          )}
        </button>

        <button
          type="button"
          onClick={() => onSketch(index)}
          disabled={scene.sketchStatus === 'loading'}
          className="flex items-center justify-center gap-1.5 rounded-lg border border-[rgba(114,228,255,0.18)] bg-[rgba(14,30,56,0.7)] px-3 py-2 font-mono text-[11px] font-semibold text-[#72e4ff] transition hover:bg-[rgba(20,44,76,0.8)] disabled:opacity-40 disabled:cursor-not-allowed"
        >
          {scene.sketchStatus === 'loading' ? (
            <Loader2 size={12} className="animate-spin" />
          ) : (
            <Camera size={12} />
          )}
          Sketch
        </button>

        <button
          type="button"
          onClick={() => onVideo(index)}
          disabled={scene.videoStatus === 'loading' || scene.videoStatus === 'converting'}
          className="flex items-center justify-center gap-1.5 rounded-lg border border-[rgba(232,169,74,0.22)] bg-[rgba(42,28,6,0.7)] px-3 py-2 font-mono text-[11px] font-semibold text-[#e8a94a] transition hover:bg-[rgba(58,38,8,0.8)] disabled:opacity-40 disabled:cursor-not-allowed"
        >
          {scene.videoStatus === 'loading' ? (
            <>
              <Loader2 size={12} className="animate-spin" />
              Rendering…
            </>
          ) : scene.videoStatus === 'converting' ? (
            <>
              <Loader2 size={12} className="animate-spin" />
              GIF…
            </>
          ) : (
            <>
              <Film size={12} />
              GIF
            </>
          )}
        </button>

        <button
          type="button"
          onClick={() => onVideoRemix(index)}
          disabled={!scene.videoId || scene.videoStatus === 'loading' || scene.videoStatus === 'converting'}
          title={scene.videoId ? 'Remixt das letzte Video dieser Szene ueber seine Video-ID.' : 'Erst ein Video rendern, dann steht Remix per Video-ID zur Verfuegung.'}
          className="flex items-center justify-center gap-1.5 rounded-lg border border-[rgba(168,118,255,0.22)] bg-[rgba(28,18,48,0.72)] px-3 py-2 font-mono text-[11px] font-semibold text-[#c7a7ff] transition hover:bg-[rgba(42,24,72,0.82)] disabled:opacity-40 disabled:cursor-not-allowed"
        >
          {scene.videoStatus === 'loading' || scene.videoStatus === 'converting' ? (
            <Loader2 size={12} className="animate-spin" />
          ) : (
            <RefreshCw size={12} />
          )}
          Remix
        </button>

        <button
          type="button"
          onClick={() => onVideoExtension(index)}
          disabled={!scene.videoId || scene.videoStatus === 'loading' || scene.videoStatus === 'converting'}
          title={scene.videoId ? 'Erweitert das letzte Video dieser Szene ueber seine Video-ID.' : 'Erst ein Video rendern, dann steht die Extension per Video-ID zur Verfuegung.'}
          className="flex items-center justify-center gap-1.5 rounded-lg border border-[rgba(114,228,255,0.18)] bg-[rgba(10,32,46,0.72)] px-3 py-2 font-mono text-[11px] font-semibold text-[#72e4ff] transition hover:bg-[rgba(16,46,66,0.82)] disabled:opacity-40 disabled:cursor-not-allowed"
        >
          {scene.videoStatus === 'loading' || scene.videoStatus === 'converting' ? (
            <Loader2 size={12} className="animate-spin" />
          ) : (
            <ChevronsDown size={12} />
          )}
          Extend
        </button>
      </div>

      {/* Error states */}
      {scene.errorSketch && (
        <ErrorBadge message={scene.errorSketch} />
      )}
      {scene.errorPolish && (
        <ErrorBadge message={scene.errorPolish} />
      )}
      {scene.errorVideo && (
        <ErrorBadge message={scene.errorVideo} />
      )}

      {scene.renderPromptDebug && (
        <details className="mx-4 mb-4 rounded-[16px] border border-[rgba(114,228,255,0.1)] bg-[rgba(8,16,30,0.82)] px-4 py-3 text-xs">
          <summary className="cursor-pointer font-mono text-[10px] uppercase tracking-[0.18em] text-[#72e4ff]">
            Prompt-Debug · {scene.renderPromptDebug.target === 'video' ? 'GIF Render' : 'Sketch Render'}
          </summary>
          <div className="mt-3 space-y-3">
            <div>
              <div className="font-mono text-[10px] uppercase tracking-[0.16em] text-[#36516e]">Rohprompt</div>
              <pre className="mt-2 whitespace-pre-wrap rounded-lg border border-[rgba(114,228,255,0.08)] bg-[#040d1a] px-3 py-2 font-mono text-[10px] leading-relaxed text-[#8ea6c3] overflow-x-auto">
                {scene.renderPromptDebug.rawPrompt}
              </pre>
            </div>
            <div>
              <div className="font-mono text-[10px] uppercase tracking-[0.16em] text-[#36516e]">Bereinigter Prompt-Core</div>
              <pre className="mt-2 whitespace-pre-wrap rounded-lg border border-[rgba(114,228,255,0.12)] bg-[rgba(10,24,42,0.86)] px-3 py-2 font-mono text-[10px] leading-relaxed text-[#c8ddf0] overflow-x-auto">
                {scene.renderPromptDebug.cleanedPrompt}
              </pre>
            </div>
            <div>
              <div className="font-mono text-[10px] uppercase tracking-[0.16em] text-[#36516e]">Finaler Modellprompt</div>
              <pre className="mt-2 max-h-72 overflow-auto whitespace-pre-wrap rounded-lg border border-[rgba(168,118,255,0.12)] bg-[rgba(20,14,34,0.82)] px-3 py-2 font-mono text-[10px] leading-relaxed text-[#d8c2ff]">
                {scene.renderPromptDebug.finalPrompt}
              </pre>
            </div>
            {(scene.renderPromptDebug.renderMode || scene.renderPromptDebug.sourceVideoId || scene.renderPromptDebug.resultVideoId) && (
              <div className="rounded-lg border border-[rgba(114,228,255,0.08)] bg-[#040d1a] px-3 py-2 font-mono text-[10px] leading-relaxed text-[#8ea6c3]">
                Rendermodus: {scene.renderPromptDebug.renderMode === 'extend' ? 'Extension' : scene.renderPromptDebug.renderMode === 'remix' ? 'Remix' : 'Neurender'}
                {scene.renderPromptDebug.sourceVideoId ? ` · Quelle: ${scene.renderPromptDebug.sourceVideoId}` : ''}
                {scene.renderPromptDebug.resultVideoId ? ` · Ergebnis: ${scene.renderPromptDebug.resultVideoId}` : ''}
              </div>
            )}
            {scene.renderPromptDebug.iqBrief && (
              <div className="space-y-3 rounded-xl border border-[rgba(114,228,255,0.12)] bg-[rgba(8,18,32,0.75)] p-4">
                <div className="font-mono text-[10px] uppercase tracking-[0.16em] text-[#72e4ff]">
                  IQ Brief · {scene.renderPromptDebug.iqBrief.usedRemote ? 'Foundry IQ' : 'Workspace KB'}
                </div>
                <pre className="max-h-56 overflow-auto whitespace-pre-wrap rounded-lg border border-[rgba(114,228,255,0.12)] bg-[rgba(3,8,16,0.72)] px-3 py-2 font-mono text-[10px] leading-relaxed text-[#c8ddf0]">
                  {scene.renderPromptDebug.iqBrief.promptBlock}
                </pre>
                {scene.renderPromptDebug.iqBrief.citations.length > 0 && (
                  <div className="space-y-2">
                    {scene.renderPromptDebug.iqBrief.citations.map((citation) => (
                      <div key={`${citation.source}-${citation.excerpt.slice(0, 24)}`} className="rounded-lg border border-[rgba(114,228,255,0.08)] bg-[rgba(5,12,24,0.72)] p-3">
                        <div className="font-mono text-[10px] uppercase tracking-[0.16em] text-[#72e4ff]">{citation.source}</div>
                        <div className="mt-1 text-[10px] leading-relaxed text-[#8ea6c3]">{citation.excerpt}</div>
                      </div>
                    ))}
                  </div>
                )}
              </div>
            )}
            {(scene.renderPromptDebug.stylePresetIds.length > 0 || scene.renderPromptDebug.referenceStyleSummary) && (
              <div className="space-y-2">
                {scene.renderPromptDebug.stylePresetIds.length > 0 && (
                  <div className="flex flex-wrap gap-2">
                    {scene.renderPromptDebug.stylePresetIds.map((presetId) => (
                      <span
                        key={`${scene.beat}-${presetId}`}
                        className="rounded-full border border-[rgba(114,228,255,0.14)] bg-[rgba(18,34,58,0.56)] px-2 py-0.5 font-mono text-[10px] uppercase tracking-[0.14em] text-[#72e4ff]"
                      >
                        {presetId}
                      </span>
                    ))}
                  </div>
                )}
                {scene.renderPromptDebug.referenceStyleSummary && (
                  <div className="font-mono text-[10px] leading-relaxed text-[#4a7090]">
                    Referenz-DNA: <span className="text-[#8ea6c3]">{scene.renderPromptDebug.referenceStyleSummary}</span>
                  </div>
                )}
              </div>
            )}
          </div>
        </details>
      )}

      {scene.videoId && (
        <div className="mx-4 mb-4 rounded-[16px] border border-[rgba(232,169,74,0.12)] bg-[rgba(22,16,6,0.72)] px-4 py-3 text-xs">
          <div className="flex items-center gap-2">
            <div className="font-mono text-[10px] uppercase tracking-[0.16em] text-[#8a6a30]">Video-ID</div>
            {scene.remixedFromVideoId && (
              <div className="ml-auto font-mono text-[10px] text-[#b9a06d]">
                {scene.videoTransformMode === 'extend' ? 'Extension von' : 'Remix von'} {scene.remixedFromVideoId}
              </div>
            )}
          </div>
          <div className="mt-2 flex items-center gap-2">
            <div className="min-w-0 flex-1 truncate rounded-lg border border-[rgba(232,169,74,0.12)] bg-[rgba(38,26,10,0.72)] px-3 py-2 font-mono text-[10px] text-[#f0d39a]">
              {scene.videoId}
            </div>
            <CopyTextButton text={scene.videoId} label="ID" copiedLabel="Kopiert" compact />
          </div>
        </div>
      )}

      {/* Sketch output */}
      {scene.sketchStatus === 'done' && scene.sketchData && (
        <AssetBlock
          label="Sketch"
          type="image"
          src={scene.sketchData}
          downloadName={`stillframe-${runId}-s${index + 1}-${scene.beat}-sketch.png`}
        />
      )}

      {/* GIF output */}
      {scene.videoStatus === 'done' && scene.gifData && (
        <AssetBlock
          label="GIF Loop"
          type="gif"
          src={scene.gifData}
          downloadName={`stillframe-${runId}-s${index + 1}-${scene.beat}-loop.gif`}
        />
      )}
    </article>
  );
}

// ── Sub-components ───────────────────────────────────────────────────────────

function CopyTextButton({
  text,
  label = 'Kopieren',
  copiedLabel = 'Kopiert',
  compact = false,
}: {
  text: string;
  label?: string;
  copiedLabel?: string;
  compact?: boolean;
}) {
  const [copied, setCopied] = useState(false);

  const handleCopy = async () => {
    const success = await copyText(text);
    if (!success) {
      return;
    }

    setCopied(true);
    window.setTimeout(() => setCopied(false), 1800);
  };

  return (
    <button
      type="button"
      onClick={() => void handleCopy()}
      className={`inline-flex items-center justify-center gap-1.5 rounded-lg border border-[rgba(168,118,255,0.2)] bg-[rgba(33,18,56,0.72)] font-mono text-[10px] font-semibold text-[#d8c2ff] transition hover:bg-[rgba(48,24,78,0.82)] ${compact ? 'px-2 py-1' : 'px-3 py-2'}`}
    >
      {copied ? <CheckCircle2 size={12} className="text-[#8df0b4]" /> : <Copy size={12} />}
      {copied ? copiedLabel : label}
    </button>
  );
}

function IdeaListPanel({
  label,
  items,
  allowUse,
  onUseRitual,
  onUseSatire,
}: {
  label: string;
  items: string[];
  allowUse?: 'ritual' | 'satire' | 'both';
  onUseRitual: (value: string) => void;
  onUseSatire: (value: string) => void;
}) {
  return (
    <article className="rounded-[18px] border border-[rgba(168,118,255,0.14)] bg-[rgba(8,12,24,0.76)] p-4 space-y-3">
      <div className="font-mono text-[10px] uppercase tracking-[0.18em] text-[#705d92]">{label}</div>

      {items.length === 0 ? (
        <div className="font-mono text-[10px] leading-relaxed text-[#5c4b78]">
          Noch keine Eintraege. Starte oben einen neuen Vision-Run.
        </div>
      ) : (
        <div className="space-y-2">
          {items.map((item, index) => (
            <div key={`${label}-${index}`} className="rounded-[14px] border border-[rgba(168,118,255,0.1)] bg-[rgba(14,14,30,0.72)] p-3 space-y-2">
              <div className="font-mono text-[11px] leading-relaxed text-[#efe5ff]">{item}</div>
              <div className="flex flex-wrap gap-2">
                <CopyTextButton text={item} compact />
                {(allowUse === 'ritual' || allowUse === 'both') && (
                  <button
                    type="button"
                    onClick={() => onUseRitual(item)}
                    className="rounded-lg border border-[rgba(114,228,255,0.18)] bg-[rgba(10,26,46,0.72)] px-2 py-1 font-mono text-[10px] font-semibold text-[#72e4ff] transition hover:bg-[rgba(18,38,64,0.82)]"
                  >
                    Ritual Input
                  </button>
                )}
                {(allowUse === 'satire' || allowUse === 'both') && (
                  <button
                    type="button"
                    onClick={() => onUseSatire(item)}
                    className="rounded-lg border border-[rgba(232,169,74,0.18)] bg-[rgba(42,28,6,0.7)] px-2 py-1 font-mono text-[10px] font-semibold text-[#e8c16a] transition hover:bg-[rgba(58,38,8,0.8)]"
                  >
                    Satire Fokus
                  </button>
                )}
              </div>
            </div>
          ))}
        </div>
      )}
    </article>
  );
}

function IdeaVisionCard({
  vision,
  onUseRitual,
  onUseSatire,
  onGenerateRitual,
  onGenerateSatire,
  isGenerating,
}: {
  vision: StillframeIdeaVision;
  onUseRitual: (value: string) => void;
  onUseSatire: (value: string) => void;
  onGenerateRitual: (vision: StillframeIdeaVision) => Promise<void>;
  onGenerateSatire: (vision: StillframeIdeaVision) => Promise<void>;
  isGenerating: boolean;
}) {
  const visionClipboardText = [
    vision.title,
    `Theme: ${vision.theme}`,
    `Character: ${vision.character}`,
    `Event: ${vision.event}`,
    `Action: ${vision.action}`,
    `Story: ${vision.story}`,
    `Style: ${vision.style}`,
    `Prompt seed: ${vision.promptSeed}`,
    `Preset seed: ${vision.presetSeed}`,
  ].join('\n');

  return (
    <article className="rounded-[20px] border border-[rgba(168,118,255,0.14)] bg-[rgba(9,12,24,0.8)] p-4 space-y-4">
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div className="space-y-1">
          <div className="font-mono text-[10px] uppercase tracking-[0.18em] text-[#705d92]">Vision Card</div>
          <h3 className="font-mono text-sm font-semibold text-[#f3eaff]">{vision.title}</h3>
        </div>
        <div className="flex flex-wrap items-center gap-2">
          <button
            type="button"
            onClick={() => void onGenerateRitual(vision)}
            disabled={isGenerating}
            className="rounded-lg border border-[rgba(114,228,255,0.18)] bg-[rgba(10,26,46,0.72)] px-2 py-1 font-mono text-[10px] font-semibold text-[#72e4ff] transition hover:bg-[rgba(18,38,64,0.82)] disabled:cursor-not-allowed disabled:opacity-40"
          >
            {isGenerating ? 'Laeuft...' : '4 Ritual Beats'}
          </button>
          <button
            type="button"
            onClick={() => void onGenerateSatire(vision)}
            disabled={isGenerating}
            className="rounded-lg border border-[rgba(232,169,74,0.18)] bg-[rgba(42,28,6,0.7)] px-2 py-1 font-mono text-[10px] font-semibold text-[#e8c16a] transition hover:bg-[rgba(58,38,8,0.8)] disabled:cursor-not-allowed disabled:opacity-40"
          >
            {isGenerating ? 'Laeuft...' : '4 Satire Beats'}
          </button>
          <CopyTextButton text={visionClipboardText} label="Card kopieren" copiedLabel="Card kopiert" compact />
        </div>
      </div>

      <div className="grid gap-3 md:grid-cols-2">
        <div className="space-y-2 font-mono text-[10px] leading-relaxed text-[#8f74c9]">
          <div>Theme: <span className="text-[#efe5ff]">{vision.theme}</span></div>
          <div>Character: <span className="text-[#efe5ff]">{vision.character}</span></div>
          <div>Event: <span className="text-[#efe5ff]">{vision.event}</span></div>
          <div>Action: <span className="text-[#efe5ff]">{vision.action}</span></div>
          <div>Style: <span className="text-[#efe5ff]">{vision.style}</span></div>
        </div>

        <div className="space-y-3">
          <div className="rounded-[14px] border border-[rgba(168,118,255,0.1)] bg-[rgba(14,14,30,0.72)] p-3 space-y-2">
            <div className="font-mono text-[10px] uppercase tracking-[0.16em] text-[#705d92]">Story</div>
            <div className="font-mono text-[11px] leading-relaxed text-[#efe5ff]">{vision.story}</div>
            <div className="flex flex-wrap gap-2">
              <CopyTextButton text={vision.story} compact />
              <button
                type="button"
                onClick={() => onUseRitual(vision.story)}
                className="rounded-lg border border-[rgba(114,228,255,0.18)] bg-[rgba(10,26,46,0.72)] px-2 py-1 font-mono text-[10px] font-semibold text-[#72e4ff] transition hover:bg-[rgba(18,38,64,0.82)]"
              >
                Ritual Input
              </button>
              <button
                type="button"
                onClick={() => onUseSatire(vision.story)}
                className="rounded-lg border border-[rgba(232,169,74,0.18)] bg-[rgba(42,28,6,0.7)] px-2 py-1 font-mono text-[10px] font-semibold text-[#e8c16a] transition hover:bg-[rgba(58,38,8,0.8)]"
              >
                Satire Fokus
              </button>
            </div>
          </div>

          <div className="rounded-[14px] border border-[rgba(168,118,255,0.1)] bg-[rgba(14,14,30,0.72)] p-3 space-y-2">
            <div className="font-mono text-[10px] uppercase tracking-[0.16em] text-[#705d92]">Prompt Seed</div>
            <div className="font-mono text-[11px] leading-relaxed text-[#efe5ff]">{vision.promptSeed}</div>
            <div className="flex flex-wrap gap-2">
              <CopyTextButton text={vision.promptSeed} compact />
              <button
                type="button"
                onClick={() => onUseRitual(vision.promptSeed)}
                className="rounded-lg border border-[rgba(114,228,255,0.18)] bg-[rgba(10,26,46,0.72)] px-2 py-1 font-mono text-[10px] font-semibold text-[#72e4ff] transition hover:bg-[rgba(18,38,64,0.82)]"
              >
                Ritual Input
              </button>
              <button
                type="button"
                onClick={() => onUseSatire(vision.promptSeed)}
                className="rounded-lg border border-[rgba(232,169,74,0.18)] bg-[rgba(42,28,6,0.7)] px-2 py-1 font-mono text-[10px] font-semibold text-[#e8c16a] transition hover:bg-[rgba(58,38,8,0.8)]"
              >
                Satire Fokus
              </button>
            </div>
          </div>

          <div className="rounded-[14px] border border-[rgba(168,118,255,0.1)] bg-[rgba(14,14,30,0.72)] p-3 space-y-2">
            <div className="font-mono text-[10px] uppercase tracking-[0.16em] text-[#705d92]">Preset Seed</div>
            <div className="font-mono text-[11px] leading-relaxed text-[#efe5ff]">{vision.presetSeed}</div>
            <CopyTextButton text={vision.presetSeed} compact />
          </div>
        </div>
      </div>
    </article>
  );
}

function ErrorBadge({ message }: { message: string }) {
  return (
    <div className="mx-4 mb-3 flex items-start gap-2 rounded-lg bg-[rgba(255,80,60,0.08)] border border-[rgba(255,80,60,0.18)] px-3 py-2 text-[10px] text-[#ff6a4f] font-mono">
      <TriangleAlert size={11} className="mt-0.5 shrink-0" />
      <span className="break-words min-w-0">{message}</span>
    </div>
  );
}

interface AssetBlockProps {
  label: string;
  type: 'image' | 'gif';
  src: string;
  downloadName: string;
}

function AssetBlock({ label, type, src, downloadName }: AssetBlockProps) {
  return (
    <div className="border-t border-[rgba(255,255,255,0.05)] px-4 pt-3 pb-4 space-y-2">
      <div className="flex items-center justify-between">
        <span className="font-mono text-[10px] uppercase tracking-[0.2em] text-[#3a5070]">{label}</span>
        <button
          type="button"
          onClick={() => downloadDataUrl(src, downloadName)}
          className="flex items-center gap-1 rounded-md border border-[rgba(114,228,255,0.15)] bg-[rgba(10,20,40,0.5)] px-2 py-1 font-mono text-[10px] text-[#4a7090] transition hover:text-[#72e4ff] hover:border-[rgba(114,228,255,0.3)]"
        >
          <Download size={10} />
          Save
        </button>
      </div>

      <div className="overflow-hidden rounded-lg border border-[rgba(114,228,255,0.1)]">
        {type === 'gif' ? (
          <img
            src={src}
            alt={`${label} output`}
            className="w-full h-auto object-contain"
          />
        ) : (
          <img
            src={src}
            alt={`${label} output`}
            className="w-full h-auto object-contain"
          />
        )}
      </div>
    </div>
  );
}

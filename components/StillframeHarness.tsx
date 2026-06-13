import React, { useCallback, useEffect, useRef, useState } from 'react';
import JSZip from 'jszip';
import {
  BookOpen,
  Camera,
  ChevronsDown,
  CheckCircle2,
  Copy,
  Database,
  Download,
  Film,
  ImagePlus,
  Loader2,
  Play,
  RefreshCw,
  Sparkles,
  Tags,
  Terminal,
  TriangleAlert,
  X,
} from 'lucide-react';
import type { ARVSatireSketch } from '../lib/arvTypes';

import { arvMinimalSignalGeometryPreset } from '../lib/minimalSignalGeometryPreset';
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

type BeatType = 'scene-1' | 'scene-2' | 'scene-3' | 'scene-4';
type AssetStatus = 'idle' | 'loading' | 'converting' | 'done' | 'error';
type GenerationMode = 'ritual' | 'satire' | 'signal';
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
  durationSeconds: number;
  polishStatus: AssetStatus;
  sketchStatus: AssetStatus;
  sketchData: string | null;
  videoStatus: AssetStatus;
  videoId: string | null;
  remixedFromVideoId: string | null;
  videoTransformMode: VideoTransformMode | null;
  videoTransformPrompt: string;
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

type DemoStageId = 'concept' | 'scene-1' | 'scene-2' | 'scene-3' | 'scene-4';
type DemoStageStatus = 'pending' | 'active' | 'done' | 'error';

interface DemoRunState {
  status: 'idle' | 'running' | 'done' | 'error';
  stages: Record<DemoStageId, DemoStageStatus>;
  error: string | null;
  startedAt: number | null;
  finishedAt: number | null;
}

interface StillframeGeneratedContext {
  storyTitle: string | null;
  storyConcept: string | null;
  stylePresets: StillframeStylePresetSummary[];
  referenceStyle: StillframeReferenceStyleSummary | null;
}

type StudioView = 'demo' | 'manual-demo' | 'werkstatt';

type PipelineLogLevel = 'info' | 'detail' | 'success' | 'error';

interface PipelineLogEntry {
  id: number;
  time: number;
  level: PipelineLogLevel;
  text: string;
}
type DemoNarrationStepId = 'ready' | 'concept' | 'grounding' | 'render' | 'results' | 'zip' | 'done' | 'error';
type DemoFocusTarget = 'demo' | 'log' | 'results' | 'zip';
interface DemoNarrationStep {
  id: DemoNarrationStepId;
  title: string;
  kicker: string;
  body: string;
  target: DemoFocusTarget;
}

interface StillframeStoryMemoryScene {
  index: number;
  beat: string;
  title: string;
  prompt: string;
  motion: string;
  durationSeconds?: number;
  videoId?: string | null;
  remixedFromVideoId?: string | null;
  videoTransformMode?: VideoTransformMode | null;
}

interface StillframeStoryMemoryCard {
  type: 'stillframe_story_memory';
  id: string;
  createdAt: string;
  updatedAt: string;
  title: string;
  sourcePrompt: string;
  storyConcept: string;
  continuationOf?: string | null;
  referenceStyle?: StillframeReferenceStyleSummary | null;
  stylePresets: StillframeStylePresetSummary[];
  scenes: StillframeStoryMemoryScene[];
  notes?: string;
}

// ── Constants ────────────────────────────────────────────────────────────────

const BEAT_LABELS: Record<BeatType, string> = {
  'scene-1': '① Szene 1',
  'scene-2': '② Szene 2',
  'scene-3': '③ Szene 3',
  'scene-4': '④ Szene 4',
};

const BEAT_COLORS: Record<BeatType, string> = {
  'scene-1': 'bg-cobalt/20 text-[#7db4e8] border-[#3a6090]/50',
  'scene-2': 'bg-[#1a2e1a]/60 text-[#72d9a0] border-[#2a5a3a]/50',
  'scene-3': 'bg-[#2a1a00]/60 text-[#e8a94a] border-[#6a4010]/50',
  'scene-4': 'bg-[#1a0e2a]/60 text-[#b08af0] border-[#4a2a80]/50',
};

const BEAT_RING: Record<BeatType, string> = {
  'scene-1': 'border-[#3a6090]/40',
  'scene-2': 'border-[#2a5a3a]/40',
  'scene-3': 'border-[#6a4010]/40',
  'scene-4': 'border-[#4a2a80]/40',
};

const PLACEHOLDER_CONCEPTS = [
  'A suspended glass engine breathing over a dark floor grid',
  'A miniature weather system forming above a silent machine basin',
  'A signal aperture opening once inside a fogged steel chamber',
  'A kinetic structure folding light through dust and residue',
  'A synthetic organism drifting through a restrained industrial void',
];

const DEMO_STAGE_IDS: DemoStageId[] = ['concept', 'scene-1', 'scene-2', 'scene-3', 'scene-4'];

const DEMO_STAGE_LABELS: Record<DemoStageId, string> = {
  concept: 'Story-Konzept + 4 Beats',
  'scene-1': 'Szene 1 · Sora → GIF',
  'scene-2': 'Szene 2 · Sora → GIF',
  'scene-3': 'Szene 3 · Sora → GIF',
  'scene-4': 'Szene 4 · Sora → GIF',
};

const createIdleDemoStages = (): Record<DemoStageId, DemoStageStatus> => ({
  concept: 'pending',
  'scene-1': 'pending',
  'scene-2': 'pending',
  'scene-3': 'pending',
  'scene-4': 'pending',
});

const IDLE_DEMO_RUN: DemoRunState = {
  status: 'idle',
  stages: createIdleDemoStages(),
  error: null,
  startedAt: null,
  finishedAt: null,
};

const DEMO_SEEDS: Record<GenerationMode, string> = {
  ritual: 'A suspended glass signal engine breathing over a dark hangar floor, archive dust drifting through cyan scan light, one slow mechanical exhale per loop',
  satire: 'A pressure-core open-plan ritual where a polite glass machine quietly malfunctions during its own performance review',
  signal: 'black CRT field, one acid-cyan spiral tightening into a single dot, scanner sweep with afterimage residue',
};
const DEMO_NARRATION_STEPS: Record<DemoNarrationStepId, DemoNarrationStep> = {
  ready: {
    id: 'ready',
    title: 'OBS Demo Assistenz bereit',
    kicker: 'Aufnahme-Setup',
    body: 'Starte jetzt die Bildschirmaufnahme und klicke dann auf Demo-Lauf starten. Die App kommentiert den Ablauf visuell und fuehrt den Fokus automatisch durch die Produktion.',
    target: 'demo',
  },
  concept: {
    id: 'concept',
    title: 'Story-Konzept und vier Beats entstehen',
    kicker: 'Schritt 1',
    body: 'Aus Prompt, Modus und ARV-Stilregeln entsteht ein sendefaehiger Mini-Storyboard-Bogen mit vier editierbaren Szenenprompts.',
    target: 'demo',
  },
  grounding: {
    id: 'grounding',
    title: 'Foundry IQ grounded jede Szene',
    kicker: 'Schritt 2',
    body: 'Vor dem Rendern werden Kanalstil, Motive und Verbote aus der ARV-Wissensbasis in den finalen Sora-Prompt eingemischt. Das Log zeigt Query, Quellen und Prompt-Preview.',
    target: 'log',
  },
  render: {
    id: 'render',
    title: 'Sora rendert Video, danach entsteht der GIF-Loop',
    kicker: 'Schritt 3',
    body: 'Jede Szene laeuft sequenziell: Prompt-Preview, Sora-Request, Video-Ergebnis, Konvertierung zu einem loopbaren 16:9-GIF fuer die Dia-Show.',
    target: 'results',
  },
  results: {
    id: 'results',
    title: 'Die vier Szenen sind sichtbar nachvollziehbar',
    kicker: 'Ergebnis',
    body: 'Die Karten zeigen Titel, Motion, finalen Prompt-Debug, Video-ID und GIF-Status. So sieht man, was wirklich produziert wurde.',
    target: 'results',
  },
  zip: {
    id: 'zip',
    title: 'Szenen-ZIP wird vorbereitet',
    kicker: 'Export',
    body: 'Das ZIP buendelt story.json, prompts.md und alle vorhandenen GIF-/Sketch-Assets. Es ist das transportierbare Ergebnis fuer Video- und OBS-Produktion.',
    target: 'zip',
  },
  done: {
    id: 'done',
    title: 'Demo-Lauf abgeschlossen',
    kicker: 'Fertig',
    body: 'Die komplette Pipeline ist dokumentiert: Konzept, Grounding, Render, GIF-Loops und ZIP-Download. Danach kann das Thumbnail Studio Titel, Beschreibung, Hashtags und SEO liefern.',
    target: 'zip',
  },
  error: {
    id: 'error',
    title: 'Demo-Lauf braucht Aufmerksamkeit',
    kicker: 'Fehler',
    body: 'Ein Schritt hat gemeldet, dass er nicht fertig wurde. Das Live Pipeline Log bleibt im Fokus, damit die Ursache fuer die Aufnahme sichtbar ist.',
    target: 'log',
  },
};

const truncateForLog = (text: string, max = 160): string => {
  const clean = text.replace(/\s+/g, ' ').trim();
  return clean.length > max ? `${clean.slice(0, max - 1)}…` : clean;
};

const truncateForPreview = (text: string, max = 280): string => {
  const clean = text.replace(/\s+/g, ' ').trim();
  return clean.length > max ? `${clean.slice(0, max - 1)}…` : clean;
};

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
const MAX_REFERENCE_IMAGES = 4;
const MAX_REFERENCE_FILE_BYTES = 15 * 1024 * 1024;
const REFERENCE_ANALYSIS_MAX_DIMENSION = 1024;
const SUPPORTED_VIDEO_DURATION_SECONDS = [4, 8, 12] as const;
const DEFAULT_VIDEO_DURATION_SECONDS = 4;

const GENERATION_MODE_LABELS: Record<GenerationMode, string> = {
  ritual: 'Ritual Story Beats',
  satire: 'Satire Sketch',
  signal: 'Minimal Signal Geometry',
};

const GENERATION_MODE_STATUS_LABELS: Record<GenerationMode, string> = {
  ritual: 'Ritual Vision Lab',
  satire: 'Satire Vision Lab',
  signal: 'Signal Geometry Lab',
};

const GENERATION_MODE_DESCRIPTIONS: Record<GenerationMode, string> = {
  ritual: 'Hypnotic micro-motion stop-frame loops via Azure OpenAI Foundry. Gib 3 bis 5 Schlagwoerter, ein freies Konzept oder Referenzbilder an, lass dir passende Stil-Presets und 4 diverse Szenen-Prompts bauen und rendere daraus GIF-Loops fuer die naechste Stream-Dia-Show.',
  satire: 'Einfacher ARV-Satiremodus mit zwei Figuren, einem optionalen Satire-Fokus und direkt generierten Sketch- plus GIF-Szenen – als humorvolle Visual-Ebene zwischen den Techno-Loops.',
  signal: 'Minimalistische CRT-Signalgeometrie auf schwarzem Grund: Motif und Motion-Event waehlen, daraus 4 abstrakte Loop-Szenen mit duennen Linien, Scanlines und sauberem Signal-Payoff bauen – ideal als reduzierte Visuals fuer dunkle Techno-Sets.',
};

const IDEA_SECTION_CONFIG: Array<{ key: StillframeIdeaListKey; label: string; useTarget?: 'ritual' | 'satire' | 'signal' | 'both' | 'all' }> = [
  { key: 'themes', label: 'Themen' },
  { key: 'characters', label: 'Charaktere' },
  { key: 'events', label: 'Ereignisse' },
  { key: 'actions', label: 'Handlungen' },
  { key: 'stories', label: 'Geschichten', useTarget: 'all' },
  { key: 'styles', label: 'Styles' },
  { key: 'promptSeeds', label: 'Prompt Seeds', useTarget: 'all' },
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
  storyTitle: string | null,
  storyConcept: string | null,
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
    storyTitle: storyTitle?.trim() || undefined,
    storyConcept: storyConcept?.trim() || undefined,
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

const sanitizeFilenamePart = (value: string): string => (
  value
    .trim()
    .toLowerCase()
    .replace(/[^a-z0-9]+/gi, '-')
    .replace(/^-+|-+$/g, '')
    .slice(0, 80) || 'story'
);

const downloadBlob = (blob: Blob, filename: string) => {
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  a.download = filename;
  a.click();
  window.setTimeout(() => URL.revokeObjectURL(url), 250);
};

const addAssetToZip = async (zip: JSZip, path: string, assetUrl: string) => {
  const response = await fetch(assetUrl);
  const blob = await response.blob();
  zip.file(path, blob);
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

const dataUrlToObjectUrl = (dataUrl: string): string => {
  if (!dataUrl.startsWith('data:')) {
    return dataUrl;
  }

  const [header, payload] = dataUrl.split(',');
  const mimeType = header.match(/^data:([^;]+)/)?.[1] || 'application/octet-stream';
  const binary = window.atob(payload || '');
  const bytes = new Uint8Array(binary.length);
  for (let index = 0; index < binary.length; index += 1) {
    bytes[index] = binary.charCodeAt(index);
  }
  return URL.createObjectURL(new Blob([bytes], { type: mimeType }));
};

const revokeObjectUrl = (value?: string | null) => {
  if (value?.startsWith('blob:')) {
    URL.revokeObjectURL(value);
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

const normalizeVideoDurationSeconds = (value: unknown): number => {
  const parsed = Number(value);
  if (!Number.isFinite(parsed)) {
    return DEFAULT_VIDEO_DURATION_SECONDS;
  }

  return SUPPORTED_VIDEO_DURATION_SECONDS.reduce((closest, duration) => {
    const closestDistance = Math.abs(closest - parsed);
    const durationDistance = Math.abs(duration - parsed);
    return durationDistance < closestDistance ? duration : closest;
  }, DEFAULT_VIDEO_DURATION_SECONDS);
};

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
    durationSeconds: DEFAULT_VIDEO_DURATION_SECONDS,
    polishStatus: 'idle',
    sketchStatus: 'idle',
    sketchData: null,
    videoStatus: 'idle',
    videoId: null,
    remixedFromVideoId: null,
    videoTransformMode: null,
    videoTransformPrompt: '',
    videoBase64: null,
    gifData: null,
    errorPolish: null,
    errorSketch: null,
    errorVideo: null,
    renderPromptDebug: null,
  }));

// ── Component ────────────────────────────────────────────────────────────────

export default function StillframeHarness() {
  const [generationMode, setGenerationMode] = useState<GenerationMode>('ritual');
  const [outputMode, setOutputMode] = useState<GenerationMode | null>(null);
  const [concept, setConcept] = useState('');
  const [ideaSeed, setIdeaSeed] = useState('');
  const [keywordInput, setKeywordInput] = useState('');
  const [keywords, setKeywords] = useState<string[]>([]);
  const [referenceImages, setReferenceImages] = useState<ReferenceImageAsset[]>([]);
  const [satirePrompt, setSatirePrompt] = useState('');
  const [signalPrompt, setSignalPrompt] = useState('');
  const [selectedSignalMotif, setSelectedSignalMotif] = useState<string>(arvMinimalSignalGeometryPreset.defaultMotifs[0]);
  const [selectedSignalMotionEvent, setSelectedSignalMotionEvent] = useState<string>(arvMinimalSignalGeometryPreset.defaultMotionEvents[0]);
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
  const [demoRun, setDemoRun] = useState<DemoRunState>(IDLE_DEMO_RUN);
  const [isObsDemoMode, setIsObsDemoMode] = useState(false);
  const [demoZipExportedAt, setDemoZipExportedAt] = useState<number | null>(null);
  const [studioView, setStudioView] = useState<StudioView>('demo');
  const [pipelineLog, setPipelineLog] = useState<PipelineLogEntry[]>([]);
  const [isDownloadingStoryZip, setIsDownloadingStoryZip] = useState(false);
  const [storyMemories, setStoryMemories] = useState<StillframeStoryMemoryCard[]>([]);
  const [selectedStoryMemoryId, setSelectedStoryMemoryId] = useState('');
  const [isLoadingStoryMemories, setIsLoadingStoryMemories] = useState(false);
  const [isSavingStoryMemory, setIsSavingStoryMemory] = useState(false);
  const [isSyncingStoryMemory, setIsSyncingStoryMemory] = useState(false);
  const [storyMemoryMessage, setStoryMemoryMessage] = useState<string | null>(null);
  const [isCompactSceneCards, setIsCompactSceneCards] = useState(true);
  const [satireLayoutMode, setSatireLayoutMode] = useState<'single' | 'split'>('single');
  const [isPreparingReferences, setIsPreparingReferences] = useState(false);
  const [conceptError, setConceptError] = useState<string | null>(null);
  const [referenceError, setReferenceError] = useState<string | null>(null);
  const [ideasError, setIdeasError] = useState<string | null>(null);
  const [ideaPackSaveMessage, setIdeaPackSaveMessage] = useState<string | null>(null);
  const [storyTitle, setStoryTitle] = useState<string | null>(null);
  const [storyConcept, setStoryConcept] = useState<string | null>(null);
  const [stylePresets, setStylePresets] = useState<StillframeStylePresetSummary[]>([]);
  const [referenceStyle, setReferenceStyle] = useState<StillframeReferenceStyleSummary | null>(null);
  const [ideaPack, setIdeaPack] = useState<StillframeIdeaPack | null>(null);
  const [tokenUsage, setTokenUsage] = useState<{ prompt: number; completion: number; total: number } | null>(null);
  const [runId, setRunId] = useState<string>('');
  const [subject, setSubject] = useState<string | null>(null);
  const [microMotion, setMicroMotion] = useState<string | null>(null);
  const [scenes, setScenes] = useState<SceneState[]>([]);
  const scenesRef = useRef<SceneState[]>([]);
  const hasRequestedInitialStoryMemoryLoadRef = useRef(false);
  const demoSectionRef = useRef<HTMLElement | null>(null);
  const demoLogSectionRef = useRef<HTMLDivElement | null>(null);
  const demoResultsSectionRef = useRef<HTMLDivElement | null>(null);
  const demoZipSectionRef = useRef<HTMLDivElement | null>(null);
  const obsAutoZipRunRef = useRef<number | null>(null);
  const ideaSectionRef = useRef<HTMLElement | null>(null);
  const stillframeSectionRef = useRef<HTMLDivElement | null>(null);
  const inputRef = useRef<HTMLTextAreaElement>(null);
  const referenceInputRef = useRef<HTMLInputElement>(null);
  const didBootstrapIdeaRemixRef = useRef(false);
  const pipelineLogIdRef = useRef(0);
  const pipelineLogScrollRef = useRef<HTMLDivElement | null>(null);

  const placeholderIndex = useRef(Math.floor(Math.random() * PLACEHOLDER_CONCEPTS.length));
  const pendingKeywords = mergeKeywords(keywords, keywordInput);
  const canGenerateConcept = Boolean(concept.trim()) || pendingKeywords.length >= MIN_KEYWORDS || referenceImages.length > 0;
  const selectedSatirePresetProfile = getStillframeSatirePresetProfile(satirePresetProfileId)
    ?? getStillframeSatirePresetProfile(DEFAULT_STILLFRAME_SATIRE_PRESET_PROFILE_ID)
    ?? STILLFRAME_SATIRE_PRESET_PROFILES[0]!;
  const selectedSatireElements = satireSelectedElementIds
    .map((elementId) => getStillframeSatireElement(elementId))
    .filter((element): element is NonNullable<ReturnType<typeof getStillframeSatireElement>> => Boolean(element));
  const canGenerateSatire = Boolean(selectedSatirePresetProfile);
  const canGenerateSignal = Boolean(selectedSignalMotif && selectedSignalMotionEvent);

  // keep ref in sync so handleSketchAll can read latest prompts
  const updateScene = useCallback(
    (index: number, patch: Partial<SceneState>) => {
      if ('gifData' in patch) {
        revokeObjectUrl(scenesRef.current[index]?.gifData);
      }
      setScenes((prev) => {
        const next = prev.map((s, i) => (i === index ? { ...s, ...patch } : s));
        scenesRef.current = next;
        return next;
      });
    },
    [],
  );

  useEffect(() => () => {
    scenesRef.current.forEach((scene) => revokeObjectUrl(scene.gifData));
  }, []);

  const pushPipelineLog = useCallback((level: PipelineLogLevel, text: string) => {
    pipelineLogIdRef.current += 1;
    const entry: PipelineLogEntry = { id: pipelineLogIdRef.current, time: Date.now(), level, text };
    setPipelineLog((prev) => (prev.length >= 120 ? [...prev.slice(prev.length - 119), entry] : [...prev, entry]));
  }, []);

  useEffect(() => {
    const el = pipelineLogScrollRef.current;
    if (el) el.scrollTop = el.scrollHeight;
  }, [pipelineLog]);

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
    setReferenceError(null);
  };

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

  const applyIdeaToSignal = useCallback((value: string) => {
    setGenerationMode('signal');
    setSignalPrompt(value);
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
    referenceStyle
      ? {
        summary: referenceStyle.summary,
        subjectFocus: referenceStyle.subjectFocus,
        palette: referenceStyle.palette,
        motion: referenceStyle.motion,
        promptDNA: referenceStyle.promptDNA,
        keywords: referenceStyle.keywords,
      }
      : undefined
  ), [referenceStyle]);

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
        : `Stillframe Ideenpack - ${GENERATION_MODE_LABELS[pack.mode]}`,
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
        mode: data.mode === 'satire' ? 'satire' : data.mode === 'signal' ? 'signal' : 'ritual',
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
      const nextMode = parsedPayload.mode === 'satire' ? 'satire' : parsedPayload.mode === 'signal' ? 'signal' : 'ritual';
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
    scenesRef.current.forEach((scene) => revokeObjectUrl(scene.gifData));
    scenesRef.current = [];
    setScenes([]);
    setStoryTitle(null);
    setStoryConcept(null);
    setStylePresets([]);
    setReferenceStyle(null);
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

  const runGenerateConcept = useCallback(async (
    conceptSeed: string,
    preparedKeywords: string[],
    options?: { referenceStyleOverride?: StillframeReferenceStyleSummary | null },
  ) => {
    const trimmedConcept = conceptSeed.trim();
    const referenceStyleOverride = options && 'referenceStyleOverride' in options
      ? options.referenceStyleOverride
      : buildReferenceStyleOverride();

    if (!trimmedConcept && preparedKeywords.length < MIN_KEYWORDS && referenceImages.length === 0) {
      setConceptError(`Bitte mindestens ${MIN_KEYWORDS} Schlagwoerter, ein Referenzbild oder einen freien Concept-Text eingeben.`);
      return null;
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

      const generatedContext: StillframeGeneratedContext = {
        storyTitle: data.storyTitle || null,
        storyConcept: data.storyConcept || null,
        stylePresets: Array.isArray(data.stylePresets) ? data.stylePresets : [],
        referenceStyle: data.referenceStyle || null,
      };

      setStoryTitle(generatedContext.storyTitle);
      setStoryConcept(generatedContext.storyConcept);
      setSubject(data.subject);
      setMicroMotion(data.microMotion);
      setKeywords(Array.isArray(data.keywords) ? data.keywords : preparedKeywords);
      setStylePresets(generatedContext.stylePresets);
      setReferenceStyle(generatedContext.referenceStyle);
      applyUsageSummary(data.usage);
      const initialized = initScenes(data.scenes);
      scenesRef.current = initialized;
      setScenes(initialized);
      setOutputMode('ritual');
      return generatedContext;
    } catch (err: any) {
      if (referenceStyleOverride) {
        setReferenceStyle(referenceStyleOverride);
      }
      setConceptError(err.message || 'Concept generation failed.');
      pushPipelineLog('error', `Story-Konzept fehlgeschlagen: ${err.message || 'Concept generation failed.'}`);
      return null;
    } finally {
      setIsGeneratingConcept(false);
    }
  }, [applyUsageSummary, buildReferenceStyleOverride, pushPipelineLog, referenceImages.length, resetGeneratedOutput, serializeReferenceImages]);

  const runGenerateSatire = useCallback(async (satireSeed: string) => {
    if (!canGenerateSatire) {
      setConceptError('Bitte eine gueltige Satire-Voreinstellung waehlen.');
      return null;
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

      const generatedContext: StillframeGeneratedContext = {
        storyTitle: data.storyTitle || null,
        storyConcept: data.storyConcept || null,
        stylePresets: Array.isArray(data.stylePresets) ? data.stylePresets : [],
        referenceStyle: data.referenceStyle || null,
      };

      setSatireSketch(data.satireSketch || null);
      setAppliedSatirePresetProfileId(data.presetProfileId || selectedSatirePresetProfile.id);
      setAppliedSatireElementIds(Array.isArray(data.selectedElementIds) ? data.selectedElementIds : satireSelectedElementIds);
      setStoryTitle(generatedContext.storyTitle);
      setStoryConcept(generatedContext.storyConcept);
      setSubject(data.subject || null);
      setMicroMotion(data.microMotion || null);
      setStylePresets(generatedContext.stylePresets);
      setReferenceStyle(generatedContext.referenceStyle);
      applyUsageSummary(data.usage);

      const initialized = initScenes(Array.isArray(data.scenes) ? data.scenes : []);
      scenesRef.current = initialized;
      setScenes(initialized);
      setOutputMode('satire');
      return generatedContext;
    } catch (err: any) {
      if (referenceStyleOverride) {
        setReferenceStyle(referenceStyleOverride);
      }
      setConceptError(err.message || 'Satire generation failed.');
      pushPipelineLog('error', `Satire-Story fehlgeschlagen: ${err.message || 'Satire generation failed.'}`);
      return null;
    } finally {
      setIsGeneratingConcept(false);
    }
  }, [applyUsageSummary, buildReferenceStyleOverride, canGenerateSatire, pushPipelineLog, resetGeneratedOutput, satireSelectedElementIds, satireSketch, selectedSatirePresetProfile.id, serializeReferenceImages]);

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

  const runGenerateSignal = useCallback(async (signalSeed: string, motif = selectedSignalMotif, motionEvent = selectedSignalMotionEvent) => {
    if (!motif || !motionEvent) {
      setConceptError('Bitte ein Signal-Motif und ein Motion-Event waehlen.');
      return null;
    }

    const referenceStyleOverride = buildReferenceStyleOverride();

    setIsGeneratingConcept(true);
    setConceptError(null);
    setReferenceError(null);
    resetGeneratedOutput();
    const newRunId = new Date().toISOString().slice(0, 19).replace(/[T:]/g, '-');
    setRunId(newRunId);

    try {
      const res = await fetch('/api/stillframe/signal', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          prompt: signalSeed.trim() || undefined,
          motif,
          motionEvent,
          referenceStyleOverride,
          referenceImages: serializeReferenceImages(),
        }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || 'Signal geometry generation failed.');

      const generatedContext: StillframeGeneratedContext = {
        storyTitle: data.storyTitle || null,
        storyConcept: data.storyConcept || null,
        stylePresets: Array.isArray(data.stylePresets) ? data.stylePresets : [],
        referenceStyle: data.referenceStyle || null,
      };

      setStoryTitle(generatedContext.storyTitle);
      setStoryConcept(generatedContext.storyConcept);
      setSubject(data.subject || motif);
      setMicroMotion(data.microMotion || motionEvent);
      setKeywords(Array.isArray(data.keywords) ? data.keywords.slice(0, MAX_KEYWORDS) : ['minimal', 'signal', 'geometry']);
      setStylePresets(generatedContext.stylePresets);
      setReferenceStyle(generatedContext.referenceStyle);
      applyUsageSummary(data.usage);

      const initialized = initScenes(Array.isArray(data.scenes) ? data.scenes : []);
      scenesRef.current = initialized;
      setScenes(initialized);
      setOutputMode('signal');
      return generatedContext;
    } catch (err: any) {
      if (referenceStyleOverride) {
        setReferenceStyle(referenceStyleOverride);
      }
      setConceptError(err.message || 'Signal geometry generation failed.');
      pushPipelineLog('error', `Signal-Geometry-Story fehlgeschlagen: ${err.message || 'Signal geometry generation failed.'}`);
      return null;
    } finally {
      setIsGeneratingConcept(false);
    }
  }, [applyUsageSummary, buildReferenceStyleOverride, pushPipelineLog, resetGeneratedOutput, selectedSignalMotif, selectedSignalMotionEvent, serializeReferenceImages]);

  const handleGenerateSignal = async () => {
    await runGenerateSignal(signalPrompt.trim());
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

  const handleGenerateVisionSignal = useCallback(async (vision: StillframeIdeaVision) => {
    const signalSeed = [
      vision.title,
      vision.theme,
      vision.event,
      vision.action,
      vision.style,
      vision.promptSeed,
    ].filter((value) => value.trim().length > 0).join('. ');

    setGenerationMode('signal');
    setSignalPrompt(signalSeed);
    await runGenerateSignal(signalSeed);
  }, [runGenerateSignal]);

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
    options: { remixVideoId?: string | null; videoTransform?: VideoTransformMode | null; context?: StillframeGeneratedContext } = {},
  ) => {
    const remixVideoId = options.remixVideoId?.trim() || undefined;
    const videoTransform = resolveVideoTransformMode(remixVideoId, options.videoTransform);
    const effectiveStoryTitle = options.context ? options.context.storyTitle : storyTitle;
    const effectiveStoryConcept = options.context ? options.context.storyConcept : storyConcept;
    const effectiveStylePresets = options.context ? options.context.stylePresets : stylePresets;
    const effectiveReferenceStyle = options.context ? options.context.referenceStyle : referenceStyle;
    const renderSeconds = normalizeVideoDurationSeconds(scenesRef.current[index]?.durationSeconds);
    const videoRequestBody = {
      prompt: scenePrompt,
      seconds: renderSeconds,
      beatIndex: index,
      stylePresetIds: effectiveStylePresets.map((preset) => preset.id),
      referenceStyle: effectiveReferenceStyle,
      iqContext: buildStillframeIQContext(
        scenesRef.current,
        index,
        effectiveStoryTitle,
        effectiveStoryConcept,
        effectiveReferenceStyle,
        effectiveStylePresets,
        remixVideoId ?? null,
        videoTransform,
      ),
      ...(remixVideoId ? { remixVideoId, videoTransform } : {}),
    };

    pushPipelineLog('info', `Szene ${index + 1} · Foundry-IQ Prompt-Preview wird vorbereitet…`);
    const previewRes = await fetch('/api/stillframe/video/preview', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(videoRequestBody),
    });
    const previewData = await previewRes.json();
    if (!previewRes.ok) {
      pushPipelineLog('error', `Szene ${index + 1} · Prompt-Preview fehlgeschlagen: ${previewData.error || 'Video prompt preview failed.'}`);
      throw new Error(previewData.error || 'Video prompt preview failed.');
    }

    const previewDebug = (previewData.debug ?? null) as StillframeRenderPromptDebug | null;
    updateScene(index, { renderPromptDebug: previewDebug });
    if (previewDebug?.iqBrief) {
      pushPipelineLog('detail', `Szene ${index + 1} · Foundry-IQ Daten abgerufen: ${previewDebug.iqBrief.usedRemote ? 'Foundry IQ Agent (remote)' : 'Workspace KB (Fallback)'} · ${previewDebug.iqBrief.citations.length} Zitate`);
      pushPipelineLog('detail', `Szene ${index + 1} · IQ Query: ${truncateForLog(previewDebug.iqBrief.query)}`);
    }
    if (previewDebug?.finalPrompt) {
      pushPipelineLog('detail', `Szene ${index + 1} · Sora-2 Prompt bereit: ${truncateForLog(previewDebug.finalPrompt)}`);
    }

    const videoRenderRequestBody = previewDebug
      ? { ...videoRequestBody, preparedPromptDebug: previewDebug }
      : videoRequestBody;

    pushPipelineLog('info', `Szene ${index + 1} · Sora-2 Request wird jetzt gesendet (${renderSeconds}s${videoTransform ? ` · ${videoTransform === 'extend' ? 'Extension' : 'Remix'}` : ''})`);
    const videoRes = await fetch('/api/stillframe/video', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(videoRenderRequestBody),
    });
    const videoData = await videoRes.json();
    if (!videoRes.ok) {
      pushPipelineLog('error', `Szene ${index + 1} · Sora-Render fehlgeschlagen: ${videoData.error || 'Video generation failed.'}`);
      throw new Error(videoData.error || 'Video generation failed.');
    }
    const resolvedVideoId = videoData.videoId || videoData.jobId || null;
    const renderDebug = (videoData.debug ?? null) as StillframeRenderPromptDebug | null;
    if (renderDebug?.iqBrief) {
      pushPipelineLog('detail', `Szene ${index + 1} · IQ-Grounding: ${renderDebug.iqBrief.usedRemote ? 'Foundry IQ Agent (remote)' : 'Workspace KB (Fallback)'} · ${renderDebug.iqBrief.citations.length} Zitate`);
    }
    if (renderDebug?.finalPrompt) {
      pushPipelineLog('detail', `Szene ${index + 1} · Final Prompt: ${truncateForLog(renderDebug.finalPrompt)}`);
    }
    pushPipelineLog('info', `Szene ${index + 1} · Sora-Video fertig${resolvedVideoId ? ` · ${resolvedVideoId}` : ''} → GIF-Konvertierung läuft…`);

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
    if (!gifRes.ok) {
      pushPipelineLog('error', `Szene ${index + 1} · GIF-Konvertierung fehlgeschlagen: ${gifData.error || 'GIF conversion failed.'}`);
      throw new Error(gifData.error || 'GIF conversion failed.');
    }

    updateScene(index, {
      videoStatus: 'done',
      videoId: resolvedVideoId,
      remixedFromVideoId: remixVideoId ?? null,
      videoTransformMode: videoTransform ?? null,
      videoBase64: null,
      gifData: dataUrlToObjectUrl(gifData.gifData),
      renderPromptDebug: videoData.debug || null,
    });
    pushPipelineLog('success', `Szene ${index + 1} · GIF-Loop fertig (720p · 16:9)`);
  }, [pushPipelineLog, referenceStyle, storyConcept, storyTitle, stylePresets, updateScene]);

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
    const transformPrompt = scene.videoTransformPrompt.trim() || scene.prompt;

    updateScene(index, {
      videoStatus: 'loading',
      errorVideo: null,
      videoTransformMode: 'remix',
      renderPromptDebug: null,
    });

    try {
      await renderVideoForScene(transformPrompt, index, { remixVideoId: scene.videoId, videoTransform: 'remix' });
    } catch (err: any) {
      updateScene(index, { videoStatus: 'error', errorVideo: err.message || 'Video-Remix failed.' });
    }
  };

  const handleVideoExtension = async (index: number) => {
    const scene = scenes[index];
    if (!scene?.prompt.trim() || !scene.videoId) return;
    const transformPrompt = scene.videoTransformPrompt.trim() || scene.prompt;

    updateScene(index, {
      videoStatus: 'loading',
      errorVideo: null,
      videoTransformMode: 'extend',
      renderPromptDebug: null,
    });

    try {
      await renderVideoForScene(transformPrompt, index, { remixVideoId: scene.videoId, videoTransform: 'extend' });
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
      videoId: null,
      remixedFromVideoId: null,
      videoBase64: null,
      gifData: null,
      videoTransformMode: null,
      videoTransformPrompt: '',
      errorPolish: null,
      errorSketch: null,
      errorVideo: null,
      renderPromptDebug: null,
    });
  };

  const handleVideoTransformPromptChange = (index: number, value: string) => {
    updateScene(index, { videoTransformPrompt: value });
  };

  const handleDurationChange = (index: number, value: number) => {
    updateScene(index, {
      durationSeconds: normalizeVideoDurationSeconds(value),
      videoStatus: 'idle',
      videoBase64: null,
      gifData: null,
      videoTransformMode: null,
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
          mode: outputMode === 'satire' ? 'satire' : outputMode === 'signal' ? 'signal' : 'ritual',
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

  const handleDownloadStoryZip = useCallback(async () => {
    const currentScenes = scenesRef.current;
    if (currentScenes.length === 0 || isDownloadingStoryZip) {
      return;
    }

    setIsDownloadingStoryZip(true);

    try {
      const safeStoryName = sanitizeFilenamePart(storyTitle || concept || 'arv-demo-story');
      const zip = new JSZip();
      const metadata = {
        exportedAt: new Date().toISOString(),
        runId,
        storyTitle,
        storyConcept,
        mode: outputMode ?? generationMode,
        sourcePrompt: concept.trim() || null,
        referenceStyle,
        stylePresets,
        scenes: currentScenes.map((scene, index) => ({
          index: index + 1,
          beat: scene.beat,
          title: scene.title,
          prompt: scene.prompt,
          motion: scene.motion,
          durationSeconds: scene.durationSeconds,
          videoId: scene.videoId,
          remixedFromVideoId: scene.remixedFromVideoId,
          videoTransformMode: scene.videoTransformMode,
          hasGif: Boolean(scene.gifData),
          hasSketch: Boolean(scene.sketchData),
          renderPromptDebug: scene.renderPromptDebug,
        })),
      };

      zip.file('story.json', JSON.stringify(metadata, null, 2));
      zip.file('prompts.md', [
        `# ${storyTitle || 'ARV Demo Story'}`,
        '',
        storyConcept || concept.trim() || 'Kein Story-Concept gespeichert.',
        '',
        `Modus: ${GENERATION_MODE_LABELS[(outputMode ?? generationMode) as GenerationMode]}`,
        '',
        ...currentScenes.flatMap((scene, index) => [
          `## Szene ${index + 1} · ${scene.title}`,
          '',
          `Beat: ${scene.beat}`,
          '',
          `Motion: ${scene.motion}`,
          '',
          scene.prompt,
          '',
        ]),
      ].join('\n'));

      await Promise.all(currentScenes.map(async (scene, index) => {
        const scenePrefix = `scene-${String(index + 1).padStart(2, '0')}`;
        if (scene.gifData) {
          await addAssetToZip(zip, `${scenePrefix}-loop.gif`, scene.gifData);
        }
        if (scene.sketchData) {
          await addAssetToZip(zip, `${scenePrefix}-sketch.png`, scene.sketchData);
        }
      }));

      const blob = await zip.generateAsync({ type: 'blob' });
      downloadBlob(blob, `${safeStoryName}-scenes.zip`);
      setDemoZipExportedAt(Date.now());
      pushPipelineLog('success', `Story-ZIP exportiert · ${currentScenes.filter((scene) => scene.gifData).length} GIF-Loops · ${currentScenes.length} Szenenprompts`);
    } catch (err: any) {
      pushPipelineLog('error', `Story-ZIP konnte nicht erstellt werden: ${err.message || 'Export failed.'}`);
    } finally {
      setIsDownloadingStoryZip(false);
    }
  }, [concept, generationMode, isDownloadingStoryZip, outputMode, pushPipelineLog, referenceStyle, runId, storyConcept, storyTitle, stylePresets]);

  const buildStoryMemoryPayload = useCallback((continuationOf?: string | null): StillframeStoryMemoryCard | null => {
    const currentScenes = scenesRef.current;
    if (currentScenes.length === 0) {
      return null;
    }

    const now = new Date().toISOString();
    return {
      type: 'stillframe_story_memory',
      id: `story-memory-${Date.now().toString(36)}-${Math.random().toString(36).slice(2, 8)}`,
      createdAt: now,
      updatedAt: now,
      title: storyTitle || concept.trim().slice(0, 80) || 'ARV Stillframe Story',
      sourcePrompt: concept.trim(),
      storyConcept: storyConcept || concept.trim(),
      continuationOf: continuationOf || null,
      referenceStyle,
      stylePresets,
      scenes: currentScenes.map((scene, index) => ({
        index: index + 1,
        beat: scene.beat,
        title: scene.title,
        prompt: scene.prompt,
        motion: scene.motion,
        durationSeconds: scene.durationSeconds,
        videoId: scene.videoId,
        remixedFromVideoId: scene.remixedFromVideoId,
        videoTransformMode: scene.videoTransformMode,
      })),
      notes: 'Saved from Hyroglyphs manual demo flow for Foundry IQ story continuation.',
    };
  }, [concept, referenceStyle, storyConcept, storyTitle, stylePresets]);

  const loadStoryMemories = useCallback(async () => {
    setIsLoadingStoryMemories(true);
    setStoryMemoryMessage(null);
    try {
      const res = await fetch('/api/stillframe/story-memory');
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || 'Story memory lookup failed.');
      const memories = Array.isArray(data.memories) ? data.memories : [];
      setStoryMemories(memories);
      if (!selectedStoryMemoryId && memories[0]?.id) {
        setSelectedStoryMemoryId(memories[0].id);
      }
      setStoryMemoryMessage(memories.length > 0
        ? `${memories.length} Story-Memory-Datei(en) geladen.`
        : 'Noch keine gespeicherten Story-Memories vorhanden.');
    } catch (err: any) {
      setStoryMemoryMessage(err.message || 'Story-Memory konnte nicht geladen werden.');
    } finally {
      setIsLoadingStoryMemories(false);
    }
  }, [selectedStoryMemoryId]);

  const selectedStoryMemory = storyMemories.find((memory) => memory.id === selectedStoryMemoryId) || null;

  const applyStoryMemoryToEditor = useCallback((memory: StillframeStoryMemoryCard) => {
    const nextScenes = initScenes(memory.scenes.slice(0, 4).map((scene, index) => ({
      beat: (['scene-1', 'scene-2', 'scene-3', 'scene-4'][index] ?? scene.beat) as BeatType,
      title: scene.title || `Szene ${index + 1}`,
      prompt: scene.prompt,
      motion: scene.motion,
    })));
    scenesRef.current = nextScenes;
    setScenes(nextScenes);
    setStoryTitle(memory.title);
    setStoryConcept(memory.storyConcept || memory.sourcePrompt);
    setConcept(memory.sourcePrompt || memory.storyConcept || memory.title);
    setReferenceStyle(memory.referenceStyle ?? null);
    setStylePresets(memory.stylePresets || []);
    setOutputMode('ritual');
    setGenerationMode('ritual');
    setRunId(new Date().toISOString().slice(0, 19).replace(/[T:]/g, '-'));
    setStoryMemoryMessage(`Story-Memory „${memory.title}“ in die manuelle Demo geladen.`);
    pushPipelineLog('detail', `Story-Memory geladen: „${memory.title}“ · ${memory.scenes.length} gespeicherte Szenen`);
  }, [pushPipelineLog]);

  const handleSaveStoryMemory = useCallback(async (continuationOf?: string | null) => {
    const memoryCard = buildStoryMemoryPayload(continuationOf);
    if (!memoryCard || isSavingStoryMemory) {
      return;
    }

    setIsSavingStoryMemory(true);
    setStoryMemoryMessage(null);
    try {
      const res = await fetch('/api/stillframe/story-memory/write', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ memoryCard }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || 'Story memory write failed.');
      setStoryMemories((previous) => [data.memoryCard, ...previous.filter((memory) => memory.id !== data.memoryCard.id)]);
      setSelectedStoryMemoryId(data.memoryCard.id);
      setStoryMemoryMessage(`Story-Memory gespeichert: ${data.markdownPath}. Sync: scripts/sync-stillframe-story-memory.ps1`);
      pushPipelineLog('success', `Story-Memory gespeichert · ${data.memoryCard.title}`);
    } catch (err: any) {
      setStoryMemoryMessage(err.message || 'Story-Memory konnte nicht gespeichert werden.');
      pushPipelineLog('error', `Story-Memory speichern fehlgeschlagen: ${err.message || 'write failed'}`);
    } finally {
      setIsSavingStoryMemory(false);
    }
  }, [buildStoryMemoryPayload, isSavingStoryMemory, pushPipelineLog]);

  const handleContinueStoryMemory = useCallback(async () => {
    if (!selectedStoryMemory || isGeneratingConcept) {
      return;
    }

    const lastScene = selectedStoryMemory.scenes[selectedStoryMemory.scenes.length - 1];
    const continuationSeed = [
      `Fortsetzung der gespeicherten ARV-Story „${selectedStoryMemory.title}“.`,
      selectedStoryMemory.storyConcept,
      selectedStoryMemory.referenceStyle?.summary ? `Erhalte Style-DNA: ${selectedStoryMemory.referenceStyle.summary}` : '',
      selectedStoryMemory.referenceStyle?.promptDNA ? `Prompt-DNA: ${selectedStoryMemory.referenceStyle.promptDNA}` : '',
      lastScene ? `Setze nach Szene ${lastScene.index} fort: ${lastScene.title}. Letzter Prompt: ${lastScene.prompt}` : '',
      'Schreibe vier neue, spätere Szenen als direkte Fortsetzung; nicht neu starten, sondern Motive, Palette, Motion-Grammar und Chronologie weiterführen.',
    ].filter(Boolean).join('\n');

    const memoryKeywords = selectedStoryMemory.referenceStyle?.keywords?.slice(0, MAX_KEYWORDS) ?? [];
    setConcept(continuationSeed);
    setReferenceStyle(selectedStoryMemory.referenceStyle ?? null);
    setStylePresets(selectedStoryMemory.stylePresets || []);
    setPipelineLog([]);
    pushPipelineLog('info', `Story-Fortsetzung gestartet · Basis: „${selectedStoryMemory.title}“`);
    const generatedContext = await runGenerateConcept(continuationSeed, memoryKeywords, {
      referenceStyleOverride: selectedStoryMemory.referenceStyle ?? null,
    });
    if (generatedContext && scenesRef.current.length > 0) {
      pushPipelineLog('success', `Fortsetzung generiert: „${generatedContext.storyTitle ?? selectedStoryMemory.title}“ · speichere neue Story-Memory…`);
      const now = new Date().toISOString();
      const memoryCard: StillframeStoryMemoryCard = {
        type: 'stillframe_story_memory',
        id: `story-memory-${Date.now().toString(36)}-${Math.random().toString(36).slice(2, 8)}`,
        createdAt: now,
        updatedAt: now,
        title: generatedContext.storyTitle || `Fortsetzung · ${selectedStoryMemory.title}`,
        sourcePrompt: continuationSeed,
        storyConcept: generatedContext.storyConcept || continuationSeed,
        continuationOf: selectedStoryMemory.id,
        referenceStyle: generatedContext.referenceStyle || selectedStoryMemory.referenceStyle || null,
        stylePresets: generatedContext.stylePresets,
        scenes: scenesRef.current.map((scene, index) => ({
          index: index + 1,
          beat: scene.beat,
          title: scene.title,
          prompt: scene.prompt,
          motion: scene.motion,
          durationSeconds: scene.durationSeconds,
          videoId: scene.videoId,
          remixedFromVideoId: scene.remixedFromVideoId,
          videoTransformMode: scene.videoTransformMode,
        })),
        notes: `Continuation of ${selectedStoryMemory.title}`,
      };
      setIsSavingStoryMemory(true);
      try {
        const res = await fetch('/api/stillframe/story-memory/write', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ memoryCard }),
        });
        const data = await res.json();
        if (!res.ok) throw new Error(data.error || 'Story memory write failed.');
        setStoryMemories((previous) => [data.memoryCard, ...previous.filter((memory) => memory.id !== data.memoryCard.id)]);
        setSelectedStoryMemoryId(data.memoryCard.id);
        setStoryMemoryMessage(`Fortsetzung gespeichert: ${data.markdownPath}. Sync: scripts/sync-stillframe-story-memory.ps1`);
        pushPipelineLog('success', `Story-Fortsetzung gespeichert · ${data.memoryCard.title}`);
      } catch (err: any) {
        setStoryMemoryMessage(err.message || 'Fortsetzung konnte nicht gespeichert werden.');
        pushPipelineLog('error', `Fortsetzung speichern fehlgeschlagen: ${err.message || 'write failed'}`);
      } finally {
        setIsSavingStoryMemory(false);
      }
    }
  }, [isGeneratingConcept, pushPipelineLog, runGenerateConcept, selectedStoryMemory]);

  const handleSyncStoryMemory = useCallback(async () => {
    if (isSyncingStoryMemory) {
      return;
    }

    if (storyMemories.length === 0) {
      setStoryMemoryMessage('Noch keine gespeicherte story.md vorhanden. Speichere zuerst eine Story-Memory, dann kann Foundry IQ synchronisiert werden.');
      pushPipelineLog('detail', 'Foundry-IQ Sync übersprungen · keine gespeicherte Story-Memory vorhanden');
      return;
    }

    setIsSyncingStoryMemory(true);
    setStoryMemoryMessage(null);
    pushPipelineLog('info', 'Foundry-IQ Sync gestartet · lade gespeicherte story.md Dateien in die Knowledge Base');
    try {
      const res = await fetch('/api/stillframe/story-memory/sync', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ includeStylePack: false, recreateKnowledgeBase: false }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || 'Story memory sync failed.');
      const output = [data.stdout, data.stderr].filter(Boolean).join('\n').trim();
      setStoryMemoryMessage(`Foundry-IQ Sync abgeschlossen: ${data.markdownCount ?? 0} Story-Memory-Datei(en) hochgeladen.${output ? `\n${output}` : ''}`);
      pushPipelineLog('success', `Foundry-IQ Sync abgeschlossen · ${data.markdownCount ?? 0} Story-Memory-Datei(en)`);
    } catch (err: any) {
      setStoryMemoryMessage(err.message || 'Foundry-IQ Sync konnte nicht ausgeführt werden.');
      pushPipelineLog('error', `Foundry-IQ Sync fehlgeschlagen: ${err.message || 'sync failed'}`);
    } finally {
      setIsSyncingStoryMemory(false);
    }
  }, [isSyncingStoryMemory, pushPipelineLog, storyMemories.length]);

  useEffect(() => {
    if ((studioView === 'manual-demo' || studioView === 'werkstatt') && !hasRequestedInitialStoryMemoryLoadRef.current) {
      hasRequestedInitialStoryMemoryLoadRef.current = true;
      void loadStoryMemories();
    }
  }, [loadStoryMemories, studioView]);

  const handleManualDemoGenerateScenes = useCallback(async () => {
    const trimmed = concept.trim();
    const preparedKeywords = keywordInput.trim() ? mergeKeywords(keywords, keywordInput) : keywords;

    if (keywordInput.trim()) {
      setKeywords(preparedKeywords);
      setKeywordInput('');
    }

    setGenerationMode('ritual');
    setPipelineLog([]);
    pushPipelineLog('info', 'Manueller Demo-Flow gestartet · Prompt + Stilreferenzen werden zu 4 Szenenprompts verdichtet…');
    const generatedContext = await runGenerateConcept(trimmed, preparedKeywords);
    if (generatedContext && scenesRef.current.length > 0) {
      pushPipelineLog('success', `Manueller Demo-Flow fertig: „${generatedContext.storyTitle ?? 'ohne Titel'}“ · ${scenesRef.current.length} editierbare Szenenprompts geschrieben`);
    }
  }, [concept, keywordInput, keywords, pushPipelineLog, runGenerateConcept]);

  // ── One-Click Demo Run (Agents League) ──────────────────────────────

  const handleDemoRun = async () => {
    if (demoRun.status === 'running' || isGeneratingConcept || isRenderingAllVideos) return;

    setDemoRun({
      status: 'running',
      stages: { ...createIdleDemoStages(), concept: 'active' },
      error: null,
      startedAt: Date.now(),
      finishedAt: null,
    });
    setDemoZipExportedAt(null);
    setPipelineLog([]);
    pushPipelineLog('info', `Demo-Lauf gestartet · Modus „${GENERATION_MODE_LABELS[generationMode]}“`);
    pushPipelineLog('info', 'Stufe 1 · Story-Konzept + 4 Beats werden generiert…');

    const patchStage = (stage: DemoStageId, status: DemoStageStatus) => {
      setDemoRun((prev) => ({ ...prev, stages: { ...prev.stages, [stage]: status } }));
    };

    // Stufe 1: Story-Konzept + 4 Beats generieren (mit kuratiertem Demo-Seed als Fallback)
    let generatedContext: StillframeGeneratedContext | null = null;
    if (generationMode === 'satire') {
      const satireSeed = satirePrompt.trim() || DEMO_SEEDS.satire;
      if (!satirePrompt.trim()) setSatirePrompt(satireSeed);
      generatedContext = await runGenerateSatire(satireSeed);
    } else if (generationMode === 'signal') {
      const signalSeed = signalPrompt.trim() || DEMO_SEEDS.signal;
      if (!signalPrompt.trim()) setSignalPrompt(signalSeed);
      generatedContext = await runGenerateSignal(signalSeed);
    } else {
      const preparedKeywords = keywordInput.trim() ? mergeKeywords(keywords, keywordInput) : keywords;
      if (keywordInput.trim()) {
        setKeywords(preparedKeywords);
        setKeywordInput('');
      }
      const hasOwnInput = Boolean(concept.trim()) || preparedKeywords.length >= MIN_KEYWORDS || referenceImages.length > 0;
      const ritualSeed = concept.trim() || (hasOwnInput ? '' : DEMO_SEEDS.ritual);
      if (!concept.trim() && ritualSeed) setConcept(ritualSeed);
      generatedContext = await runGenerateConcept(ritualSeed, preparedKeywords);
    }

    if (!generatedContext || scenesRef.current.length === 0) {
      pushPipelineLog('error', 'Story-Generierung fehlgeschlagen – Demo-Lauf gestoppt.');
      setDemoRun((prev) => ({
        ...prev,
        status: 'error',
        stages: { ...prev.stages, concept: 'error' },
        error: 'Story-Generierung fehlgeschlagen – Details stehen im Live Pipeline Log.',
        finishedAt: Date.now(),
      }));
      return;
    }
    patchStage('concept', 'done');
    pushPipelineLog('success', `Story-Konzept fertig: „${generatedContext.storyTitle ?? 'ohne Titel'}“ · 4 Beats angelegt`);
    pushPipelineLog('info', 'Stufe 2 · 4 Szenen werden sequenziell gerendert (IQ-Grounding → Sora → GIF)…');

    // Stufe 2: Alle vier Szenen sequenziell rendern (Foundry IQ Grounding → Sora → GIF)
    setIsRenderingAllVideos(true);
    let hadSceneError = false;
    const sceneCount = Math.min(scenesRef.current.length, 4);
    for (let i = 0; i < sceneCount; i++) {
      const stageId = `scene-${i + 1}` as DemoStageId;
      const scene = scenesRef.current[i];
      if (!scene?.prompt.trim()) {
        hadSceneError = true;
        pushPipelineLog('error', `Szene ${i + 1} · Kein Prompt vorhanden – übersprungen.`);
        patchStage(stageId, 'error');
        continue;
      }

      patchStage(stageId, 'active');
      updateScene(i, {
        videoStatus: 'loading',
        videoBase64: null,
        gifData: null,
        errorVideo: null,
        remixedFromVideoId: null,
        videoTransformMode: null,
        renderPromptDebug: null,
      });

      try {
        await renderVideoForScene(scenesRef.current[i].prompt, i, { context: generatedContext });
        patchStage(stageId, 'done');
      } catch (err: any) {
        hadSceneError = true;
        updateScene(i, { videoStatus: 'error', errorVideo: err.message || 'Video/GIF failed.' });
        patchStage(stageId, 'error');
      }
    }
    setIsRenderingAllVideos(false);
    pushPipelineLog(hadSceneError ? 'error' : 'success', hadSceneError
      ? 'Demo-Lauf mit Fehlern beendet – einzelne Szenen können manuell neu gerendert werden.'
      : 'Demo-Lauf abgeschlossen · Story + 4 GIF-Loops fertig.');

    setDemoRun((prev) => ({
      ...prev,
      status: hadSceneError ? 'error' : 'done',
      error: hadSceneError
        ? 'Mindestens eine Szene konnte nicht gerendert werden. Einzelne Szenen lassen sich unten manuell neu rendern.'
        : null,
      finishedAt: Date.now(),
    }));
  };

  // ── Render ─────────────────────────────────────────────────────────────────

  const activePolishBatchIndex = scenes.findIndex((scene) => scene.polishStatus === 'loading');
  const hasActivePolish = scenes.some((scene) => scene.polishStatus === 'loading');
  const activeVideoBatchIndex = scenes.findIndex((scene) => scene.videoStatus === 'loading' || scene.videoStatus === 'converting');
  const hasActiveVideoRender = scenes.some((scene) => scene.videoStatus === 'loading' || scene.videoStatus === 'converting');

  const isDemoRunning = demoRun.status === 'running';
  const demoSeedWillBeUsed = generationMode === 'satire'
    ? !satirePrompt.trim()
    : generationMode === 'signal'
      ? !signalPrompt.trim()
      : !concept.trim() && pendingKeywords.length < MIN_KEYWORDS && referenceImages.length === 0;

  const sceneIqEntries = scenes.flatMap((scene, index) => {
    const brief = scene.renderPromptDebug?.iqBrief;
    return brief ? [{ index, brief }] : [];
  });
  const usedRemoteIq = sceneIqEntries.some((entry) => entry.brief.usedRemote);
  const iqCitations: Array<{ source: string; excerpt: string }> = [];
  const seenIqSources = new Set<string>();
  sceneIqEntries.forEach((entry) => {
    entry.brief.citations.forEach((citation) => {
      if (!seenIqSources.has(citation.source)) {
        seenIqSources.add(citation.source);
        iqCitations.push(citation);
      }
    });
  });

  const activeDemoStage = DEMO_STAGE_IDS.find((stageId) => demoRun.stages[stageId] === 'active') ?? null;
  const completedGifCount = scenes.filter((scene) => Boolean(scene.gifData)).length;
  const activeSceneForNarration = activeVideoBatchIndex >= 0 ? scenes[activeVideoBatchIndex] : null;
  const demoNarrationStepId: DemoNarrationStepId = demoRun.status === 'error'
    ? 'error'
    : demoZipExportedAt
      ? 'done'
      : isDownloadingStoryZip
        ? 'zip'
        : demoRun.status === 'done'
          ? 'zip'
          : activeDemoStage === 'concept'
            ? 'concept'
            : activeSceneForNarration?.renderPromptDebug?.iqBrief
              ? 'render'
              : activeDemoStage?.startsWith('scene-')
                ? 'grounding'
                : completedGifCount > 0
                  ? 'results'
                  : 'ready';
  const demoNarrationStep = DEMO_NARRATION_STEPS[demoNarrationStepId];
  const demoFocusClass = (target: DemoFocusTarget): string => (
    isObsDemoMode && demoNarrationStep.target === target
      ? 'ring-2 ring-[#d2ff4d]/70 shadow-[0_0_44px_rgba(210,255,77,0.18)]'
      : ''
  );

  useEffect(() => {
    if (!isObsDemoMode || studioView !== 'demo') {
      return;
    }

    const refMap: Record<DemoFocusTarget, React.RefObject<HTMLElement | HTMLDivElement | null>> = {
      demo: demoSectionRef,
      log: demoLogSectionRef,
      results: demoResultsSectionRef,
      zip: demoZipSectionRef,
    };
    const target = refMap[demoNarrationStep.target]?.current;
    if (!target) {
      return;
    }

    const timeout = window.setTimeout(() => {
      target.scrollIntoView({ behavior: 'smooth', block: 'center' });
    }, 220);

    return () => window.clearTimeout(timeout);
  }, [demoNarrationStep.target, isObsDemoMode, studioView, activeVideoBatchIndex, completedGifCount, isDownloadingStoryZip]);

  useEffect(() => {
    if (!isObsDemoMode || demoRun.status !== 'done' || !demoRun.finishedAt || demoZipExportedAt || isDownloadingStoryZip) {
      return;
    }
    if (obsAutoZipRunRef.current === demoRun.finishedAt || scenesRef.current.length === 0) {
      return;
    }

    obsAutoZipRunRef.current = demoRun.finishedAt;
    pushPipelineLog('info', 'OBS Demo Assistenz · ZIP-Download startet automatisch in 2 Sekunden…');
    const timeout = window.setTimeout(() => {
      void handleDownloadStoryZip();
    }, 2000);

    return () => window.clearTimeout(timeout);
  }, [demoRun.finishedAt, demoRun.status, demoZipExportedAt, handleDownloadStoryZip, isDownloadingStoryZip, isObsDemoMode, pushPipelineLog]);

  const scrollToPanel = useCallback((target: 'stillframe') => {
    const targetRef = stillframeSectionRef;

    targetRef.current?.scrollIntoView({ behavior: 'smooth', block: 'start' });
  }, []);

  const handleWorkspaceChange = (nextWorkspace: 'stillframe') => {
    window.requestAnimationFrame(() => scrollToPanel(nextWorkspace));
  };

  return (
    <div
      className="min-h-screen signal-shell bg-[#02040e]"
    >
      {/* ── Header ─────────────────────────────────────────────────────────── */}
      <header className="border-b border-[rgba(114,228,255,0.14)] bg-[rgba(4,6,16,0.72)] px-5 py-3 backdrop-blur-xl">
        <div className="mx-auto flex max-w-[1500px] flex-wrap items-center gap-3">
          <div className="flex min-w-[220px] items-center gap-3">
            <div className="h-7 w-px bg-[rgba(114,228,255,0.12)]" />
            <div>
              <div className="font-mono text-[10px] uppercase tracking-[0.24em] text-[#36516e]">Hyroglyphs</div>
              <div className="font-mono text-xs font-semibold text-[#c8ddf0]">Stillframe Studio</div>
            </div>
          </div>

          <div className="inline-flex rounded-2xl border border-[rgba(114,228,255,0.16)] bg-[rgba(7,14,28,0.82)] p-1">
            <button
              type="button"
              onClick={() => setStudioView('demo')}
              className={`rounded-xl px-3 py-2 font-mono text-[10px] font-semibold transition ${studioView === 'demo'
                ? 'border border-[rgba(114,228,255,0.3)] bg-[rgba(18,38,64,0.92)] text-[#72e4ff]'
                : 'border border-transparent text-[#4a7090] hover:text-[#c8ddf0]'}`}
            >
              Demo Flow
            </button>
            <button
              type="button"
              onClick={() => setStudioView('manual-demo')}
              className={`rounded-xl px-3 py-2 font-mono text-[10px] font-semibold transition ${studioView === 'manual-demo'
                ? 'border border-[rgba(232,193,106,0.34)] bg-[rgba(54,36,8,0.9)] text-[#ffd980]'
                : 'border border-transparent text-[#4a7090] hover:text-[#c8ddf0]'}`}
            >
              Manuelle Demo
            </button>
            <button
              type="button"
              onClick={() => setStudioView('werkstatt')}
              className={`rounded-xl px-3 py-2 font-mono text-[10px] font-semibold transition ${studioView === 'werkstatt'
                ? 'border border-[rgba(168,118,255,0.34)] bg-[rgba(38,20,64,0.92)] text-[#c7a7ff]'
                : 'border border-transparent text-[#4a7090] hover:text-[#c8ddf0]'}`}
            >
              Werkstatt
            </button>
          </div>

          <div className="flex flex-wrap items-center gap-2 rounded-2xl border border-[rgba(114,228,255,0.12)] bg-[rgba(7,14,28,0.78)] px-2 py-2">
            <button
              type="button"
              onClick={() => handleWorkspaceChange('stillframe')}
              className="rounded-xl border border-[rgba(114,228,255,0.16)] bg-[rgba(10,26,46,0.6)] px-3 py-2 font-mono text-[10px] font-semibold text-[#8ea6c3] transition hover:text-[#72e4ff]"
            >
              4 Szenen
            </button>
          </div>

          <div className="ml-auto flex items-center gap-3">
            <span className="font-mono text-[11px] uppercase tracking-[0.28em] text-[#4a7090]">Azure OpenAI Foundry</span>
            <span className="rounded-full border border-[rgba(114,228,255,0.2)] bg-[rgba(20,40,70,0.6)] px-2.5 py-0.5 font-mono text-[10px] text-[#72e4ff]">
              {GENERATION_MODE_LABELS[generationMode]}
            </span>
          </div>
        </div>
      </header>

      <main className="mx-auto max-w-[1500px] px-4 py-8 space-y-8">

        {/* ── Hero ─────────────────────────────────────────────────────────── */}
        {studioView === 'demo' ? (
          <div className="space-y-2">
            <h1 className="font-mono text-2xl font-bold tracking-tight text-[#f3f8ff]">
              Visual Engine für Audio Rework Visions
            </h1>
            <p className="text-sm text-[#4a6a8a] max-w-3xl">
              Hyroglyphs produziert die Bild-Ebene für Musikvideos und Techno-Livestreams auf dem YouTube-Kanal{' '}
              <span className="text-[#72e4ff]">@audioreworkvisions</span>: KI-generierte, loopbare GIF-Szenen,
              die als GIF-Dia-Show das fertige Video simulieren und als Video-Quelle in Streams und Releases laufen –
              stilistisch verankert in der ARV-Ästhetik über Foundry-IQ-Grounding.
            </p>
          </div>
        ) : studioView === 'manual-demo' ? (
          <div className="space-y-2">
            <div className="font-mono text-[11px] uppercase tracking-[0.24em] text-[#ffd980]">
              Manuelle Demo · Prompt + Style Extraction
            </div>
            <h1 className="font-mono text-2xl font-bold tracking-tight text-[#f3f8ff]">
              Vier Szenenprompts aus einer einfachen Idee und einem Stilbild
            </h1>
            <p className="text-sm text-[#4a6a8a] max-w-3xl">
              Diese zweite Demo-Seite ist bewusst kompakt: Ein kurzer Prompt und ein oder mehrere Referenzbilder reichen,
              damit Hyroglyphs die ARV-Style-DNA extrahiert und automatisch vier editierbare Szenenprompts für die
              GIF-Dia-Show auf <span className="text-[#72e4ff]">@audioreworkvisions</span> schreibt.
            </p>
          </div>
        ) : (
          <div className="space-y-2">
            <div className="font-mono text-[11px] uppercase tracking-[0.24em] text-[#8f74c9]">
              Werkstatt · Manuelle Produktion für @audioreworkvisions
            </div>
            <h1 className="font-mono text-2xl font-bold tracking-tight text-[#f3f8ff]">
              {GENERATION_MODE_LABELS[generationMode]}
            </h1>
            <div className="rounded-[16px] border border-[rgba(114,228,255,0.12)] bg-[rgba(6,12,24,0.62)] p-3 text-xs text-[#8ea6c3]">
              <div className="font-mono uppercase tracking-[0.14em] text-[10px] text-[#72e4ff]">Werkstatt-Ablauf</div>
              <div className="mt-1">1) Modus und Prompt wählen · 2) Story + 4 Szenen generieren · 3) Szenen einzeln polieren/rendern · 4) optional ZIP exportieren.</div>
            </div>
          </div>
        )}

        {/* Agents League · One-Click Demo Run */}
        {studioView === 'demo' && (
        <section ref={demoSectionRef} className={`scroll-mt-24 rounded-[24px] border border-[rgba(114,228,255,0.2)] bg-[linear-gradient(135deg,rgba(6,22,42,0.88),rgba(18,10,38,0.88))] p-5 space-y-4 backdrop-blur-sm transition ${demoFocusClass('demo')}`}>
          <div className="flex flex-wrap items-start justify-between gap-4">
            <div className="max-w-3xl space-y-1.5">
              <div className="font-mono text-[11px] uppercase tracking-[0.24em] text-[#72e4ff]">
                Agents League · One-Click Demo
              </div>
              <h2 className="font-mono text-lg font-semibold text-[#f3f8ff]">
                Vom Konzept zur sendefertigen GIF-Dia-Show – in einem Lauf
              </h2>
              <p className="text-xs leading-relaxed text-[#8ea6c3]">
                Ein Klick orchestriert die komplette Produktion: Foundry-Modelle schreiben ein Story-Konzept mit vier
                visuellen Beats, Foundry IQ grounded jede Szene mit Zitaten aus der ARV-Style-Wissensbasis (damit jedes
                Visual zur Kanal-Ästhetik passt), Sora rendert vier Videos, die automatisch zu loopbaren GIFs konvertiert
                werden. Die vier GIF-Loops bilden zusammen die Dia-Show, die als Bild-/Video-Quelle im nächsten
                Musikvideo oder Techno-Livestream läuft – Thumbnail, Titel, Beschreibung, Hashtags und SEO-Keywords
                dazu liefert anschließend das Thumbnail Studio.
                {demoSeedWillBeUsed && (
                  <span className="text-[#72e4ff]">
                    {' '}Ohne eigene Eingabe startet der Lauf mit einem kuratierten Demo-Seed im Modus „{GENERATION_MODE_LABELS[generationMode]}“.
                  </span>
                )}
              </p>
            </div>
            <div className="flex flex-col items-stretch gap-2 sm:min-w-[230px]">
              <button
                type="button"
                onClick={() => void handleDemoRun()}
                disabled={isDemoRunning || isGeneratingConcept || isRenderingAllVideos || hasActiveVideoRender}
                className="flex items-center justify-center gap-2 rounded-xl border border-[rgba(114,228,255,0.4)] bg-[#0e3a5c] px-6 py-3 font-mono text-xs font-semibold text-[#9ff0ff] shadow-[0_0_30px_rgba(114,228,255,0.12)] transition hover:bg-[#155083] disabled:cursor-not-allowed disabled:opacity-40"
              >
                {isDemoRunning ? (
                  <><Loader2 size={15} className="animate-spin" />Demo läuft…</>
                ) : (
                  <><Play size={15} />Demo-Lauf starten</>
                )}
              </button>
              <button
                type="button"
                onClick={() => setIsObsDemoMode((current) => !current)}
                className={`flex items-center justify-center gap-2 rounded-xl border px-4 py-2.5 font-mono text-[11px] font-semibold transition ${isObsDemoMode
                  ? 'border-[rgba(210,255,77,0.38)] bg-[rgba(42,54,10,0.72)] text-[#d2ff4d]'
                  : 'border-[rgba(114,228,255,0.16)] bg-[rgba(7,14,28,0.72)] text-[#8ea6c3] hover:text-[#72e4ff]'}`}
                title="Stille visuelle Moderation fuer OBS-Bildschirmaufnahme aktivieren"
              >
                <Camera size={13} />
                OBS Demo Assistenz {isObsDemoMode ? 'aktiv' : 'starten'}
              </button>
            </div>
          </div>

          {isObsDemoMode && (
            <div className="grid gap-3 rounded-[18px] border border-[rgba(210,255,77,0.22)] bg-[rgba(12,20,10,0.58)] p-4 lg:grid-cols-[minmax(0,0.9fr)_minmax(0,1.1fr)]">
              <div className="space-y-2">
                <div className="font-mono text-[10px] uppercase tracking-[0.22em] text-[#d2ff4d]">Stille Moderation fuer Hackathon-Video</div>
                <h3 className="font-mono text-base font-semibold text-[#f3f8ff]">{demoNarrationStep.title}</h3>
                <p className="text-xs leading-relaxed text-[#b9c98c]">{demoNarrationStep.body}</p>
              </div>
              <div className="grid gap-2 sm:grid-cols-4">
                {(['concept', 'grounding', 'render', 'zip'] as DemoNarrationStepId[]).map((stepId) => {
                  const step = DEMO_NARRATION_STEPS[stepId];
                  const active = demoNarrationStep.id === stepId || (stepId === 'zip' && (demoNarrationStep.id === 'done' || demoNarrationStep.id === 'zip'));
                  return (
                    <div key={stepId} className={`rounded-xl border px-3 py-2 ${active
                      ? 'border-[rgba(210,255,77,0.38)] bg-[rgba(42,54,10,0.68)] text-[#d2ff4d]'
                      : 'border-[rgba(114,228,255,0.12)] bg-[rgba(5,12,24,0.62)] text-[#4a7090]'}`}
                    >
                      <div className="font-mono text-[9px] uppercase tracking-[0.16em]">{step.kicker}</div>
                      <div className="mt-1 font-mono text-[10px] font-semibold leading-tight">{step.title}</div>
                    </div>
                  );
                })}
              </div>
            </div>
          )}

          {demoRun.status !== 'idle' && (
            <div className="flex flex-wrap items-center gap-2">
              {DEMO_STAGE_IDS.map((stageId) => {
                const status = demoRun.stages[stageId];
                const chipClass = status === 'done'
                  ? 'border-[rgba(141,240,180,0.35)] bg-[rgba(10,40,24,0.6)] text-[#8df0b4]'
                  : status === 'active'
                    ? 'border-[rgba(114,228,255,0.4)] bg-[rgba(14,44,70,0.7)] text-[#72e4ff]'
                    : status === 'error'
                      ? 'border-[rgba(255,80,60,0.35)] bg-[rgba(60,16,10,0.6)] text-[#ff6a4f]'
                      : 'border-[rgba(114,228,255,0.1)] bg-[rgba(8,16,30,0.6)] text-[#36516e]';
                return (
                  <span key={stageId} className={`flex items-center gap-1.5 rounded-full border px-3 py-1.5 font-mono text-[10px] font-semibold ${chipClass}`}>
                    {status === 'active' && <Loader2 size={11} className="animate-spin" />}
                    {status === 'done' && <CheckCircle2 size={11} />}
                    {status === 'error' && <TriangleAlert size={11} />}
                    {DEMO_STAGE_LABELS[stageId]}
                  </span>
                );
              })}
              {demoRun.startedAt && demoRun.finishedAt && (
                <span className="font-mono text-[10px] text-[#4a7090]">
                  Laufzeit {Math.max(1, Math.round((demoRun.finishedAt - demoRun.startedAt) / 1000))}s
                </span>
              )}
            </div>
          )}

          {demoRun.error && (
            <div className="flex items-start gap-2 rounded-lg border border-[rgba(255,80,60,0.2)] bg-[rgba(255,80,60,0.1)] px-4 py-3 text-xs text-[#ff6a4f]">
              <TriangleAlert size={14} className="mt-0.5 shrink-0" />
              <span>
                {demoRun.error}
                {demoRun.stages.concept === 'error' && conceptError ? ` · ${conceptError}` : ''}
              </span>
            </div>
          )}

          {demoRun.status === 'done' && (
            <div className="flex items-start gap-2 rounded-lg border border-[rgba(141,240,180,0.2)] bg-[rgba(141,240,180,0.08)] px-4 py-3 text-xs text-[#8df0b4]">
              <CheckCircle2 size={14} className="mt-0.5 shrink-0" />
              <span>
                Produktion abgeschlossen: Story „{storyTitle ?? 'ohne Titel'}“ mit vier GIF-Loops – bereit als Dia-Show
                für das nächste Musikvideo bzw. den nächsten Livestream auf @audioreworkvisions.
                Nächster Schritt: Im Thumbnail Studio Thumbnail, Titel, Beschreibung, Hashtags und SEO-Keywords zum Video generieren.
                Das Foundry-IQ-Grounding jeder Szene ist im IQ-Panel und im Prompt-Debug nachvollziehbar.
              </span>
            </div>
          )}

          {scenes.length > 0 && (
            <div ref={demoZipSectionRef} className={`scroll-mt-24 flex flex-wrap items-center gap-3 rounded-[16px] border border-[rgba(232,193,106,0.16)] bg-[rgba(42,28,6,0.36)] px-4 py-3 transition ${demoFocusClass('zip')}`}>
              <div className="min-w-0 flex-1">
                <div className="font-mono text-[10px] uppercase tracking-[0.18em] text-[#ffd980]">Szenen-ZIP</div>
                <div className="mt-1 text-xs text-[#b9a06d]">
                  Exportiert Story-Metadaten, alle vier Prompts und vorhandene Sketch/GIF-Assets fuer die Dia-Show.
                </div>
              </div>
              <button
                type="button"
                onClick={() => void handleDownloadStoryZip()}
                disabled={isDownloadingStoryZip}
                className="flex items-center gap-2 rounded-xl border border-[rgba(232,193,106,0.3)] bg-[rgba(58,38,8,0.82)] px-4 py-2.5 font-mono text-[11px] font-semibold text-[#ffd980] transition hover:bg-[rgba(74,48,10,0.9)] disabled:cursor-not-allowed disabled:opacity-40"
              >
                {isDownloadingStoryZip ? <Loader2 size={14} className="animate-spin" /> : <Download size={14} />}
                ZIP downloaden
              </button>
            </div>
          )}

          {/* Live Pipeline Log */}
          {pipelineLog.length > 0 && (
            <div ref={demoLogSectionRef} className={`scroll-mt-24 rounded-[16px] border border-[rgba(114,228,255,0.14)] bg-[rgba(3,8,18,0.85)] p-3 space-y-2 transition ${demoFocusClass('log')}`}>
              <div className="flex flex-wrap items-center gap-2">
                <Terminal size={13} className="text-[#72e4ff]" />
                <span className="font-mono text-[10px] uppercase tracking-[0.2em] text-[#72e4ff]">Live Pipeline Log</span>
                <span className="font-mono text-[10px] text-[#4a7090]">IQ-Grounding · Final Prompts · Sora-Render · GIF-Konvertierung</span>
                <button
                  type="button"
                  onClick={() => setPipelineLog([])}
                  className="ml-auto rounded-md border border-[rgba(114,228,255,0.12)] px-2 py-1 font-mono text-[9px] font-semibold text-[#4a7090] transition hover:text-[#8ea6c3]"
                >
                  Leeren
                </button>
              </div>
              <div ref={pipelineLogScrollRef} className="max-h-60 space-y-1 overflow-y-auto rounded-lg bg-[rgba(2,5,12,0.85)] p-3 font-mono text-[10px] leading-relaxed">
                {pipelineLog.map((entry) => (
                  <div
                    key={entry.id}
                    className={`flex gap-2 ${entry.level === 'error'
                      ? 'text-[#ff6a4f]'
                      : entry.level === 'success'
                        ? 'text-[#8df0b4]'
                        : entry.level === 'detail'
                          ? 'text-[#8f74c9]'
                          : 'text-[#8ea6c3]'}`}
                  >
                    <span className="shrink-0 text-[#36516e]">{new Date(entry.time).toLocaleTimeString('de-DE')}</span>
                    <span className="min-w-0 break-words">{entry.text}</span>
                  </div>
                ))}
              </div>
            </div>
          )}
        </section>
        )}

        {studioView === 'manual-demo' && (
        <section className="rounded-[24px] border border-[rgba(232,193,106,0.22)] bg-[linear-gradient(135deg,rgba(34,22,6,0.86),rgba(7,14,28,0.88))] p-5 space-y-5 backdrop-blur-sm">
          <div className="flex flex-wrap items-start justify-between gap-4">
            <div className="max-w-3xl space-y-1.5">
              <div className="font-mono text-[11px] uppercase tracking-[0.24em] text-[#ffd980]">
                Agents League · Manual Demo Flow
              </div>
              <h2 className="font-mono text-lg font-semibold text-[#f3f8ff]">
                Simple Prompt + Style-Upload → 4 Szenenprompts
              </h2>
              <p className="text-xs leading-relaxed text-[#b9a06d]">
                Für die Live-Demo kannst du einen sehr kurzen visuellen Impuls eintippen und ein Stilbild hochladen.
                Die bestehende Style-Extraction liest Palette, Material, Licht und Prompt-DNA aus den Bildern und schreibt daraus automatisch vier Story-Beats, die anschließend als GIFs gerendert oder als Szenen-ZIP exportiert werden.
              </p>
            </div>
            {scenes.length > 0 && (
              <button
                type="button"
                onClick={() => void handleDownloadStoryZip()}
                disabled={isDownloadingStoryZip}
                className="flex items-center gap-2 rounded-xl border border-[rgba(232,193,106,0.34)] bg-[rgba(58,38,8,0.82)] px-4 py-2.5 font-mono text-[11px] font-semibold text-[#ffd980] transition hover:bg-[rgba(74,48,10,0.9)] disabled:cursor-not-allowed disabled:opacity-40"
              >
                {isDownloadingStoryZip ? <Loader2 size={14} className="animate-spin" /> : <Download size={14} />}
                Szenen-ZIP downloaden
              </button>
            )}
          </div>

          <div className="rounded-[18px] border border-[rgba(114,228,255,0.14)] bg-[rgba(4,12,24,0.72)] p-4 space-y-4">
            <div className="flex flex-wrap items-start justify-between gap-3">
              <div className="min-w-0 space-y-1">
                <div className="font-mono text-[11px] uppercase tracking-[0.22em] text-[#72e4ff]">Foundry IQ Story Memory</div>
                <p className="max-w-3xl text-xs leading-relaxed text-[#8ea6c3]">
                  Speichert Prompt, extrahierte Style-DNA und Szenen als Markdown-Story-Memory. Gespeicherte Stories lassen sich hier wieder laden, fortsetzen und explizit mit Foundry IQ synchronisieren.
                </p>
              </div>
              <div className="flex flex-wrap items-center gap-2">
                <button
                  type="button"
                  onClick={() => void loadStoryMemories()}
                  disabled={isLoadingStoryMemories}
                  className="inline-flex items-center gap-2 rounded-xl border border-[rgba(114,228,255,0.18)] bg-[rgba(10,26,46,0.72)] px-3 py-2 font-mono text-[10px] font-semibold text-[#72e4ff] transition hover:bg-[rgba(18,38,64,0.82)] disabled:cursor-not-allowed disabled:opacity-40"
                >
                  {isLoadingStoryMemories ? <Loader2 size={12} className="animate-spin" /> : <Database size={12} />}
                  Memory abrufen
                </button>
                {scenes.length > 0 && (
                  <button
                    type="button"
                    onClick={() => void handleSaveStoryMemory(selectedStoryMemory?.id ?? null)}
                    disabled={isSavingStoryMemory}
                    className="inline-flex items-center gap-2 rounded-xl border border-[rgba(141,240,180,0.2)] bg-[rgba(10,40,24,0.56)] px-3 py-2 font-mono text-[10px] font-semibold text-[#8df0b4] transition hover:bg-[rgba(14,52,30,0.68)] disabled:cursor-not-allowed disabled:opacity-40"
                  >
                    {isSavingStoryMemory ? <Loader2 size={12} className="animate-spin" /> : <BookOpen size={12} />}
                    Als story.md speichern
                  </button>
                )}
                <button
                  type="button"
                  onClick={() => void handleSyncStoryMemory()}
                  disabled={isSyncingStoryMemory || storyMemories.length === 0}
                  title={storyMemories.length === 0 ? 'Speichere zuerst eine Story-Memory als story.md.' : 'Gespeicherte story.md Dateien mit Foundry IQ synchronisieren'}
                  className="inline-flex items-center gap-2 rounded-xl border border-[rgba(232,193,106,0.24)] bg-[rgba(42,28,6,0.72)] px-3 py-2 font-mono text-[10px] font-semibold text-[#ffd980] transition hover:bg-[rgba(58,38,8,0.82)] disabled:cursor-not-allowed disabled:opacity-40"
                >
                  {isSyncingStoryMemory ? <Loader2 size={12} className="animate-spin" /> : <RefreshCw size={12} />}
                  Mit Foundry IQ syncen
                </button>
              </div>
            </div>

            {storyMemories.length > 0 && (
              <div className="grid gap-3 xl:grid-cols-[minmax(0,1fr)_auto] xl:items-end">
                <label className="space-y-2">
                  <span className="block font-mono text-[10px] uppercase tracking-[0.18em] text-[#4a7090]">Gespeicherte Story</span>
                  <div className="relative">
                    <select
                      value={selectedStoryMemoryId}
                      onChange={(event) => setSelectedStoryMemoryId(event.target.value)}
                      aria-label="Gespeicherte Story-Memory auswählen"
                      className="w-full appearance-none rounded-xl border border-[rgba(114,228,255,0.18)] bg-[#071221] px-4 py-3 pr-9 font-mono text-[11px] text-[#c8ddf0] outline-none transition focus:border-[#72e4ff]"
                    >
                      {storyMemories.map((memory) => (
                        <option key={memory.id} value={memory.id}>
                          {memory.title} · {memory.scenes.length} Szenen · {new Date(memory.updatedAt).toLocaleDateString('de-DE')}
                        </option>
                      ))}
                    </select>
                    <ChevronsDown size={13} className="pointer-events-none absolute right-3 top-1/2 -translate-y-1/2 text-[#4a7090]" />
                  </div>
                </label>
                <div className="flex flex-wrap gap-2">
                  <button
                    type="button"
                    onClick={() => selectedStoryMemory && applyStoryMemoryToEditor(selectedStoryMemory)}
                    disabled={!selectedStoryMemory}
                    className="inline-flex items-center gap-2 rounded-xl border border-[rgba(114,228,255,0.18)] bg-[rgba(10,26,46,0.72)] px-3 py-3 font-mono text-[10px] font-semibold text-[#72e4ff] transition hover:bg-[rgba(18,38,64,0.82)] disabled:cursor-not-allowed disabled:opacity-40"
                  >
                    <Copy size={12} />
                    Wiederverwenden
                  </button>
                  <button
                    type="button"
                    onClick={() => void handleContinueStoryMemory()}
                    disabled={!selectedStoryMemory || isGeneratingConcept}
                    className="inline-flex items-center gap-2 rounded-xl border border-[rgba(232,193,106,0.24)] bg-[rgba(42,28,6,0.72)] px-3 py-3 font-mono text-[10px] font-semibold text-[#ffd980] transition hover:bg-[rgba(58,38,8,0.82)] disabled:cursor-not-allowed disabled:opacity-40"
                  >
                    {isGeneratingConcept ? <Loader2 size={12} className="animate-spin" /> : <RefreshCw size={12} />}
                    Fortsetzen
                  </button>
                </div>
              </div>
            )}

            {selectedStoryMemory && (
              <div className="rounded-[14px] border border-[rgba(114,228,255,0.1)] bg-[rgba(3,8,18,0.72)] px-3 py-3 font-mono text-[10px] leading-relaxed text-[#8ea6c3]">
                <span className="text-[#72e4ff]">Aktive Memory:</span> {selectedStoryMemory.storyConcept || selectedStoryMemory.sourcePrompt || selectedStoryMemory.title}
                {selectedStoryMemory.referenceStyle?.summary ? <> · <span className="text-[#ffd980]">Style:</span> {selectedStoryMemory.referenceStyle.summary}</> : null}
              </div>
            )}

            {storyMemoryMessage && (
              <div className={`rounded-lg border px-4 py-3 font-mono text-[10px] leading-relaxed ${/fehl|failed|error/i.test(storyMemoryMessage)
                ? 'border-[rgba(255,80,60,0.2)] bg-[rgba(255,80,60,0.1)] text-[#ff6a4f]'
                : 'border-[rgba(114,228,255,0.14)] bg-[rgba(10,26,46,0.56)] text-[#72e4ff]'}`}>
                {storyMemoryMessage}
              </div>
            )}
          </div>

          <div className="grid gap-5 xl:grid-cols-[minmax(0,1.05fr)_minmax(340px,0.95fr)]">
            <div className="space-y-4">
              <label className="block space-y-2">
                <span className="block font-mono text-[11px] uppercase tracking-[0.22em] text-[#ffd980]">Simple Prompt</span>
                <textarea
                  ref={inputRef}
                  value={concept}
                  onChange={(event) => setConcept(event.target.value)}
                  rows={4}
                  placeholder="z. B. eine schwarze Maschine atmet im Takt, cyan Staub, ruhige Kamera, techno archive energy"
                  className="w-full resize-none rounded-xl border border-[rgba(232,193,106,0.2)] bg-[rgba(5,10,18,0.86)] px-4 py-3 font-mono text-sm text-[#fff4d0] placeholder-[#6f5a2f] outline-none transition focus:border-[rgba(255,217,128,0.55)] focus:ring-1 focus:ring-[rgba(255,217,128,0.2)]"
                  onKeyDown={(event) => {
                    if (event.key === 'Enter' && !event.shiftKey) {
                      event.preventDefault();
                      void handleManualDemoGenerateScenes();
                    }
                  }}
                />
              </label>

              <div className="flex flex-wrap items-center gap-3">
                <button
                  type="button"
                  onClick={() => void handleManualDemoGenerateScenes()}
                  disabled={isGeneratingConcept || isPreparingReferences || (!concept.trim() && referenceImages.length === 0)}
                  className="flex items-center gap-2 rounded-xl border border-[rgba(232,193,106,0.34)] bg-[rgba(58,38,8,0.82)] px-5 py-3 font-mono text-xs font-semibold text-[#ffd980] transition hover:bg-[rgba(74,48,10,0.9)] disabled:cursor-not-allowed disabled:opacity-40"
                >
                  {isGeneratingConcept ? (
                    <><Loader2 size={14} className="animate-spin" />Szenen werden geschrieben…</>
                  ) : (
                    <><Sparkles size={14} />4 Szenenprompts schreiben</>
                  )}
                </button>
                {scenes.length > 0 && (
                  <button
                    type="button"
                    onClick={handleVideoAll}
                    disabled={isRenderingAllVideos || hasActiveVideoRender || scenes.every((scene) => !scene.prompt.trim())}
                    className="flex items-center gap-2 rounded-xl border border-[rgba(114,228,255,0.18)] bg-[rgba(10,32,46,0.72)] px-5 py-3 font-mono text-xs font-semibold text-[#72e4ff] transition hover:bg-[rgba(16,46,66,0.82)] disabled:cursor-not-allowed disabled:opacity-40"
                  >
                    {isRenderingAllVideos ? <><Loader2 size={14} className="animate-spin" />GIF {Math.max(activeVideoBatchIndex, 0) + 1} / {scenes.length}…</> : <><Film size={14} />Alle 4 GIFs rendern</>}
                  </button>
                )}
              </div>

              {conceptError && (
                <div className="flex items-start gap-2 rounded-lg border border-[rgba(255,80,60,0.2)] bg-[rgba(255,80,60,0.1)] px-4 py-3 text-xs text-[#ff6a4f]">
                  <TriangleAlert size={14} className="mt-0.5 shrink-0" />
                  {conceptError}
                </div>
              )}
            </div>

            <div className="rounded-[18px] border border-[rgba(232,193,106,0.16)] bg-[rgba(10,12,20,0.78)] p-4 space-y-4">
              <div className="flex flex-wrap items-center justify-between gap-3">
                <div>
                  <div className="font-mono text-[11px] uppercase tracking-[0.22em] text-[#ffd980]">Style Extraction Upload</div>
                  <div className="mt-1 font-mono text-[10px] text-[#8a6a30]">PNG / GIF · {referenceImages.length}/{MAX_REFERENCE_IMAGES}</div>
                </div>
                <button
                  type="button"
                  onClick={() => referenceInputRef.current?.click()}
                  disabled={isPreparingReferences || referenceImages.length >= MAX_REFERENCE_IMAGES}
                  className="inline-flex items-center gap-2 rounded-xl border border-[rgba(232,193,106,0.22)] bg-[rgba(42,28,6,0.72)] px-4 py-2 font-mono text-[11px] font-semibold text-[#ffd980] transition hover:bg-[rgba(58,38,8,0.82)] disabled:cursor-not-allowed disabled:opacity-40"
                >
                  {isPreparingReferences ? <Loader2 size={13} className="animate-spin" /> : <ImagePlus size={13} />}
                  Stilbilder hochladen
                </button>
              </div>

              <input
                ref={referenceInputRef}
                type="file"
                accept="image/png,image/gif"
                multiple
                className="hidden"
                onChange={handleReferenceFilesSelected}
              />

              {referenceImages.length > 0 ? (
                <div className="grid gap-3 sm:grid-cols-2">
                  {referenceImages.map((referenceImage) => (
                    <article key={referenceImage.id} className="overflow-hidden rounded-[16px] border border-[rgba(232,193,106,0.12)] bg-[rgba(4,8,16,0.78)]">
                      <div className="aspect-video overflow-hidden border-b border-[rgba(232,193,106,0.08)] bg-[#02040e]">
                        <img src={referenceImage.previewDataUrl} alt={referenceImage.name} className="h-full w-full object-cover" />
                      </div>
                      <div className="space-y-2 px-3 py-3">
                        <div className="flex items-start justify-between gap-2">
                          <div className="min-w-0">
                            <div className="truncate font-mono text-[11px] text-[#fff4d0]">{referenceImage.name}</div>
                            <div className="font-mono text-[10px] text-[#8a6a30]">{referenceImage.source.toUpperCase()} · {referenceImage.width}×{referenceImage.height}</div>
                          </div>
                          <button
                            type="button"
                            onClick={() => handleRemoveReferenceImage(referenceImage.id)}
                            className="rounded-full border border-[rgba(232,193,106,0.14)] p-1 text-[#8a6a30] transition hover:border-[rgba(232,193,106,0.3)] hover:text-[#fff4d0]"
                            aria-label={`${referenceImage.name} entfernen`}
                          >
                            <X size={12} />
                          </button>
                        </div>
                      </div>
                    </article>
                  ))}
                </div>
              ) : (
                <div className="rounded-[16px] border border-dashed border-[rgba(232,193,106,0.14)] bg-[rgba(4,8,16,0.52)] px-4 py-8 text-center font-mono text-[11px] text-[#8a6a30]">
                  Kein Stilbild geladen · Prompt allein reicht, Referenzen machen die Szenen-DNA konkreter.
                </div>
              )}

              {referenceStyle && (
                <div className="rounded-[14px] border border-[rgba(114,228,255,0.12)] bg-[rgba(4,14,26,0.68)] px-3 py-3 font-mono text-[10px] leading-relaxed text-[#8ea6c3]">
                  <span className="text-[#72e4ff]">Extrahierte Style-DNA:</span> {referenceStyle.summary || referenceStyle.promptDNA || referenceStyle.palette}
                </div>
              )}

              {referenceError && (
                <div className="flex items-start gap-2 rounded-lg border border-[rgba(255,80,60,0.2)] bg-[rgba(255,80,60,0.1)] px-4 py-3 text-xs text-[#ff6a4f]">
                  <TriangleAlert size={14} className="mt-0.5 shrink-0" />
                  {referenceError}
                </div>
              )}
            </div>
          </div>

          {scenes.length > 0 && (
            <div className="rounded-[16px] border border-[rgba(141,240,180,0.18)] bg-[rgba(10,40,24,0.08)] px-4 py-3 text-xs leading-relaxed text-[#8df0b4]">
              <CheckCircle2 size={14} className="mr-2 inline-block align-[-2px]" />
              Vier Szenenprompts sind geschrieben. Du kannst sie unten editieren, als GIFs rendern oder direkt als ZIP mit Story-Metadaten exportieren.
            </div>
          )}
        </section>
        )}

        {/* ── Compose + Storyboard (two-column studio) ─────────────────────── */}
        <div ref={stillframeSectionRef} className={`grid scroll-mt-24 gap-6 ${studioView === 'werkstatt' ? 'xl:grid-cols-[minmax(0,0.9fr)_minmax(0,1.1fr)] xl:items-start' : ''}`}>

        {/* Left column · Compose controls (nur Werkstatt) */}
        {studioView === 'werkstatt' && (
        <div className="space-y-6 xl:sticky xl:top-6">

        <details className="rounded-[18px] border border-[rgba(114,228,255,0.14)] bg-[rgba(4,12,24,0.72)] p-4" open={false}>
          <summary className="cursor-pointer font-mono text-[11px] uppercase tracking-[0.2em] text-[#72e4ff]">
            Story Memory & IQ Sync
          </summary>
          <div className="mt-3 space-y-4">
          <div className="flex flex-wrap items-start justify-between gap-3">
            <div className="min-w-0 space-y-1">
              <div className="font-mono text-[11px] uppercase tracking-[0.22em] text-[#72e4ff]">Foundry IQ Story Memory</div>
              <p className="max-w-3xl text-xs leading-relaxed text-[#8ea6c3]">
                Werkstatt-Pipeline fuer story.md: Storys mit Szenenprompts und Style-Cards abrufen, speichern, wiederverwenden und mit Foundry IQ synchronisieren.
              </p>
            </div>
            <div className="flex flex-wrap items-center gap-2">
              <button
                type="button"
                onClick={() => void loadStoryMemories()}
                disabled={isLoadingStoryMemories}
                className="inline-flex items-center gap-2 rounded-xl border border-[rgba(114,228,255,0.18)] bg-[rgba(10,26,46,0.72)] px-3 py-2 font-mono text-[10px] font-semibold text-[#72e4ff] transition hover:bg-[rgba(18,38,64,0.82)] disabled:cursor-not-allowed disabled:opacity-40"
              >
                {isLoadingStoryMemories ? <Loader2 size={12} className="animate-spin" /> : <Database size={12} />}
                Memory abrufen
              </button>
              {scenes.length > 0 && (
                <button
                  type="button"
                  onClick={() => void handleSaveStoryMemory(selectedStoryMemory?.id ?? null)}
                  disabled={isSavingStoryMemory}
                  className="inline-flex items-center gap-2 rounded-xl border border-[rgba(141,240,180,0.2)] bg-[rgba(10,40,24,0.56)] px-3 py-2 font-mono text-[10px] font-semibold text-[#8df0b4] transition hover:bg-[rgba(14,52,30,0.68)] disabled:cursor-not-allowed disabled:opacity-40"
                >
                  {isSavingStoryMemory ? <Loader2 size={12} className="animate-spin" /> : <BookOpen size={12} />}
                  Als story.md speichern
                </button>
              )}
              <button
                type="button"
                onClick={() => void handleSyncStoryMemory()}
                disabled={isSyncingStoryMemory || storyMemories.length === 0}
                title={storyMemories.length === 0 ? 'Speichere zuerst eine Story-Memory als story.md.' : 'Gespeicherte story.md Dateien mit Foundry IQ synchronisieren'}
                className="inline-flex items-center gap-2 rounded-xl border border-[rgba(232,193,106,0.24)] bg-[rgba(42,28,6,0.72)] px-3 py-2 font-mono text-[10px] font-semibold text-[#ffd980] transition hover:bg-[rgba(58,38,8,0.82)] disabled:cursor-not-allowed disabled:opacity-40"
              >
                {isSyncingStoryMemory ? <Loader2 size={12} className="animate-spin" /> : <RefreshCw size={12} />}
                Mit Foundry IQ syncen
              </button>
            </div>
          </div>

          {storyMemories.length > 0 && (
            <div className="grid gap-3 xl:grid-cols-[minmax(0,1fr)_auto] xl:items-end">
              <label className="space-y-2">
                <span className="block font-mono text-[10px] uppercase tracking-[0.18em] text-[#4a7090]">Gespeicherte Story</span>
                <div className="relative">
                  <select
                    value={selectedStoryMemoryId}
                    onChange={(event) => setSelectedStoryMemoryId(event.target.value)}
                    aria-label="Gespeicherte Story-Memory auswählen"
                    className="w-full appearance-none rounded-xl border border-[rgba(114,228,255,0.18)] bg-[#071221] px-4 py-3 pr-9 font-mono text-[11px] text-[#c8ddf0] outline-none transition focus:border-[#72e4ff]"
                  >
                    {storyMemories.map((memory) => (
                      <option key={memory.id} value={memory.id}>
                        {memory.title} · {memory.scenes.length} Szenen · {new Date(memory.updatedAt).toLocaleDateString('de-DE')}
                      </option>
                    ))}
                  </select>
                  <ChevronsDown size={13} className="pointer-events-none absolute right-3 top-1/2 -translate-y-1/2 text-[#4a7090]" />
                </div>
              </label>
              <div className="flex flex-wrap gap-2">
                <button
                  type="button"
                  onClick={() => selectedStoryMemory && applyStoryMemoryToEditor(selectedStoryMemory)}
                  disabled={!selectedStoryMemory}
                  className="inline-flex items-center gap-2 rounded-xl border border-[rgba(114,228,255,0.18)] bg-[rgba(10,26,46,0.72)] px-3 py-3 font-mono text-[10px] font-semibold text-[#72e4ff] transition hover:bg-[rgba(18,38,64,0.82)] disabled:cursor-not-allowed disabled:opacity-40"
                >
                  <Copy size={12} />
                  Wiederverwenden
                </button>
                <button
                  type="button"
                  onClick={() => void handleContinueStoryMemory()}
                  disabled={!selectedStoryMemory || isGeneratingConcept}
                  className="inline-flex items-center gap-2 rounded-xl border border-[rgba(232,193,106,0.24)] bg-[rgba(42,28,6,0.72)] px-3 py-3 font-mono text-[10px] font-semibold text-[#ffd980] transition hover:bg-[rgba(58,38,8,0.82)] disabled:cursor-not-allowed disabled:opacity-40"
                >
                  {isGeneratingConcept ? <Loader2 size={12} className="animate-spin" /> : <RefreshCw size={12} />}
                  Fortsetzen
                </button>
              </div>
            </div>
          )}

          {selectedStoryMemory && (
            <div className="rounded-[14px] border border-[rgba(114,228,255,0.1)] bg-[rgba(3,8,18,0.72)] px-3 py-3 font-mono text-[10px] leading-relaxed text-[#8ea6c3]">
              <span className="text-[#72e4ff]">Aktive Memory:</span> {selectedStoryMemory.storyConcept || selectedStoryMemory.sourcePrompt || selectedStoryMemory.title}
              {selectedStoryMemory.referenceStyle?.summary ? <> · <span className="text-[#ffd980]">Style:</span> {selectedStoryMemory.referenceStyle.summary}</> : null}
            </div>
          )}

          {storyMemoryMessage && (
            <div className={`rounded-lg border px-4 py-3 font-mono text-[10px] leading-relaxed ${/fehl|failed|error/i.test(storyMemoryMessage)
              ? 'border-[rgba(255,80,60,0.2)] bg-[rgba(255,80,60,0.1)] text-[#ff6a4f]'
              : 'border-[rgba(114,228,255,0.14)] bg-[rgba(10,26,46,0.56)] text-[#72e4ff]'}`}>
              {storyMemoryMessage}
            </div>
          )}
          </div>
        </details>

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
                { id: 'signal', label: 'Signal Geometry' },
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
          ) : generationMode === 'signal' ? (
            <>
              <div className="grid gap-4">
                <div className="rounded-[18px] border border-[rgba(0,245,212,0.14)] bg-[rgba(4,14,18,0.78)] p-4 space-y-3">
                  <div className="flex flex-wrap items-start justify-between gap-3">
                    <div>
                      <div className="font-mono text-[11px] uppercase tracking-[0.22em] text-[#4a8f8a]">Preset Engine</div>
                      <div className="mt-1 font-mono text-sm font-semibold text-[#d9fff7]">{arvMinimalSignalGeometryPreset.name}</div>
                    </div>
                    <span className="rounded-full border border-[rgba(0,245,212,0.18)] bg-[rgba(0,245,212,0.08)] px-2.5 py-1 font-mono text-[10px] text-[#6ff7e2]">
                      black CRT · thin lines · one event
                    </span>
                  </div>
                  <p className="text-[11px] leading-relaxed text-[#5f8d91]">
                    Minimalistische schwarze Signalbuehne mit einem zentralen geometrischen Objekt, duennen cyan-magenta/ivory Linien, analogem CRT-Grain und einem sauberen Reveal-Shift-Hold-Return Loop.
                  </p>
                </div>

                <div className="grid gap-4 lg:grid-cols-2">
                  <label className="space-y-2">
                    <span className="block font-mono text-[11px] uppercase tracking-[0.22em] text-[#4a8f8a]">Motif</span>
                    <div className="relative">
                      <select
                        value={selectedSignalMotif}
                        onChange={(event) => setSelectedSignalMotif(event.target.value)}
                        className="w-full appearance-none rounded-xl border border-[rgba(0,245,212,0.18)] bg-[#041014] px-4 py-3 pr-9 font-mono text-[11px] text-[#d9fff7] outline-none transition focus:border-[#48f6e8]"
                      >
                        {arvMinimalSignalGeometryPreset.defaultMotifs.map((motif) => (
                          <option key={motif} value={motif}>{motif}</option>
                        ))}
                      </select>
                      <ChevronsDown size={13} className="pointer-events-none absolute right-3 top-1/2 -translate-y-1/2 text-[#4a8f8a]" />
                    </div>
                  </label>

                  <label className="space-y-2">
                    <span className="block font-mono text-[11px] uppercase tracking-[0.22em] text-[#4a8f8a]">Motion Event</span>
                    <div className="relative">
                      <select
                        value={selectedSignalMotionEvent}
                        onChange={(event) => setSelectedSignalMotionEvent(event.target.value)}
                        className="w-full appearance-none rounded-xl border border-[rgba(0,245,212,0.18)] bg-[#041014] px-4 py-3 pr-9 font-mono text-[11px] text-[#d9fff7] outline-none transition focus:border-[#48f6e8]"
                      >
                        {arvMinimalSignalGeometryPreset.defaultMotionEvents.map((motionEvent) => (
                          <option key={motionEvent} value={motionEvent}>{motionEvent}</option>
                        ))}
                      </select>
                      <ChevronsDown size={13} className="pointer-events-none absolute right-3 top-1/2 -translate-y-1/2 text-[#4a8f8a]" />
                    </div>
                  </label>
                </div>

                <label className="space-y-2">
                  <span className="block font-mono text-[11px] uppercase tracking-[0.22em] text-[#4a8f8a]">Optionaler Signal Seed</span>
                  <textarea
                    value={signalPrompt}
                    onChange={(event) => setSignalPrompt(event.target.value)}
                    placeholder="z. B. black-on-black broadcast alignment mark with one cyan pulse and magenta edge split"
                    rows={3}
                    className="w-full resize-none rounded-xl border border-[rgba(0,245,212,0.18)] bg-[#041014] px-4 py-3 font-mono text-sm text-[#d9fff7] placeholder-[#315d60] outline-none transition focus:border-[#48f6e8] focus:ring-1 focus:ring-[rgba(72,246,232,0.2)]"
                    onKeyDown={(event) => {
                      if (event.key === 'Enter' && !event.shiftKey) {
                        event.preventDefault();
                        void handleGenerateSignal();
                      }
                    }}
                  />
                </label>

                <div className="space-y-3 rounded-[18px] border border-[rgba(0,245,212,0.12)] bg-[rgba(2,16,18,0.68)] p-4">
                  <div className="flex flex-wrap items-center justify-between gap-3">
                    <label className="font-mono text-[11px] uppercase tracking-[0.22em] text-[#4a8f8a]">
                      Signal Referenzbilder PNG / GIF
                    </label>
                    <div className="flex items-center gap-3">
                      <span className={`rounded-full border px-2 py-0.5 font-mono text-[10px] ${referenceImages.length > 0 ? 'border-[rgba(0,245,212,0.24)] bg-[rgba(0,245,212,0.08)] text-[#6ff7e2]' : 'border-[rgba(0,245,212,0.12)] bg-[rgba(4,20,22,0.6)] text-[#4a8f8a]'}`}>
                        {referenceImages.length}/{MAX_REFERENCE_IMAGES}
                      </span>
                      <button
                        type="button"
                        onClick={() => referenceInputRef.current?.click()}
                        disabled={isPreparingReferences || referenceImages.length >= MAX_REFERENCE_IMAGES}
                        className="inline-flex items-center gap-2 rounded-xl border border-[rgba(0,245,212,0.2)] bg-[rgba(4,42,44,0.72)] px-4 py-2 font-mono text-[11px] font-semibold text-[#6ff7e2] transition hover:bg-[rgba(8,56,58,0.86)] disabled:cursor-not-allowed disabled:opacity-40"
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

                  <p className="text-[11px] leading-relaxed text-[#5f8d91]">
                    Signal Geometry liest Referenzbilder als Stil- und Formsignal: Palette, Liniengewicht, Oberflaechenrauschen, Kontrast und Bewegungs-DNA werden in die vier abstrakten Beats uebernommen.
                  </p>

                  {referenceImages.length > 0 && (
                    <div className="grid gap-3 md:grid-cols-2 xl:grid-cols-4">
                      {referenceImages.map((referenceImage) => (
                        <article
                          key={referenceImage.id}
                          className="overflow-hidden rounded-[16px] border border-[rgba(0,245,212,0.12)] bg-[rgba(3,12,16,0.82)]"
                        >
                          <div className="aspect-video overflow-hidden border-b border-[rgba(0,245,212,0.08)] bg-[#010708]">
                            <img
                              src={referenceImage.previewDataUrl}
                              alt={referenceImage.name}
                              className="h-full w-full object-cover"
                            />
                          </div>
                          <div className="space-y-2 px-3 py-3">
                            <div className="flex items-start justify-between gap-2">
                              <div className="min-w-0">
                                <div className="truncate font-mono text-[11px] text-[#d9fff7]">{referenceImage.name}</div>
                                <div className="font-mono text-[10px] text-[#4a8f8a]">
                                  {referenceImage.source.toUpperCase()} · {referenceImage.width}×{referenceImage.height}
                                </div>
                              </div>
                              <button
                                type="button"
                                onClick={() => handleRemoveReferenceImage(referenceImage.id)}
                                className="rounded-full border border-[rgba(0,245,212,0.14)] p-1 text-[#4a8f8a] transition hover:border-[rgba(0,245,212,0.28)] hover:text-[#d9fff7]"
                                aria-label={`${referenceImage.name} entfernen`}
                              >
                                <X size={12} />
                              </button>
                            </div>

                            <div className="font-mono text-[10px] leading-relaxed text-[#5f8d91]">
                              {referenceImage.source === 'gif'
                                ? 'GIF-Stilanker: erstes normalisiertes Loop-Still wird als Signal-DNA analysiert.'
                                : 'PNG-Stilanker: Form, Kanten, Licht und Rauschen werden fuer Signal-DNA analysiert.'}
                            </div>
                          </div>
                        </article>
                      ))}
                    </div>
                  )}

                  {referenceError && (
                    <div className="flex items-start gap-2 rounded-lg border border-[rgba(255,80,60,0.2)] bg-[rgba(255,80,60,0.1)] px-4 py-3 text-xs text-[#ff6a4f]">
                      <TriangleAlert size={14} className="mt-0.5 shrink-0" />
                      {referenceError}
                    </div>
                  )}
                </div>

                <div className="flex flex-wrap items-center gap-3">
                  <button
                    type="button"
                    onClick={handleGenerateSignal}
                    disabled={isGeneratingConcept || !canGenerateSignal}
                    className="flex items-center gap-2 rounded-xl border border-[rgba(0,245,212,0.28)] bg-[rgba(4,42,44,0.82)] px-5 py-2.5 font-mono text-xs font-semibold text-[#6ff7e2] transition hover:bg-[rgba(8,56,58,0.9)] disabled:cursor-not-allowed disabled:opacity-40"
                  >
                    {isGeneratingConcept ? (
                      <><Loader2 size={14} className="animate-spin" />Generating signal…</>
                    ) : (
                      <><Sparkles size={14} />Generate Signal Beats</>
                    )}
                  </button>
                  <div className="font-mono text-[10px] leading-relaxed text-[#4a8f8a]">
                    Preset-Dauerlogik: Sora 4/8/12s · locked camera · no text · no characters · no strobe
                  </div>
                </div>

                {conceptError && (
                  <div className="flex items-start gap-2 rounded-lg bg-[rgba(255,80,60,0.1)] border border-[rgba(255,80,60,0.2)] px-4 py-3 text-xs text-[#ff6a4f]">
                    <TriangleAlert size={14} className="mt-0.5 shrink-0" />
                    {conceptError}
                  </div>
                )}
              </div>
            </>
          ) : (
            <>
              <div className="flex flex-wrap items-center justify-between gap-3 rounded-xl border border-[rgba(114,228,255,0.12)] bg-[rgba(6,14,28,0.78)] px-3 py-2">
                <span className="font-mono text-[10px] uppercase tracking-[0.18em] text-[#4a7090]">Satire Layout</span>
                <div className="inline-flex items-center gap-1 rounded-lg border border-[rgba(114,228,255,0.14)] bg-[rgba(7,14,28,0.82)] p-1">
                  <button
                    type="button"
                    onClick={() => setSatireLayoutMode('single')}
                    className={`rounded-md px-3 py-1.5 font-mono text-[10px] font-semibold transition ${satireLayoutMode === 'single'
                      ? 'border border-[rgba(114,228,255,0.28)] bg-[rgba(18,38,64,0.9)] text-[#72e4ff]'
                      : 'border border-transparent text-[#4a7090] hover:text-[#8ea6c3]'}`}
                  >
                    Einspaltig
                  </button>
                  <button
                    type="button"
                    onClick={() => setSatireLayoutMode('split')}
                    className={`rounded-md px-3 py-1.5 font-mono text-[10px] font-semibold transition ${satireLayoutMode === 'split'
                      ? 'border border-[rgba(168,118,255,0.28)] bg-[rgba(38,20,64,0.9)] text-[#c7a7ff]'
                      : 'border border-transparent text-[#4a7090] hover:text-[#8ea6c3]'}`}
                  >
                    Zweispaltig
                  </button>
                </div>
              </div>

              <div className={`grid gap-4 ${satireLayoutMode === 'split' ? 'xl:grid-cols-[minmax(0,1.1fr)_minmax(360px,0.9fr)]' : ''}`}>
                <div className="min-w-0 space-y-3">
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

                <div className={`grid min-w-0 gap-4 ${satireLayoutMode === 'split' ? 'lg:grid-cols-[minmax(260px,0.85fr)_minmax(0,1.15fr)]' : ''}`}>
                  <div className="min-w-0 rounded-[18px] border border-[rgba(114,228,255,0.12)] bg-[rgba(8,16,30,0.82)] p-4 space-y-3">
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

                  <div className="min-w-0 rounded-[18px] border border-[rgba(114,228,255,0.12)] bg-[rgba(8,16,30,0.82)] p-4 space-y-4">
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

                <div className={`space-y-3 ${satireLayoutMode === 'split' ? 'xl:col-span-2' : ''}`}>
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
        {/* End left column */}
        </div>
        )}

        {/* Right column · Generated output + storyboard */}
        <div className="space-y-6">

        {/* ── Scene beat cards ──────────────────────────────────────────────── */}
        {scenes.length > 0 && (
          <div ref={demoResultsSectionRef} className={`scroll-mt-24 space-y-5 rounded-[24px] transition ${isObsDemoMode ? 'p-2' : ''} ${demoFocusClass('results')}`}>
            {/* Foundry IQ Spotlight */}
            {sceneIqEntries.length > 0 && (
              <div className="rounded-[20px] border border-[rgba(114,228,255,0.16)] bg-[rgba(6,16,30,0.78)] p-4 space-y-3">
                <div className="flex flex-wrap items-center gap-2">
                  <Database size={14} className="text-[#72e4ff]" />
                  <span className="font-mono text-[11px] uppercase tracking-[0.2em] text-[#72e4ff]">Foundry IQ Grounding</span>
                  <span className={`rounded-full border px-2.5 py-0.5 font-mono text-[10px] font-semibold ${usedRemoteIq
                    ? 'border-[rgba(141,240,180,0.3)] bg-[rgba(10,40,24,0.55)] text-[#8df0b4]'
                    : 'border-[rgba(232,169,74,0.3)] bg-[rgba(42,28,6,0.55)] text-[#e8c16a]'}`}
                  >
                    {usedRemoteIq ? 'Foundry IQ Agent · Remote' : 'Workspace Knowledge Base · Fallback'}
                  </span>
                  <span className="ml-auto font-mono text-[10px] text-[#4a7090]">
                    {sceneIqEntries.length}/{scenes.length} Szenen grounded · {iqCitations.length} zitierte Quellen
                  </span>
                </div>
                <div className="flex flex-wrap gap-2">
                  {sceneIqEntries.map((entry) => (
                    <span
                      key={`iq-scene-${entry.index}`}
                      className="rounded-full border border-[rgba(114,228,255,0.14)] bg-[rgba(12,26,46,0.6)] px-2.5 py-1 font-mono text-[10px] text-[#8ea6c3]"
                    >
                      Szene {entry.index + 1} · {entry.brief.provider === 'foundry-iq-agent' ? 'Foundry IQ' : 'Local KB'} · {entry.brief.citations.length} Zitate
                    </span>
                  ))}
                </div>
                {iqCitations.length > 0 && (
                  <details className="rounded-lg border border-[rgba(114,228,255,0.1)] bg-[rgba(4,10,20,0.62)] px-3 py-2">
                    <summary className="cursor-pointer font-mono text-[10px] uppercase tracking-[0.16em] text-[#8ea6c3]">
                      Quellen anzeigen ({iqCitations.length})
                    </summary>
                    <div className="mt-2 grid gap-2 md:grid-cols-2">
                      {iqCitations.slice(0, 8).map((citation) => (
                        <div key={`${citation.source}-${citation.excerpt.slice(0, 24)}`} className="rounded-lg border border-[rgba(114,228,255,0.08)] bg-[rgba(4,10,20,0.72)] p-3">
                          <div className="truncate font-mono text-[10px] uppercase tracking-[0.14em] text-[#72e4ff]">{citation.source}</div>
                          <div className="mt-1 text-[10px] leading-relaxed text-[#8ea6c3]">{citation.excerpt}</div>
                        </div>
                      ))}
                    </div>
                  </details>
                )}
              </div>
            )}

            {/* Batch actions */}
            <div className="flex flex-wrap items-center gap-3">
              {studioView === 'werkstatt' && (
                <div className="inline-flex items-center gap-1 rounded-xl border border-[rgba(114,228,255,0.14)] bg-[rgba(6,14,28,0.82)] p-1">
                  <button
                    type="button"
                    onClick={() => setIsCompactSceneCards(true)}
                    className={`rounded-lg px-3 py-1.5 font-mono text-[10px] font-semibold transition ${isCompactSceneCards
                      ? 'border border-[rgba(114,228,255,0.3)] bg-[rgba(18,38,64,0.9)] text-[#72e4ff]'
                      : 'border border-transparent text-[#4a7090] hover:text-[#8ea6c3]'}`}
                  >
                    Kompakt
                  </button>
                  <button
                    type="button"
                    onClick={() => setIsCompactSceneCards(false)}
                    className={`rounded-lg px-3 py-1.5 font-mono text-[10px] font-semibold transition ${!isCompactSceneCards
                      ? 'border border-[rgba(168,118,255,0.3)] bg-[rgba(38,20,64,0.9)] text-[#c7a7ff]'
                      : 'border border-transparent text-[#4a7090] hover:text-[#8ea6c3]'}`}
                  >
                    Detail
                  </button>
                </div>
              )}
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
              <button
                type="button"
                onClick={() => void handleDownloadStoryZip()}
                disabled={isDownloadingStoryZip}
                className="flex items-center gap-2 rounded-xl border border-[rgba(232,193,106,0.22)] bg-[rgba(42,28,6,0.7)] px-4 py-2 font-mono text-[11px] font-semibold text-[#ffd980] transition hover:bg-[rgba(58,38,8,0.8)] disabled:cursor-not-allowed disabled:opacity-40"
              >
                {isDownloadingStoryZip ? <Loader2 size={13} className="animate-spin" /> : <Download size={13} />}
                Szenen-ZIP
              </button>
              <span className="font-mono text-[10px] text-[#2a4060]">
                {outputMode === 'satire'
                  ? 'Polish, Skizzen und GIFs laufen nacheinander durch denselben Vier-Beat-Satirebogen.'
                  : 'Polish, Skizzen und GIF-Loops werden nacheinander entlang der vier Beats erzeugt.'}
              </span>
            </div>

            <div className="grid gap-5 lg:grid-cols-2">
              {scenes.map((scene, index) => (
                <SceneCard
                  key={`${scene.beat}-${index}`}
                  scene={scene}
                  index={index}
                  compact={studioView === 'werkstatt' && isCompactSceneCards}
                  onPromptChange={handlePromptChange}
                  onTransformPromptChange={handleVideoTransformPromptChange}
                  onDurationChange={handleDurationChange}
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
              {studioView === 'demo'
                ? <>Starte oben den <span className="text-[#4a7090]">Demo-Lauf</span>, um vier loopbare GIF-Szenen für die nächste Stream-Dia-Show zu produzieren – oder wechsle in die <button type="button" onClick={() => setStudioView('werkstatt')} className="text-[#c7a7ff] underline decoration-dotted underline-offset-2 transition hover:text-[#e6d6ff]">Werkstatt</button> fuer Modus, Ideen-Generator und manuelle Stillframe-Szenen.</>
                : studioView === 'manual-demo'
                  ? <>Gib oben einen <span className="text-[#8a6a30]">Simple Prompt</span> ein, lade optional Stilbilder hoch und schreibe daraus automatisch vier editierbare Szenenprompts.</>
                : generationMode === 'satire'
                  ? <>Waehle eine Voreinstellung, optional Referenzbilder und einen Satire-Fokus, und starte oben <span className="text-[#4a7090]">Satire Sketch + 4 Beats</span></>
                  : <>Gib ein Konzept, 3 bis 5 Keywords oder Referenzbilder oben ein und klicke auf <span className="text-[#4a7090]">Generate Story Beats</span></>}
            </p>
          </div>
        )}
        {/* End right column */}
        </div>
        {/* End two-column studio grid */}
        </div>

      </main>

      {isObsDemoMode && studioView === 'demo' && (
        <aside className="fixed bottom-5 right-5 z-40 w-[min(420px,calc(100vw-2rem))] rounded-[20px] border border-[rgba(210,255,77,0.32)] bg-[rgba(4,8,14,0.92)] p-4 shadow-[0_24px_80px_rgba(0,0,0,0.48)] backdrop-blur-xl">
          <div className="flex items-start gap-3">
            <div className="mt-0.5 flex h-9 w-9 shrink-0 items-center justify-center rounded-xl border border-[rgba(210,255,77,0.28)] bg-[rgba(42,54,10,0.62)] text-[#d2ff4d]">
              {demoNarrationStep.id === 'done' ? <CheckCircle2 size={18} /> : demoNarrationStep.id === 'error' ? <TriangleAlert size={18} /> : <Camera size={18} />}
            </div>
            <div className="min-w-0 space-y-2">
              <div className="flex flex-wrap items-center gap-2">
                <span className="font-mono text-[10px] uppercase tracking-[0.2em] text-[#d2ff4d]">{demoNarrationStep.kicker}</span>
                {activeDemoStage && (
                  <span className="rounded-full border border-[rgba(114,228,255,0.16)] bg-[rgba(10,26,46,0.68)] px-2 py-0.5 font-mono text-[9px] text-[#72e4ff]">
                    {DEMO_STAGE_LABELS[activeDemoStage]}
                  </span>
                )}
              </div>
              <h3 className="font-mono text-sm font-semibold leading-snug text-[#f3f8ff]">{demoNarrationStep.title}</h3>
              <p className="text-xs leading-relaxed text-[#b9c98c]">{demoNarrationStep.body}</p>
              <div className="flex flex-wrap items-center gap-2 font-mono text-[10px] text-[#6f8050]">
                <span>{completedGifCount}/4 GIF-Loops</span>
                <span>·</span>
                <span>{pipelineLog.length} Log-Eintraege</span>
                {demoZipExportedAt && <><span>·</span><span>ZIP heruntergeladen</span></>}
              </div>
            </div>
          </div>
        </aside>
      )}

    </div>
  );
}

// ── Scene Card ───────────────────────────────────────────────────────────────

interface SceneCardProps {
  scene: SceneState;
  index: number;
  runId: string;
  compact?: boolean;
  onPromptChange: (index: number, value: string) => void;
  onTransformPromptChange: (index: number, value: string) => void;
  onDurationChange: (index: number, value: number) => void;
  onPolish: (index: number) => void;
  onSketch: (index: number) => void;
  onVideo: (index: number) => void;
  onVideoRemix: (index: number) => void;
  onVideoExtension: (index: number) => void;
}

function SceneCard({ scene, index, runId, compact = false, onPromptChange, onTransformPromptChange, onDurationChange, onPolish, onSketch, onVideo, onVideoRemix, onVideoExtension }: SceneCardProps) {
  const beatLabel = BEAT_LABELS[scene.beat] ?? `Beat ${index + 1}`;
  const beatColorClass = BEAT_COLORS[scene.beat] ?? 'bg-zinc-800/60 text-zinc-300 border-zinc-700/50';
  const cardRingClass = BEAT_RING[scene.beat] ?? 'border-zinc-700/40';
  const isPreparingOrRenderingVideo = scene.videoStatus === 'loading' || scene.videoStatus === 'converting';
  const hasVideoPromptPreview = scene.renderPromptDebug?.target === 'video';

  return (
    <article
      className={`flex flex-col border bg-[rgba(6,12,24,0.72)] backdrop-blur-sm overflow-hidden ${compact ? 'rounded-[16px]' : 'rounded-[20px]'} ${cardRingClass}`}
    >
      {/* Card header */}
      <div className={`border-b border-[rgba(255,255,255,0.05)] flex items-center gap-2 ${compact ? 'px-3 py-2' : 'px-4 py-3'}`}>
        <span
          className={`rounded-full border px-2.5 py-0.5 font-mono text-[10px] font-semibold tracking-widest ${beatColorClass}`}
        >
          {beatLabel}
        </span>
        <span className="ml-auto truncate font-mono text-[11px] text-[#3a5070]">{scene.title}</span>
      </div>

      {/* Motion description */}
      <div className={compact ? 'px-3 pt-2 pb-1' : 'px-4 pt-3 pb-1'}>
        <p className={`font-mono text-[10px] italic text-[#2a4a6a] ${compact ? 'truncate' : 'leading-relaxed'}`}>
          {scene.motion}
        </p>
      </div>

      <div className={compact ? 'px-3 pt-2' : 'px-4 pt-3'}>
        <div className="flex flex-wrap items-center gap-2 rounded-lg border border-[rgba(232,169,74,0.12)] bg-[rgba(22,16,6,0.48)] px-3 py-2 font-mono text-[10px] text-[#b9a06d]">
          <span className="uppercase tracking-[0.16em] text-[#8a6a30]">Video</span>
          <div className="inline-flex rounded-md border border-[rgba(232,169,74,0.16)] bg-[#040d1a] p-0.5" role="group" aria-label={`Videolaenge fuer Szene ${index + 1}`}>
            {SUPPORTED_VIDEO_DURATION_SECONDS.map((duration) => {
              const isActive = scene.durationSeconds === duration;
              return (
                <button
                  key={duration}
                  type="button"
                  onClick={() => onDurationChange(index, duration)}
                  className={`h-7 min-w-9 rounded px-2 text-[11px] font-semibold transition ${isActive
                    ? 'bg-[rgba(232,169,74,0.24)] text-[#f6d58f] shadow-[0_0_16px_rgba(232,169,74,0.18)]'
                    : 'text-[#8a6a30] hover:bg-[rgba(232,169,74,0.1)] hover:text-[#d0ae6a]'
                  }`}
                >
                  {duration}s
                </button>
              );
            })}
          </div>
          {!compact && <span>720p · Sora: 4/8/12s · Standard {DEFAULT_VIDEO_DURATION_SECONDS}s</span>}
        </div>
      </div>

      {/* Prompt textarea */}
      <div className={`${compact ? 'px-3 py-2' : 'px-4 py-2'} flex-1`}>
        <textarea
          value={scene.prompt}
          onChange={(e) => onPromptChange(index, e.target.value)}
          rows={compact ? 3 : 6}
          className="w-full resize-none rounded-lg border border-[rgba(114,228,255,0.12)] bg-[#040d1a] px-3 py-2 font-mono text-[11px] text-[#c8ddf0] placeholder-[#1a3050] outline-none focus:border-[rgba(114,228,255,0.3)] transition leading-relaxed"
          placeholder="Generation prompt…"
        />
      </div>

      {scene.videoId && (
        <div className="px-4 pb-3">
          <label className="block rounded-lg border border-[rgba(168,118,255,0.12)] bg-[rgba(18,12,34,0.54)] px-3 py-2">
            <span className="mb-1 block font-mono text-[10px] uppercase tracking-[0.16em] text-[#8f74c9]">
              Remix / Extend Änderungswunsch
            </span>
            <textarea
              value={scene.videoTransformPrompt}
              onChange={(event) => onTransformPromptChange(index, event.target.value)}
              rows={2}
              className="w-full resize-none bg-transparent font-mono text-[11px] leading-relaxed text-[#d8c2ff] placeholder-[#705d92] outline-none"
              placeholder="z. B. cyan edge split staerker, langsamere Rueckkehr, zentralen Ring enger schließen"
            />
          </label>
          <div className="mt-1 font-mono text-[10px] text-[#705d92]">
            Remix/Extend sendet diesen Prompt zusammen mit Video-ID {scene.videoId}.
          </div>
        </div>
      )}

      {/* Action row */}
      <div className={`grid grid-cols-5 gap-2 ${compact ? 'px-3 pb-3 pt-1' : 'px-4 pb-4 pt-1'}`}>
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
        <details
          open={isPreparingOrRenderingVideo && hasVideoPromptPreview}
          className="mx-4 mb-4 rounded-[16px] border border-[rgba(114,228,255,0.1)] bg-[rgba(8,16,30,0.82)] px-4 py-3 text-xs"
        >
          <summary className="cursor-pointer font-mono text-[10px] uppercase tracking-[0.18em] text-[#72e4ff]">
            Prompt-Debug · {scene.renderPromptDebug.target === 'video' ? 'Sora-2 GIF Render' : 'Sketch Render'}
            {isPreparingOrRenderingVideo && hasVideoPromptPreview ? ' · vor dem Sora-2 Request sichtbar' : ''}
          </summary>
          <div className="mt-3 space-y-3">
            {isPreparingOrRenderingVideo && hasVideoPromptPreview && (
              <div className="rounded-xl border border-[rgba(232,193,106,0.18)] bg-[rgba(42,28,6,0.52)] px-3 py-2 font-mono text-[10px] leading-relaxed text-[#ffd980]">
                Dieser Prompt wurde aus Rohprompt, Style-Presets, Referenz-DNA und Foundry-IQ/Knowledge-Base-Daten gebaut und wird jetzt an Sora-2 gesendet bzw. dort verarbeitet.
              </div>
            )}
            <div>
              <div className="font-mono text-[10px] uppercase tracking-[0.16em] text-[#36516e]">
                {scene.renderPromptDebug.target === 'video' ? 'Finaler Sora-2 Prompt' : 'Finaler Modellprompt'}
              </div>
              <pre className="mt-2 max-h-72 overflow-auto whitespace-pre-wrap rounded-lg border border-[rgba(168,118,255,0.12)] bg-[rgba(20,14,34,0.82)] px-3 py-2 font-mono text-[10px] leading-relaxed text-[#d8c2ff]">
                {truncateForPreview(scene.renderPromptDebug.finalPrompt)}
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
                <div className="flex flex-wrap items-center gap-2">
                  <div className="font-mono text-[10px] uppercase tracking-[0.16em] text-[#72e4ff]">
                    IQ Brief · {scene.renderPromptDebug.iqBrief.usedRemote ? 'Foundry IQ' : 'Workspace KB'}
                  </div>
                  <span className="rounded-full border border-[rgba(114,228,255,0.14)] bg-[rgba(3,8,16,0.72)] px-2 py-0.5 font-mono text-[10px] text-[#8ea6c3]">
                    {scene.renderPromptDebug.iqBrief.citations.length} Quelle(n)
                  </span>
                </div>
                <div className="font-mono text-[10px] uppercase tracking-[0.16em] text-[#36516e]">Verwendeter IQ-Block im finalen Prompt</div>
                <pre className="max-h-56 overflow-auto whitespace-pre-wrap rounded-lg border border-[rgba(114,228,255,0.12)] bg-[rgba(3,8,16,0.72)] px-3 py-2 font-mono text-[10px] leading-relaxed text-[#c8ddf0]">
                  {truncateForPreview(scene.renderPromptDebug.iqBrief.promptBlock)}
                </pre>
                {scene.renderPromptDebug.iqBrief.citations.length > 0 && (
                  <details className="rounded-lg border border-[rgba(114,228,255,0.1)] bg-[rgba(3,8,16,0.64)] px-3 py-2">
                    <summary className="cursor-pointer font-mono text-[10px] uppercase tracking-[0.16em] text-[#8ea6c3]">
                      IQ-Quellen anzeigen ({scene.renderPromptDebug.iqBrief.citations.length})
                    </summary>
                    <div className="mt-2 space-y-2">
                      {scene.renderPromptDebug.iqBrief.citations.map((citation) => (
                        <div key={`${citation.source}-${citation.excerpt.slice(0, 24)}`} className="rounded-lg border border-[rgba(114,228,255,0.08)] bg-[rgba(5,12,24,0.72)] p-3">
                          <div className="font-mono text-[10px] uppercase tracking-[0.16em] text-[#72e4ff]">{citation.source}</div>
                          <div className="mt-1 text-[10px] leading-relaxed text-[#8ea6c3]">{citation.excerpt}</div>
                        </div>
                      ))}
                    </div>
                  </details>
                )}
              </div>
            )}
            <details className="rounded-lg border border-[rgba(114,228,255,0.08)] bg-[rgba(3,8,16,0.62)] px-3 py-2">
              <summary className="cursor-pointer font-mono text-[10px] uppercase tracking-[0.16em] text-[#8ea6c3]">
                Rohdaten anzeigen
              </summary>
              <div className="mt-2 grid gap-2">
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
                {scene.renderPromptDebug.iqBrief && (
                  <div>
                    <div className="font-mono text-[10px] uppercase tracking-[0.16em] text-[#36516e]">IQ-Abfrage</div>
                    <pre className="mt-2 max-h-36 overflow-auto whitespace-pre-wrap rounded-lg border border-[rgba(114,228,255,0.1)] bg-[rgba(3,8,16,0.72)] px-3 py-2 font-mono text-[10px] leading-relaxed text-[#8ea6c3]">
                      {scene.renderPromptDebug.iqBrief.query}
                    </pre>
                  </div>
                )}
                <div>
                  <div className="font-mono text-[10px] uppercase tracking-[0.16em] text-[#36516e]">
                    Voller finaler Prompt
                  </div>
                  <pre className="mt-2 max-h-72 overflow-auto whitespace-pre-wrap rounded-lg border border-[rgba(168,118,255,0.12)] bg-[rgba(20,14,34,0.82)] px-3 py-2 font-mono text-[10px] leading-relaxed text-[#d8c2ff]">
                    {scene.renderPromptDebug.finalPrompt}
                  </pre>
                </div>
              </div>
            </details>
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
  onUseSignal,
}: {
  label: string;
  items: string[];
  allowUse?: 'ritual' | 'satire' | 'signal' | 'both' | 'all';
  onUseRitual: (value: string) => void;
  onUseSatire: (value: string) => void;
  onUseSignal: (value: string) => void;
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
                {(allowUse === 'ritual' || allowUse === 'both' || allowUse === 'all') && (
                  <button
                    type="button"
                    onClick={() => onUseRitual(item)}
                    className="rounded-lg border border-[rgba(114,228,255,0.18)] bg-[rgba(10,26,46,0.72)] px-2 py-1 font-mono text-[10px] font-semibold text-[#72e4ff] transition hover:bg-[rgba(18,38,64,0.82)]"
                  >
                    Ritual Input
                  </button>
                )}
                {(allowUse === 'satire' || allowUse === 'both' || allowUse === 'all') && (
                  <button
                    type="button"
                    onClick={() => onUseSatire(item)}
                    className="rounded-lg border border-[rgba(232,169,74,0.18)] bg-[rgba(42,28,6,0.7)] px-2 py-1 font-mono text-[10px] font-semibold text-[#e8c16a] transition hover:bg-[rgba(58,38,8,0.8)]"
                  >
                    Satire Fokus
                  </button>
                )}
                {(allowUse === 'signal' || allowUse === 'all') && (
                  <button
                    type="button"
                    onClick={() => onUseSignal(item)}
                    className="rounded-lg border border-[rgba(0,245,212,0.18)] bg-[rgba(4,28,30,0.72)] px-2 py-1 font-mono text-[10px] font-semibold text-[#6ff7e2] transition hover:bg-[rgba(8,42,44,0.82)]"
                  >
                    Signal Input
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
  onUseSignal,
  onGenerateRitual,
  onGenerateSatire,
  onGenerateSignal,
  isGenerating,
}: {
  vision: StillframeIdeaVision;
  onUseRitual: (value: string) => void;
  onUseSatire: (value: string) => void;
  onUseSignal: (value: string) => void;
  onGenerateRitual: (vision: StillframeIdeaVision) => Promise<void>;
  onGenerateSatire: (vision: StillframeIdeaVision) => Promise<void>;
  onGenerateSignal: (vision: StillframeIdeaVision) => Promise<void>;
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
          <button
            type="button"
            onClick={() => void onGenerateSignal(vision)}
            disabled={isGenerating}
            className="rounded-lg border border-[rgba(0,245,212,0.18)] bg-[rgba(4,28,30,0.72)] px-2 py-1 font-mono text-[10px] font-semibold text-[#6ff7e2] transition hover:bg-[rgba(8,42,44,0.82)] disabled:cursor-not-allowed disabled:opacity-40"
          >
            {isGenerating ? 'Laeuft...' : '4 Signal Beats'}
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
              <button
                type="button"
                onClick={() => onUseSignal(vision.story)}
                className="rounded-lg border border-[rgba(0,245,212,0.18)] bg-[rgba(4,28,30,0.72)] px-2 py-1 font-mono text-[10px] font-semibold text-[#6ff7e2] transition hover:bg-[rgba(8,42,44,0.82)]"
              >
                Signal Input
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
              <button
                type="button"
                onClick={() => onUseSignal(vision.promptSeed)}
                className="rounded-lg border border-[rgba(0,245,212,0.18)] bg-[rgba(4,28,30,0.72)] px-2 py-1 font-mono text-[10px] font-semibold text-[#6ff7e2] transition hover:bg-[rgba(8,42,44,0.82)]"
              >
                Signal Input
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

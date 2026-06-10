/**
 * Stillframe Rituals – Azure OpenAI Generation Harness
 *
 * All three endpoints use Azure OpenAI exclusively:
 *   /api/stillframe/concept  → Azure chat completions (story beats)
 *   /api/stillframe/sketch   → Azure DALL-E (image per beat)
 *   /api/stillframe/video    → Azure Sora via Foundry (video per beat)
 */

import { Router } from 'express';
import OpenAI from 'openai';
import { ARV_CHARACTERS, getCharacter } from '../../lib/arvCharacters';
import type { ARVSatireSketch } from '../../lib/arvTypes';
import { arvMinimalSignalGeometryPreset } from '../../lib/minimalSignalGeometryPreset';
import { PRESETS } from '../../lib/presets';
import {
  DEFAULT_STILLFRAME_SATIRE_PRESET_PROFILE_ID,
  getStillframeSatireElement,
  getStillframeSatirePresetProfile,
  STILLFRAME_SATIRE_ELEMENT_OPTIONS,
  STILLFRAME_SATIRE_PRESET_PROFILES,
  type StillframeSatireElementOption,
  type StillframeSatirePresetProfile,
} from '../../lib/stillframeSatire';
import { buildStyleTasteLock, extractPromptCore, withStyleTaste } from '../../lib/styleTaste';
import type { StylePreset } from '../../lib/types';
import {
  foundryGenerateText,
  foundryImageGenerate,
  foundryVideoCreate,
  foundryVideoDownload,
  foundryVideoEdit,
  foundryVideoExtend,
  foundryVideoRetrieve,
} from '../../services/foundryService';
import { asNonEmptyString, toErrorMessage } from '../utils/http';
import type { IQBrief } from '../utils/iq';
import { mergeIQSceneContext, normalizeIQBriefForDebug, resolveIQBrief } from '../utils/iq';
import { sanitizeSatireSketch } from '../utils/storyboard';
import { VIDEO_FAILURE_STATUSES, VIDEO_SUCCESS_STATUSES, sleep } from '../utils/video';

const STILLFRAME_PRESET: StylePreset | null = null;
const STILLFRAME_STYLE_TASTE_PRESET: StylePreset | null = null;
const STILLFRAME_COMPATIBLE_PRESET_ID_SET = new Set<string>([
  arvMinimalSignalGeometryPreset.id,
  'micro-city-on-vinyl',
  'bass-weather-laboratory',
  'cable-monastery',
  'deep-server-reef',
  'dead-channel-ministry',
  'signal-ring-eclipse',
  'abstract-techno-visuals',
  'glass-engine-breathing',
  'magnetic-desert-crossing',
  'operator-after-midnight',
  'chromatic-shard-torus',
  'chromatic-shard-torus-soft-bloom',
  'chromatic-shard-torus-techno-reactor',
  'chromatic-shard-torus-glitch-breach',
]);
const STILLFRAME_FALLBACK_PRESET_IDS = [
  arvMinimalSignalGeometryPreset.id,
  'chromatic-shard-torus-glitch-breach',
  'abstract-techno-visuals',
] as const;
const STILLFRAME_DEFAULT_SATIRE_CHARACTER_IDS = [
  ARV_CHARACTERS[0]?.id,
  ARV_CHARACTERS[2]?.id,
].filter((value): value is string => Boolean(value));
const STILLFRAME_MIN_KEYWORDS = 3;
const STILLFRAME_MAX_KEYWORDS = 5;
const STILLFRAME_MAX_REFERENCE_IMAGES = 4;

const VIDEO_POLL_INTERVAL_MS = 4000;
const VIDEO_MAX_WAIT_MS = 10 * 60 * 1000;
const SORA_SUPPORTED_VIDEO_SECONDS = [4, 8, 12] as const;
const SORA_DEFAULT_VIDEO_SECONDS = 4;

const normalizeSoraVideoSeconds = (value: unknown): number => {
  const parsed = Number(value);
  if (!Number.isFinite(parsed)) {
    return SORA_DEFAULT_VIDEO_SECONDS;
  }

  return SORA_SUPPORTED_VIDEO_SECONDS.reduce((closest, seconds) => {
    const closestDistance = Math.abs(closest - parsed);
    const secondsDistance = Math.abs(seconds - parsed);
    return secondsDistance < closestDistance ? seconds : closest;
  }, SORA_DEFAULT_VIDEO_SECONDS);
};

// ── Azure Completions client ────────────────────────────────────────────────

const getAzureClient = (): OpenAI => {
  const endpoint = (process.env.AZURE_EXISTING_AIPROJECT_ENDPOINT || '').trim();
  const key =
    (process.env.AZURE_AI_FOUNDRY_KEY || process.env.AZURE_OPENAI_COMPLETIONS_KEY || '').trim();

  if (!endpoint) throw new Error('AZURE_EXISTING_AIPROJECT_ENDPOINT fehlt in .env.local');
  if (!key) throw new Error('AZURE_AI_FOUNDRY_KEY fehlt in .env.local');

  return new OpenAI({ baseURL: endpoint.replace(/\/$/, ''), apiKey: key });
};

const getAzureModel = (): string =>
  (process.env.AZURE_OPENAI_STORYBOARD_MODEL || process.env.AZURE_OPENAI_TEXT_MODEL || 'gpt-5.2-chat').trim();

const getStillframePolishModel = (): string =>
  (process.env.AZURE_OPENAI_POLISH_MODEL || 'gpt-5.2-chat').trim();

const getAzureVisionModel = (): string =>
  (process.env.AZURE_OPENAI_VISION_MODEL || getAzureModel()).trim();

interface StillframeStylePresetSummary {
  id: string;
  name: string;
  visualIdentity: string;
  colorPalette: string;
  lighting: string;
  motionStyle: string;
  shortPrompt: string;
}

interface StillframeUsageSummary {
  promptTokens: number;
  completionTokens: number;
  totalTokens: number;
}

interface StillframeReferenceImageInput {
  id: string;
  name: string;
  mimeType: string;
  previewDataUrl: string;
  analysisDataUrl: string;
  source: 'png' | 'gif';
}

interface StillframeReferenceStyleSummary {
  summary: string;
  subjectFocus: string;
  palette: string;
  motion: string;
  promptDNA: string;
  keywords: string[];
}

interface StillframeReferenceStyleOverride {
  summary?: string;
  subjectFocus?: string;
  palette?: string;
  motion?: string;
  promptDNA?: string;
  keywords?: string[];
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

const normalizeKeywords = (value: unknown): string[] => {
  const rawValues = Array.isArray(value)
    ? value
    : typeof value === 'string'
      ? value.split(/[\n,]/)
      : [];

  return Array.from(
    new Set(
      rawValues
        .map((entry) => (typeof entry === 'string' ? entry.trim() : ''))
        .filter((entry) => entry.length > 0),
    ),
  ).slice(0, STILLFRAME_MAX_KEYWORDS);
};

const normalizeIdeaList = (value: unknown, limit: number): string[] => {
  if (!Array.isArray(value)) {
    return [];
  }

  return Array.from(
    new Set(
      value
        .map((entry) => asNonEmptyString(entry))
        .filter((entry): entry is string => Boolean(entry)),
    ),
  ).slice(0, limit);
};

const normalizeStillframeIdeaVision = (value: unknown, index: number): StillframeIdeaVision | null => {
  if (!value || typeof value !== 'object') {
    return null;
  }

  const candidate = value as Record<string, unknown>;
  const promptSeed = asNonEmptyString(candidate.promptSeed);
  const story = asNonEmptyString(candidate.story) || asNonEmptyString(candidate.storyHook);

  if (!promptSeed && !story) {
    return null;
  }

  return {
    title: asNonEmptyString(candidate.title) || `Vision ${index + 1}`,
    theme: asNonEmptyString(candidate.theme) || 'volatile signal habitat',
    character: asNonEmptyString(candidate.character) || 'one dominant form, system, or force',
    event: asNonEmptyString(candidate.event) || 'A clear visual event breaks the stillness.',
    action: asNonEmptyString(candidate.action) || 'The scene shifts, reacts, folds, or releases pressure.',
    story: story || 'A tactile image-world opens into a loop-ready four-beat arc.',
    style: asNonEmptyString(candidate.style) || asNonEmptyString(candidate.styleDirection) || 'Raw abstract ARV loop logic with geometric forms, ugly-bright color slips, underground texture, and visible reset motion.',
    promptSeed: promptSeed || story || 'One dominant geometric form or absurd object, readable motion, analog damage, brave color, and a clear snapback loop.',
    presetSeed: asNonEmptyString(candidate.presetSeed) || 'Base preset: raw ARV loop direction with abstract geometry, controlled signal motion, and no default archive or witness motifs.',
  };
};

const buildStillframeIdeaClipboardText = (input: {
  mode: 'ritual' | 'satire' | 'signal';
  seed: string | null;
  themes: string[];
  characters: string[];
  events: string[];
  actions: string[];
  stories: string[];
  styles: string[];
  promptSeeds: string[];
  presetSeeds: string[];
  visions: StillframeIdeaVision[];
}): string => {
  const sections = [
    `Stillframe Ideas Pack (${input.mode})`,
    input.seed ? `Seed: ${input.seed}` : 'Seed: fresh run',
    '',
    `Themes: ${input.themes.join(' | ') || 'none'}`,
    `Characters: ${input.characters.join(' | ') || 'none'}`,
    `Events: ${input.events.join(' | ') || 'none'}`,
    `Actions: ${input.actions.join(' | ') || 'none'}`,
    `Stories: ${input.stories.join(' | ') || 'none'}`,
    `Styles: ${input.styles.join(' | ') || 'none'}`,
    `Prompt seeds: ${input.promptSeeds.join(' | ') || 'none'}`,
    `Preset seeds: ${input.presetSeeds.join(' | ') || 'none'}`,
    '',
    ...input.visions.flatMap((vision, index) => [
      `Vision ${index + 1}: ${vision.title}`,
      `Theme: ${vision.theme}`,
      `Character: ${vision.character}`,
      `Event: ${vision.event}`,
      `Action: ${vision.action}`,
      `Story: ${vision.story}`,
      `Style: ${vision.style}`,
      `Prompt seed: ${vision.promptSeed}`,
      `Preset seed: ${vision.presetSeed}`,
      '',
    ]),
  ];

  return sections.join('\n').trim();
};

const normalizeSatireCharacterIds = (
  value: unknown,
  currentSketch?: Partial<ARVSatireSketch> | null,
  preferredCharacterIds: string[] = [],
): string[] => {
  const requestedCharacterIds = Array.isArray(value)
    ? value
      .map((entry) => asNonEmptyString(entry))
      .filter((entry): entry is string => Boolean(entry))
    : [];

  const sketchCharacterIds = Array.isArray(currentSketch?.characterIds)
    ? currentSketch.characterIds
      .map((entry) => asNonEmptyString(entry))
      .filter((entry): entry is string => Boolean(entry))
    : [];

  return Array.from(new Set([
    ...preferredCharacterIds,
    ...requestedCharacterIds,
    ...sketchCharacterIds,
    ...STILLFRAME_DEFAULT_SATIRE_CHARACTER_IDS,
    ...ARV_CHARACTERS.map((character) => character.id),
  ]))
    .filter((characterId) => ARV_CHARACTERS.some((character) => character.id === characterId))
    .slice(0, 2);
};

const normalizeSatireElementIds = (
  value: unknown,
  fallbackElementIds: string[] = [],
): string[] => {
  const requestedElementIds = Array.isArray(value)
    ? value
      .map((entry) => asNonEmptyString(entry))
      .filter((entry): entry is string => Boolean(entry))
    : [];

  return Array.from(new Set([
    ...requestedElementIds,
    ...fallbackElementIds,
  ]))
    .filter((elementId) => STILLFRAME_SATIRE_ELEMENT_OPTIONS.some((element) => element.id === elementId))
    .slice(0, 4);
};

const buildStillframeSatireSignals = (
  satirePrompt: string | null,
  sketch: ARVSatireSketch,
  selectedCharacters: typeof ARV_CHARACTERS,
  presetProfile: StillframeSatirePresetProfile,
  selectedElements: StillframeSatireElementOption[],
  referenceStyle?: StillframeReferenceStyleSummary | null,
): string[] => normalizeSignalList([
  satirePrompt || '',
  presetProfile.name,
  presetProfile.description,
  ...presetProfile.presetIds,
  sketch.title,
  sketch.setting,
  sketch.satireTarget,
  sketch.conclusion,
  referenceStyle?.summary || '',
  referenceStyle?.subjectFocus || '',
  referenceStyle?.palette || '',
  referenceStyle?.motion || '',
  referenceStyle?.promptDNA || '',
  ...(referenceStyle?.keywords || []),
  ...selectedElements.map((element) => element.label),
  ...selectedElements.map((element) => element.promptText),
  ...sketch.dialogue.slice(0, 4).map((line) => line.line),
  ...selectedCharacters.map((character) => character.name),
  ...selectedCharacters.map((character) => character.designation),
  ...selectedCharacters.map((character) => character.satireTarget),
], 8);

const buildStillframeSatireSystemPrompt = (
  stylePresets: StylePreset[],
  satireSignals: string[],
  sketch: ARVSatireSketch,
  selectedCharacters: typeof ARV_CHARACTERS,
  presetProfile: StillframeSatirePresetProfile,
  selectedElements: StillframeSatireElementOption[],
  referenceStyle?: StillframeReferenceStyleSummary | null,
): string => `${buildStillframeSystemPrompt(stylePresets, satireSignals, referenceStyle)}

═══ SATIRE SKETCH MODE ═══
You are translating an ARV satire sketch into four visually sharp Stillframe GIF scenes.

Rules:
- Keep the ARV house style severe, tactile, image-first, and poster-readable.
- Do not hard-lock the visual world to the old archive-witness canon. Let the concept choose the material system, palette, and world behavior.
- Build the image logic from stark iconography, damaged print matter, mechanical micro-motion, analog residue, and uncanny visual contradiction rather than from politics, bureaucracy, alarm rhetoric, or institutional critique.
- Never rely on captions, speech bubbles, readable text, or literal punchline cards.
- Reject sitcom energy, improv looseness, glossy cinema, internet irony, cheerful whimsy, clean corporate interfaces, and generic contemporary illustration.
- Each scene should distill one beat into one dominant image event that can loop as a GIF.
- The strange wit should come from the image grammar itself: one figure, one motion, one rupture, one residue.

Visual grammar:
- Subject: a single form, machine, field, aperture, synthetic organism, or architectural system.
- Surface: matte dust, fogged glass, lacquered metal, scanline haze, wet reflection, grain, sediment, or soft signal residue.
- Motion: only one pressure pulse, panel shift, slit opening, drift change, wave sweep, or contour split.
- Transformation: the motion causes an afterimage, a phase shift, a duplicate echo, a pressure flare, or a controlled color slip.
- Loop: the image collapses back into the opening pose, leaving a faint analog residue.

Preset profile:
- Name: ${presetProfile.name}
- Description: ${presetProfile.description}
- Locked style presets: ${presetProfile.presetIds.join(', ')}

Chosen elements:
${selectedElements.map((element) => `- ${element.category}: ${element.promptText}`).join('\n')}

Sketch anchor:
- Title: ${sketch.title}
- Setting: ${sketch.setting}
- Satire target: ${sketch.satireTarget}
- Conclusion: ${sketch.conclusion}

Character anchors:
${selectedCharacters.map((character) => [
  `${character.name} (${character.id})`,
  `Designation: ${character.designation}`,
  `Voice: ${character.voice}`,
  `Satire target: ${character.satireTarget}`,
  `Behavior rules: ${character.behaviorRules.join(' | ')}`,
  `Transmission style: ${character.transmissionStyle}`,
].join('\n')).join('\n\n')}

Beat mapping:
- Scene 1: establish the subject and surface in a frozen iconic pose.
- Scene 2: introduce the single permitted motion and first visual rupture.
- Scene 3: let the transformation peak while the frame remains clean and loopable.
- Scene 4: collapse the image back into the opening pose with faint analog residue.

Write every scene like a damaged liturgical print recovered from an unknown analog machine cult.
`;

const normalizeSignalList = (value: unknown, maxItems = 8): string[] => {
  const rawValues = Array.isArray(value)
    ? value
    : typeof value === 'string'
      ? value.split(/[\n,]/)
      : [];

  return Array.from(
    new Set(
      rawValues
        .map((entry) => (typeof entry === 'string' ? entry.trim() : ''))
        .filter((entry) => entry.length > 0),
    ),
  ).slice(0, maxItems);
};

const isSupportedImageDataUrl = (value: string): boolean =>
  /^data:image\/(png|gif|jpe?g|webp);base64,/i.test(value);

const normalizeReferenceImages = (value: unknown): StillframeReferenceImageInput[] => {
  if (!Array.isArray(value)) {
    return [];
  }

  return value
    .map((candidate, index) => {
      if (!candidate || typeof candidate !== 'object') {
        return null;
      }

      const entry = candidate as Record<string, unknown>;
      const previewDataUrl = asNonEmptyString(entry?.previewDataUrl);
      const analysisDataUrl = asNonEmptyString(entry?.analysisDataUrl);

      if (!previewDataUrl || !analysisDataUrl) {
        return null;
      }

      if (!isSupportedImageDataUrl(previewDataUrl) || !isSupportedImageDataUrl(analysisDataUrl)) {
        return null;
      }

      const source = asNonEmptyString(entry?.source)?.toLowerCase() === 'gif' ? 'gif' : 'png';

      return {
        id: asNonEmptyString(entry?.id) || `reference-${index + 1}`,
        name: asNonEmptyString(entry?.name) || `reference-${index + 1}`,
        mimeType: asNonEmptyString(entry?.mimeType) || (source === 'gif' ? 'image/gif' : 'image/png'),
        previewDataUrl,
        analysisDataUrl,
        source,
      } satisfies StillframeReferenceImageInput;
    })
    .filter((entry): entry is StillframeReferenceImageInput => Boolean(entry))
    .slice(0, STILLFRAME_MAX_REFERENCE_IMAGES);
};

const toUsageSummary = (usage: any): StillframeUsageSummary | null => {
  if (!usage) {
    return null;
  }

  return {
    promptTokens: Number(usage.prompt_tokens ?? usage.promptTokens ?? 0),
    completionTokens: Number(usage.completion_tokens ?? usage.completionTokens ?? 0),
    totalTokens: Number(usage.total_tokens ?? usage.totalTokens ?? 0),
  };
};

const mergeUsageSummaries = (...usages: Array<StillframeUsageSummary | null | undefined>): StillframeUsageSummary | null => {
  const activeUsages = usages.filter((usage): usage is StillframeUsageSummary => Boolean(usage));
  if (activeUsages.length === 0) {
    return null;
  }

  return activeUsages.reduce<StillframeUsageSummary>(
    (acc, usage) => ({
      promptTokens: acc.promptTokens + usage.promptTokens,
      completionTokens: acc.completionTokens + usage.completionTokens,
      totalTokens: acc.totalTokens + usage.totalTokens,
    }),
    { promptTokens: 0, completionTokens: 0, totalTokens: 0 },
  );
};

const analyzeStillframeReferenceImages = async (
  client: OpenAI,
  referenceImages: StillframeReferenceImageInput[],
): Promise<{
  model: string;
  usage: StillframeUsageSummary | null;
  style: StillframeReferenceStyleSummary;
}> => {
  const model = getAzureVisionModel();

  const response = await client.chat.completions.create({
    model,
    messages: [
      {
        role: 'developer',
        content: `You analyze uploaded reference images for ARV Stillframe generation.

Return ONLY valid JSON with this schema:
{
  "summary": "1-2 concise sentences describing the combined visual identity",
  "subjectFocus": "dominant subject family or compositional focus",
  "palette": "precise palette and light behavior",
  "motion": "loop-relevant motion attitude inferred from the references",
  "promptDNA": "concise prompt DNA that can steer new scenes",
  "keywords": ["4-8 short keywords or phrases"]
}

Priorities:
- identify ARV-relevant texture, composition, palette, damage, silhouette, and signal language
- treat GIF uploads as style references whose extracted still preserves visual language even if animation is not directly visible
- avoid generic words like cinematic, moody, atmospheric unless made materially precise
- keep the output concise and useful for selecting style presets and writing new scene prompts`,
      },
      {
        role: 'user',
        content: [
          {
            type: 'text',
            text: 'Analyze these uploaded PNG/GIF references and extract the style DNA for new Stillframe ARV scenes.',
          },
          ...referenceImages.map((referenceImage) => ({
            type: 'image_url',
            image_url: {
              url: referenceImage.analysisDataUrl,
              detail: 'low',
            },
          })),
        ],
      },
    ],
  } as any);

  const rawText = asNonEmptyString(response.choices?.[0]?.message?.content ?? '');
  if (!rawText) {
    throw new Error('Bildreferenz-Analyse lieferte keine Antwort.');
  }

  const rawStyle = extractJson(rawText);
  const keywords = normalizeSignalList(rawStyle?.keywords, 8);

  return {
    model,
    usage: toUsageSummary(response.usage),
    style: {
      summary: asNonEmptyString(rawStyle?.summary) || 'Reference-driven ARV archive style.',
      subjectFocus: asNonEmptyString(rawStyle?.subjectFocus) || 'One dominant ARV witness subject in a sparse frame.',
      palette: asNonEmptyString(rawStyle?.palette) || 'Black paper, cobalt shadow, cyan-magenta bleed, rust-amber projector glow.',
      motion: asNonEmptyString(rawStyle?.motion) || 'Controlled loop-ready motion with readable residue and afterimage.',
      promptDNA: asNonEmptyString(rawStyle?.promptDNA) || 'ARV stillframe witness tableau with damaged analog archive texture and loop-ready signal residue.',
      keywords,
    },
  };
};

const normalizeReferenceStyleOverride = (value: unknown): StillframeReferenceStyleOverride | null => {
  if (!value || typeof value !== 'object') {
    return null;
  }

  const candidate = value as Record<string, unknown>;
  const override: StillframeReferenceStyleOverride = {};

  const summary = asNonEmptyString(candidate.summary);
  if (summary) override.summary = summary;

  const subjectFocus = asNonEmptyString(candidate.subjectFocus);
  if (subjectFocus) override.subjectFocus = subjectFocus;

  const palette = asNonEmptyString(candidate.palette);
  if (palette) override.palette = palette;

  const motion = asNonEmptyString(candidate.motion);
  if (motion) override.motion = motion;

  const promptDNA = asNonEmptyString(candidate.promptDNA);
  if (promptDNA) override.promptDNA = promptDNA;

  const keywords = normalizeSignalList(candidate.keywords, 8);
  if (keywords.length > 0) override.keywords = keywords;

  return Object.keys(override).length > 0 ? override : null;
};

const applyReferenceStyleOverride = (
  baseStyle: StillframeReferenceStyleSummary | null,
  override: StillframeReferenceStyleOverride | null,
): StillframeReferenceStyleSummary | null => {
  if (!baseStyle && !override) {
    return null;
  }

  return {
    summary: override?.summary || baseStyle?.summary || 'Reference-driven Stillframe style.',
    subjectFocus: override?.subjectFocus || baseStyle?.subjectFocus || 'One dominant subject or event in a readable frame.',
    palette: override?.palette || baseStyle?.palette || 'Scene-led contrast palette with restrained accents.',
    motion: override?.motion || baseStyle?.motion || 'Controlled loop motion with a clear transformation and return.',
    promptDNA: override?.promptDNA || baseStyle?.promptDNA || 'Tactile, high-contrast Stillframe image with flexible materials and legible loop logic.',
    keywords: override?.keywords?.length ? normalizeSignalList(override.keywords, 8) : (baseStyle?.keywords || []),
  };
};

const normalizeReferenceStyleSummary = (value: unknown): StillframeReferenceStyleSummary | null => {
  if (!value || typeof value !== 'object') {
    return null;
  }

  const rawReferenceStyle = value as Record<string, unknown>;

  return {
    summary: asNonEmptyString(rawReferenceStyle.summary) || 'Reference-driven Stillframe style.',
    subjectFocus: asNonEmptyString(rawReferenceStyle.subjectFocus) || 'One dominant subject or event in a readable frame.',
    palette: asNonEmptyString(rawReferenceStyle.palette) || 'Scene-led contrast palette with restrained accents.',
    motion: asNonEmptyString(rawReferenceStyle.motion) || 'Controlled loop motion with a clear transformation and return.',
    promptDNA: asNonEmptyString(rawReferenceStyle.promptDNA) || 'Tactile, high-contrast Stillframe image with flexible materials and legible loop logic.',
    keywords: normalizeSignalList(rawReferenceStyle.keywords, 8),
  } satisfies StillframeReferenceStyleSummary;
};

const resolveStillframeRequestStylePresets = (value: unknown): StylePreset[] => {
  if (!Array.isArray(value)) {
    return [];
  }

  return value
    .map((entry) => asNonEmptyString(entry))
    .filter((entry): entry is string => Boolean(entry))
    .map((presetId) => PRESETS.find((candidate) => candidate.id === presetId))
    .filter((preset): preset is StylePreset => Boolean(preset))
    .slice(0, 3);
};

const scorePresetAgainstKeywords = (preset: StylePreset, keywords: string[]): number => {
  const name = preset.name.toLowerCase();
  const description = [
    preset.visualIdentity,
    preset.shortPrompt,
    preset.examplePrompt,
    preset.colorPalette,
    preset.lighting,
    preset.textures,
    preset.motionStyle,
    preset.recurringSymbols,
    preset.atmosphere,
  ]
    .filter(Boolean)
    .join(' ')
    .toLowerCase();

  return keywords.reduce((score, keyword) => {
    const normalized = keyword.toLowerCase();
    const fragments = normalized.split(/\s+/).filter((fragment) => fragment.length >= 4);

    let nextScore = score;
    if (name.includes(normalized)) {
      nextScore += 16;
    }
    if (description.includes(normalized)) {
      nextScore += 9;
    }

    for (const fragment of fragments) {
      if (name.includes(fragment)) {
        nextScore += 5;
      }
      if (description.includes(fragment)) {
        nextScore += 2;
      }
    }

    return nextScore;
  }, 0);
};

const summarizePreset = (preset: StylePreset): StillframeStylePresetSummary => ({
  id: preset.id,
  name: preset.name,
  visualIdentity: preset.visualIdentity || preset.shortPrompt || preset.atmosphere,
  colorPalette: preset.colorPalette,
  lighting: preset.lighting,
  motionStyle: preset.motionStyle,
  shortPrompt: preset.shortPrompt || preset.examplePrompt || preset.atmosphere,
});

const getStillframeBasePreset = (): StylePreset | null => STILLFRAME_PRESET || STILLFRAME_STYLE_TASTE_PRESET;

const selectStillframeStylePresets = (
  concept: string | null,
  keywords: string[],
  referenceStyle?: StillframeReferenceStyleSummary | null,
  preferredPresetIds: string[] = [],
): StylePreset[] => {
  const rankingKeywords = Array.from(
    new Set(
      [
        concept || '',
        ...keywords,
        referenceStyle?.summary || '',
        referenceStyle?.subjectFocus || '',
        referenceStyle?.palette || '',
        referenceStyle?.motion || '',
        referenceStyle?.promptDNA || '',
        ...(referenceStyle?.keywords || []),
      ]
        .flatMap((entry) => entry.split(/[\n,.;]/))
        .map((entry) => entry.trim())
        .filter((entry) => entry.length > 0),
    ),
  );

  const accentPresets = PRESETS
    .filter((preset) => preset.id !== STILLFRAME_PRESET?.id && STILLFRAME_COMPATIBLE_PRESET_ID_SET.has(preset.id))
    .map((preset) => ({
      preset,
      score: scorePresetAgainstKeywords(preset, rankingKeywords),
    }))
    .sort((left, right) => right.score - left.score || left.preset.name.localeCompare(right.preset.name));

  const selected: StylePreset[] = [];

  const basePreset = getStillframeBasePreset();
  if (basePreset) {
    selected.push(basePreset);
  }

  for (const presetId of preferredPresetIds) {
    if (selected.length >= 3) {
      break;
    }

    const preset = PRESETS.find((candidate) => candidate.id === presetId);
    if (!preset || selected.some((candidate) => candidate.id === preset.id)) {
      continue;
    }

    if (preset.id !== STILLFRAME_PRESET?.id && !STILLFRAME_COMPATIBLE_PRESET_ID_SET.has(preset.id)) {
      continue;
    }

    selected.push(preset);
  }

  for (const { preset, score } of accentPresets) {
    if (selected.length >= 3) {
      break;
    }

    if (score <= 0) {
      continue;
    }

    selected.push(preset);
  }

  for (const presetId of STILLFRAME_FALLBACK_PRESET_IDS) {
    if (selected.length >= 3) {
      break;
    }

    const preset = PRESETS.find((candidate) => candidate.id === presetId);
    if (!preset || selected.some((candidate) => candidate.id === preset.id)) {
      continue;
    }

    selected.push(preset);
  }

  return selected.slice(0, 3);
};

const buildStillframeStyleLock = (
  stylePresets: StylePreset[],
  referenceStyle?: StillframeReferenceStyleSummary | null,
): string => {
  const [basePreset, ...accentPresets] = stylePresets.length > 0
    ? stylePresets
    : (getStillframeBasePreset() ? [getStillframeBasePreset() as StylePreset] : []);

  const accentNotes = accentPresets.map(
    (preset, index) => `Accent ${index + 1}: ${preset.name} — ${preset.visualIdentity || preset.shortPrompt || preset.atmosphere}`,
  );

  return buildStyleTasteLock({
    preset: basePreset || undefined,
    styleMode: 'loose',
    extraNotes: [
      'Stillframe should feel like raw early-ARV loop video: abstract forms, analog damage, brave color collisions, and one unmistakable reset event.',
      'Prefer one dominant geometric form, absurd object, or event in a sparse readable frame with clear contrast and a lower third kept clean.',
      'Let the material system, palette, and world logic change with the concept: raw signal geometry, damaged flyer worlds, underground room fragments, industrial scraps, synthetic organisms, microscopic fields, and absurd objects are all valid.',
      'Use presets as sampled ingredients, not cages. Do not inject paper-cut figures, archive drawers, monolith idols, witness forms, or stone relics unless the concept or reference explicitly asks for them.',
      ...(referenceStyle ? [
        `Uploaded image DNA: ${referenceStyle.summary}`,
        `Uploaded image palette and light: ${referenceStyle.palette}`,
        `Uploaded image motion attitude: ${referenceStyle.motion}`,
        `Uploaded image prompt DNA: ${referenceStyle.promptDNA}`,
      ] : []),
      ...accentNotes,
    ],
  });
};

interface StillframeRenderPromptDebug {
  target: 'sketch' | 'video';
  rawPrompt: string;
  cleanedPrompt: string;
  finalPrompt: string;
  beatStyle?: string;
  renderMode?: 'create' | 'remix' | 'extend';
  sourceVideoId?: string | null;
  resultVideoId?: string | null;
  iqBrief?: IQBrief | null;
  stylePresetIds: string[];
  referenceStyleSummary?: string | null;
}

const buildStillframeRenderPrompt = async (
  prompt: string,
  stylePresets: StylePreset[],
  referenceStyle: StillframeReferenceStyleSummary | null,
  options: {
    beatIndex?: number;
    renderTarget: 'sketch' | 'video';
    purpose: 'create' | 'remix' | 'extend';
    remixVideoId?: string | null;
    iqContext?: unknown;
  },
): Promise<{
  promptCore: string;
  finalPrompt: string;
  beatStyle?: string;
  iqBrief: IQBrief | null;
}> => {
  const { beatIndex, renderTarget, purpose, remixVideoId, iqContext } = options;
  const beatStyle =
    beatIndex != null && beatIndex >= 0 && beatIndex <= 3
      ? BEAT_STYLES[beatIndex]
      : undefined;
  const promptCore = extractPromptCore(prompt) || prompt.trim();
  const [basePreset, ...accentPresets] = stylePresets.length > 0
    ? stylePresets
    : (getStillframeBasePreset() ? [getStillframeBasePreset() as StylePreset] : []);
  const resolvedIQContext = mergeIQSceneContext({
    mode: 'stillframe',
    renderTarget,
    purpose,
    prompt: promptCore,
    sceneBeat: beatIndex != null ? `beat-${beatIndex + 1}` : undefined,
    stylePresetIds: stylePresets.map((preset) => preset.id),
    referenceStyleSummary: referenceStyle?.summary ?? null,
    referenceStylePalette: referenceStyle?.palette ?? null,
    referenceStyleMotion: referenceStyle?.motion ?? null,
    remixVideoId: remixVideoId ?? null,
  }, iqContext);
  const iqBrief = await resolveIQBrief(resolvedIQContext);

  const styledPrompt = withStyleTaste(promptCore, {
    preset: basePreset || undefined,
    styleMode: 'loose',
    userStyleContext: iqBrief?.promptBlock ?? null,
    extraNotes: [
      'Stillframe lock: keep one dominant geometric form, absurd object, or event, sparse composition, hard contrast, and strong first-frame readability.',
      'Stillframe lock: movement may be visibly alive, but it must stay deliberate, hypnotic, GIF-loop-legible, and visibly resettable rather than hectic.',
      'Stillframe lock: let the concept choose the world, palette, and material logic; sample presets without injecting old archive-witness defaults by habit.',
      ...(referenceStyle ? [
        `Reference style DNA: ${referenceStyle.summary}`,
        `Reference style palette and light: ${referenceStyle.palette}`,
        `Reference style motion attitude: ${referenceStyle.motion}`,
        `Reference style prompt DNA: ${referenceStyle.promptDNA}`,
      ] : []),
      ...accentPresets.map(
        (preset, index) => `Accent ${index + 1}: ${preset.name} — ${preset.visualIdentity || preset.shortPrompt || preset.atmosphere}`,
      ),
      ...(beatStyle ? [beatStyle] : []),
    ],
  });

  return {
    promptCore,
    finalPrompt: `${styledPrompt}\n\nStillframe render lock:\n- ${STILLFRAME_BASE_SUFFIX}`,
    iqBrief,
    ...(beatStyle ? { beatStyle } : {}),
  };
};

const buildPresetInstructionBlock = (stylePresets: StylePreset[]): string => {
  if (stylePresets.length === 0) {
    return '';
  }

  return stylePresets
    .map(
      (preset, index) => `${index === 0 ? 'Base preset' : `Accent preset ${index}`}: ${preset.name}\n- Visual identity: ${preset.visualIdentity || preset.shortPrompt || preset.atmosphere}\n- Palette: ${preset.colorPalette}\n- Lighting: ${preset.lighting}\n- Motion: ${preset.motionStyle}`,
    )
    .join('\n');
};

// ── System prompt ───────────────────────────────────────────────────────────

const buildStillframeSystemPrompt = (
  stylePresets: StylePreset[],
  keywords: string[],
  referenceStyle?: StillframeReferenceStyleSummary | null,
): string => `You are a raw ARV loop-beat generator for "Stillframe Rituals" — locked-camera GIF-like loop sequences with one dominant abstract form or event, visible continuous movement, and strong handoff logic made for AI video generation via Sora.

═══ ARV HOUSE STYLE LOCK ═══
${buildStillframeStyleLock(stylePresets, referenceStyle)}

═══ STILLFRAME FOUNDATION ═══
- Keep the camera locked or nearly locked and put the motion pressure inside the subject, light, residue, or duplicated signal traces.
- Every result must feel like raw ARV: adult, sparse, tactile, abstract-capable, absurdly specific, visually precise, and instantly readable.
- Favor hard poster-like first-frame readability and visible loop mechanics over atmospheric wallpaper.
- Translate all keyword and preset signals into concrete form, color, material, and motion language rather than literal theme labels or old house-style clichés.

${referenceStyle ? `
═══ UPLOADED IMAGE STYLE DNA ═══
- Summary: ${referenceStyle.summary}
- Subject focus: ${referenceStyle.subjectFocus}
- Palette and light: ${referenceStyle.palette}
- Motion attitude: ${referenceStyle.motion}
- Prompt DNA: ${referenceStyle.promptDNA}
- Keywords: ${referenceStyle.keywords.join(', ') || 'none'}

Use the uploaded images as style anchors for palette, texture, composition, and prompt language.
Do not copy them literally; generate new scenes that inherit their style logic.
` : ''}

${stylePresets.length > 0 ? `
═══ SELECTED STYLE PRESETS ═══
${buildPresetInstructionBlock(stylePresets)}

Use the base preset as ignition material. Use the accent presets to push scene-to-scene diversity in form language, color behavior, material grit, and loop motion while preserving one coherent ARV world.
Do not mention preset names in the JSON output. Translate them into physical detail.
` : ''}

${keywords.length > 0 ? `
═══ KEYWORD SIGNALS ═══
Keywords: ${keywords.join(', ')}
Treat the keywords as high-priority seeds for the subject, materials, lighting events, and motion arc, but do not let them pull the result out of the ARV family.
` : ''}

═══ STYLE DRIFT PROHIBITIONS ═══
NEVER drift into any of the following:
- cute or playful mascots, smiling faces, big eyes, toy-like characters
- pastel candy palettes, glossy toy-like 3D, anime/Pixar/Disney language
- decorative pseudo-sacred illustration, readable sacred text, fake inscriptions, tourist-myth staging
- photoreal people, expressive acting, crowd scenes, busy narrative clutter
- generic luxury abstract spectacle, random geology wallpaper, empty sci-fi moodboards, or clean corporate motion graphics with no ARV identity
- defaulting automatically to paper-cut witnesses, archive machinery, monolith idols, codex worlds, or stone relics when the concept does not ask for them

Allowed when rendered as clear ARV image logic rather than decorative filler:
- primitive shapes, structures, pressure cores, silhouettes, machines, diagrams, scanner bands, color blocks, fields, fluids, particles, ecologies, light events, and other concept-specific forms with strong first-frame readability

═══ PROMPT QUALITY RULES — CRITICAL ═══
Each scene "prompt" sent to Sora must be:
1. LEAN: 50–80 words maximum. Every word must earn its place. Zero filler.
2. NON-REDUNDANT: Never repeat the same information twice. Name each quality ONCE.
3. SPECIFIC: Describe exact ARV physical states, not vague moods. Not "dark and mysterious" — say "cyan-magenta misregistration shivers along one dirty white scanner edge while an acid-lime dot snaps back into black."
4. DEPTH-FIRST: The prompt must encode tactile depth through material specificity, light precision, spatial architecture, and one exact loop state.
5. NO DECORATIVE ADJECTIVES: No "haunting", "ethereal", "mesmerizing", "evocative". Show, don't describe the feeling.
6. VISIBLE MOTION: The clip must show readable motion through most of its runtime. Avoid prompts where change happens only in the final frames.

═══ DIVERSITY RULES ═══
- The four scenes must feel related, but not interchangeable.
- Each scene must change at least two of the following: material emphasis, scale, lighting geometry, texture behavior, color accent, silhouette pressure.
- Do not write four paraphrases of the same frame.
- Every scene prompt must be strong enough to render as its own GIF loop while still belonging to the same story.
- Diversity must stay inside the ARV family resemblance, but the four scenes should be free to invent different geometric, material, color, and world behaviors instead of reusing one old canon.

═══ CONTINUITY MODEL ═══
The four scenes form ONE physical arc. Each clip may be rendered at a Sora-supported 4, 8, or 12 second duration, so write timing that can stretch or compress cleanly without breaking the physical handoff.
- Scene 1 (freeze): Subject starts nearly settled, but never dead. Low idle motion, drift, pulse, sway, flicker, recoil, or breathing is already present from the first second. The main event should become clearly legible before the clip ends.
- Scene 2 (onset): Starts at scene 1's exact end-frame physical state. Motion now travels, unfolds, expands, contracts, rotates, spills, or deforms with clear direction and stronger amplitude.
- Scene 3 (hold): Starts at scene 2's exact final frame. This is the peak state, but it must stay kinetically alive: sustained pulse, vibration, orbit, pressure-wave, oscillation, shedding light, or internal churn. Never turn hold into a static pause.
- Scene 4 (return): Starts at scene 3's active peak. Reversal or re-coherence begins, but with visible residue: elastic overshoot, aftershocks, echo trails, settling sway, or repeated micro-surges. The end should loop cleanly back toward scene 1.

HANDOFF RULE: Each prompt must open with the inherited physical state from the previous scene's final frame. No hard discontinuity, but elastic residue and soft loop-closure are allowed.

═══ MOTION BOUNDARIES ═══
- Keep the camera locked, but let the subject move more boldly inside the frame.
- One dominant motion family is required, but secondary supporting motion is allowed if it clearly belongs to the same physical event.
- Medium-tempo loop motion is welcome. Avoid only chaotic whip-fast action or unreadable strobing.
- Favor motion verbs like unfolds, folds back, ripples, rotates, pulses, sways, recoils, vibrates, flickers, misregisters, breathes, tunnels, or sheds residue.

═══ OUTPUT FORMAT ═══
Return ONLY valid JSON. No markdown, no commentary.
{
  "storyTitle": "short evocative title",
  "storyConcept": "1-2 sentence summary of the new story world built from the concept and keywords",
  "subject": "concise physical description of the dominant subject",
  "microMotion": "exact arc: [start state] → [peak state] → [residue state]",
  "negativePrompt": "comma-separated exclusions specific to this concept",
  "scenes": [
    {
      "beat": "freeze",
      "title": "string",
      "prompt": "lean, deep, non-redundant Sora prompt — near-rest with visible idle motion, then a clear movement arc already underway within the clip",
      "motion": "Near-rest, but alive. [precise physical position]. [Motion event] is already readable, then grows stronger before clip end."
    },
    {
      "beat": "onset",
      "title": "string",
      "prompt": "lean, deep, non-redundant Sora prompt — opens at scene 1 end-state, motion travels clearly and gains amplitude",
      "motion": "Inherits [exact position from scene 1]. [Motion] drives outward, inward, around, or through the form to [new position]."
    },
    {
      "beat": "hold",
      "title": "string",
      "prompt": "lean, deep, non-redundant Sora prompt — opens at scene 2 end-state, peak state remains active with sustained oscillation or pulse",
      "motion": "Inherits [peak position from scene 2]. Peak state stays active through pulse, vibration, orbit, churn, or repeated recoil."
    },
    {
      "beat": "return",
      "title": "string",
      "prompt": "lean, deep, non-redundant Sora prompt — opens at active peak, reversal and settling stay visibly alive, residue remains",
      "motion": "Inherits active peak. Reversal begins. Overshoot, sway, or echo residue remains while the form resolves toward loop start."
    }
  ]
}`;

const buildMinimalSignalGeometrySystemPrompt = (
  stylePresets: StylePreset[],
  referenceStyle?: StillframeReferenceStyleSummary | null,
): string => `You are the "ARV Minimal Signal Geometry" prompt engine. Generate four connected Stillframe scenes for abstract CRT signal geometry loops.

═══ PRESET LOCK — ${arvMinimalSignalGeometryPreset.name} ═══
${arvMinimalSignalGeometryPreset.promptCore}

Style rules:
- Background: ${arvMinimalSignalGeometryPreset.visualIdentity.background}.
- Composition: ${arvMinimalSignalGeometryPreset.visualIdentity.composition}.
- Subject type: ${arvMinimalSignalGeometryPreset.visualIdentity.subjectType}.
- Palette: black and near-black base, electric cyan, hot magenta, warm ivory, ember orange, dirty white; optional acid lime, blue violet, or red signal only as tiny accents.
- Textures: ${arvMinimalSignalGeometryPreset.texture.join(', ')}.
- Motifs: ${arvMinimalSignalGeometryPreset.motifs.join(', ')}.
- Motion grammar: ${arvMinimalSignalGeometryPreset.motionRules.rhythm}.
- Allowed motion: ${arvMinimalSignalGeometryPreset.motionRules.allowedMotion.join(', ')}.
- Forbidden motion: ${arvMinimalSignalGeometryPreset.motionRules.forbiddenMotion.join(', ')}.
- Negative prompt: ${arvMinimalSignalGeometryPreset.negativePrompt}

${referenceStyle ? `
═══ UPLOADED IMAGE STYLE DNA ═══
- Summary: ${referenceStyle.summary}
- Subject focus: ${referenceStyle.subjectFocus}
- Palette and light: ${referenceStyle.palette}
- Motion attitude: ${referenceStyle.motion}
- Prompt DNA: ${referenceStyle.promptDNA}
- Keywords: ${referenceStyle.keywords.join(', ') || 'none'}

Use uploaded references only as texture, palette, and signal-language anchors. Do not copy literal subjects unless they are abstract geometry.
` : ''}

${stylePresets.length > 0 ? `
═══ SELECTED STYLE PRESETS ═══
${buildPresetInstructionBlock(stylePresets)}
` : ''}

═══ ENGINE RULES ═══
- Generate abstract geometry only: no characters, no faces, no landscapes, no readable text, no logos.
- Use one dominant central motif and one controlled event across the four scenes.
- Keep the camera locked and the frame sparse with large negative space.
- Each scene prompt must be 45-75 words, lean, concrete, and render-ready for Sora.
- Each clip may be 4, 8, or 12 seconds. Timing language must stretch cleanly across those durations.
- The four scenes must form one connected loop: reveal, micro-shift, active hold, clean return.
- Do not drift into corporate motion graphics, over-detailed cyberpunk HUD, glossy 3D logo work, festival VJ clutter, or frantic glitch.

═══ OUTPUT FORMAT ═══
Return ONLY valid JSON. No markdown, no commentary.
{
  "storyTitle": "short title for this signal geometry loop",
  "storyConcept": "1-2 sentence summary of the abstract signal system",
  "subject": "the exact central geometric signal object",
  "microMotion": "reveal -> shift -> hold -> resolve -> return",
  "negativePrompt": "comma-separated exclusions",
  "scenes": [
    { "beat": "freeze", "title": "string", "prompt": "Sora prompt", "motion": "first-frame reveal and latent motion" },
    { "beat": "onset", "title": "string", "prompt": "Sora prompt", "motion": "micro-shift and signal split" },
    { "beat": "hold", "title": "string", "prompt": "Sora prompt", "motion": "active hold and locked alignment" },
    { "beat": "return", "title": "string", "prompt": "Sora prompt", "motion": "collapse or return to clean loop start" }
  ]
}`;

// ── JSON extractor ──────────────────────────────────────────────────────────

const extractJson = (raw: string): any => {
  try {
    return JSON.parse(raw);
  } catch {
    const start = raw.indexOf('{');
    const end = raw.lastIndexOf('}');
    if (start >= 0 && end > start) return JSON.parse(raw.slice(start, end + 1));
    throw new Error('Model response did not contain parseable JSON.');
  }
};

// ── Per-beat visual ground styles ─────────────────────────────────────────
// Each beat renders through a distinct photographic / material signature.
// These are RENDERING qualities layered on top of the concept — not subjects.

const BEAT_STYLES = [
  // 0 – freeze: near-rest but already alive
  'rendered as a near-rest state with latent motion already visible in the first frame: subtle pressure, low drift, material tension, and a readable event quietly beginning inside the image',
  // 1 – onset: directional expansion or contraction
  'rendered as the first clear directional move: pressure traveling through the image, surfaces shifting, light or matter pulling with readable momentum across the frame',
  // 2 – hold: peak state kept active
  'rendered as an active peak state: sustained pulse, oscillation, internal churn, contour stress, or luminous residue that stays kinetically alive without becoming chaotic',
  // 3 – return: residue and loop resolution
  'rendered as a controlled return: afterimage residue, settling sway, elastic overshoot, or repeated micro-surges that resolve toward the opening pose',
] as const;

const STILLFRAME_BASE_SUFFIX =
  'Raw ARV loop style only: locked static camera, one dominant geometric form, absurd object, or event, hard poster readability, lower third kept clean, no text, no logos, no mascot energy. Use tactile analog damage, scene-specific materials, controlled GIF-loop motion, brave but coherent color, and adult visual tension. Do not default to archive-witness, paper-cut, monolith, or stone-relic imagery unless the concept explicitly asks for it.';

// ── Random scene (demo mode) ─────────────────────────────────────────────────

const RANDOM_SCENE_SUBJECTS = [
  'a crooked acid-lime spiral trapped in a red scanner rectangle',
  'three dirty flyer color blocks sliding over a black CRT grid',
  'a rubbery ivory aperture squeezed by cyan and magenta barcode rails',
  'a wet concrete corner where one violet triangle folds into itself',
  'a malformed signal object made of dots, bars, and orange pressure ticks',
  'a dirty white circle cut by a cyan scanner band and hot-magenta edge ghosts',
  'a slowly rotating chrome torus suspended in black void',
  'a dense field of magnetic iron filings reacting to an unseen pulse',
  'a single suspended droplet of mercury catching cold light',
  'a wall of analog tape reels breathing in and out',
  'a cracked obsidian monument leaking thin smoke',
  'a cluster of glass capillaries pumping faint neon fluid',
  'a micro-city skyline pressed flat onto a spinning vinyl record',
  'a tangle of fiber-optic cables glowing from deep inside',
  'a slab of wet black stone with luminous fault lines',
  'a hovering ring of brushed steel shedding fine sparks',
  'a deep server reef of blinking circuitry underwater',
  'a desert dune surface crawling with thin magnetic ridges',
  'a translucent membrane stretched over a resonating frame',
  'a column of suspended ash holding a frozen explosion shape',
  'a bank of CRT monitors flickering with one synchronized wave',
];

const RANDOM_SCENE_MOODS = [
  'raw underground signal accident',
  'damaged club ident pressure',
  'absurd geometric deadpan',
  'cold industrial calm',
  'tense pre-storm pressure',
  'hypnotic ritual focus',
  'deep submerged stillness',
  'electric nocturnal unease',
  'sacred mechanical reverence',
  'minimal brutalist silence',
  'warm decaying nostalgia',
];

const RANDOM_SCENE_PALETTES = [
  'matte black with phosphor cyan, hot magenta, and one acid-lime mistake',
  'dirty white, warning red, and scanner cyan on deep black',
  'wet concrete gray with violet shadow and sodium orange ticks',
  'desaturated steel blue with a single warm amber accent',
  'near-black with cold cyan rim light',
  'bone white and deep graphite with faint magenta',
  'oxidized copper and dark teal',
  'monochrome charcoal with one bioluminescent green core',
  'ash grey with bruised violet shadows',
];

const RANDOM_SCENE_MOTIONS = [
  'one scanner sweep that reveals an absurd hidden contour and erases it',
  'a crooked spiral inhale that snaps back to frame one',
  'three color blocks slipping out of register and locking back into the grid',
  'one slow continuous rotation that never fully completes',
  'a single travelling pulse that crosses the frame and returns',
  'a sustained low-frequency oscillation with visible material stress',
  'a slow inhale-and-exhale swell of the whole subject',
  'fine particles drifting in a controlled magnetic current',
  'an elastic overshoot that settles back toward the opening pose',
];

interface RandomSceneSeed {
  subject: string;
  mood: string;
  palette: string;
  motion: string;
}

const pickRandom = <T,>(list: readonly T[]): T => list[Math.floor(Math.random() * list.length)];

const buildRandomSceneSeed = (): RandomSceneSeed => ({
  subject: pickRandom(RANDOM_SCENE_SUBJECTS),
  mood: pickRandom(RANDOM_SCENE_MOODS),
  palette: pickRandom(RANDOM_SCENE_PALETTES),
  motion: pickRandom(RANDOM_SCENE_MOTIONS),
});

const RANDOM_SCENE_SYSTEM_PROMPT = `You are a raw ARV text-to-video prompt writer for "Stillframe Rituals" — single locked-camera GIF-like loop clips made for AI video generation via Sora.

Write exactly ONE standalone scene prompt. Rules:
- 45-75 words, lean, concrete, render-ready. No preamble, no quotes, no markdown, no list — output only the prompt sentence(s).
- Locked static camera. One dominant subject and one dominant motion family.
- Visible continuous movement from the first frame; loop-ready so the end can hand back to the start.
- Abstract / geometric / material / underground. No readable text, no logos, no recognizable characters or faces, no strobe or harsh flashing.
- Use tactile analog damage, scene-specific materials, brave coherent color, visible reset logic, and strong poster readability.`;

const buildRandomScenePromptRequest = (seed: RandomSceneSeed): string =>
  `Write one Sora text-to-video prompt for this seed.
Subject: ${seed.subject}.
Mood: ${seed.mood}.
Color palette: ${seed.palette}.
Dominant motion: ${seed.motion}.
${STILLFRAME_BASE_SUFFIX}`;

const buildFallbackScenePrompt = (seed: RandomSceneSeed): string =>
  `Locked static camera on ${seed.subject}, lit in ${seed.palette}, carrying a mood of ${seed.mood}. ` +
  `From the first frame the scene is already alive with ${seed.motion}, motion visible and continuous, ` +
  `loop-ready so the final frame resolves back toward the opening pose. ` +
  `Tactile materials, coherent contrast, hard poster readability, no text, no logos, no characters, no strobe.`;

// ── Routes ──────────────────────────────────────────────────────────────────


export const createStillframeRoutes = () => {
  const router = Router();

  /**
   * POST /api/stillframe/ideas
  * Body: { seed?: string, mode?: 'ritual'|'satire'|'signal', keywords?: string[], referenceStyle?: {...} }
   * Returns: { themes, characters, events, actions, stories, styles, promptSeeds, presetSeeds, visions, clipboardText, usage }
   */
  router.post('/api/stillframe/ideas', async (req, res) => {
    try {
      const rawMode = asNonEmptyString(req.body?.mode)?.toLowerCase();
      const mode = rawMode === 'satire' ? 'satire' : rawMode === 'signal' ? 'signal' : 'ritual';
      const seed = asNonEmptyString(req.body?.seed);
      const variationSeed = asNonEmptyString(req.body?.variationSeed) || `${Date.now()}-${Math.random().toString(36).slice(2, 8)}`;
      const keywords = normalizeKeywords(req.body?.keywords);
      const rawReferenceStyle = req.body?.referenceStyle;
      const referenceStyle = rawReferenceStyle && typeof rawReferenceStyle === 'object'
        ? {
          summary: asNonEmptyString(rawReferenceStyle.summary) || 'Reference-driven Stillframe style.',
          subjectFocus: asNonEmptyString(rawReferenceStyle.subjectFocus) || 'One dominant subject or event in a readable frame.',
          palette: asNonEmptyString(rawReferenceStyle.palette) || 'Scene-led contrast palette with restrained accents.',
          motion: asNonEmptyString(rawReferenceStyle.motion) || 'Controlled loop motion with a clear transformation and return.',
          promptDNA: asNonEmptyString(rawReferenceStyle.promptDNA) || 'Tactile, high-contrast Stillframe image with flexible materials and legible loop logic.',
          keywords: normalizeIdeaList(rawReferenceStyle.keywords, 8),
        } satisfies StillframeReferenceStyleSummary
        : null;
      const stylePresets = selectStillframeStylePresets(
        seed,
        mode === 'signal' ? [...keywords, ...arvMinimalSignalGeometryPreset.tags] : keywords,
        referenceStyle,
        mode === 'signal' ? [arvMinimalSignalGeometryPreset.id] : [],
      );
      const client = getAzureClient();
      const model = getAzureModel();

      const response = await client.chat.completions.create({
        model,
        messages: [
          {
            role: 'developer',
            content: `You generate reusable idea packs for Stillframe Rituals using Azure OpenAI.

${buildStillframeStyleLock(stylePresets, referenceStyle)}

Rules:
- Return ONLY valid JSON. No markdown, no commentary.
- Generate fresh, surprising, copy-ready ARV ideas for themes, characters, events, actions, stories, styles, prompt seeds, and preset seeds.
- Treat every run as a new variation request. Even with the same seed, avoid repeating earlier obvious combinations and push toward a distinct new constellation.
- Everything must stay inside an open ARV family: hard readability, sparse composition, tactile material logic, one dominant subject or event, no mascot drift, and no glossy entertainment wallpaper.
- Avoid generic fantasy, cheerful whimsy, generic cyberpunk, cute horror, and vague cinematic wallpaper.
- Make each item specific enough to paste directly into story, prompt, or preset workflows.
- Prompt seeds must already sound usable for Stillframe GIF generation.
- Preset seeds must describe a clear visual direction in one compact line.
- ${mode === 'satire'
              ? 'For satire mode, ideas must obey Subject / Surface / Motion / Transformation / Loop logic and derive wit from visual contradiction, damaged print iconography, and mechanical residue instead of explanatory politics.'
              : mode === 'signal'
                ? 'For signal geometry mode, ideas must be abstract black-background CRT geometry: motifs, line systems, dots, bars, orbital frames, chromatic edge split, one micro-motion event, no characters, no faces, no landscapes, no readable text.'
              : 'For ritual mode, ideas must imply a loop-ready four-beat motion arc, one dominant subject or event, material continuity, and a physically legible story world.'}
- Return exactly this JSON shape:
{
  "themes": ["..."],
  "characters": ["..."],
  "events": ["..."],
  "actions": ["..."],
  "stories": ["..."],
  "styles": ["..."],
  "promptSeeds": ["..."],
  "presetSeeds": ["..."],
  "visions": [
    {
      "title": "...",
      "theme": "...",
      "character": "...",
      "event": "...",
      "action": "...",
      "story": "...",
      "style": "...",
      "promptSeed": "...",
      "presetSeed": "..."
    }
  ]
}`,
          },
          {
            role: 'user',
            content: [
              `Mode: ${mode}`,
              `Variation seed: ${variationSeed}`,
              seed ? `Seed focus: ${seed}` : 'Seed focus: none. Generate a fresh ARV idea pack from scratch.',
              keywords.length > 0 ? `Keywords: ${keywords.join(', ')}` : 'Keywords: none.',
              referenceStyle
                ? `Reference style summary: ${referenceStyle.summary}\nReference palette: ${referenceStyle.palette}\nReference motion: ${referenceStyle.motion}\nReference prompt DNA: ${referenceStyle.promptDNA}\nReference keywords: ${referenceStyle.keywords.join(', ') || 'none'}`
                : 'No reference style supplied.',
              stylePresets.length > 0
                ? `Style presets: ${stylePresets.map((preset) => `${preset.name} — ${preset.visualIdentity || preset.shortPrompt || preset.atmosphere}`).join(' | ')}`
                : 'No explicit style presets supplied.',
              'Generate 6 strong items per idea list and 4 fully assembled vision cards. Make the output immediately reusable for story seeds, prompt writing, preset drafting, and GIF development.',
            ].join('\n\n'),
          },
        ],
      } as any);

      const rawText = asNonEmptyString(response.choices?.[0]?.message?.content ?? '');
      if (!rawText) {
        throw new Error('Ideen-Generator lieferte keine Antwort.');
      }

      const data = extractJson(rawText);
      const themes = normalizeIdeaList(data?.themes, 6);
      const characters = normalizeIdeaList(data?.characters, 6);
      const events = normalizeIdeaList(data?.events, 6);
      const actions = normalizeIdeaList(data?.actions, 6);
      const stories = normalizeIdeaList(data?.stories, 6);
      const styles = normalizeIdeaList(data?.styles, 6);
      const promptSeeds = normalizeIdeaList(data?.promptSeeds, 6);
      const presetSeeds = normalizeIdeaList(data?.presetSeeds, 6);
      const visions = Array.isArray(data?.visions)
        ? data.visions
          .map((vision: unknown, index: number) => normalizeStillframeIdeaVision(vision, index))
          .filter((vision): vision is StillframeIdeaVision => Boolean(vision))
          .slice(0, 4)
        : [];

      if (themes.length === 0 && promptSeeds.length === 0 && visions.length === 0) {
        throw new Error('Ideen-Generator lieferte keine verwertbaren Ideen.');
      }

      const clipboardText = buildStillframeIdeaClipboardText({
        mode,
        seed,
        themes,
        characters,
        events,
        actions,
        stories,
        styles,
        promptSeeds,
        presetSeeds,
        visions,
      });

      return res.json({
        success: true,
        mode,
        model,
        usage: toUsageSummary(response.usage),
        stylePresets: stylePresets.map(summarizePreset),
        referenceStyle,
        themes,
        characters,
        events,
        actions,
        stories,
        styles,
        promptSeeds,
        presetSeeds,
        visions,
        clipboardText,
      });
    } catch (error) {
      console.error('Stillframe ideas Fehler:', error);
      return res.status(500).json({ error: toErrorMessage(error, 'Stillframe idea generation failed') });
    }
  });

  /**
   * POST /api/stillframe/concept
   * Body: { concept?: string, keywords?: string[], referenceImages?: Array<{ ... }> }
   * Returns: { storyTitle, storyConcept, subject, microMotion, negativePrompt, stylePresets, referenceStyle, scenes[], model, usage }
   */
  router.post('/api/stillframe/concept', async (req, res) => {
    try {
      const concept = asNonEmptyString(req.body?.concept);
      const keywords = normalizeKeywords(req.body?.keywords);
      const referenceImages = normalizeReferenceImages(req.body?.referenceImages);
      const referenceStyleOverride = normalizeReferenceStyleOverride(req.body?.referenceStyleOverride);

      if (!concept && keywords.length === 0 && referenceImages.length === 0) {
        return res.status(400).json({ error: 'concept, Bildreferenzen oder 3 bis 5 keywords sind erforderlich.' });
      }

      if (keywords.length > STILLFRAME_MAX_KEYWORDS) {
        return res.status(400).json({ error: 'Bitte maximal 5 keywords senden.' });
      }

      if (!concept && referenceImages.length === 0 && keywords.length > 0 && keywords.length < STILLFRAME_MIN_KEYWORDS) {
        return res.status(400).json({ error: 'Bitte genau 3 bis 5 keywords senden.' });
      }

      const client = getAzureClient();
      const model = getAzureModel();
      let referenceStyleResult: Awaited<ReturnType<typeof analyzeStillframeReferenceImages>> | null = null;

      if (referenceImages.length > 0) {
        try {
          referenceStyleResult = await analyzeStillframeReferenceImages(client, referenceImages);
        } catch (referenceError) {
          console.error('Stillframe Referenzstil Fehler:', referenceError);
          return res.status(500).json({
            error: toErrorMessage(
              referenceError,
              'Bildreferenzen konnten nicht analysiert werden. Bitte pruefe, ob ein vision-faehiges Azure OpenAI Modell konfiguriert ist.',
            ),
          });
        }
      }

      const referenceStyle = applyReferenceStyleOverride(referenceStyleResult?.style ?? null, referenceStyleOverride);
      const stylePresets = selectStillframeStylePresets(concept, keywords, referenceStyle);

      const promptParts = [
        concept
          ? `Concept seed: "${concept}"`
          : referenceImages.length > 0
            ? 'No freeform concept seed supplied. Build a fresh stillframe story world from the uploaded reference images and any style keywords.'
            : 'No freeform concept seed supplied. Invent a fresh stillframe story world from the keywords only.',
        keywords.length > 0
          ? `Keywords: ${keywords.join(', ')}`
          : 'Keywords: none',
        referenceStyle
          ? `Reference style summary: ${referenceStyle.summary}\nReference palette: ${referenceStyle.palette}\nReference motion: ${referenceStyle.motion}\nReference prompt DNA: ${referenceStyle.promptDNA}\nReference keywords: ${referenceStyle.keywords.join(', ') || 'none'}`
          : 'Reference style: none',
        'Generate one fresh Stillframe Rituals story with four connected prompts for four diverse GIF scenes.',
      ];

      const response = await client.chat.completions.create({
        model,
        messages: [
          { role: 'developer', content: buildStillframeSystemPrompt(stylePresets, keywords, referenceStyle) },
          {
            role: 'user',
            content: promptParts.join('\n'),
          },
        ],
      } as any);

      const rawText = asNonEmptyString(response.choices?.[0]?.message?.content ?? '');
      if (!rawText) throw new Error('Model response was empty.');

      const data = extractJson(rawText);

      if (!Array.isArray(data?.scenes) || data.scenes.length < 4) {
        throw new Error('Model did not return 4 scene beats.');
      }

      const usage = mergeUsageSummaries(
        toUsageSummary(response.usage),
        referenceStyleResult?.usage,
      );

      return res.json({
        success: true,
        model,
        usage,
        storyTitle: data.storyTitle ?? (concept || referenceStyle?.subjectFocus || keywords.join(' / ') || 'Stillframe Rituals Sequence'),
        storyConcept: data.storyConcept ?? concept ?? referenceStyle?.summary ?? keywords.join(', '),
        subject: data.subject ?? concept ?? referenceStyle?.subjectFocus ?? keywords.join(', '),
        microMotion: data.microMotion ?? '',
        negativePrompt: data.negativePrompt ?? '',
        keywords,
        stylePresets: stylePresets.map(summarizePreset),
        referenceStyle,
        referenceImageCount: referenceImages.length,
        scenes: data.scenes.slice(0, 4).map((s: any, i: number) => ({
          beat: s.beat ?? ['freeze', 'onset', 'hold', 'return'][i],
          title: s.title ?? `Beat ${i + 1}`,
          prompt: s.prompt ?? '',
          motion: s.motion ?? '',
        })),
      });
    } catch (error) {
      console.error('Stillframe concept Fehler:', error);
      return res.status(500).json({ error: toErrorMessage(error, 'Stillframe concept generation failed') });
    }
  });

  /**
   * POST /api/stillframe/signal
   * Body: { prompt?: string, motif?: string, motionEvent?: string, referenceImages?: Array<{ ... }> }
   * Returns: { storyTitle, storyConcept, subject, microMotion, negativePrompt, stylePresets, referenceStyle, scenes[], model, usage }
   */
  router.post('/api/stillframe/signal', async (req, res) => {
    try {
      const prompt = asNonEmptyString(req.body?.prompt);
      const motif = asNonEmptyString(req.body?.motif) || arvMinimalSignalGeometryPreset.defaultMotifs[0];
      const motionEvent = asNonEmptyString(req.body?.motionEvent) || arvMinimalSignalGeometryPreset.defaultMotionEvents[0];
      const referenceImages = normalizeReferenceImages(req.body?.referenceImages);
      const referenceStyleOverride = normalizeReferenceStyleOverride(req.body?.referenceStyleOverride);

      const client = getAzureClient();
      const model = getAzureModel();
      let referenceStyleResult: Awaited<ReturnType<typeof analyzeStillframeReferenceImages>> | null = null;

      if (referenceImages.length > 0) {
        try {
          referenceStyleResult = await analyzeStillframeReferenceImages(client, referenceImages);
        } catch (referenceError) {
          console.error('Stillframe Signal Referenzstil Fehler:', referenceError);
          return res.status(500).json({
            error: toErrorMessage(
              referenceError,
              'Bildreferenzen konnten nicht analysiert werden. Bitte pruefe, ob ein vision-faehiges Azure OpenAI Modell konfiguriert ist.',
            ),
          });
        }
      }

      const presetReferenceStyle = applyReferenceStyleOverride({
        summary: arvMinimalSignalGeometryPreset.description,
        subjectFocus: motif,
        palette: 'Deep black and near-black CRT grey with electric cyan, hot magenta, warm ivory, ember orange, and dirty white signal accents.',
        motion: `${arvMinimalSignalGeometryPreset.motionRules.rhythm}. ${motionEvent}`,
        promptDNA: arvMinimalSignalGeometryPreset.promptCore,
        keywords: [...arvMinimalSignalGeometryPreset.tags],
      }, referenceStyleOverride);
      const referenceStyle = applyReferenceStyleOverride(referenceStyleResult?.style ?? presetReferenceStyle, referenceStyleOverride)
        || presetReferenceStyle;
      const stylePresets = selectStillframeStylePresets(
        [prompt, motif, motionEvent, arvMinimalSignalGeometryPreset.name].filter(Boolean).join('. '),
        [...arvMinimalSignalGeometryPreset.tags, motif, motionEvent],
        referenceStyle,
        [arvMinimalSignalGeometryPreset.id],
      );

      const response = await client.chat.completions.create({
        model,
        messages: [
          { role: 'developer', content: buildMinimalSignalGeometrySystemPrompt(stylePresets, referenceStyle) },
          {
            role: 'user',
            content: [
              `Freeform seed: ${prompt || 'none'}`,
              `Chosen motif: ${motif}`,
              `Chosen motion event: ${motionEvent}`,
              `Generation template:\n${arvMinimalSignalGeometryPreset.generationPromptTemplate}`,
              referenceStyle
                ? `Reference style summary: ${referenceStyle.summary}\nReference palette: ${referenceStyle.palette}\nReference motion: ${referenceStyle.motion}\nReference prompt DNA: ${referenceStyle.promptDNA}`
                : 'Reference style: none',
              'Generate four connected Minimal Signal Geometry scenes. Keep them abstract, sparse, black-background, loop-ready, and Sora-safe.',
            ].join('\n\n'),
          },
        ],
      } as any);

      const rawText = asNonEmptyString(response.choices?.[0]?.message?.content ?? '');
      if (!rawText) throw new Error('Signal geometry generation returned an empty response.');

      const data = extractJson(rawText);
      if (!Array.isArray(data?.scenes) || data.scenes.length < 4) {
        throw new Error('Signal geometry engine did not return four scenes.');
      }

      const usage = mergeUsageSummaries(
        toUsageSummary(response.usage),
        referenceStyleResult?.usage,
      );

      return res.json({
        success: true,
        mode: 'signal',
        model,
        usage,
        presetId: arvMinimalSignalGeometryPreset.id,
        motif,
        motionEvent,
        keywords: [...arvMinimalSignalGeometryPreset.tags, motif, motionEvent],
        stylePresets: stylePresets.map(summarizePreset),
        referenceStyle,
        referenceImageCount: referenceImages.length,
        storyTitle: data.storyTitle ?? 'Minimal Signal Geometry',
        storyConcept: data.storyConcept ?? `${motif}. ${motionEvent}`,
        subject: data.subject ?? motif,
        microMotion: data.microMotion ?? motionEvent,
        negativePrompt: data.negativePrompt ?? arvMinimalSignalGeometryPreset.negativePrompt,
        scenes: data.scenes.slice(0, 4).map((scene: any, index: number) => ({
          beat: scene.beat ?? ['freeze', 'onset', 'hold', 'return'][index],
          title: scene.title ?? `Signal Beat ${index + 1}`,
          prompt: scene.prompt ?? '',
          motion: scene.motion ?? '',
        })),
      });
    } catch (error) {
      console.error('Stillframe signal geometry Fehler:', error);
      return res.status(500).json({ error: toErrorMessage(error, 'Stillframe signal geometry generation failed') });
    }
  });

  /**
   * POST /api/stillframe/satire
   * Body: { prompt?: string, presetProfileId?: string, selectedElementIds?: string[], referenceImages?: [], currentSketch?: ARVSatireSketch }
   * Returns: { satireSketch, storyTitle, storyConcept, stylePresets, scenes[], usage }
   */
  router.post('/api/stillframe/satire', async (req, res) => {
    try {
      const satirePrompt = asNonEmptyString(req.body?.prompt);
      const referenceImages = normalizeReferenceImages(req.body?.referenceImages);
      const referenceStyleOverride = normalizeReferenceStyleOverride(req.body?.referenceStyleOverride);
      const currentSketch = req.body?.currentSketch && typeof req.body.currentSketch === 'object'
        ? req.body.currentSketch as Partial<ARVSatireSketch>
        : null;
      const presetProfile = getStillframeSatirePresetProfile(asNonEmptyString(req.body?.presetProfileId))
        ?? getStillframeSatirePresetProfile(DEFAULT_STILLFRAME_SATIRE_PRESET_PROFILE_ID)
        ?? STILLFRAME_SATIRE_PRESET_PROFILES[0]!;
      const selectedElementIds = normalizeSatireElementIds(req.body?.selectedElementIds, presetProfile.defaultElementIds);
      const selectedElements = selectedElementIds
        .map((elementId) => getStillframeSatireElement(elementId))
        .filter((element): element is StillframeSatireElementOption => Boolean(element));
      const characterIds = normalizeSatireCharacterIds(req.body?.characterIds, currentSketch, presetProfile.characterIds);

      if (characterIds.length < 2) {
        return res.status(400).json({ error: 'Mindestens zwei ARV-Charaktere sind erforderlich.' });
      }

      const selectedCharacters = characterIds
        .map((characterId) => getCharacter(characterId))
        .filter((character): character is NonNullable<ReturnType<typeof getCharacter>> => Boolean(character));

      if (selectedCharacters.length < 2) {
        return res.status(400).json({ error: 'Die gewaehlten ARV-Charaktere konnten nicht geladen werden.' });
      }

      const client = getAzureClient();
      let referenceStyleResult: Awaited<ReturnType<typeof analyzeStillframeReferenceImages>> | null = null;
      if (referenceImages.length > 0) {
        try {
          referenceStyleResult = await analyzeStillframeReferenceImages(client, referenceImages);
        } catch (error) {
          console.warn('Stillframe satire Referenzbildanalyse fehlgeschlagen:', error);
        }
      }
      const referenceStyle = applyReferenceStyleOverride(referenceStyleResult?.style ?? null, referenceStyleOverride);

      const variationSeed = asNonEmptyString(req.body?.variationSeed) || `${Date.now()}-${Math.random().toString(36).slice(2, 8)}`;
      const sketchInstruction = [
        'Du schreibst einen neuen ARV Satire Sketch auf Deutsch. Er soll sofort spielbar, trocken, absurd und klar strukturiert sein.',
        'Der Ton muss streng ARV bleiben: kalte Praezision, keine lockere Comedy, keine freundliche Plauderei, keine Stand-up- oder Meme-Energie.',
        'Die Bild- und Situationslogik soll aus strenger ikonischer Bildsprache, analogem Zerfall und mechanischer Mikro-Bewegung entstehen.',
        'Nutze exakt die vorgegebenen Figuren mit ihrer eigenen Stimme, ihren Eigenheiten und Verhaltensregeln.',
        'Baue Setting, Momente und Pointen so, dass sie in vier visuelle Beats uebersetzt werden koennen: ein dominantes Subjekt, eine beschaedigte Oberflaeche, genau eine mechanische Bewegung, eine kleine visuelle Transformation und eine saubere Rueckkehr in den Ausgangsloop.',
        'Denk in etwa in dieser Grammatik: Subject = einzelne Form, Maschine, Feld, Apertur, synthetisches Wesen oder architektonisches System. Surface = matte Koernung, beschlagenes Glas, lackiertes Metall, Scanline-Haze, nasse Reflexion oder weiches Signalrestbild. Motion = genau ein Druckimpuls, Panel-Shift, Schlitzoeffnung, Driftwechsel, Wellen-Sweep oder Konturensplit. Transformation = Nachbild, Phasenwechsel, Duplikat-Echo, Druckflare oder kontrollierter Farbschlupf. Loop = Kollaps zurueck in die Eroeffnungspose mit Restenergie.',
        'Schreibe 8 bis 10 Dialogzeilen. Jede Zeile muss die Situation weitertreiben und neue satirische Information liefern.',
        'Das Setting muss einfach lesbar und visuell stark sein, damit daraus vier ikonische GIF-Szenen abgeleitet werden koennen.',
        'Wenn Referenzbilder mitgeschickt werden, uebernimm daraus Stil, Material, Palette, Oberflaechenlogik und Prompt-DNA fuer Presets und Szenen, ohne die Bilder wörtlich zu kopieren.',
        'Wenn ein bisheriger Sketch als Kontext mitgeschickt wird, schreibe bewusst eine neue, klar andere Version. Keine Paraphrase.',
        'Antworte ausschliesslich mit JSON in diesem Format: {"title":"...","setting":"...","satireTarget":"...","dialogue":[{"characterId":"...","line":"..."}],"conclusion":"..."}.',
      ].join('\n\n');

      const sketchResult = await foundryGenerateText(
        [
          `Variation-Seed: ${variationSeed}`,
          satirePrompt
            ? `Satire-Fokus des Users: ${satirePrompt}`
            : 'Kein zusaetzlicher Satire-Fokus vorgegeben. Nutze das Preset-Profil und die gewaehlten Elemente als Hauptsignal.',
          `Preset-Profil: ${presetProfile.name}`,
          `Preset-Beschreibung: ${presetProfile.description}`,
          `Gebundene Style-Presets: ${presetProfile.presetIds.join(', ')}`,
          `Gewaehlte Elemente: ${selectedElements.map((element) => `${element.category}: ${element.promptText}`).join(' | ') || 'keine expliziten Elemente'}`,
          referenceStyle
            ? `Referenzbild-Stil: ${referenceStyle.summary}\nReferenz-Palette: ${referenceStyle.palette}\nReferenz-Motion: ${referenceStyle.motion}\nReferenz-Prompt-DNA: ${referenceStyle.promptDNA}\nReferenz-Keywords: ${referenceStyle.keywords.join(', ') || 'none'}`
            : 'Keine Referenzbilder vorhanden.',
          `Gewaehlte Figuren: ${selectedCharacters.map((character) => `${character.name} (${character.id})`).join(', ')}`,
          'Figurenprofil:',
          ...selectedCharacters.map((character) => [
            `${character.name} (${character.id})`,
            `Designation: ${character.designation}`,
            `Voice: ${character.voice}`,
            `Satire-Ziel: ${character.satireTarget}`,
            `Verhaltensregeln: ${character.behaviorRules.join(' | ')}`,
            `Signalvokabular: ${character.vocabulary.slice(0, 8).join(' | ')}`,
            `Sprechformat: ${character.transmissionStyle}`,
          ].join('\n')),
          currentSketch
            ? `Bisheriger Sketch als Kontrastkontext: ${JSON.stringify(currentSketch, null, 2)}`
            : 'Es liegt noch kein bisheriger Sketch vor.',
          'Schreibe jetzt einen neuen, klaren, bildstarken ARV-Satire-Sketch, der spaeter direkt in vier GIF-Szenen uebersetzt werden kann. Gib nur JSON zurueck.',
        ].join('\n\n'),
        sketchInstruction,
        asNonEmptyString(req.body?.model) || undefined,
      );

      const rawSketch = extractJson(sketchResult.text);
      const sketch = sanitizeSatireSketch(rawSketch, {
        characterIds,
        characterLabels: Object.fromEntries(selectedCharacters.map((character) => [character.id, character.name])),
        previousSketch: currentSketch,
      });

      const satireSignals = buildStillframeSatireSignals(
        satirePrompt,
        sketch,
        selectedCharacters,
        presetProfile,
        selectedElements,
        referenceStyle,
      );
      const stylePresets = selectStillframeStylePresets(
        `${sketch.title}. ${sketch.setting}. ${sketch.satireTarget}`,
        satireSignals,
        referenceStyle,
        presetProfile.presetIds,
      );

      const model = getAzureModel();
      const sceneResponse = await client.chat.completions.create({
        model,
        messages: [
          {
            role: 'developer',
            content: buildStillframeSatireSystemPrompt(
              stylePresets,
              satireSignals,
              sketch,
              selectedCharacters,
              presetProfile,
              selectedElements,
              referenceStyle,
            ),
          },
          {
            role: 'user',
            content: [
              satirePrompt
                ? `Zusatzfokus: ${satirePrompt}`
                : 'Kein Zusatzfokus. Nutze Preset-Profil, Elemente und Sketch als Leitlinie.',
              `Preset-Profil: ${presetProfile.name} — ${presetProfile.description}`,
              `Style-Presets: ${presetProfile.presetIds.join(', ')}`,
              `Elemente: ${selectedElements.map((element) => `${element.category}: ${element.promptText}`).join(' | ') || 'keine expliziten Elemente'}`,
              referenceStyle
                ? `Referenzbild-DNA: ${referenceStyle.summary}\nReferenzbild-Palette: ${referenceStyle.palette}\nReferenzbild-Motion: ${referenceStyle.motion}\nReferenzbild-Prompt-DNA: ${referenceStyle.promptDNA}`
                : 'Keine Referenzbilder als Stilanker vorhanden.',
              `Sketch-Titel: ${sketch.title}`,
              `Setting: ${sketch.setting}`,
              `Satire-Ziel: ${sketch.satireTarget}`,
              `Dialog-Auszug:\n${sketch.dialogue.map((line) => `${getCharacter(line.characterId)?.name ?? line.characterId}: ${line.line}`).join('\n')}`,
              `Nicht-Aufloesung: ${sketch.conclusion}`,
              'Erzeuge jetzt vier stillframe-taugliche Szenenprompts fuer Skizze und GIF. Jede Szene muss eine klare visuelle Pointe und einen loopbaren Bewegungsbogen tragen. Gib nur JSON zurueck.',
            ].join('\n\n'),
          },
        ],
      } as any);

      const rawText = asNonEmptyString(sceneResponse.choices?.[0]?.message?.content ?? '');
      if (!rawText) {
        throw new Error('Satire-Szenengenerierung lieferte keine Antwort.');
      }

      const data = extractJson(rawText);
      if (!Array.isArray(data?.scenes) || data.scenes.length < 4) {
        throw new Error('Satiremodus lieferte keine vier Szenen.');
      }

      const usage = mergeUsageSummaries(
        referenceStyleResult?.usage,
        sketchResult.usage,
        toUsageSummary(sceneResponse.usage),
      );

      return res.json({
        success: true,
        mode: 'satire',
        model,
        sketchModel: sketchResult.model,
        usage,
        presetProfileId: presetProfile.id,
        selectedElementIds,
        satireSketch: sketch,
        sketch,
        keywords: satireSignals,
        stylePresets: stylePresets.map(summarizePreset),
        referenceStyle,
        referenceImageCount: referenceImages.length,
        storyTitle: data.storyTitle ?? sketch.title,
        storyConcept: data.storyConcept ?? `${sketch.satireTarget} · ${sketch.setting}`,
        subject: data.subject ?? sketch.setting,
        microMotion: data.microMotion ?? sketch.conclusion,
        negativePrompt: data.negativePrompt ?? '',
        scenes: data.scenes.slice(0, 4).map((scene: any, index: number) => ({
          beat: scene.beat ?? ['freeze', 'onset', 'hold', 'return'][index],
          title: scene.title ?? `Satire Beat ${index + 1}`,
          prompt: scene.prompt ?? '',
          motion: scene.motion ?? '',
        })),
      });
    } catch (error) {
      console.error('Stillframe satire Fehler:', error);
      return res.status(500).json({ error: toErrorMessage(error, 'Stillframe satire generation failed') });
    }
  });

  /**
   * POST /api/stillframe/polish
  * Body: { prompt: string, beat?: string, title?: string, motion?: string, mode?: 'ritual'|'satire'|'signal', storyTitle?: string, storyConcept?: string, stylePresetIds?: string[], referenceStyle?: {...} }
   * Returns: { prompt, model, usage }
   */
  router.post('/api/stillframe/polish', async (req, res) => {
    try {
      const prompt = asNonEmptyString(req.body?.prompt);
      if (!prompt) {
        return res.status(400).json({ error: 'prompt ist erforderlich.' });
      }

      const promptCore = extractPromptCore(prompt) || prompt.trim();

      const rawMode = asNonEmptyString(req.body?.mode)?.toLowerCase();
      const mode = rawMode === 'satire' ? 'satire' : rawMode === 'signal' ? 'signal' : 'ritual';
      const beat = asNonEmptyString(req.body?.beat) || 'scene';
      const title = asNonEmptyString(req.body?.title) || 'Untitled scene';
      const motion = asNonEmptyString(req.body?.motion) || '';
      const storyTitle = asNonEmptyString(req.body?.storyTitle) || '';
      const storyConcept = asNonEmptyString(req.body?.storyConcept) || '';
      const satirePresetProfile = mode === 'satire'
        ? getStillframeSatirePresetProfile(asNonEmptyString(req.body?.presetProfileId)) || null
        : null;
      const satireElementIds = mode === 'satire'
        ? normalizeSatireElementIds(req.body?.selectedElementIds, satirePresetProfile?.defaultElementIds || [])
        : [];
      const satireElements = satireElementIds
        .map((elementId) => getStillframeSatireElement(elementId))
        .filter((element): element is StillframeSatireElementOption => Boolean(element));
      const modePolishRuleA = mode === 'satire'
        ? 'For satire mode, compress the scene into one iconic image plate: one subject, one surface logic, one mechanical motion, one visual transformation, one residue return.'
        : mode === 'signal'
          ? 'For signal geometry mode, preserve abstract black-background CRT geometry: one central motif, thin linework, one micro-motion event, large negative space, and a clean lock or collapse.'
        : 'For ritual story mode, preserve physical handoff logic and make the scene feel like one section of a continuous four-beat loop.';
      const modePolishRuleB = mode === 'satire'
        ? 'For satire mode, favor damaged print iconography, hard poster-readability, analog contradiction, and visual compression over narrative explanation.'
        : mode === 'signal'
          ? 'For signal geometry mode, remove characters, faces, landscapes, readable text, logo energy, glossy 3D, busy HUD detail, and chaotic glitch; keep the prompt technical, sparse, and loop-legible.'
        : 'For ritual story mode, favor inherited end-state, material depth, and sustained rhythmic motion over isolated poster-tableau logic.';
      const satirePresetProfileLine = satirePresetProfile
        ? `Satire preset profile: ${satirePresetProfile.name} — ${satirePresetProfile.description}`
        : 'No satire preset profile supplied.';
      const satireElementsLine = satireElements.length > 0
        ? `Satire elements: ${satireElements.map((element) => `${element.category}: ${element.promptText}`).join(' | ')}`
        : 'No satire elements supplied.';
      const stylePresets = resolveStillframeRequestStylePresets(req.body?.stylePresetIds);
      const referenceStyle = normalizeReferenceStyleSummary(req.body?.referenceStyle);

      const client = getAzureClient();
      const model = getStillframePolishModel();
      const response = await client.chat.completions.create({
        model,
        messages: [
          {
            role: 'developer',
            content: `You polish one Stillframe scene prompt for ${mode === 'satire' ? 'the satire sketch mode' : mode === 'signal' ? 'the Minimal Signal Geometry mode' : 'the story mode'} using GPT-5.2-chat.

${buildStillframeStyleLock(stylePresets, referenceStyle)}

Rules:
- Preserve the exact scene identity, beat intent, and loop logic of the source prompt.
- Make the prompt leaner, sharper, more materially precise, and more renderable.
- Keep the locked-camera ARV look with one dominant subject or event and readable continuous motion.
- Prefer exact physical detail over mood adjectives.
- Stay in 45-85 words.
- ${modePolishRuleA}
- ${modePolishRuleB}
- Return ONLY valid JSON in this shape: {"prompt":"..."}`,
          },
          {
            role: 'user',
            content: [
              `Mode: ${mode}`,
              `Story title: ${storyTitle || 'none'}`,
              `Story concept: ${storyConcept || 'none'}`,
              `Beat: ${beat}`,
              `Scene title: ${title}`,
              motion ? `Motion note: ${motion}` : 'No separate motion note.',
              satirePresetProfileLine,
              satireElementsLine,
              referenceStyle
                ? `Reference style summary: ${referenceStyle.summary}\nReference palette: ${referenceStyle.palette}\nReference motion: ${referenceStyle.motion}\nReference prompt DNA: ${referenceStyle.promptDNA}`
                : 'No reference style uploaded.',
              stylePresets.length > 0
                ? `Style presets: ${stylePresets.map((preset) => `${preset.name} — ${preset.visualIdentity || preset.shortPrompt || preset.atmosphere}`).join(' | ')}`
                : 'No explicit style presets supplied.',
              `Source prompt:\n${promptCore}`,
              'Rewrite this single scene prompt only. Keep its meaning and beat role, but make it cleaner, deeper, and more production-ready for Sora.',
            ].join('\n\n'),
          },
        ],
      } as any);

      const rawText = asNonEmptyString(response.choices?.[0]?.message?.content ?? '');
      if (!rawText) {
        throw new Error('Prompt-Polishing lieferte keine Antwort.');
      }

      const data = extractJson(rawText);
      const polishedPrompt = asNonEmptyString(data?.prompt);
      if (!polishedPrompt) {
        throw new Error('Prompt-Polishing lieferte keinen Prompt.');
      }

      return res.json({
        success: true,
        model,
        prompt: polishedPrompt,
        usage: toUsageSummary(response.usage),
        debug: {
          rawPrompt: prompt,
          cleanedPrompt: promptCore,
          polishedPrompt,
          stylePresetIds: stylePresets.map((preset) => preset.id),
          referenceStyleSummary: referenceStyle?.summary ?? null,
        },
      });
    } catch (error) {
      console.error('Stillframe polish Fehler:', error);
      return res.status(500).json({ error: toErrorMessage(error, 'Stillframe prompt polishing failed') });
    }
  });

  /**
   * POST /api/stillframe/sketch
   * Body: { prompt: string }
   * Returns: { imageData, model }
   */
  router.post('/api/stillframe/sketch', async (req, res) => {
    try {
      const userPrompt = asNonEmptyString(req.body?.prompt);
      if (!userPrompt) {
        return res.status(400).json({ error: 'prompt ist erforderlich.' });
      }

      const stylePresets = resolveStillframeRequestStylePresets(req.body?.stylePresetIds);
      const referenceStyle = normalizeReferenceStyleSummary(req.body?.referenceStyle);

      const beatIndex: number | undefined =
        Number.isInteger(Number(req.body?.beatIndex)) && req.body?.beatIndex != null
          ? Math.max(0, Math.min(3, Number(req.body.beatIndex)))
          : undefined;

      const { promptCore, finalPrompt, beatStyle, iqBrief } = await buildStillframeRenderPrompt(
        userPrompt,
        stylePresets,
        referenceStyle,
        {
          beatIndex,
          renderTarget: 'sketch',
          purpose: 'create',
          iqContext: req.body?.iqContext,
        },
      );

      const configuredImageModel = asNonEmptyString(process.env.AZURE_OPENAI_IMAGE_DEPLOYMENT);
      const imageModel = configuredImageModel?.toLowerCase() === 'gpt-image-1'
        ? undefined
        : configuredImageModel;

      const result = await foundryImageGenerate({
        prompt: finalPrompt,
        size: '1024x1024',
        quality: 'auto',
        model: imageModel,
      });

      return res.json({
        success: true,
        imageData: result.imageData,
        model: result.model,
        beatIndex,
        beatStyle,
        debug: {
          target: 'sketch',
          rawPrompt: userPrompt,
          cleanedPrompt: promptCore,
          finalPrompt,
          beatStyle,
          iqBrief: normalizeIQBriefForDebug(iqBrief),
          stylePresetIds: stylePresets.map((preset) => preset.id),
          referenceStyleSummary: referenceStyle?.summary ?? null,
        } satisfies StillframeRenderPromptDebug,
      });
    } catch (error) {
      console.error('Stillframe sketch Fehler:', error);
      return res.status(500).json({ error: toErrorMessage(error, 'Stillframe sketch generation failed') });
    }
  });

  /**
   * POST /api/stillframe/video
    * Body: { prompt: string, seconds?: number, beatIndex?: number, remixVideoId?: string, videoTransform?: 'remix' | 'extend' }
   * Returns: { videoBase64, videoUrl?, videoId, jobId, status, seconds, beatIndex }
   */
  router.post('/api/stillframe/video', async (req, res) => {
    try {
      const userPrompt = asNonEmptyString(req.body?.prompt);
      if (!userPrompt) {
        return res.status(400).json({ error: 'prompt ist erforderlich.' });
      }

      const stylePresets = resolveStillframeRequestStylePresets(req.body?.stylePresetIds);
      const referenceStyle = normalizeReferenceStyleSummary(req.body?.referenceStyle);

      const requestedSeconds = normalizeSoraVideoSeconds(req.body?.seconds);
      const remixVideoId = asNonEmptyString(req.body?.remixVideoId);
      const videoTransform = remixVideoId
        ? (req.body?.videoTransform === 'extend' ? 'extend' : 'remix')
        : null;

      const beatIndex: number | undefined =
        Number.isInteger(Number(req.body?.beatIndex)) && req.body?.beatIndex != null
          ? Math.max(0, Math.min(3, Number(req.body.beatIndex)))
          : undefined;

      const deployment =
        (process.env.AZURE_OPENAI_VIDEO_DEPLOYMENT || process.env.AZURE_VIDEO_MODEL || 'sora-2').trim();

      const { promptCore, finalPrompt, beatStyle, iqBrief } = await buildStillframeRenderPrompt(
        userPrompt,
        stylePresets,
        referenceStyle,
        {
          beatIndex,
          renderTarget: 'video',
          purpose: videoTransform ?? 'create',
          remixVideoId,
          iqContext: req.body?.iqContext,
        },
      );
      const debug = {
        target: 'video',
        rawPrompt: userPrompt,
        cleanedPrompt: promptCore,
        finalPrompt,
        beatStyle,
        renderMode: videoTransform ?? 'create',
        sourceVideoId: remixVideoId ?? null,
        iqBrief: normalizeIQBriefForDebug(iqBrief),
        stylePresetIds: stylePresets.map((preset) => preset.id),
        referenceStyleSummary: referenceStyle?.summary ?? null,
      } satisfies StillframeRenderPromptDebug;

      let job = videoTransform === 'extend'
        ? await foundryVideoExtend({
            prompt: finalPrompt,
            videoId: remixVideoId!,
            seconds: requestedSeconds,
          })
        : videoTransform === 'remix'
          ? await foundryVideoEdit({
              prompt: finalPrompt,
              videoId: remixVideoId!,
            })
          : await foundryVideoCreate({
            prompt: finalPrompt,
            deployment,
            size: '1280x720',
            seconds: requestedSeconds,
          });

      if (!job.id) throw new Error('Azure Sora lieferte keine Job-ID zurück.');

      const startedAt = Date.now();

      while (Date.now() - startedAt < VIDEO_MAX_WAIT_MS) {
        const status = job.status;

        if (VIDEO_FAILURE_STATUSES.has(status)) {
          return res.status(500).json({
            error: job.error || 'Azure Sora video generation failed.',
            status,
            videoId: job.id,
            jobId: job.id,
          });
        }

        if (VIDEO_SUCCESS_STATUSES.has(status)) {
          const resolvedVideoId = job.videoId || job.id;

          if (job.videoUrl) {
            return res.json({
              success: true,
              videoId: resolvedVideoId,
              jobId: job.id,
              status,
              videoUrl: job.videoUrl,
              seconds: requestedSeconds,
              beatIndex,
              beatStyle,
              debug: {
                ...debug,
                resultVideoId: resolvedVideoId,
              },
            });
          }

          try {
            const videoBase64 = await foundryVideoDownload(job.id, deployment);
            return res.json({
              success: true,
              videoId: resolvedVideoId,
              jobId: job.id,
              status,
              videoBase64,
              seconds: requestedSeconds,
              beatIndex,
              beatStyle,
              debug: {
                ...debug,
                resultVideoId: resolvedVideoId,
              },
            });
          } catch {
            await sleep(VIDEO_POLL_INTERVAL_MS);
            job = await foundryVideoRetrieve(job.id, deployment);
            continue;
          }
        }

        await sleep(VIDEO_POLL_INTERVAL_MS);
        job = await foundryVideoRetrieve(job.id, deployment);
      }

      return res.status(504).json({ error: 'Timeout: Azure Sora hat die Zeit überschritten.', videoId: job.id, jobId: job.id });
    } catch (error) {
      console.error('Stillframe video Fehler:', error);
      return res.status(500).json({ error: toErrorMessage(error, 'Stillframe video generation failed') });
    }
  });

  /**
   * POST /api/stillframe/random-video
   * Schreibt selbst einen frischen Text-to-Video-Prompt und rendert daraus
   * ein zufälliges Sora-Video (Demo-Mode). Optionaler Body: { seconds?: number }
   * Returns: { success, prompt, seed, videoId, jobId, status, seconds, videoUrl?, videoBase64? }
   */
  router.post('/api/stillframe/random-video', async (req, res) => {
    try {
      const requestedSeconds = normalizeSoraVideoSeconds(req.body?.seconds ?? SORA_DEFAULT_VIDEO_SECONDS);
      const seed = buildRandomSceneSeed();

      let generatedPrompt = '';
      try {
        const completion = await foundryGenerateText(
          buildRandomScenePromptRequest(seed),
          RANDOM_SCENE_SYSTEM_PROMPT,
          getAzureModel(),
        );
        generatedPrompt = asNonEmptyString(completion.text)?.replace(/^["'\s]+|["'\s]+$/g, '') || '';
      } catch (promptError) {
        console.warn('Random-Video Prompt-Generierung fehlgeschlagen, nutze Fallback:', promptError);
      }

      const finalPrompt = generatedPrompt || buildFallbackScenePrompt(seed);

      const deployment =
        (process.env.AZURE_OPENAI_VIDEO_DEPLOYMENT || process.env.AZURE_VIDEO_MODEL || 'sora-2').trim();

      let job = await foundryVideoCreate({
        prompt: finalPrompt,
        deployment,
        size: '1280x720',
        seconds: requestedSeconds,
      });

      if (!job.id) throw new Error('Azure Sora lieferte keine Job-ID zurück.');

      const startedAt = Date.now();

      while (Date.now() - startedAt < VIDEO_MAX_WAIT_MS) {
        const status = job.status;

        if (VIDEO_FAILURE_STATUSES.has(status)) {
          return res.status(500).json({
            error: job.error || 'Azure Sora video generation failed.',
            status,
            videoId: job.id,
            jobId: job.id,
            prompt: finalPrompt,
          });
        }

        if (VIDEO_SUCCESS_STATUSES.has(status)) {
          const resolvedVideoId = job.videoId || job.id;

          if (job.videoUrl) {
            return res.json({
              success: true,
              prompt: finalPrompt,
              seed,
              videoId: resolvedVideoId,
              jobId: job.id,
              status,
              videoUrl: job.videoUrl,
              seconds: requestedSeconds,
            });
          }

          try {
            const videoBase64 = await foundryVideoDownload(job.id, deployment);
            return res.json({
              success: true,
              prompt: finalPrompt,
              seed,
              videoId: resolvedVideoId,
              jobId: job.id,
              status,
              videoBase64,
              seconds: requestedSeconds,
            });
          } catch {
            await sleep(VIDEO_POLL_INTERVAL_MS);
            job = await foundryVideoRetrieve(job.id, deployment);
            continue;
          }
        }

        await sleep(VIDEO_POLL_INTERVAL_MS);
        job = await foundryVideoRetrieve(job.id, deployment);
      }

      return res.status(504).json({
        error: 'Timeout: Azure Sora hat die Zeit überschritten.',
        videoId: job.id,
        jobId: job.id,
        prompt: finalPrompt,
      });
    } catch (error) {
      console.error('Stillframe random-video Fehler:', error);
      return res.status(500).json({ error: toErrorMessage(error, 'Random video generation failed') });
    }
  });

  return router;
};


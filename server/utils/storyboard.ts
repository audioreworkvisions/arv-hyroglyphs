import {
  buildFinalStoryPrompt,
  buildStoryNegativePrompt,
  buildPresetStoryboardInstruction,
  buildStoryEngineSystemInstruction,
  normalizeStorySceneBeat,
  type StoryboardTuningPreset,
} from '../../lib/storyboardTuning';
import type { ARVDialogueLine, ARVSatireSketch } from '../../lib/arvTypes';
import type { StoryArcMode, StoryScene } from '../../lib/types';

export interface StoryboardPreset extends StoryboardTuningPreset {}

export { buildFinalStoryPrompt, buildPresetStoryboardInstruction, buildStoryEngineSystemInstruction };

export const parseJsonObjectFromModelText = (raw: string): any => {
  try {
    return JSON.parse(raw);
  } catch {
    const start = raw.indexOf('{');
    const end = raw.lastIndexOf('}');
    if (start >= 0 && end > start) {
      return JSON.parse(raw.slice(start, end + 1));
    }
    throw new Error('Could not parse JSON from OpenAI response.');
  }
};

export const sanitizeStoryboard = (
  storyData: any,
  preset?: StoryboardPreset | null,
  sourcePrompt?: string | null,
  storyArcMode: StoryArcMode = 'iconic',
) => {
  const rawScenes = Array.isArray(storyData?.scenes) ? storyData.scenes : [];
  if (rawScenes.length < 4) {
    throw new Error('OpenAI storyboard response did not contain enough scenes.');
  }

  const fallbackPrompt = typeof sourcePrompt === 'string' && sourcePrompt.trim()
    ? sourcePrompt.trim()
    : (typeof storyData?.settingDescription === 'string' && storyData.settingDescription.trim()
      ? storyData.settingDescription.trim()
      : 'ARV story world');

  const normalizedStory = {
    title: typeof storyData?.title === 'string' && storyData.title.trim() ? storyData.title.trim() : 'Untitled Sequence',
    presetName: typeof storyData?.presetName === 'string' && storyData.presetName.trim()
      ? storyData.presetName.trim()
      : (preset?.name || 'ARV Signal World'),
    mainMotif: typeof storyData?.mainMotif === 'string' && storyData.mainMotif.trim()
      ? storyData.mainMotif.trim()
      : fallbackPrompt,
    visualDNA: typeof storyData?.visualDNA === 'string' && storyData.visualDNA.trim()
      ? storyData.visualDNA.trim()
      : 'Dark, cinematic, hypnotic ARV world with recognizable material rituals and controlled motion.',
    colorPalette: typeof storyData?.colorPalette === 'string' && storyData.colorPalette.trim()
      ? storyData.colorPalette.trim()
      : (preset?.colorPalette || 'Velvet black, cyan highlights, muted amber accents'),
    motionGrammar: typeof storyData?.motionGrammar === 'string' && storyData.motionGrammar.trim()
      ? storyData.motionGrammar.trim()
      : (preset?.motionStyle || 'Slow breathing motion, locked or very slow camera, seamless loop progression.'),
    hookTitle: typeof storyData?.hookTitle === 'string' && storyData.hookTitle.trim()
      ? storyData.hookTitle.trim()
      : (typeof storyData?.title === 'string' && storyData.title.trim() ? storyData.title.trim() : 'ARV Story Sequence'),
    negativePrompt: typeof storyData?.negativePrompt === 'string' && storyData.negativePrompt.trim()
      ? storyData.negativePrompt.trim()
      : buildStoryNegativePrompt(fallbackPrompt, { sourcePrompt: fallbackPrompt, preset: preset ?? undefined }),
    settingDescription: typeof storyData?.settingDescription === 'string' && storyData.settingDescription.trim()
      ? storyData.settingDescription.trim()
      : 'A coherent visual setting.',
    characterDefinition: typeof storyData?.characterDefinition === 'string' && storyData.characterDefinition.trim()
      ? storyData.characterDefinition.trim()
      : 'A consistent central subject.',
    tone: typeof storyData?.tone === 'string' && storyData.tone.trim() ? storyData.tone.trim() : 'Cinematic',
  };

  const scenes = rawScenes.slice(0, 4).map((rawScene: any, index: number) => {
    const sceneBeat = normalizeStorySceneBeat(rawScene?.sceneBeat, index);
    const scene = {
      sceneBeat,
      action: typeof rawScene?.action === 'string' && rawScene.action.trim()
        ? rawScene.action.trim()
        : `Scene ${index + 1} action.`,
      motionDescription: typeof rawScene?.motionDescription === 'string' && rawScene.motionDescription.trim()
        ? rawScene.motionDescription.trim()
        : 'Slow, steady movement.',
      continuityNotes: typeof rawScene?.continuityNotes === 'string' && rawScene.continuityNotes.trim()
        ? rawScene.continuityNotes.trim()
        : 'Keep visual continuity with prior scene.',
      gifSpecification: typeof rawScene?.gifSpecification === 'string' && rawScene.gifSpecification.trim()
        ? rawScene.gifSpecification.trim()
        : `Cinematic visual of scene ${index + 1}.`,
    };

    return {
      id: `scene-${index + 1}`,
      sceneBeat: scene.sceneBeat,
      action: scene.action,
      motionDescription: scene.motionDescription,
      continuityNotes: scene.continuityNotes,
      gifSpecification: scene.gifSpecification,
      finalPrompt: buildFinalStoryPrompt(scene.gifSpecification, {
        sourcePrompt: fallbackPrompt,
        preset: preset ?? undefined,
        arcMode: storyArcMode,
      }),
      status: 'pending',
    };
  });

  return {
    ...normalizedStory,
    storyArcMode,
    presetId: preset?.id || 'neutral',
    scenes,
  };
};

export const sanitizeStoryboardSceneRewrite = (
  sceneData: any,
  currentScene: StoryScene,
  options: {
    preset?: StoryboardPreset | null;
    sourcePrompt?: string | null;
    storyArcMode?: StoryArcMode;
  } = {},
): StoryScene => {
  const fallbackPrompt = typeof currentScene.gifSpecification === 'string' && currentScene.gifSpecification.trim()
    ? currentScene.gifSpecification.trim()
    : currentScene.finalPrompt;

  const action = typeof sceneData?.action === 'string' && sceneData.action.trim()
    ? sceneData.action.trim()
    : currentScene.action;
  const motionDescription = typeof sceneData?.motionDescription === 'string' && sceneData.motionDescription.trim()
    ? sceneData.motionDescription.trim()
    : currentScene.motionDescription;
  const continuityNotes = typeof sceneData?.continuityNotes === 'string' && sceneData.continuityNotes.trim()
    ? sceneData.continuityNotes.trim()
    : currentScene.continuityNotes;
  const gifSpecification = typeof sceneData?.gifSpecification === 'string' && sceneData.gifSpecification.trim()
    ? sceneData.gifSpecification.trim()
    : fallbackPrompt;

  return {
    ...currentScene,
    action,
    motionDescription,
    continuityNotes,
    gifSpecification,
    finalPrompt: buildFinalStoryPrompt(gifSpecification, {
      sourcePrompt: options.sourcePrompt ?? fallbackPrompt,
      preset: options.preset ?? undefined,
      arcMode: options.storyArcMode ?? 'iconic',
    }),
    status: 'pending',
    gifData: undefined,
    error: undefined,
  };
};

const asTrimmedString = (value: unknown): string | null => {
  if (typeof value !== 'string') {
    return null;
  }

  const trimmed = value.trim();
  return trimmed.length > 0 ? trimmed : null;
};

export const sanitizeSatireSketch = (
  sketchData: any,
  options: {
    characterIds: string[];
    characterLabels?: Record<string, string>;
    previousSketch?: Partial<ARVSatireSketch> | null;
  },
): ARVSatireSketch => {
  const characterIds = Array.from(
    new Set((Array.isArray(options.characterIds) ? options.characterIds : []).filter((value): value is string => typeof value === 'string' && value.trim().length > 0)),
  ).slice(0, 2);

  if (characterIds.length < 2) {
    throw new Error('Satire sketch generation requires at least two character ids.');
  }

  const satireTarget = asTrimmedString(sketchData?.satireTarget)
    || asTrimmedString(options.previousSketch?.satireTarget)
    || 'Institutionelle Absurditaet';

  const title = asTrimmedString(sketchData?.title)
    || asTrimmedString(options.previousSketch?.title)
    || `${characterIds.map((id) => options.characterLabels?.[id] || id).join(' & ')} — ${satireTarget}`;

  const setting = asTrimmedString(sketchData?.setting)
    || asTrimmedString(options.previousSketch?.setting)
    || 'Ein stillgelegter Verwaltungsraum zwischen Archiv, Sternwarte und Ticket-System.';

  const rawDialogue = Array.isArray(sketchData?.dialogue)
    ? sketchData.dialogue
    : Array.isArray(options.previousSketch?.dialogue)
      ? options.previousSketch.dialogue
      : [];

  const dialogue: ARVDialogueLine[] = rawDialogue
    .map((entry: any, index: number) => {
      const line = asTrimmedString(entry?.line ?? entry);
      if (!line) {
        return null;
      }

      const requestedCharacterId = asTrimmedString(entry?.characterId);
      const characterId = requestedCharacterId && characterIds.includes(requestedCharacterId)
        ? requestedCharacterId
        : characterIds[index % characterIds.length];

      return {
        characterId,
        line,
      } satisfies ARVDialogueLine;
    })
    .filter((entry): entry is ARVDialogueLine => !!entry)
    .slice(0, 12);

  const fallbackDialogue = [
    `Das vorliegende Problem wurde erneut klassifiziert: ${satireTarget}.`,
    'Die Klassifizierung ist bekannt. Sie aendert nichts am Vorgang.',
    'Dann muessen wir den Vorgang aus Gruenden der Form neu eroertern.',
    'Die Neueroerterung wurde bereits vorbereitet und zugleich vertagt.',
    'Wer hat diese Vertagung veranlasst?',
    'Niemand zustaendiges. Genau deshalb gilt sie als gueltig.',
    'Dann bleibt nur noch, die Absurditaet korrekt zu dokumentieren.',
    'Das wurde bereits getan. Wirkung und Einsicht bleiben ausstehend.',
  ];

  while (dialogue.length < 8) {
    const index = dialogue.length;
    dialogue.push({
      characterId: characterIds[index % characterIds.length],
      line: fallbackDialogue[index % fallbackDialogue.length],
    });
  }

  const conclusion = asTrimmedString(sketchData?.conclusion)
    || asTrimmedString(options.previousSketch?.conclusion)
    || 'Das Protokoll endet hier. Die Absurditaet bleibt vollstaendig in Kraft.';

  return {
    id: `arv-sketch-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`,
    title,
    setting,
    satireTarget,
    characterIds,
    dialogue,
    conclusion,
    createdAt: Date.now(),
  };
};
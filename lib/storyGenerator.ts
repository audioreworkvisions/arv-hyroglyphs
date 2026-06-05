import { GoogleGenAI, Type } from '@google/genai';
import { StoryArcMode, StorySequence } from './types';
import { PRESETS } from './presets';
import {
  buildFinalStoryPrompt,
  buildStoryEngineSystemInstruction,
  buildStoryNegativePrompt,
  normalizeStorySceneBeat,
} from './storyboardTuning';

export async function generateStorySequence(
  apiKey: string,
  prompt: string,
  presetId?: string | null,
  storyArcMode: StoryArcMode = 'iconic',
): Promise<StorySequence> {
  const ai = new GoogleGenAI({ apiKey });
  const preset = presetId ? (PRESETS.find((entry) => entry.id === presetId) ?? null) : null;
  const systemInstruction = buildStoryEngineSystemInstruction(prompt, preset, 'en', storyArcMode);

  const responseSchema = {
    type: Type.OBJECT,
    properties: {
      title: { type: Type.STRING, description: "A catchy title for the story" },
      presetName: { type: Type.STRING, description: "A unique ARV universe or preset name for the story world" },
      mainMotif: { type: Type.STRING, description: "The recurring figure, object family, machine, or world anchor" },
      visualDNA: { type: Type.STRING, description: "A concise summary of the recognizable visual DNA of the universe" },
      colorPalette: { type: Type.STRING, description: "A concise palette summary for the world" },
      motionGrammar: { type: Type.STRING, description: "How movement and camera behavior should feel across the universe" },
      hookTitle: { type: Type.STRING, description: "A short memorable stream or thumbnail hook" },
      negativePrompt: { type: Type.STRING, description: "A concise negative prompt aligned with the universe" },
      settingDescription: { type: Type.STRING, description: "Overall setting description" },
      characterDefinition: { type: Type.STRING, description: "Detailed description of the main character(s) to maintain continuity" },
      tone: { type: Type.STRING, description: "The emotional tone of the story" },
      scenes: {
        type: Type.ARRAY,
        description: "The sequence of exactly 4 scenes",
        items: {
          type: Type.OBJECT,
          properties: {
            sceneBeat: { type: Type.STRING, description: 'Exact structural beat: emergence, lock-in, peak, or afterimage' },
            action: { type: Type.STRING, description: "What happens in this scene" },
            motionDescription: { type: Type.STRING, description: "Camera and subject movement" },
            continuityNotes: { type: Type.STRING, description: "Notes on what must remain consistent from previous scenes" },
            gifSpecification: { type: Type.STRING, description: "The core visual prompt for the video model" }
          },
          required: ["sceneBeat", "action", "motionDescription", "continuityNotes", "gifSpecification"]
        }
      }
    },
    required: ["title", "presetName", "mainMotif", "visualDNA", "colorPalette", "motionGrammar", "hookTitle", "negativePrompt", "settingDescription", "characterDefinition", "tone", "scenes"]
  };

  const response = await ai.models.generateContent({
    model: 'gemini-3-flash-preview',
    contents: `Generate a story sequence based on this idea: "${prompt}"`,
    config: {
      systemInstruction,
      responseMimeType: 'application/json',
      responseSchema,
      temperature: 0.7,
    }
  });

  const text = response.text || "{}";
  const data = JSON.parse(text);
  const defaultNegativePrompt = buildStoryNegativePrompt(prompt, { sourcePrompt: prompt, preset });

  const scenes = data.scenes.map((scene: any, index: number) => {
    const sceneBeat = normalizeStorySceneBeat(scene.sceneBeat, index);
    const finalPrompt = buildFinalStoryPrompt(scene.gifSpecification, {
      sourcePrompt: prompt,
      preset,
      arcMode: storyArcMode,
    });

    return {
      id: `scene-${index + 1}`,
      sceneBeat,
      action: scene.action,
      motionDescription: scene.motionDescription,
      continuityNotes: scene.continuityNotes,
      gifSpecification: scene.gifSpecification,
      finalPrompt,
      status: 'pending'
    };
  });

  return {
    title: data.title,
    storyArcMode,
    presetName: typeof data.presetName === 'string' && data.presetName.trim() ? data.presetName.trim() : (preset?.name ?? 'ARV Signal World'),
    mainMotif: typeof data.mainMotif === 'string' && data.mainMotif.trim() ? data.mainMotif.trim() : prompt,
    visualDNA: typeof data.visualDNA === 'string' && data.visualDNA.trim()
      ? data.visualDNA.trim()
      : 'Tactile ARV world with hard contrast, controlled motion, clear material logic, and one dominant event per scene.',
    colorPalette: typeof data.colorPalette === 'string' && data.colorPalette.trim()
      ? data.colorPalette.trim()
      : (preset?.colorPalette ?? 'Matte black, mineral white, restrained signal color, and one deliberate accent'),
    motionGrammar: typeof data.motionGrammar === 'string' && data.motionGrammar.trim()
      ? data.motionGrammar.trim()
      : (preset?.motionStyle ?? 'Locked or very slow camera, one clear transformation, readable motion continuity, and a loop-ready return.'),
    hookTitle: typeof data.hookTitle === 'string' && data.hookTitle.trim() ? data.hookTitle.trim() : data.title,
    negativePrompt: typeof data.negativePrompt === 'string' && data.negativePrompt.trim() ? data.negativePrompt.trim() : defaultNegativePrompt,
    settingDescription: data.settingDescription,
    characterDefinition: data.characterDefinition,
    tone: data.tone,
    presetId: preset?.id || 'neutral',
    scenes
  };
}
import type { ARVNarrativePhase } from './arvTypes';

export interface StylePreset {
  id: string;
  name: string;
  colorPalette: string;
  lighting: string;
  cameraPerspective: string;
  textures: string;
  motionStyle: string;
  recurringSymbols: string;
  atmosphere: string;
  examplePrompt?: string;
  visualIdentity?: string;
  shortPrompt?: string;
  negativePrompt?: string;
  motionRule?: string;
  colorRule?: string;
  obsRule?: string;
  creativeDirection?: string;
  soraAvoid?: string;
}

export interface ContinuityState {
  characters: string;
  objects: string;
  environment: string;
  motionPatterns: string;
}

export type StoryArcMode = 'cinematic' | 'iconic';

export type StorySceneBeat = 'emergence' | 'lock-in' | 'peak' | 'afterimage';

export interface StorySceneARVMetadata {
  source: 'arv';
  sequenceId: string;
  sequenceTitle: string;
  sequenceConcept: string;
  sceneNumber: number;
  phase: ARVNarrativePhase;
  sceneTitle: string;
  narration: string;
  characterId?: string;
  createdAt: number;
}

export interface StorySequenceARVMetadata {
  source: 'arv';
  sequenceId: string;
  sequenceTitle: string;
  concept: string;
  characterId?: string;
  createdAt: number;
}

export interface StoryScene {
  id: string;
  sceneBeat: StorySceneBeat;
  action: string;
  motionDescription: string;
  continuityNotes: string;
  gifSpecification: string;
  finalPrompt: string;
  status: 'pending' | 'generating' | 'completed' | 'error';
  gifData?: string;
  videoId?: string | null;
  remixedFromVideoId?: string | null;
  videoTransformMode?: 'remix' | 'extend' | null;
  error?: string;
  arv?: StorySceneARVMetadata;
}

export interface StorySequence {
  title: string;
  settingDescription: string;
  characterDefinition: string;
  tone: string;
  presetId: string;
  storyArcMode: StoryArcMode;
  presetName?: string;
  mainMotif?: string;
  visualDNA?: string;
  colorPalette?: string;
  motionGrammar?: string;
  hookTitle?: string;
  negativePrompt?: string;
  arv?: StorySequenceARVMetadata;
  scenes: StoryScene[];
}
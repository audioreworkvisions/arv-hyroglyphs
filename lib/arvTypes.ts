export type ARVNarrativePhase = 'emergence' | 'tension' | 'expansion' | 'collapse';

export interface ARVCharacter {
  id: string;
  name: string;
  designation: string;
  voice: string;
  vocabulary: string[];
  behaviorRules: string[];
  satireTarget: string;
  emotionalRegister: string;
  transmissionStyle: string;
  colorKey: string; // tailwind color token (e.g. 'indigo')
}

export interface ARVGifPrompt {
  id: string;
  prompt: string;
  styleNote: string;
  geometry: string;
  motion: string;
  colors: string;
  atmosphere: string;
  characterId?: string;
  phase?: ARVNarrativePhase;
  tags: string[];
  createdAt: number;
}

export interface ARVStoryScene {
  phase: ARVNarrativePhase;
  sceneNumber: number;
  title: string;
  prompt: string;
  narration: string;
}

export interface ARVStorySequence {
  id: string;
  title: string;
  concept: string;
  characterId?: string;
  scenes: ARVStoryScene[];
  createdAt: number;
}

export interface ARVDialogueLine {
  characterId: string;
  line: string;
}

export interface ARVSatireSketch {
  id: string;
  title: string;
  setting: string;
  satireTarget: string;
  characterIds: string[];
  dialogue: ARVDialogueLine[];
  conclusion: string;
  createdAt: number;
}

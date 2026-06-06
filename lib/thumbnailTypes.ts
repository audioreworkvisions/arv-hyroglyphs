/**
 * ARV Thumbnail Studio — shared TypeScript types.
 *
 * These types are consumed by both the Express backend (server/services + routes)
 * and the React frontend (components/thumbnail-studio). They intentionally use
 * plain JSON-serializable shapes so the same contract crosses the HTTP boundary.
 *
 * This tool only ever talks to Azure AI Foundry, Azure OpenAI, the OpenAI API and
 * Foundry IQ. It never uses Gemini or Fal routes.
 */

export const THUMBNAIL_GENRES = [
  'Hardgroove',
  'Raw Techno',
  'Funky Techno',
  'Detroit Techno',
  'Breakbeat Techno',
  'Hypnotic Techno',
  'Acid',
  'Oldschool',
  'Industrial',
  'Dub Techno',
] as const;

export type ThumbnailGenre = (typeof THUMBNAIL_GENRES)[number];

export const THUMBNAIL_MOODS = [
  'dark',
  'ritual',
  'analog',
  'political',
  'cosmic',
  'machine',
  'underground',
  'emotional',
  'rave',
  'xerox',
] as const;

export type ThumbnailMood = (typeof THUMBNAIL_MOODS)[number];

export const THUMBNAIL_MODES = [
  'background-only',
  'title-only-banner',
  'full-youtube-thumbnail',
  'final-composed-thumbnail',
] as const;

export type ThumbnailMode = (typeof THUMBNAIL_MODES)[number];

export const THUMBNAIL_TEXT_STYLES = [
  'brutal-industrial',
  'signal-minimal',
  'arv-transmission',
] as const;

export type ThumbnailTextStyle = (typeof THUMBNAIL_TEXT_STYLES)[number];

export const ARV_TOPLINE = 'TECHNO TRANSMISSIONS';
export const ARV_FOOTER = 'PEACE LOVE TECHNO';

export interface ThumbnailUploadedImage {
  fileName: string;
  dataUrl: string;
}

export interface ThumbnailStudioRequest {
  title?: string;
  theme?: string;
  genre?: ThumbnailGenre | string;
  mood?: ThumbnailMood[] | string[];
  streamNumber?: string;
  variantCount?: number;
  thumbnailMode?: ThumbnailMode;
  styleProfileId?: string;
  useFoundryIq?: boolean;
}

export interface ThumbnailReferenceImageAnalysis {
  fileName: string;
  width: number;
  height: number;
  aspectRatio: string;
  dominantColors: string[];
  averageBrightness: number;
  estimatedContrast: number;
  composition: string[];
  semanticHints: string[];
}

export interface ThumbnailReferenceAnalysis {
  source: 'folder' | 'upload' | 'mixed';
  analyzedCount: number;
  skippedCount: number;
  images: ThumbnailReferenceImageAnalysis[];
  summary: string;
  warnings: string[];
}

export interface ThumbnailStyleProfile {
  id: string;
  brand: string;
  sourceCount: number;
  summary: string;
  detectedPalettes: string[];
  layoutPatterns: string[];
  titlePatterns: string[];
  visualMotifs: string[];
  typographyNotes: string[];
  negativeStyleRules: string[];
  exampleFileNames: string[];
  createdAt: string;
  updatedAt: string;
}

export interface ThumbnailTitleVariant {
  title: string;
  subtitle: string;
  score: number;
  reason: string;
}

export interface ThumbnailTextOverlayConfig {
  topline: string;
  mainTitle: string;
  subtitle: string;
  footer: string;
  streamNumber: string;
  position: 'center' | 'left' | 'right' | 'top' | 'bottom';
  safeArea: boolean;
  fontStyle: string;
  colorLogic: string;
  textStyle: ThumbnailTextStyle;
  icons: ThumbnailIcon[];
}

export type ThumbnailIcon = 'peace' | 'heart' | 'vinyl';

export interface CreativeDecisionExplanation {
  whyTitle: string;
  whyTheme: string;
  whyLayout: string;
  whyPalette: string;
  whyLocalText: string;
  usedIqRules: string[];
  avoidedPatterns: string[];
  iqProvider: FoundryIqMemoryResult['provider'];
  usedRemote: boolean;
}

export interface ThumbnailConcept {
  selectedTitle: string;
  theme: string;
  shortConcept: string;
  titleVariants: ThumbnailTitleVariant[];
  topPicks: string[];
  youtubeTitle: string;
  description: string;
  hashtags: string[];
  seoKeywords: string[];
  layout: string;
  palette: string[];
  visualMotifs: string[];
  backgroundPrompt: string;
  negativePrompt: string;
  textOverlay: ThumbnailTextOverlayConfig;
  creativeDecision: CreativeDecisionExplanation;
  generatedByAzure: boolean;
}

export interface FoundryIqMemoryResult {
  provider: 'foundry-iq-agent' | 'local-knowledge' | 'inactive';
  usedRemote: boolean;
  query: string;
  styleRules: string[];
  patterns: string[];
  dramaturgy: string[];
  continuity: string[];
  forbidden: string[];
  citations: Array<{ source: string; excerpt: string }>;
  promptBlock: string;
  fallbackNote: string;
}

export interface ThumbnailBackgroundResult {
  available: boolean;
  imageDataUrl: string | null;
  model: string | null;
  provider: 'foundry' | 'upload' | 'none';
  revisedPrompt?: string;
  note: string;
}

export interface ThumbnailRenderRequest {
  backgroundImagePath?: string;
  backgroundDataUrl?: string;
  title: string;
  subtitle?: string;
  topline?: string;
  footer?: string;
  streamNumber?: string;
  layout?: Partial<ThumbnailTextOverlayConfig>;
  outputFormat?: 'png' | 'jpg';
}

export interface ThumbnailRenderResult {
  id: string;
  width: number;
  height: number;
  format: 'png' | 'jpg';
  imageDataUrl: string;
  fileName: string;
  filePath: string;
  createdAt: string;
}

export interface ThumbnailMemoryCard {
  type: 'thumbnail_memory';
  brand: string;
  title: string;
  theme: string;
  genre: string;
  mood: string[];
  palette: string[];
  layout: string;
  whatGenerated: string;
  whatWorked: string;
  avoidNextTime: string;
  backgroundPrompt: string;
  negativePrompt: string;
  textOverlay: ThumbnailTextOverlayConfig;
  foundryIqSources: string[];
  createdAt: string;
}

export interface ThumbnailStudioSession {
  id: string;
  createdAt: string;
  input: ThumbnailStudioRequest;
  styleProfile: ThumbnailStyleProfile | null;
  foundryIqMemory: FoundryIqMemoryResult | null;
  concept: ThumbnailConcept | null;
  background: ThumbnailBackgroundResult | null;
  render: ThumbnailRenderResult | null;
  exports: string[];
}

export interface ThumbnailStudioHealth {
  ok: boolean;
  azureTextConfigured: boolean;
  azureImageConfigured: boolean;
  foundryIqConfigured: boolean;
  dataDir: string;
  capabilities: {
    referenceAnalysis: boolean;
    titleGeneration: boolean;
    backgroundGeneration: boolean;
    localRender: boolean;
  };
}

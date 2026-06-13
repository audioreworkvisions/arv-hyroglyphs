import React, { useCallback, useEffect, useState } from 'react';
import { BookOpen, CheckCircle2, Copy, Loader2, Sparkles, TriangleAlert } from 'lucide-react';
import { saveItem, type LibraryIdeaItem } from '../lib/libraryDB';

type GenerationMode = 'ritual' | 'satire' | 'signal';

type StillframeIdeaVision = {
  title: string;
  theme: string;
  character: string;
  event: string;
  action: string;
  story: string;
  style: string;
  promptSeed: string;
  presetSeed: string;
};

type StillframeIdeaPack = {
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
};

type StillframeIdeaRemixPayload = {
  mode?: GenerationMode;
  seed?: string;
};

type StillframeIdeaListKey =
  | 'themes'
  | 'characters'
  | 'events'
  | 'actions'
  | 'stories'
  | 'styles'
  | 'promptSeeds'
  | 'presetSeeds';

const STILLFRAME_IDEA_REMIX_STORAGE_KEY = 'hyroglyphis:stillframe-ideas-remix';
const MAX_KEYWORDS = 5;

const GENERATION_MODE_STATUS_LABELS: Record<GenerationMode, string> = {
  ritual: 'Ritual Vision Lab',
  satire: 'Satire Vision Lab',
  signal: 'Signal Geometry Lab',
};

const GENERATION_MODE_PLACEHOLDERS: Record<GenerationMode, string> = {
  ritual: 'z. B. breathing storm lab above black water, micro-city under magnetic weather, kinetic aperture with delayed residue',
  satire: 'z. B. pressure-core office meltdown, glass engine with procedural panic, signal field doing dry visual comedy',
  signal: 'z. B. black CRT barcode breathing once, cyan-magenta orbital frame locking into a central dot',
};

const IDEA_SECTION_CONFIG: Array<{ key: StillframeIdeaListKey; label: string; useAsPrompt?: boolean }> = [
  { key: 'themes', label: 'Themen' },
  { key: 'characters', label: 'Charaktere' },
  { key: 'events', label: 'Ereignisse' },
  { key: 'actions', label: 'Handlungen' },
  { key: 'stories', label: 'Geschichten', useAsPrompt: true },
  { key: 'styles', label: 'Styles' },
  { key: 'promptSeeds', label: 'Prompt Seeds', useAsPrompt: true },
  { key: 'presetSeeds', label: 'Preset Seeds' },
];

const parseKeywords = (value: string): string[] =>
  value
    .split(/[\n,]/)
    .map((entry) => entry.trim())
    .filter((entry) => entry.length > 0);

const mergeKeywords = (currentKeywords: string[], draftValue: string): string[] =>
  Array.from(new Set([...currentKeywords, ...parseKeywords(draftValue)])).slice(0, MAX_KEYWORDS);

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

interface StoryIdeasGeneratorPanelProps {
  onUsePrompt: (value: string) => void;
}

export default function StoryIdeasGeneratorPanel({ onUsePrompt }: StoryIdeasGeneratorPanelProps) {
  const [generationMode, setGenerationMode] = useState<GenerationMode>('ritual');
  const [ideaSeed, setIdeaSeed] = useState('');
  const [keywordInput, setKeywordInput] = useState('');
  const [keywords, setKeywords] = useState<string[]>([]);
  const [isGeneratingIdeas, setIsGeneratingIdeas] = useState(false);
  const [isSavingIdeaPack, setIsSavingIdeaPack] = useState(false);
  const [ideasError, setIdeasError] = useState<string | null>(null);
  const [ideaPackSaveMessage, setIdeaPackSaveMessage] = useState<string | null>(null);
  const [ideaPack, setIdeaPack] = useState<StillframeIdeaPack | null>(null);

  const flushKeywordInput = useCallback(() => {
    if (!keywordInput.trim()) {
      return;
    }

    setKeywords((previous) => mergeKeywords(previous, keywordInput));
    setKeywordInput('');
  }, [keywordInput]);

  const runGenerateIdeas = useCallback(async (options?: { mode?: GenerationMode; seed?: string }) => {
    const nextMode = options?.mode ?? generationMode;
    const nextSeed = options?.seed ?? ideaSeed.trim();

    setIsGeneratingIdeas(true);
    setIdeasError(null);
    setIdeaPackSaveMessage(null);

    if (options?.mode) {
      setGenerationMode(options.mode);
    }

    if (typeof options?.seed === 'string') {
      setIdeaSeed(options.seed);
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
        }),
      });

      const data = await res.json();
      if (!res.ok) {
        throw new Error(data.error || 'Idea generation failed.');
      }

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
  }, [generationMode, ideaSeed, keywords]);

  const handleGenerateIdeas = useCallback(async () => {
    await runGenerateIdeas();
  }, [runGenerateIdeas]);

  const handleSaveIdeaPack = useCallback(async () => {
    if (!ideaPack || isSavingIdeaPack) {
      return;
    }

    setIsSavingIdeaPack(true);
    setIdeaPackSaveMessage(null);

    const trimmedSeed = ideaSeed.trim();
    const item: LibraryIdeaItem = {
      id: `ideas-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`,
      type: 'ideas',
      createdAt: Date.now(),
      prompt: trimmedSeed || ideaPack.stories[0] || ideaPack.promptSeeds[0] || ideaPack.themes[0] || 'Stillframe Ideenpack',
      title: trimmedSeed
        ? `Stillframe Ideenpack - ${trimmedSeed.slice(0, 72)}`
        : `Stillframe Ideenpack - ${GENERATION_MODE_STATUS_LABELS[ideaPack.mode]}`,
      mode: ideaPack.mode,
      seed: trimmedSeed || undefined,
      clipboardText: ideaPack.clipboardText,
      themes: ideaPack.themes,
      characters: ideaPack.characters,
      events: ideaPack.events,
      actions: ideaPack.actions,
      stories: ideaPack.stories,
      styles: ideaPack.styles,
      promptSeeds: ideaPack.promptSeeds,
      presetSeeds: ideaPack.presetSeeds,
      visions: ideaPack.visions.map((vision) => ({ ...vision })),
    };

    try {
      await saveItem(item);
      setIdeaPackSaveMessage('Ideenpack in Bibliothek gespeichert.');
    } catch (error: any) {
      setIdeaPackSaveMessage(error?.message || 'Ideenpack konnte nicht gespeichert werden.');
    } finally {
      setIsSavingIdeaPack(false);
    }
  }, [ideaPack, ideaSeed, isSavingIdeaPack]);

  useEffect(() => {
    if (typeof window === 'undefined') {
      return;
    }

    const rawPayload = window.sessionStorage.getItem(STILLFRAME_IDEA_REMIX_STORAGE_KEY);
    if (!rawPayload) {
      return;
    }

    window.sessionStorage.removeItem(STILLFRAME_IDEA_REMIX_STORAGE_KEY);

    try {
      const parsedPayload = JSON.parse(rawPayload) as StillframeIdeaRemixPayload;
      const nextMode = parsedPayload.mode === 'satire' ? 'satire' : parsedPayload.mode === 'signal' ? 'signal' : 'ritual';
      const nextSeed = typeof parsedPayload.seed === 'string' ? parsedPayload.seed.trim() : '';

      if (!nextSeed) {
        return;
      }

      void runGenerateIdeas({ mode: nextMode, seed: nextSeed });
    } catch {
      window.sessionStorage.removeItem(STILLFRAME_IDEA_REMIX_STORAGE_KEY);
    }
  }, [runGenerateIdeas]);

  return (
    <section className="rounded-[24px] border border-[rgba(168,118,255,0.16)] bg-[linear-gradient(180deg,rgba(22,12,40,0.72),rgba(7,12,24,0.8))] p-5 space-y-5 backdrop-blur-sm">
      <div className="flex flex-wrap items-start justify-between gap-4">
        <div className="space-y-2 max-w-3xl">
          <div className="font-mono text-[11px] uppercase tracking-[0.24em] text-[#8f74c9]">Ideen Generator</div>
          <h2 className="font-mono text-xl font-semibold text-[#f3eaff]">
            Neue Visionen fuer Themen, Figuren, Ereignisse, Stories, Styles, Prompt- und Preset-Seeds
          </h2>
          <p className="text-sm leading-relaxed text-[#907aa8]">
            Baue frische ARV-Ideenpakete und uebernimm Storys oder Prompt-Seeds direkt in den Story GIF Composer.
          </p>
        </div>

        {ideaPack?.clipboardText && (
          <div className="flex flex-wrap items-center gap-2">
            <CopyTextButton text={ideaPack.clipboardText} label="Alles kopieren" copiedLabel="Pack kopiert" />
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
        <div
          className={`rounded-lg border px-4 py-3 font-mono text-[11px] ${ideaPackSaveMessage.includes('gespeichert')
            ? 'border-[rgba(114,228,255,0.16)] bg-[rgba(10,26,46,0.56)] text-[#72e4ff]'
            : 'border-[rgba(255,80,60,0.2)] bg-[rgba(255,80,60,0.1)] text-[#ff6a4f]'}`}
        >
          {ideaPackSaveMessage}
        </div>
      )}

      <div className="grid gap-4 xl:grid-cols-[minmax(0,1.15fr)_minmax(340px,0.85fr)]">
        <div className="space-y-3">
          <label className="block font-mono text-[11px] uppercase tracking-[0.22em] text-[#8f74c9]">Ideen-Seed</label>
          <textarea
            value={ideaSeed}
            onChange={(event) => setIdeaSeed(event.target.value)}
            rows={3}
            placeholder={GENERATION_MODE_PLACEHOLDERS[generationMode]}
            className="w-full resize-none rounded-xl border border-[rgba(168,118,255,0.18)] bg-[rgba(10,10,24,0.82)] px-4 py-3 font-mono text-sm text-[#f3eaff] placeholder-[#4d4162] outline-none transition focus:border-[rgba(199,167,255,0.55)] focus:ring-1 focus:ring-[rgba(199,167,255,0.24)]"
            onKeyDown={(event) => {
              if (event.key === 'Enter' && !event.shiftKey) {
                event.preventDefault();
                void handleGenerateIdeas();
              }
            }}
          />

          <div className="space-y-2">
            <label className="block font-mono text-[11px] uppercase tracking-[0.22em] text-[#705d92]">Keywords</label>
            <div className="rounded-xl border border-[rgba(168,118,255,0.16)] bg-[rgba(12,12,24,0.8)] px-3 py-3">
              <div className="mb-2 flex flex-wrap gap-2">
                {keywords.map((keyword) => (
                  <button
                    key={keyword}
                    type="button"
                    onClick={() => setKeywords((previous) => previous.filter((entry) => entry !== keyword))}
                    className="rounded-full border border-[rgba(168,118,255,0.22)] bg-[rgba(30,16,54,0.7)] px-2 py-1 font-mono text-[10px] text-[#d8c2ff] transition hover:border-[rgba(199,167,255,0.45)]"
                  >
                    {keyword} ×
                  </button>
                ))}
              </div>
              <input
                value={keywordInput}
                onChange={(event) => setKeywordInput(event.target.value)}
                onBlur={flushKeywordInput}
                onKeyDown={(event) => {
                  if (event.key === 'Enter' || event.key === ',') {
                    event.preventDefault();
                    flushKeywordInput();
                    return;
                  }

                  if (event.key === 'Backspace' && !keywordInput && keywords.length > 0) {
                    event.preventDefault();
                    setKeywords((previous) => previous.slice(0, -1));
                  }
                }}
                placeholder={keywords.length >= MAX_KEYWORDS ? 'Max. 5 Keywords erreicht' : 'z. B. pressure, glass, storm'}
                disabled={keywords.length >= MAX_KEYWORDS}
                className="w-full bg-transparent font-mono text-sm text-[#f3eaff] placeholder-[#5c4b78] outline-none disabled:cursor-not-allowed disabled:opacity-60"
              />
            </div>
          </div>
        </div>

        <div className="rounded-[18px] border border-[rgba(168,118,255,0.14)] bg-[rgba(12,14,28,0.78)] p-4 space-y-3">
          <div className="font-mono text-[11px] uppercase tracking-[0.2em] text-[#705d92]">Generator Status</div>
          <div className="space-y-2 font-mono text-[11px] leading-relaxed text-[#8f74c9]">
            <div>Modus: <span className="text-[#f3eaff]">{GENERATION_MODE_STATUS_LABELS[generationMode]}</span></div>
            <div>Keywords: <span className="text-[#c7a7ff]">{keywords.length > 0 ? keywords.join(', ') : 'keine'}</span></div>
            <div>Seed: <span className="text-[#c7a7ff]">{ideaSeed.trim() || 'frischer Lauf ohne expliziten Seed'}</span></div>
          </div>

          <div className="grid grid-cols-3 gap-2">
            {(['ritual', 'satire', 'signal'] as const).map((mode) => (
              <button
                key={mode}
                type="button"
                onClick={() => setGenerationMode(mode)}
                className={`rounded-lg border px-2 py-1.5 font-mono text-[10px] font-semibold transition ${generationMode === mode
                  ? 'border-[rgba(199,167,255,0.5)] bg-[rgba(62,28,96,0.88)] text-[#f3eaff]'
                  : 'border-[rgba(168,118,255,0.2)] bg-[rgba(32,18,56,0.62)] text-[#8f74c9] hover:text-[#d8c2ff]'}`}
              >
                {mode}
              </button>
            ))}
          </div>

          <button
            type="button"
            onClick={() => void handleGenerateIdeas()}
            disabled={isGeneratingIdeas}
            className="flex w-full items-center justify-center gap-2 rounded-xl border border-[rgba(168,118,255,0.24)] bg-[rgba(48,24,78,0.82)] px-4 py-3 font-mono text-[11px] font-semibold text-[#e6d6ff] transition hover:bg-[rgba(62,28,96,0.88)] disabled:cursor-not-allowed disabled:opacity-40"
          >
            {isGeneratingIdeas ? (
              <><Loader2 size={14} className="animate-spin" />Visionen werden gebaut...</>
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
                onUsePrompt={onUsePrompt}
                useAsPrompt={section.useAsPrompt}
              />
            ))}
          </div>

          {ideaPack.visions.length > 0 && (
            <div className="space-y-3">
              <div className="font-mono text-[11px] uppercase tracking-[0.22em] text-[#8f74c9]">Vision Cards</div>
              <div className="grid gap-4 xl:grid-cols-2">
                {ideaPack.visions.map((vision, index) => (
                  <IdeaVisionCard
                    key={`${vision.title}-${index}`}
                    vision={vision}
                    onUsePrompt={onUsePrompt}
                  />
                ))}
              </div>
            </div>
          )}
        </div>
      )}
    </section>
  );
}

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
  onUsePrompt,
  useAsPrompt = false,
}: {
  label: string;
  items: string[];
  onUsePrompt: (value: string) => void;
  useAsPrompt?: boolean;
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
                {useAsPrompt && (
                  <button
                    type="button"
                    onClick={() => onUsePrompt(item)}
                    className="rounded-lg border border-[rgba(114,228,255,0.18)] bg-[rgba(10,26,46,0.72)] px-2 py-1 font-mono text-[10px] font-semibold text-[#72e4ff] transition hover:bg-[rgba(18,38,64,0.82)]"
                  >
                    Als Story Prompt
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
  onUsePrompt,
}: {
  vision: StillframeIdeaVision;
  onUsePrompt: (value: string) => void;
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

  const composedStoryPrompt = [
    vision.title,
    vision.story,
    vision.theme,
    vision.character,
    vision.event,
    vision.action,
    vision.style,
    vision.promptSeed,
  ]
    .map((value) => value.trim())
    .filter((value) => value.length > 0)
    .join('. ');

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
            onClick={() => onUsePrompt(composedStoryPrompt || vision.story || vision.promptSeed)}
            className="rounded-lg border border-[rgba(114,228,255,0.18)] bg-[rgba(10,26,46,0.72)] px-2 py-1 font-mono text-[10px] font-semibold text-[#72e4ff] transition hover:bg-[rgba(18,38,64,0.82)]"
          >
            In Story Composer laden
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
                onClick={() => onUsePrompt(vision.story)}
                className="rounded-lg border border-[rgba(114,228,255,0.18)] bg-[rgba(10,26,46,0.72)] px-2 py-1 font-mono text-[10px] font-semibold text-[#72e4ff] transition hover:bg-[rgba(18,38,64,0.82)]"
              >
                Als Story Prompt
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
                onClick={() => onUsePrompt(vision.promptSeed)}
                className="rounded-lg border border-[rgba(114,228,255,0.18)] bg-[rgba(10,26,46,0.72)] px-2 py-1 font-mono text-[10px] font-semibold text-[#72e4ff] transition hover:bg-[rgba(18,38,64,0.82)]"
              >
                Als Story Prompt
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

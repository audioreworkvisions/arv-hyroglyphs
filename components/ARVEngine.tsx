import React, { useState, useCallback } from 'react';
import {
  Cpu,
  Wand2,
  Film,
  Users,
  Radio,
  RefreshCw,
  Copy,
  ArrowRight,
  Loader2,
  Zap,
  ChevronDown,
  ChevronUp,
  CheckCircle2,
  PlayCircle,
  Brain,
  ThumbsUp,
  ThumbsDown,
  TrendingUp,
  TrendingDown,
} from 'lucide-react';
import { StyleProfile, RATING_LABELS } from '../lib/styleMemory';
import { ARV_CHARACTERS, getCharacter, CHARACTER_COLOR_MAP } from '../lib/arvCharacters';
import {
  generateGifPrompt,
  generateStorySequence,
  expandPromptWithAI,
  generateTransmission,
} from '../lib/arvEngine';
import { AzureUsageEntry } from '../hooks/useAzureUsage';
import { STYLE_TASTE_SHORT_LABEL, type StyleFlexMode } from '../lib/styleTaste';
import {
  ARVGifPrompt,
  ARVStorySequence,
  ARVSatireSketch,
  ARVNarrativePhase,
} from '../lib/arvTypes';

// ─── TYPES ───────────────────────────────────────────────────────────────────────

type ARVSubTab = 'prompts' | 'story' | 'sketch' | 'transmission' | 'characters' | 'memory';

interface ARVEngineProps {
  onUsePrompt: (prompt: string) => void;
  onSendToStoryboard: (board: ARVStorySequence) => void;
  styleProfile?: StyleProfile | null;
  styleMode: StyleFlexMode;
  onAzureUsage?: (entry: Omit<AzureUsageEntry, 'id' | 'timestamp'>) => void;
  embedded?: boolean;
}

type ARVEngineApiPayload = {
  error?: string;
};

const parseApiJsonResponse = async <T extends ARVEngineApiPayload>(response: Response) => {
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
  data: ARVEngineApiPayload | null,
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

// ─── STYLE MEMORY PANEL ───────────────────────────────────────────────────────────

function StyleMemoryPanel({ profile }: { profile: StyleProfile | null }) {
  if (!profile || profile.totalFeedback === 0) {
    return (
      <div className="flex flex-col items-center justify-center py-20 text-stone-600 font-mono text-center">
        <Brain size={48} className="mb-4 opacity-30" />
        <p className="text-sm font-bold">Kein Stil-Profil vorhanden</p>
        <p className="text-xs mt-2 max-w-sm text-stone-700">
          Bewerte deine GIFs und Stories in der Bibliothek (Feedback-Button). Das System lernt deinen Geschmack und
          passt zukünftige Generierungen automatisch an.
        </p>
      </div>
    );
  }

  const { emoji: ratingEmoji } = RATING_LABELS[Math.round(profile.avgRating) as 1|2|3|4|5] ?? RATING_LABELS[3];

  return (
    <div className="space-y-6 font-mono">
      {/* Overview */}
      <div className="grid grid-cols-3 gap-3">
        <div className="bg-zinc-950 border border-zinc-800 rounded-xl p-4 text-center">
          <div className="text-3xl mb-1">{ratingEmoji}</div>
          <div className="text-lg font-bold text-stone-200">{profile.avgRating.toFixed(1)}<span className="text-xs text-stone-600">/5</span></div>
          <div className="text-[10px] text-stone-500 uppercase tracking-widest">Ø Bewertung</div>
        </div>
        <div className="bg-zinc-950 border border-zinc-800 rounded-xl p-4 text-center">
          <div className="text-3xl mb-1 font-bold text-indigo-400">{profile.totalFeedback}</div>
          <div className="text-[10px] text-stone-500 uppercase tracking-widest mt-4">Bewertungen</div>
        </div>
        <div className="bg-zinc-950 border border-zinc-800 rounded-xl p-4 text-center">
          <div className="text-3xl mb-1 font-bold text-emerald-400">{profile.topLikes.length}</div>
          <div className="text-[10px] text-stone-500 uppercase tracking-widest mt-4">Stil-Tags</div>
        </div>
      </div>

      {/* Top Likes */}
      {profile.topLikes.length > 0 && (
        <div className="space-y-2">
          <div className="flex items-center gap-2 text-[10px] text-stone-500 uppercase tracking-widest font-bold">
            <ThumbsUp size={11} className="text-emerald-400" />
            Bevorzugte visuelle Elemente
          </div>
          <div className="flex flex-wrap gap-2">
            {profile.topLikes.map((t) => (
              <span key={t.tag} className="px-2.5 py-1 text-xs rounded-full border border-emerald-700/50 bg-emerald-950/30 text-emerald-300">
                {t.tag} <span className="opacity-50 text-[9px]">·{t.score.toFixed(0)}</span>
              </span>
            ))}
          </div>
        </div>
      )}

      {/* Top Dislikes */}
      {profile.topDislikes.length > 0 && (
        <div className="space-y-2">
          <div className="flex items-center gap-2 text-[10px] text-stone-500 uppercase tracking-widest font-bold">
            <ThumbsDown size={11} className="text-rose-400" />
            Vermeiden
          </div>
          <div className="flex flex-wrap gap-2">
            {profile.topDislikes.map((t) => (
              <span key={t.tag} className="px-2.5 py-1 text-xs rounded-full border border-rose-700/50 bg-rose-950/30 text-rose-300">
                {t.tag}
              </span>
            ))}
          </div>
        </div>
      )}

      {/* Want More */}
      {profile.wantMoreThemes.length > 0 && (
        <div className="space-y-2">
          <div className="flex items-center gap-2 text-[10px] text-stone-500 uppercase tracking-widest font-bold">
            <TrendingUp size={11} className="text-violet-400" />
            Mehr davon (gelernte Richtungen)
          </div>
          <div className="flex flex-wrap gap-2">
            {profile.wantMoreThemes.map((theme) => (
              <span key={theme} className="px-2.5 py-1 text-xs rounded-full border border-violet-700/50 bg-violet-950/30 text-violet-300">
                {theme}
              </span>
            ))}
          </div>
        </div>
      )}

      {/* Want Less */}
      {profile.wantLessThemes.length > 0 && (
        <div className="space-y-2">
          <div className="flex items-center gap-2 text-[10px] text-stone-500 uppercase tracking-widest font-bold">
            <TrendingDown size={11} className="text-amber-400" />
            Weniger davon
          </div>
          <div className="flex flex-wrap gap-2">
            {profile.wantLessThemes.map((theme) => (
              <span key={theme} className="px-2.5 py-1 text-xs rounded-full border border-amber-700/50 bg-amber-950/30 text-amber-300">
                {theme}
              </span>
            ))}
          </div>
        </div>
      )}

      {/* Recent comments */}
      {profile.recentComments.length > 0 && (
        <div className="space-y-2">
          <div className="text-[10px] text-stone-500 uppercase tracking-widest font-bold">Zuletzt notiert</div>
          <div className="space-y-1.5">
            {profile.recentComments.slice(0, 3).map((c, i) => (
              <div key={i} className="bg-zinc-950 border border-zinc-800 rounded-lg px-3 py-2 text-xs text-stone-400 italic">
                &ldquo;{c}&rdquo;
              </div>
            ))}
          </div>
        </div>
      )}

      {/* Prompt context preview */}
      {profile.promptContext && (
        <div className="space-y-2">
          <div className="text-[10px] text-stone-500 uppercase tracking-widest font-bold">Aktiver Prompt-Kontext (wird automatisch injiziert)</div>
          <pre className="bg-zinc-950 border border-zinc-800 rounded-lg px-3 py-2 text-[10px] text-indigo-300 whitespace-pre-wrap leading-relaxed overflow-auto max-h-40">
            {profile.promptContext}
          </pre>
        </div>
      )}

      <div className="text-[9px] text-stone-700 border-t border-zinc-800 pt-3">
        Letzte Aktualisierung: {new Date(profile.lastUpdated).toLocaleString('de-DE')}
      </div>
    </div>
  );
}

// ─── CONSTANTS ───────────────────────────────────────────────────────────────────

const PHASE_OPTIONS: { value: ARVNarrativePhase | ''; label: string; desc: string }[] = [
  { value: '', label: 'Free', desc: 'Alle Phasen' },
  { value: 'emergence', label: 'I · Emergence', desc: 'Erscheinen aus dem Nichts' },
  { value: 'tension', label: 'II · Tension', desc: 'Maschinendruck, Verzerrung' },
  { value: 'expansion', label: 'III · Expansion', desc: 'Kosmische Unterbrechung' },
  { value: 'collapse', label: 'IV · Collapse', desc: 'Rückfaltung, Minimalform' },
];

const PHASE_COLORS: Record<string, string> = {
  emergence: 'text-indigo-400',
  tension: 'text-amber-500',
  expansion: 'text-violet-400',
  collapse: 'text-rose-500',
};

// ─── SMALL COMPONENTS ─────────────────────────────────────────────────────────────

function CopyButton({ text }: { text: string }) {
  const [copied, setCopied] = useState(false);
  const handleCopy = () => {
    navigator.clipboard.writeText(text);
    setCopied(true);
    setTimeout(() => setCopied(false), 1800);
  };
  return (
    <button
      onClick={handleCopy}
      className="flex items-center gap-1.5 px-2.5 py-1.5 rounded-lg bg-zinc-800 hover:bg-zinc-700 text-stone-300 text-xs font-mono font-medium transition-colors"
    >
      {copied ? <CheckCircle2 size={13} className="text-emerald-400" /> : <Copy size={13} />}
      {copied ? 'Kopiert' : 'Kopieren'}
    </button>
  );
}

function CharacterBadge({ characterId, small }: { characterId: string; small?: boolean }) {
  const char = getCharacter(characterId);
  if (!char) return null;
  const colorClass = CHARACTER_COLOR_MAP[char.colorKey] ?? 'text-stone-400 border-stone-700 bg-zinc-900';
  return (
    <span
      className={`inline-flex items-center gap-1 px-2 py-0.5 rounded-full border font-mono text-xs font-bold ${colorClass} ${small ? 'text-[10px]' : ''}`}
    >
      {char.name}
    </span>
  );
}

function MonolithBox({ children, className = '' }: { children: React.ReactNode; className?: string }) {
  return (
    <div
      className={`bg-zinc-950 border border-zinc-800 rounded-xl p-5 font-mono text-sm ${className}`}
    >
      {children}
    </div>
  );
}

// ─── PROMPT PANEL ────────────────────────────────────────────────────────────────

function PromptPanel({ onUsePrompt, onSendToStoryboard, styleMode }: { onUsePrompt: (p: string) => void; onSendToStoryboard: (board: ARVStorySequence) => void; styleMode: StyleFlexMode }) {
  const [selectedChar, setSelectedChar] = useState<string>('');
  const [selectedPhase, setSelectedPhase] = useState<ARVNarrativePhase | ''>('');
  const [current, setCurrent] = useState<ARVGifPrompt | null>(null);
  const [history, setHistory] = useState<ARVGifPrompt[]>([]);
  const [isExpanding, setIsExpanding] = useState(false);
  const [expandError, setExpandError] = useState<string | null>(null);

  const handleGenerate = useCallback(() => {
    const result = generateGifPrompt(selectedChar || undefined, selectedPhase || undefined, styleMode);
    setCurrent(result);
    setHistory((h) => [result, ...h].slice(0, 8));
    setExpandError(null);
  }, [selectedChar, selectedPhase, styleMode]);

  const handleExpand = async () => {
    if (!current) return;
    setIsExpanding(true);
    setExpandError(null);
    try {
      const expanded = await expandPromptWithAI(current.prompt, styleMode);
      setCurrent({ ...current, prompt: expanded });
    } catch (e: any) {
      setExpandError(e.message);
    } finally {
      setIsExpanding(false);
    }
  };

  return (
    <div className="space-y-6">
      {/* Controls */}
      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
        {/* Character */}
        <div className="space-y-2">
          <label className="text-xs font-mono font-bold text-stone-400 uppercase tracking-widest">
            Charakter (optional)
          </label>
          <div className="grid grid-cols-1 gap-1.5">
            {[{ id: '', name: 'Keiner', colorKey: '' }, ...ARV_CHARACTERS].map((c) => {
              const colorClass = c.colorKey
                ? CHARACTER_COLOR_MAP[c.colorKey]
                : 'text-stone-400 border-zinc-700 bg-zinc-900/40';
              return (
                <button
                  key={c.id}
                  onClick={() => setSelectedChar(c.id)}
                  className={`px-3 py-2 text-left rounded-lg border transition-all text-xs font-mono ${
                    selectedChar === c.id
                      ? `${colorClass} ring-1 ring-current`
                      : 'border-zinc-800 bg-zinc-900 text-stone-500 hover:border-zinc-700 hover:text-stone-300'
                  }`}
                >
                  <span className="font-bold">{c.name}</span>
                  {'designation' in c && (
                    <span className="ml-2 opacity-50 text-[10px]">{c.designation.split('·')[0]}</span>
                  )}
                </button>
              );
            })}
          </div>
        </div>

        {/* Phase */}
        <div className="space-y-2">
          <label className="text-xs font-mono font-bold text-stone-400 uppercase tracking-widest">
            Narrative Phase (optional)
          </label>
          <div className="space-y-1.5">
            {PHASE_OPTIONS.map((p) => (
              <button
                key={p.value}
                onClick={() => setSelectedPhase(p.value as ARVNarrativePhase | '')}
                className={`w-full px-3 py-2 text-left rounded-lg border transition-all text-xs font-mono ${
                  selectedPhase === p.value
                    ? `border-zinc-600 bg-zinc-800 ${p.value ? PHASE_COLORS[p.value] : 'text-stone-300'}`
                    : 'border-zinc-800 bg-zinc-900 text-stone-500 hover:border-zinc-700 hover:text-stone-300'
                }`}
              >
                <span className="font-bold">{p.label}</span>
                <span className="ml-2 opacity-50">{p.desc}</span>
              </button>
            ))}
          </div>

          <button
            onClick={handleGenerate}
            className="w-full mt-4 py-3 px-4 rounded-xl bg-indigo-600 hover:bg-indigo-500 text-white font-bold font-mono text-sm transition-colors flex items-center justify-center gap-2"
          >
            <Wand2 size={16} />
            GENERATE PROMPT
          </button>
        </div>
      </div>

      {/* Generated Prompt */}
      {current && (
        <MonolithBox>
          <div className="space-y-4">
            <div className="flex items-center justify-between gap-2 flex-wrap">
              <div className="flex items-center gap-2 flex-wrap">
                {current.characterId && <CharacterBadge characterId={current.characterId} />}
                {current.phase && (
                  <span className={`text-xs font-bold ${PHASE_COLORS[current.phase]}`}>
                    {current.phase.toUpperCase()}
                  </span>
                )}
                {current.tags
                  .filter((t) => !['no-character', 'free', 'unphased', current.phase, current.characterId].includes(t))
                  .slice(0, 1)
                  .map((tag) => (
                    <span key={tag} className="text-[10px] text-stone-500 font-mono uppercase tracking-wider">
                      [{tag}]
                    </span>
                  ))}
              </div>
              <div className="flex items-center gap-2">
                <CopyButton text={current.prompt} />
                <button
                  onClick={handleGenerate}
                  className="p-1.5 rounded-lg bg-zinc-800 hover:bg-zinc-700 text-stone-400 transition-colors"
                  title="Neu generieren"
                >
                  <RefreshCw size={13} />
                </button>
              </div>
            </div>

            <p className="text-stone-200 leading-relaxed text-sm">{current.prompt}</p>

            <div className="pt-2 border-t border-zinc-800 text-[10px] text-stone-600 font-mono">
              {current.styleNote}
            </div>

            {/* Actions */}
            <div className="flex items-center gap-2 flex-wrap pt-1">
              <button
                onClick={() => onUsePrompt(current.prompt)}
                className="flex items-center gap-1.5 px-3 py-2 rounded-lg bg-indigo-600/20 hover:bg-indigo-600/40 border border-indigo-500/30 text-indigo-300 text-xs font-mono font-bold transition-colors"
              >
                <ArrowRight size={13} />
                In Stillframe senden
              </button>
              <button
                onClick={handleExpand}
                disabled={isExpanding}
                className="flex items-center gap-1.5 px-3 py-2 rounded-lg bg-zinc-800 hover:bg-zinc-700 text-stone-300 text-xs font-mono font-medium transition-colors disabled:opacity-50"
              >
                {isExpanding ? (
                  <Loader2 size={13} className="animate-spin" />
                ) : (
                  <Zap size={13} />
                )}
                Mit AI erweitern
              </button>
              <button
                onClick={() => {
                  const board = generateStorySequence(current.prompt, selectedChar || undefined, styleMode);
                  onSendToStoryboard(board);
                }}
                className="flex items-center gap-1.5 px-3 py-2 rounded-lg bg-violet-600/20 hover:bg-violet-600/40 border border-violet-500/30 text-violet-300 text-xs font-mono font-bold transition-colors"
              >
                <PlayCircle size={13} />
                Als Story Board (4 Szenen)
              </button>
            </div>
            {expandError && (
              <p className="text-xs text-rose-400 font-mono">{expandError}</p>
            )}
          </div>
        </MonolithBox>
      )}

      {/* History */}
      {history.length > 1 && (
        <div className="space-y-2">
          <h4 className="text-xs font-mono font-bold text-stone-500 uppercase tracking-widest">
            Verlauf
          </h4>
          <div className="grid grid-cols-1 gap-2">
            {history.slice(1).map((item) => (
              <div
                key={item.id}
                className="bg-zinc-950 border border-zinc-800/50 rounded-lg px-4 py-3 flex items-start justify-between gap-3"
              >
                <p className="text-xs text-stone-400 font-mono line-clamp-2 flex-1">
                  {item.prompt.substring(0, 120)}…
                </p>
                <div className="flex items-center gap-1.5 shrink-0">
                  <CopyButton text={item.prompt} />
                  <button
                    onClick={() => onUsePrompt(item.prompt)}
                    className="p-1.5 rounded bg-zinc-800 hover:bg-zinc-700 text-stone-400 hover:text-indigo-300 transition-colors"
                    title="An Stillframe senden"
                  >
                    <ArrowRight size={12} />
                  </button>
                </div>
              </div>
            ))}
          </div>
        </div>
      )}
    </div>
  );
}

// ─── STORY PANEL ──────────────────────────────────────────────────────────────────

function StoryPanel({ onUsePrompt, onSendToStoryboard, styleMode }: { onUsePrompt: (p: string) => void; onSendToStoryboard: (board: ARVStorySequence) => void; styleMode: StyleFlexMode }) {
  const [concept, setConcept] = useState('');
  const [selectedChar, setSelectedChar] = useState<string>('');
  const [story, setStory] = useState<ARVStorySequence | null>(null);
  const [expandedScene, setExpandedScene] = useState<number | null>(null);

  const CONCEPT_EXAMPLES = [
    'Bürokratische Unendlichkeit',
    'Der letzte Statusbericht',
    'Kosmische Gleichgültigkeit',
    'Algorithmus ohne Aufgabe',
    'Das Archiv brennt',
    'Signal ohne Empfänger',
    'Formular B-9 (nicht vorhanden)',
    'Kollaps, Phase 1 von 1',
  ];

  const handleGenerate = () => {
    if (!concept.trim()) return;
    const result = generateStorySequence(concept.trim(), selectedChar || undefined, styleMode);
    setStory(result);
    setExpandedScene(null);
  };

  return (
    <div className="space-y-6">
      {/* Controls */}
      <div className="space-y-4">
        <div className="space-y-2">
          <label className="text-xs font-mono font-bold text-stone-400 uppercase tracking-widest">
            Konzept / Thema
          </label>
          <input
            type="text"
            value={concept}
            onChange={(e) => setConcept(e.target.value)}
            onKeyDown={(e) => e.key === 'Enter' && handleGenerate()}
            placeholder="Bürokratische Unendlichkeit..."
            className="w-full px-4 py-3 rounded-xl border border-zinc-800 bg-zinc-950 text-stone-200 font-mono text-sm placeholder-stone-600 focus:ring-2 focus:ring-indigo-500/50 focus:border-indigo-500/50 outline-none transition-all"
          />
          <div className="flex flex-wrap gap-1.5">
            {CONCEPT_EXAMPLES.map((ex) => (
              <button
                key={ex}
                onClick={() => setConcept(ex)}
                className="px-2.5 py-1 text-[10px] font-mono rounded-full bg-zinc-900 border border-zinc-800 text-stone-400 hover:text-stone-200 hover:border-zinc-600 transition-colors"
              >
                {ex}
              </button>
            ))}
          </div>
        </div>

        <div className="space-y-2">
          <label className="text-xs font-mono font-bold text-stone-400 uppercase tracking-widest">
            Charakter-Stimme (optional)
          </label>
          <div className="flex flex-wrap gap-2">
            <button
              onClick={() => setSelectedChar('')}
              className={`px-3 py-1.5 rounded-lg border text-xs font-mono transition-all ${
                selectedChar === ''
                  ? 'border-zinc-600 bg-zinc-800 text-stone-300'
                  : 'border-zinc-800 bg-zinc-900 text-stone-500 hover:border-zinc-700'
              }`}
            >
              Kein Charakter
            </button>
            {ARV_CHARACTERS.map((c) => {
              const colorClass = CHARACTER_COLOR_MAP[c.colorKey];
              return (
                <button
                  key={c.id}
                  onClick={() => setSelectedChar(c.id)}
                  className={`px-3 py-1.5 rounded-lg border text-xs font-mono font-bold transition-all ${
                    selectedChar === c.id
                      ? `${colorClass} ring-1 ring-current`
                      : 'border-zinc-800 bg-zinc-900 text-stone-500 hover:border-zinc-700 hover:text-stone-300'
                  }`}
                >
                  {c.name}
                </button>
              );
            })}
          </div>
        </div>

        <button
          onClick={handleGenerate}
          disabled={!concept.trim()}
          className="flex items-center gap-2 px-5 py-3 rounded-xl bg-indigo-600 hover:bg-indigo-500 disabled:bg-zinc-800 disabled:text-stone-600 text-white font-bold font-mono text-sm transition-colors"
        >
          <Film size={16} />
          STORY GENERIEREN
        </button>
      </div>

      {/* Story Output */}
      {story && (
        <div className="space-y-4">
          <MonolithBox>
            <div className="space-y-3">
              <div className="space-y-1">
                <div className="text-[10px] text-stone-500 font-mono uppercase tracking-widest">
                  ARV Story Sequence
                </div>
                <h3 className="text-lg font-bold text-stone-100 font-mono">{story.title}</h3>
                {story.characterId && (
                  <div className="pt-1">
                    <CharacterBadge characterId={story.characterId} />
                  </div>
                )}
              </div>
              <button
                onClick={() => onSendToStoryboard(story)}
                className="flex items-center gap-2 px-4 py-2.5 rounded-xl bg-violet-600 hover:bg-violet-500 text-white font-bold font-mono text-sm transition-colors w-full justify-center"
              >
                <PlayCircle size={15} />
                → Story Mode: Alle 4 GIFs generieren &amp; als ZIP laden
              </button>
            </div>
          </MonolithBox>

          {story.scenes.map((scene, i) => {
            const phaseColor = PHASE_COLORS[scene.phase] ?? 'text-stone-400';
            const isOpen = expandedScene === i;
            return (
              <div
                key={i}
                className="bg-zinc-950 border border-zinc-800 rounded-xl overflow-hidden"
              >
                {/* Scene Header */}
                <button
                  onClick={() => setExpandedScene(isOpen ? null : i)}
                  className="w-full flex items-center justify-between gap-3 px-5 py-4 text-left hover:bg-zinc-900/50 transition-colors"
                >
                  <div className="flex items-center gap-3">
                    <span className={`text-xs font-mono font-bold ${phaseColor}`}>
                      {scene.phase.toUpperCase()} {scene.sceneNumber}
                    </span>
                    <span className="text-sm font-mono font-bold text-stone-300">
                      {scene.title}
                    </span>
                  </div>
                  {isOpen ? (
                    <ChevronUp size={14} className="text-stone-500" />
                  ) : (
                    <ChevronDown size={14} className="text-stone-500" />
                  )}
                </button>

                {isOpen && (
                  <div className="px-5 pb-5 space-y-4 border-t border-zinc-800/50">
                    {/* Narration */}
                    <p className="text-xs text-stone-500 font-mono italic pt-3">{scene.narration}</p>

                    {/* Prompt */}
                    <div className="space-y-2">
                      <div className="text-[10px] text-stone-600 font-mono uppercase tracking-widest">
                        GIF Prompt
                      </div>
                      <p className="text-sm text-stone-200 font-mono leading-relaxed">
                        {scene.prompt}
                      </p>
                    </div>

                    <div className="flex items-center gap-2 pt-1">
                      <CopyButton text={scene.prompt} />
                      <button
                        onClick={() => onUsePrompt(scene.prompt)}
                        className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-indigo-600/20 hover:bg-indigo-600/40 border border-indigo-500/30 text-indigo-300 text-xs font-mono font-bold transition-colors"
                      >
                        <ArrowRight size={12} />
                        In Stillframe
                      </button>
                    </div>
                  </div>
                )}
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
}

// ─── SKETCH PANEL ─────────────────────────────────────────────────────────────────

function SketchPanel({
  onSendToStoryboard,
  onAzureUsage,
  styleMode,
}: {
  onSendToStoryboard: (board: ARVStorySequence) => void;
  onAzureUsage?: (entry: Omit<AzureUsageEntry, 'id' | 'timestamp'>) => void;
  styleMode: StyleFlexMode;
}) {
  const [char1, setChar1] = useState(ARV_CHARACTERS[0].id);
  const [char2, setChar2] = useState(ARV_CHARACTERS[2].id);
  const [sketch, setSketch] = useState<ARVSatireSketch | null>(null);
  const [isGeneratingSketch, setIsGeneratingSketch] = useState(false);
  const [sketchError, setSketchError] = useState<string | null>(null);

  const handleGenerate = useCallback(async () => {
    setIsGeneratingSketch(true);
    setSketchError(null);

    try {
      const response = await fetch('/api/foundry/sketch', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          characterIds: [char1, char2],
          currentSketch: sketch,
          variationSeed: `${Date.now()}-${Math.random().toString(36).slice(2, 8)}`,
        }),
      });

      const { data, rawText } = await parseApiJsonResponse<{
        sketch?: ARVSatireSketch;
        model?: string;
        usage?: { promptTokens?: number; completionTokens?: number; totalTokens?: number };
        error?: string;
      }>(response);

      if (!response.ok) {
        throw new Error(
          buildApiErrorMessage(
            response,
            data,
            rawText,
            'Azure Sketch Model konnte den Sketch nicht neu schreiben.',
          ),
        );
      }

      if (!data?.sketch) {
        throw new Error(
          buildApiErrorMessage(
            response,
            data ?? null,
            rawText,
            'Azure Sketch Model lieferte keinen gueltigen Sketch zurueck.',
          ),
        );
      }

      setSketch(data.sketch);

      if (data.usage && onAzureUsage) {
        onAzureUsage({
          type: 'text',
          model: data.model || 'foundry',
          promptTokens: data.usage.promptTokens,
          completionTokens: data.usage.completionTokens,
          totalTokens: data.usage.totalTokens,
        });
      }
    } catch (error) {
      setSketchError(error instanceof Error ? error.message : 'Azure Sketch Model fehlgeschlagen.');
    } finally {
      setIsGeneratingSketch(false);
    }
  }, [char1, char2, onAzureUsage, sketch]);

  const buildSketchStoryboard = (sk: ARVSatireSketch): ARVStorySequence => {
    const half = Math.ceil(sk.dialogue.length / 2);
    return {
      id: `arv-sketch-sb-${Date.now()}`,
      title: sk.title,
      concept: `${sk.satireTarget} · ${sk.setting}`,
      scenes: [
        { phase: 'emergence', sceneNumber: 1, title: 'Exposition',
          prompt: generateGifPrompt(char1, 'emergence', styleMode).prompt,
          narration: sk.setting },
        { phase: 'tension', sceneNumber: 2, title: 'Erste Konfrontation',
          prompt: generateGifPrompt(char1, 'tension', styleMode).prompt,
          narration: sk.dialogue.slice(0, half).map(l => `${getCharacter(l.characterId)?.name ?? l.characterId}: ${l.line.slice(0, 60)}`).join(' / ') },
        { phase: 'expansion', sceneNumber: 3, title: 'Eskalation',
          prompt: generateGifPrompt(char2, 'expansion', styleMode).prompt,
          narration: sk.dialogue.slice(half).map(l => `${getCharacter(l.characterId)?.name ?? l.characterId}: ${l.line.slice(0, 60)}`).join(' / ') },
        { phase: 'collapse', sceneNumber: 4, title: 'Nicht-Auflösung',
          prompt: generateGifPrompt(char2, 'collapse', styleMode).prompt,
          narration: sk.conclusion },
      ],
      createdAt: Date.now(),
    };
  };

  return (
    <div className="space-y-6">
      {/* Controls */}
      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
        {(['Charakter 1', 'Charakter 2'] as const).map((label, idx) => {
          const current = idx === 0 ? char1 : char2;
          const setter = idx === 0 ? setChar1 : setChar2;
          return (
            <div key={label} className="space-y-2">
              <label className="text-xs font-mono font-bold text-stone-400 uppercase tracking-widest">
                {label}
              </label>
              <div className="space-y-1.5">
                {ARV_CHARACTERS.map((c) => {
                  const colorClass = CHARACTER_COLOR_MAP[c.colorKey];
                  return (
                    <button
                      key={c.id}
                      onClick={() => setter(c.id)}
                      className={`w-full px-3 py-2 text-left rounded-lg border transition-all text-xs font-mono ${
                        current === c.id
                          ? `${colorClass} ring-1 ring-current`
                          : 'border-zinc-800 bg-zinc-900 text-stone-500 hover:border-zinc-700 hover:text-stone-300'
                      }`}
                    >
                      <span className="font-bold">{c.name}</span>
                      <span className="ml-2 opacity-40 text-[10px]">{c.designation.split('·')[0]}</span>
                    </button>
                  );
                })}
              </div>
            </div>
          );
        })}
      </div>

      <button
        onClick={handleGenerate}
        disabled={isGeneratingSketch}
        className="flex items-center gap-2 px-5 py-3 rounded-xl bg-indigo-600 hover:bg-indigo-500 disabled:bg-indigo-900/60 disabled:text-indigo-200/70 disabled:cursor-not-allowed text-white font-bold font-mono text-sm transition-colors"
      >
        {isGeneratingSketch ? <Loader2 size={16} className="animate-spin" /> : <Cpu size={16} />}
        {isGeneratingSketch ? 'SKETCH WIRD MIT AZURE GESCHRIEBEN...' : 'SKETCH MIT AZURE GENERIEREN'}
      </button>

      {sketchError && (
        <p className="text-xs text-rose-400 font-mono">{sketchError}</p>
      )}

      {/* Sketch Output */}
      {sketch && (
        <MonolithBox className="space-y-5">
          {/* Title */}
          <div className="space-y-1">
            <div className="text-[10px] text-stone-600 uppercase tracking-widest font-mono">
              ARV Satire Sketch
            </div>
            <h3 className="text-base font-bold text-stone-100 font-mono">{sketch.title}</h3>
            <div className="text-xs text-rose-400 font-mono">SATIRE-ZIEL: {sketch.satireTarget}</div>
          </div>

          {/* Setting */}
          <div className="border-l-2 border-zinc-700 pl-4">
            <div className="text-[10px] text-stone-600 uppercase tracking-widest font-mono mb-1">
              Ort / Situation
            </div>
            <p className="text-xs text-stone-400 font-mono italic">{sketch.setting}</p>
          </div>

          {/* Dialogue */}
          <div className="space-y-3">
            <div className="text-[10px] text-stone-600 uppercase tracking-widest font-mono">
              Dialog
            </div>
            {sketch.dialogue.map((line, i) => {
              const char = getCharacter(line.characterId);
              const colorClass = char ? CHARACTER_COLOR_MAP[char.colorKey] : '';
              return (
                <div key={i} className="space-y-0.5">
                  <div
                    className={`text-[10px] font-bold font-mono uppercase tracking-widest ${
                      colorClass.split(' ')[0]
                    }`}
                  >
                    {char?.name ?? line.characterId}
                  </div>
                  <p className="text-sm text-stone-200 font-mono leading-relaxed pl-3 border-l border-zinc-800">
                    {line.line}
                  </p>
                </div>
              );
            })}
          </div>

          {/* Conclusion */}
          <div className="pt-3 border-t border-zinc-800">
            <div className="text-[10px] text-stone-600 uppercase tracking-widest font-mono mb-2">
              Abschluss
            </div>
            <p className="text-xs text-stone-400 font-mono italic">{sketch.conclusion}</p>
          </div>

          <div className="flex items-center gap-2 pt-1 flex-wrap">
            <CopyButton
              text={[
                `=== ${sketch.title} ===`,
                `Satire-Ziel: ${sketch.satireTarget}`,
                '',
                `[Ort: ${sketch.setting}]`,
                '',
                ...sketch.dialogue.map((l) => {
                  const c = getCharacter(l.characterId);
                  return `${c?.name ?? l.characterId}:\n  ${l.line}`;
                }),
                '',
                `[${sketch.conclusion}]`,
              ].join('\n')}
            />
            <button
              onClick={handleGenerate}
              disabled={isGeneratingSketch}
              className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-zinc-800 hover:bg-zinc-700 disabled:bg-zinc-900 disabled:text-stone-500 disabled:cursor-not-allowed text-stone-300 text-xs font-mono transition-colors"
            >
              {isGeneratingSketch ? <Loader2 size={12} className="animate-spin" /> : <RefreshCw size={12} />}
              {isGeneratingSketch ? 'Azure schreibt neu…' : 'Sketch mit Azure neu schreiben'}
            </button>
            <button
              onClick={() => onSendToStoryboard(buildSketchStoryboard(sketch))}
              className="flex items-center gap-1.5 px-3 py-2 rounded-lg bg-violet-600/20 hover:bg-violet-600/40 border border-violet-500/30 text-violet-300 text-xs font-mono font-bold transition-colors"
            >
              <PlayCircle size={13} />
              → Story Board (4 GIF-Szenen)
            </button>
          </div>
        </MonolithBox>
      )}
    </div>
  );
}

// ─── TRANSMISSION PANEL ───────────────────────────────────────────────────────────

function TransmissionPanel({ onSendToStoryboard, styleMode }: { onSendToStoryboard: (board: ARVStorySequence) => void; styleMode: StyleFlexMode }) {
  const [selectedChar, setSelectedChar] = useState(ARV_CHARACTERS[0].id);
  const [topic, setTopic] = useState('');
  const [transmission, setTransmission] = useState<string>('');  const PHASE_TITLES: Record<string, string> = {
    emergence: 'Signal-Initiierung',
    tension: 'Druck-Aufbau',
    expansion: 'Kosmische Ausweitung',
    collapse: 'Finales Echo',
  };

  const TOPIC_SEEDS = [
    'Bürokratie', 'Kosmische Irrelevanz', 'Historische Wiederholung',
    'Optimismus als Fehler', 'Das ausstehende Ticket', 'Entropie',
    'Signal ohne Empfänger', 'Kollaps (geplant)', 'Formular B-9',
  ];

  const handleGenerate = () => {
    const result = generateTransmission(selectedChar, topic.trim() || undefined);
    setTransmission(result);
  };

  const char = getCharacter(selectedChar);
  const colorClass = char ? CHARACTER_COLOR_MAP[char.colorKey].split(' ')[0] : 'text-stone-400';

  return (
    <div className="space-y-6">
      <div className="space-y-4">
        <div className="space-y-2">
          <label className="text-xs font-mono font-bold text-stone-400 uppercase tracking-widest">
            Charakter-Stimme
          </label>
          <div className="grid grid-cols-2 md:grid-cols-3 gap-2">
            {ARV_CHARACTERS.map((c) => {
              const cc = CHARACTER_COLOR_MAP[c.colorKey];
              return (
                <button
                  key={c.id}
                  onClick={() => setSelectedChar(c.id)}
                  className={`px-3 py-2.5 text-left rounded-lg border text-xs font-mono font-bold transition-all ${
                    selectedChar === c.id
                      ? `${cc} ring-1 ring-current`
                      : 'border-zinc-800 bg-zinc-900 text-stone-500 hover:border-zinc-700 hover:text-stone-300'
                  }`}
                >
                  {c.name}
                  <div className="text-[9px] opacity-50 font-normal mt-0.5 truncate">
                    {c.emotionalRegister.split('.')[0]}
                  </div>
                </button>
              );
            })}
          </div>
        </div>

        <div className="space-y-2">
          <label className="text-xs font-mono font-bold text-stone-400 uppercase tracking-widest">
            Thema (optional)
          </label>
          <input
            type="text"
            value={topic}
            onChange={(e) => setTopic(e.target.value)}
            placeholder="Leer lassen für zufälliges Thema..."
            className="w-full px-4 py-2.5 rounded-xl border border-zinc-800 bg-zinc-950 text-stone-200 font-mono text-sm placeholder-stone-600 focus:ring-2 focus:ring-indigo-500/50 outline-none transition-all"
          />
          <div className="flex flex-wrap gap-1.5">
            {TOPIC_SEEDS.map((t) => (
              <button
                key={t}
                onClick={() => setTopic(t)}
                className="px-2.5 py-1 text-[10px] font-mono rounded-full bg-zinc-900 border border-zinc-800 text-stone-400 hover:text-stone-200 hover:border-zinc-600 transition-colors"
              >
                {t}
              </button>
            ))}
          </div>
        </div>

        <button
          onClick={handleGenerate}
          className="flex items-center gap-2 px-5 py-3 rounded-xl bg-indigo-600 hover:bg-indigo-500 text-white font-bold font-mono text-sm transition-colors"
        >
          <Radio size={16} />
          TRANSMISSION SENDEN
        </button>
      </div>

      {transmission && (
        <MonolithBox>
          <div className="space-y-3">
            {char && (
              <CharacterBadge characterId={char.id} />
            )}
            <pre className={`whitespace-pre-wrap text-sm font-mono leading-relaxed ${colorClass}`}>
              {transmission}
            </pre>
            <div className="pt-2 border-t border-zinc-800 flex items-center gap-2 flex-wrap">
              <CopyButton text={transmission} />
              <button
                onClick={handleGenerate}
                className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-zinc-800 hover:bg-zinc-700 text-stone-300 text-xs font-mono transition-colors"
              >
                <RefreshCw size={12} />
                Neu
              </button>
              <button
                onClick={() => {
                  const board: ARVStorySequence = {
                    id: `arv-tx-sb-${Date.now()}`,
                    title: `${char?.name ?? selectedChar}: ${topic.trim() || 'Transmission'}`,
                    concept: topic.trim() || 'Charakter-Transmission',
                    characterId: selectedChar,
                    scenes: (['emergence', 'tension', 'expansion', 'collapse'] as const).map((phase, i) => ({
                      phase,
                      sceneNumber: i + 1,
                      title: PHASE_TITLES[phase],
                      prompt: generateGifPrompt(selectedChar, phase, styleMode).prompt,
                      narration: `[${char?.name ?? selectedChar} sendet: ${topic.trim() || 'unbekanntes Signal'} · Phase ${i + 1} von 4]`,
                    })),
                    createdAt: Date.now(),
                  };
                  onSendToStoryboard(board);
                }}
                className="flex items-center gap-1.5 px-3 py-2 rounded-lg bg-violet-600/20 hover:bg-violet-600/40 border border-violet-500/30 text-violet-300 text-xs font-mono font-bold transition-colors"
              >
                <PlayCircle size={13} />
                → Story Board (4 GIF-Szenen)
              </button>
            </div>
          </div>
        </MonolithBox>
      )}
    </div>
  );
}

// ─── CHARACTERS PANEL ─────────────────────────────────────────────────────────────

function CharactersPanel() {
  const [openId, setOpenId] = useState<string | null>(null);

  return (
    <div className="space-y-3">
      {ARV_CHARACTERS.map((char) => {
        const colorClass = CHARACTER_COLOR_MAP[char.colorKey];
        const isOpen = openId === char.id;
        return (
          <div
            key={char.id}
            className={`bg-zinc-950 border rounded-xl overflow-hidden transition-colors ${
              isOpen ? `border-${char.colorKey}-500/30` : 'border-zinc-800'
            }`}
          >
            <button
              onClick={() => setOpenId(isOpen ? null : char.id)}
              className="w-full flex items-center justify-between gap-3 px-5 py-4 text-left hover:bg-zinc-900/40 transition-colors"
            >
              <div className="flex items-center gap-3">
                <span className={`font-mono font-bold text-sm ${colorClass.split(' ')[0]}`}>
                  {char.name}
                </span>
                <span className="text-[10px] text-stone-500 font-mono hidden sm:block">
                  {char.designation.split('·')[0].trim()}
                </span>
              </div>
              {isOpen ? (
                <ChevronUp size={14} className="text-stone-500 shrink-0" />
              ) : (
                <ChevronDown size={14} className="text-stone-500 shrink-0" />
              )}
            </button>

            {isOpen && (
              <div className="px-5 pb-5 space-y-4 border-t border-zinc-800/50">
                <div className="pt-3 text-[10px] text-stone-500 font-mono">{char.designation}</div>

                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                  <div className="space-y-1">
                    <div className="text-[10px] text-stone-600 font-mono uppercase tracking-widest">Stimme</div>
                    <p className="text-xs text-stone-300 font-mono">{char.voice}</p>
                  </div>
                  <div className="space-y-1">
                    <div className="text-[10px] text-stone-600 font-mono uppercase tracking-widest">Satire-Ziel</div>
                    <p className="text-xs text-stone-300 font-mono">{char.satireTarget}</p>
                  </div>
                  <div className="space-y-1">
                    <div className="text-[10px] text-stone-600 font-mono uppercase tracking-widest">Übertragungsstil</div>
                    <p className="text-xs text-stone-300 font-mono">{char.transmissionStyle}</p>
                  </div>
                  <div className="space-y-1">
                    <div className="text-[10px] text-stone-600 font-mono uppercase tracking-widest">Emotionale Frequenz</div>
                    <p className="text-xs text-stone-300 font-mono">{char.emotionalRegister}</p>
                  </div>
                </div>

                <div className="space-y-2">
                  <div className="text-[10px] text-stone-600 font-mono uppercase tracking-widest">Vokabular</div>
                  <div className="flex flex-wrap gap-1.5">
                    {char.vocabulary.map((v) => (
                      <span
                        key={v}
                        className={`px-2 py-0.5 text-[10px] font-mono rounded border ${colorClass}`}
                      >
                        {v}
                      </span>
                    ))}
                  </div>
                </div>

                <div className="space-y-2">
                  <div className="text-[10px] text-stone-600 font-mono uppercase tracking-widest">Verhaltensregeln</div>
                  <ul className="space-y-1">
                    {char.behaviorRules.map((rule, i) => (
                      <li key={i} className="text-xs text-stone-400 font-mono flex gap-2">
                        <span className={`shrink-0 ${colorClass.split(' ')[0]}`}>→</span>
                        {rule}
                      </li>
                    ))}
                  </ul>
                </div>
              </div>
            )}
          </div>
        );
      })}
    </div>
  );
}

// ─── MAIN ARV ENGINE COMPONENT ───────────────────────────────────────────────────

export default function ARVEngine({ onUsePrompt, onSendToStoryboard, styleProfile, styleMode, onAzureUsage, embedded = false }: ARVEngineProps) {
  const [activeTab, setActiveTab] = useState<ARVSubTab>(embedded ? 'story' : 'prompts');

  const tabs: { id: ARVSubTab; label: string; icon: React.ReactNode; desc: string }[] = [
    { id: 'prompts', label: 'GIF Prompts', icon: <Wand2 size={15} />, desc: 'ARV Visual Generator' },
    { id: 'story', label: 'Story Engine', icon: <Film size={15} />, desc: '4-Phasen Sequenz' },
    { id: 'sketch', label: 'Satire Sketch', icon: <Cpu size={15} />, desc: 'Monty-Python-Modus' },
    { id: 'transmission', label: 'Transmission', icon: <Radio size={15} />, desc: 'Charakter-Monolog' },
    { id: 'characters', label: 'Charaktere', icon: <Users size={15} />, desc: 'ARV-Universum' },
    { id: 'memory', label: 'Style Memory', icon: <Brain size={15} />, desc: 'Gelernter Geschmack' },
  ];

  return (
    <div className={embedded ? 'space-y-6' : 'space-y-8'}>
      {/* Header */}
      {!embedded && (
        <div className="space-y-1">
          <div className="flex items-center gap-2">
            <Cpu size={20} className="text-indigo-400" />
            <h2 className="text-3xl font-bold tracking-tight font-mono">ARV ENGINE</h2>
          </div>
          <p className="text-stone-500 dark:text-stone-400 font-mono text-sm">
            Automatischer GIF-Stil- & Story-Generator · Satire-Charakter-Engine · Transmissions-System
          </p>
          <div className="text-[10px] font-mono text-stone-600 pt-1 space-x-4">
            <span className="text-indigo-400">■</span> ARV_GIF_STYLE: {STYLE_TASTE_SHORT_LABEL}
            <span className="ml-4 text-rose-400">■</span> ARV_SATIRE: dry · absurd · logical · machine-like
          </div>
        </div>
      )}

      {/* Sub-Tabs */}
      <div className="flex flex-wrap gap-2">
        {tabs.map((tab) => (
          <button
            key={tab.id}
            onClick={() => setActiveTab(tab.id)}
            className={`flex items-center gap-2 px-4 py-2.5 rounded-xl font-mono text-sm font-bold transition-all ${
              activeTab === tab.id
                ? 'bg-zinc-900 text-indigo-400 border border-indigo-500/40 shadow-sm'
                : 'text-stone-500 border border-transparent hover:text-stone-300 hover:border-zinc-700'
            }`}
          >
            {tab.icon}
            <span>{tab.label}</span>
            {activeTab === tab.id && (
              <span className="text-[9px] text-stone-500 font-normal hidden sm:block">
                · {tab.desc}
              </span>
            )}
          </button>
        ))}
      </div>

      {/* Panel */}
      <div>
        {activeTab === 'prompts' && <PromptPanel onUsePrompt={onUsePrompt} onSendToStoryboard={onSendToStoryboard} styleMode={styleMode} />}
        {activeTab === 'story' && <StoryPanel onUsePrompt={onUsePrompt} onSendToStoryboard={onSendToStoryboard} styleMode={styleMode} />}
        {activeTab === 'sketch' && <SketchPanel onSendToStoryboard={onSendToStoryboard} onAzureUsage={onAzureUsage} styleMode={styleMode} />}
        {activeTab === 'transmission' && <TransmissionPanel onSendToStoryboard={onSendToStoryboard} styleMode={styleMode} />}
        {activeTab === 'characters' && <CharactersPanel />}
        {activeTab === 'memory' && <StyleMemoryPanel profile={styleProfile ?? null} />}
      </div>
    </div>
  );
}

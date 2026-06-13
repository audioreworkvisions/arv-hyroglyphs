import React from 'react';
import { Lightbulb, Sparkles } from 'lucide-react';
import type { ThumbnailConcept } from '../../lib/thumbnailTypes';
import CopyButton from './CopyButton';

interface ThumbnailConceptPanelProps {
  concept: ThumbnailConcept | null;
}

const cardClass = 'space-y-2 rounded-xl border border-zinc-800 bg-zinc-950/60 p-4';
const headingClass = 'text-[11px] font-semibold uppercase tracking-[0.16em] text-zinc-500';
const SEO_KEYWORD_MAX_LENGTH = 400;

const buildSeoKeywordLine = (keywords: string[]): string => {
  const cleanKeywords = keywords
    .map((keyword) => keyword.trim())
    .filter((keyword) => keyword.length > 0);
  const line = cleanKeywords.join(', ');
  if (line.length <= SEO_KEYWORD_MAX_LENGTH) {
    return line;
  }

  const parts: string[] = [];
  for (const keyword of cleanKeywords) {
    const candidate = [...parts, keyword].join(', ');
    if (candidate.length > SEO_KEYWORD_MAX_LENGTH) {
      break;
    }
    parts.push(keyword);
  }

  return parts.join(', ');
};

function ChipList({ items, tone = 'cyan' }: { items: string[]; tone?: 'cyan' | 'amber' | 'zinc' }) {
  const toneClass =
    tone === 'amber'
      ? 'border-amber-800 bg-amber-950/40 text-amber-300'
      : tone === 'zinc'
        ? 'border-zinc-700 bg-zinc-900 text-zinc-300'
        : 'border-cyan-800 bg-cyan-950/40 text-cyan-300';
  return (
    <div className="flex flex-wrap gap-1.5">
      {items.map((item, index) => (
        <span key={`${item}-${index}`} className={`rounded-full border px-2.5 py-1 text-[11px] ${toneClass}`}>
          {item}
        </span>
      ))}
    </div>
  );
}

export default function ThumbnailConceptPanel({ concept }: ThumbnailConceptPanelProps) {
  if (!concept) {
    return null;
  }

  const decision = concept.creativeDecision;
  const seoKeywordLine = buildSeoKeywordLine(concept.seoKeywords);

  return (
    <section className="space-y-4">
      <div className="space-y-4 rounded-2xl border border-zinc-800 bg-zinc-900/60 p-5">
        <header className="flex items-center justify-between gap-3">
          <div className="flex items-center gap-2">
            <Sparkles size={18} className="text-amber-400" />
            <h3 className="text-sm font-semibold uppercase tracking-[0.14em] text-zinc-200">Konzept</h3>
          </div>
          <span className="rounded-full border border-zinc-700 bg-zinc-900 px-2.5 py-1 text-[11px] text-zinc-400">
            {concept.generatedByAzure ? 'Azure-generiert' : 'lokaler Fallback'}
          </span>
        </header>

        <div className={cardClass}>
          <div className="flex items-center justify-between gap-2">
            <h4 className={headingClass}>Empfohlener Titel</h4>
            <CopyButton value={concept.selectedTitle} label="Copy Title" />
          </div>
          <p className="text-2xl font-black tracking-tight text-zinc-50">{concept.selectedTitle}</p>
        </div>

        <div className="grid gap-4 sm:grid-cols-2">
          <div className={cardClass}>
            <h4 className={headingClass}>Top Picks</h4>
            <ChipList items={concept.topPicks} tone="amber" />
          </div>
          <div className={cardClass}>
            <h4 className={headingClass}>Thema</h4>
            <p className="text-sm text-zinc-300">{concept.theme}</p>
          </div>
        </div>

        <details className={cardClass}>
          <summary className="cursor-pointer text-[11px] font-semibold uppercase tracking-[0.16em] text-zinc-500">
            Titelvarianten ({concept.titleVariants.length})
          </summary>
          <ul className="mt-3 space-y-2">
            {concept.titleVariants.map((variant, index) => (
              <li key={`${variant.title}-${index}`} className="flex items-start justify-between gap-3 border-b border-zinc-800/70 pb-2 last:border-0">
                <div>
                  <p className="text-sm font-semibold text-zinc-100">{variant.title}</p>
                  <p className="text-xs text-zinc-500">{variant.reason}</p>
                </div>
                <span className="shrink-0 rounded-full border border-zinc-700 px-2 py-0.5 text-[11px] text-zinc-400">{variant.score}</span>
              </li>
            ))}
          </ul>
        </details>

        <div className={cardClass}>
          <div className="flex items-center justify-between gap-2">
            <h4 className={headingClass}>YouTube-Titel</h4>
            <CopyButton value={concept.youtubeTitle} label="Copy" />
          </div>
          <p className="text-sm text-zinc-200">{concept.youtubeTitle}</p>
        </div>

        <div className={cardClass}>
          <div className="flex items-center justify-between gap-2">
            <h4 className={headingClass}>Beschreibung</h4>
            <CopyButton value={concept.description} label="Copy Description" />
          </div>
          <pre className="whitespace-pre-wrap text-sm text-zinc-300">{concept.description}</pre>
        </div>

        <div className="grid gap-4 sm:grid-cols-2">
          <div className={cardClass}>
            <div className="flex items-center justify-between gap-2">
              <h4 className={headingClass}>Hashtags</h4>
              <CopyButton value={concept.hashtags.join(' ')} label="Copy Hashtags" />
            </div>
            <ChipList items={concept.hashtags} tone="cyan" />
          </div>
          <details className={cardClass}>
            <summary className="cursor-pointer text-[11px] font-semibold uppercase tracking-[0.16em] text-zinc-500">
              SEO Keywords ({concept.seoKeywords.length})
            </summary>
            <div className="flex items-center justify-between gap-2">
              <h4 className={headingClass}>SEO Keywords</h4>
              <CopyButton value={seoKeywordLine} label="Copy SEO" />
            </div>
            <p className="break-words font-mono text-[11px] leading-relaxed text-zinc-500">
              {seoKeywordLine || '—'}
            </p>
            <p className="text-[10px] text-zinc-600">{seoKeywordLine.length} / {SEO_KEYWORD_MAX_LENGTH} Zeichen</p>
            <ChipList items={concept.seoKeywords} tone="zinc" />
          </details>
        </div>

        <div className="grid gap-4 sm:grid-cols-2">
          <div className={cardClass}>
            <h4 className={headingClass}>Thumbnail Layout</h4>
            <p className="text-sm text-zinc-300">{concept.layout}</p>
          </div>
          <div className={cardClass}>
            <h4 className={headingClass}>Farbpalette</h4>
            <ChipList items={concept.palette} tone="zinc" />
          </div>
        </div>

        <details className={cardClass}>
          <summary className="cursor-pointer text-[11px] font-semibold uppercase tracking-[0.16em] text-zinc-500">
            Prompt & Render-Details
          </summary>
          <div className="mt-3 flex items-center justify-between gap-2">
            <h4 className={headingClass}>Finalbild-Prompt (Titel + Hintergrund)</h4>
            <CopyButton value={concept.backgroundPrompt} label="Copy Prompt" />
          </div>
          <pre className="whitespace-pre-wrap text-xs text-zinc-400">{concept.backgroundPrompt}</pre>

          <div className="mt-3">
            <h4 className={headingClass}>Negative Prompt</h4>
            <p className="text-xs text-zinc-400">{concept.negativePrompt}</p>
          </div>

          <div className="mt-3">
            <h4 className={headingClass}>Titel-Render-Modus</h4>
            <div className="grid gap-1 text-xs text-zinc-400 sm:grid-cols-2">
              <span>Topline: <span className="text-zinc-200">{concept.textOverlay.topline}</span></span>
              <span>Footer: <span className="text-zinc-200">{concept.textOverlay.footer}</span></span>
              <span>Subtitle: <span className="text-zinc-200">{concept.textOverlay.subtitle || '—'}</span></span>
              <span>Stream #: <span className="text-zinc-200">{concept.textOverlay.streamNumber || '—'}</span></span>
              <span>Style: <span className="text-zinc-200">{concept.textOverlay.textStyle}</span></span>
              <span>Color: <span className="text-zinc-200">{concept.textOverlay.colorLogic}</span></span>
              <span>Lokales Overlay: <span className="text-zinc-200">{concept.textOverlay.localOverlay || 'minimal'}</span></span>
            </div>
          </div>
        </details>
      </div>

      <details className="space-y-3 rounded-2xl border border-zinc-800 bg-zinc-900/60 p-5">
        <summary className="flex cursor-pointer items-center gap-2 text-sm font-semibold uppercase tracking-[0.14em] text-zinc-200">
          <Lightbulb size={18} className="text-amber-400" />
          Creative Decision Explanation
        </summary>
        <div className="flex items-center gap-2">
          <h3 className="text-sm font-semibold uppercase tracking-[0.14em] text-zinc-200">Creative Decision Explanation</h3>
        </div>
        <dl className="space-y-2 text-sm">
          <div><dt className="text-xs uppercase tracking-wide text-zinc-500">Warum dieser Titel</dt><dd className="text-zinc-300">{decision.whyTitle}</dd></div>
          <div><dt className="text-xs uppercase tracking-wide text-zinc-500">Warum dieses Thema</dt><dd className="text-zinc-300">{decision.whyTheme}</dd></div>
          <div><dt className="text-xs uppercase tracking-wide text-zinc-500">Warum dieses Layout</dt><dd className="text-zinc-300">{decision.whyLayout}</dd></div>
          <div><dt className="text-xs uppercase tracking-wide text-zinc-500">Warum diese Palette</dt><dd className="text-zinc-300">{decision.whyPalette}</dd></div>
          <div><dt className="text-xs uppercase tracking-wide text-zinc-500">Warum dieser Titel-Render</dt><dd className="text-zinc-300">{decision.whyLocalText}</dd></div>
        </dl>
        {decision.usedIqRules.length > 0 && (
          <div className="space-y-1.5">
            <h4 className={headingClass}>Verwendete Foundry IQ Regeln</h4>
            <ChipList items={decision.usedIqRules} tone="cyan" />
          </div>
        )}
        {decision.avoidedPatterns.length > 0 && (
          <div className="space-y-1.5">
            <h4 className={headingClass}>Vermiedene Patterns</h4>
            <ChipList items={decision.avoidedPatterns} tone="amber" />
          </div>
        )}
        <p className="text-[11px] text-zinc-500">
          IQ Provider: <span className="text-zinc-300">{decision.iqProvider}</span> · Remote: {decision.usedRemote ? 'yes' : 'no'}
        </p>
      </details>

      <details className="rounded-2xl border border-zinc-800 bg-zinc-900/60 p-5">
        <summary className="flex cursor-pointer items-center justify-between text-sm font-semibold uppercase tracking-[0.14em] text-zinc-300">
          JSON Preview
          <CopyButton value={JSON.stringify(concept, null, 2)} label="Export JSON" />
        </summary>
        <pre className="mt-3 max-h-96 overflow-auto rounded-lg bg-zinc-950 p-3 text-[11px] text-zinc-400">
          {JSON.stringify(concept, null, 2)}
        </pre>
      </details>
    </section>
  );
}

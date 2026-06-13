import React from 'react';
import { BrainCircuit, ShieldAlert } from 'lucide-react';
import type { FoundryIqMemoryResult } from '../../lib/thumbnailTypes';

interface FoundryIqMemoryPanelProps {
  memory: FoundryIqMemoryResult | null;
}

const providerLabel: Record<FoundryIqMemoryResult['provider'], string> = {
  'foundry-iq-agent': 'Foundry IQ Agent (remote)',
  'local-knowledge': 'Local ARV Knowledge',
  inactive: 'Inactive',
};

const providerColor: Record<FoundryIqMemoryResult['provider'], string> = {
  'foundry-iq-agent': 'text-emerald-300 border-emerald-800 bg-emerald-950/40',
  'local-knowledge': 'text-amber-300 border-amber-800 bg-amber-950/40',
  inactive: 'text-zinc-400 border-zinc-700 bg-zinc-900/60',
};

function ListBlock({ title, items }: { title: string; items: string[] }) {
  if (!items || items.length === 0) {
    return null;
  }
  return (
    <div className="space-y-1.5">
      <h4 className="text-[11px] font-semibold uppercase tracking-[0.16em] text-zinc-500">{title}</h4>
      <ul className="space-y-1">
        {items.map((item, index) => (
          <li key={`${title}-${index}`} className="text-sm leading-snug text-zinc-300">
            • {item}
          </li>
        ))}
      </ul>
    </div>
  );
}

export default function FoundryIqMemoryPanel({ memory }: FoundryIqMemoryPanelProps) {
  if (!memory) {
    return null;
  }

  const isInactive = memory.provider === 'inactive';

  return (
    <section className="space-y-4 rounded-2xl border border-zinc-800 bg-zinc-900/60 p-5">
      <header className="flex items-center justify-between gap-3">
        <div className="flex items-center gap-2">
          <BrainCircuit size={18} className="text-cyan-400" />
          <h3 className="text-sm font-semibold uppercase tracking-[0.14em] text-zinc-200">Foundry IQ Memory Used</h3>
        </div>
        <span className={`rounded-full border px-2.5 py-1 text-[11px] font-semibold ${providerColor[memory.provider]}`}>
          {providerLabel[memory.provider]}
        </span>
      </header>

      <div className="flex flex-wrap gap-3 text-xs text-zinc-400">
        <span>
          Remote used: <strong className={memory.usedRemote ? 'text-emerald-300' : 'text-zinc-300'}>{memory.usedRemote ? 'yes' : 'no'}</strong>
        </span>
        <span>Provider: <strong className="text-zinc-300">{memory.provider}</strong></span>
        <span>Rules: <strong className="text-zinc-300">{memory.styleRules.length + memory.patterns.length + memory.dramaturgy.length + memory.forbidden.length}</strong></span>
        <span>Sources: <strong className="text-zinc-300">{memory.citations.length}</strong></span>
      </div>

      {isInactive ? (
        <div className="flex items-start gap-2 rounded-xl border border-zinc-700 bg-zinc-950/70 p-3 text-sm text-zinc-400">
          <ShieldAlert size={16} className="mt-0.5 text-amber-400" />
          <span>{memory.fallbackNote}</span>
        </div>
      ) : (
        <>
          <div className="rounded-xl border border-zinc-700 bg-zinc-950/60 px-3 py-2 text-xs text-zinc-400">
            {memory.promptBlock || 'Kompakte Memory-Zusammenfassung vorhanden. Details bei Bedarf aufklappen.'}
          </div>

          <details className="rounded-xl border border-zinc-800 bg-zinc-950/40 p-3">
            <summary className="cursor-pointer text-[11px] font-semibold uppercase tracking-[0.16em] text-zinc-400">
              Memory-Details anzeigen
            </summary>
            <div className="mt-3 grid gap-4 sm:grid-cols-2">
              <ListBlock title="Retrieved Style Rules" items={memory.styleRules} />
              <ListBlock title="Retrieved Patterns" items={memory.patterns} />
              <ListBlock title="Dramaturgy" items={memory.dramaturgy} />
              <ListBlock title="Negative Rules" items={memory.forbidden} />
            </div>
          </details>

          {memory.citations.length > 0 && (
            <details className="space-y-1.5 border-t border-zinc-800 pt-3">
              <summary className="cursor-pointer text-[11px] font-semibold uppercase tracking-[0.16em] text-zinc-500">
                Sources / Citations ({memory.citations.length})
              </summary>
              <ul className="mt-2 space-y-1">
                {memory.citations.map((citation, index) => (
                  <li key={`citation-${index}`} className="text-xs text-zinc-400">
                    <span className="font-mono text-cyan-400">{citation.source}</span>
                    {citation.excerpt ? ` — ${citation.excerpt.slice(0, 160)}` : ''}
                  </li>
                ))}
              </ul>
            </details>
          )}

          <p className="text-[11px] italic text-zinc-500">{memory.fallbackNote}</p>
        </>
      )}
    </section>
  );
}

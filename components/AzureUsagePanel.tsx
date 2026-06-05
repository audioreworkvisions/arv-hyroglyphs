import React, { useState } from 'react';
import { ChevronDown, ChevronUp, Cpu, Trash2 } from 'lucide-react';
import { AzureUsageEntry, AzureUsageTotals } from '../hooks/useAzureUsage';

interface AzureUsagePanelProps {
  entries: AzureUsageEntry[];
  totals: AzureUsageTotals;
  onClear: () => void;
}

const TYPE_LABEL: Record<string, string> = {
  text: 'Text',
  storyboard: 'Storyboard',
  image: 'Bild',
  video: 'Video',
};

const fmt = (n: number) =>
  n >= 1000 ? `${(n / 1000).toFixed(1)}k` : String(n);

const timeStr = (ts: number) => {
  const d = new Date(ts);
  return `${String(d.getHours()).padStart(2, '0')}:${String(d.getMinutes()).padStart(2, '0')}`;
};

export default function AzureUsagePanel({ entries, totals, onClear }: AzureUsagePanelProps) {
  const [expanded, setExpanded] = useState(false);

  if (entries.length === 0) return null;

  return (
    <div className="fixed bottom-4 right-4 z-50 w-72 rounded-2xl border border-sky-500/30 bg-zinc-950/95 dark:bg-zinc-950/95 backdrop-blur-md shadow-2xl text-xs font-mono select-none">
      {/* Header */}
      <div
        className="flex items-center justify-between px-4 py-2.5 cursor-pointer"
        onClick={() => setExpanded(!expanded)}
      >
        <div className="flex items-center gap-2 text-sky-400">
          <Cpu size={13} />
          <span className="font-bold tracking-wide uppercase text-[10px]">Azure Verbrauch</span>
        </div>
        <div className="flex items-center gap-2">
          <button
            onClick={(e) => { e.stopPropagation(); onClear(); }}
            className="text-zinc-600 hover:text-zinc-400 transition-colors p-0.5"
            title="Verlauf löschen"
          >
            <Trash2 size={11} />
          </button>
          {expanded ? <ChevronDown size={13} className="text-zinc-500" /> : <ChevronUp size={13} className="text-zinc-500" />}
        </div>
      </div>

      {/* Aggregate stats – always visible */}
      <div className="grid grid-cols-3 gap-px bg-zinc-800/40 border-t border-sky-500/20">
        <div className="flex flex-col items-center py-2 bg-zinc-950/80">
          <span className="text-sky-300 font-bold text-sm leading-none">{fmt(totals.totalTokens)}</span>
          <span className="text-zinc-500 text-[9px] mt-1 uppercase tracking-widest">Token</span>
        </div>
        <div className="flex flex-col items-center py-2 bg-zinc-950/80">
          <span className="text-violet-300 font-bold text-sm leading-none">{totals.imageCount}</span>
          <span className="text-zinc-500 text-[9px] mt-1 uppercase tracking-widest">Bilder</span>
        </div>
        <div className="flex flex-col items-center py-2 bg-zinc-950/80">
          <span className="text-emerald-300 font-bold text-sm leading-none">{totals.videoSeconds}s</span>
          <span className="text-zinc-500 text-[9px] mt-1 uppercase tracking-widest">Video</span>
        </div>
      </div>

      {/* Token breakdown row */}
      {totals.totalTokens > 0 && (
        <div className="flex items-center gap-2 px-4 py-1.5 border-t border-zinc-800/60 text-[10px] text-zinc-500">
          <span className="text-zinc-400">↑ {fmt(totals.promptTokens)} prompt</span>
          <span className="text-zinc-700">·</span>
          <span className="text-zinc-400">↓ {fmt(totals.completionTokens)} completion</span>
        </div>
      )}

      {/* Entry log – collapsible */}
      {expanded && entries.length > 0 && (
        <div className="border-t border-zinc-800/60 max-h-56 overflow-y-auto">
          {entries.slice(0, 15).map((entry) => (
            <div
              key={entry.id}
              className="flex items-start justify-between gap-2 px-4 py-1.5 border-b border-zinc-900 hover:bg-zinc-900/40 transition-colors"
            >
              <div className="flex flex-col gap-0.5 min-w-0">
                <div className="flex items-center gap-1.5">
                  <span className={`text-[9px] font-bold uppercase tracking-wide ${
                    entry.type === 'video' ? 'text-emerald-400' :
                    entry.type === 'image' ? 'text-violet-400' :
                    'text-sky-400'
                  }`}>
                    {TYPE_LABEL[entry.type] ?? entry.type}
                  </span>
                  <span className="text-zinc-600 truncate max-w-[100px]">{entry.model}</span>
                </div>

                {entry.type === 'video' && (
                  <span className="text-zinc-400">{entry.videoSeconds}s · {entry.videoSize}</span>
                )}
                {entry.type === 'image' && (
                  <span className="text-zinc-400">{entry.imageSize}</span>
                )}
                {(entry.type === 'text' || entry.type === 'storyboard') && entry.totalTokens !== undefined && (
                  <span className="text-zinc-400">
                    {fmt(entry.promptTokens ?? 0)}↑ + {fmt(entry.completionTokens ?? 0)}↓ = {fmt(entry.totalTokens)}
                  </span>
                )}
              </div>
              <span className="text-zinc-600 shrink-0 pt-0.5">{timeStr(entry.timestamp)}</span>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}

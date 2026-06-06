import React from 'react';
import { History, Loader2 } from 'lucide-react';
import type { ThumbnailStudioSession } from '../../lib/thumbnailTypes';

interface ThumbnailHistoryPanelProps {
  sessions: ThumbnailStudioSession[];
  loading: boolean;
  onRefresh: () => void;
  onSelect: (session: ThumbnailStudioSession) => void;
}

export default function ThumbnailHistoryPanel({ sessions, loading, onRefresh, onSelect }: ThumbnailHistoryPanelProps) {
  return (
    <section className="space-y-3 rounded-2xl border border-zinc-800 bg-zinc-900/60 p-5">
      <header className="flex items-center justify-between">
        <div className="flex items-center gap-2">
          <History size={18} className="text-zinc-400" />
          <h3 className="text-sm font-semibold uppercase tracking-[0.14em] text-zinc-200">Verlauf</h3>
        </div>
        <button
          type="button"
          onClick={onRefresh}
          className="inline-flex items-center gap-1.5 rounded-lg border border-zinc-700 bg-zinc-900 px-2.5 py-1.5 text-[11px] font-semibold text-zinc-300 transition hover:border-cyan-700"
        >
          {loading ? <Loader2 size={12} className="animate-spin" /> : null}
          Aktualisieren
        </button>
      </header>

      {sessions.length === 0 ? (
        <p className="text-xs text-zinc-500">Noch keine gespeicherten Sessions.</p>
      ) : (
        <ul className="space-y-2">
          {sessions.map((session) => (
            <li key={session.id}>
              <button
                type="button"
                onClick={() => onSelect(session)}
                className="flex w-full items-center justify-between gap-3 rounded-lg border border-zinc-800 bg-zinc-950/60 px-3 py-2 text-left transition hover:border-cyan-800"
              >
                <div className="min-w-0">
                  <p className="truncate text-sm font-semibold text-zinc-100">
                    {session.concept?.selectedTitle || session.input.title || 'Untitled'}
                  </p>
                  <p className="truncate text-[11px] text-zinc-500">
                    {new Date(session.createdAt).toLocaleString()} · {session.input.genre || 'Techno'}
                  </p>
                </div>
                <span className="shrink-0 rounded-full border border-zinc-700 px-2 py-0.5 text-[10px] uppercase tracking-wide text-zinc-400">
                  {session.foundryIqMemory?.provider || 'local'}
                </span>
              </button>
            </li>
          ))}
        </ul>
      )}
    </section>
  );
}

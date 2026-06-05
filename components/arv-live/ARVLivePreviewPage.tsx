import React, { useEffect, useMemo, useState } from 'react';
import ARVLiveCanvas from './ARVLiveCanvas';
import { ARV_CURATED_LIVE_PRESETS, ARV_LIVE_PRESETS, resolveARVLivePresetId } from '../../lib/arv-live/presets';
import { ARV_REACTION_PRESETS, type ARVReactionKind } from '../../lib/arv-live/types';

const DEFAULT_PREVIEW_PRESET_ID = 'archiveIrisKaleidoscope';

const resolveInitialPreviewPresetId = (): string => {
  if (typeof window === 'undefined') {
    return DEFAULT_PREVIEW_PRESET_ID;
  }

  return resolveARVLivePresetId(
    new URLSearchParams(window.location.search).get('preset'),
    DEFAULT_PREVIEW_PRESET_ID,
  );
};

export default function ARVLivePreviewPage() {
  const [selectedPresetId, setSelectedPresetId] = useState(resolveInitialPreviewPresetId);
  const [localReactionTrigger, setLocalReactionTrigger] = useState<{ reaction: ARVReactionKind; nonce: number } | null>(null);
  const [lastReaction, setLastReaction] = useState<ARVReactionKind | null>(null);
  const selectedPreset = useMemo(() => ARV_LIVE_PRESETS[selectedPresetId], [selectedPresetId]);
  const viewerHref = useMemo(
    () => `/arv-live/viewer?preset=${encodeURIComponent(selectedPresetId)}&quality=ultra&hud=minimal`,
    [selectedPresetId],
  );
  const obsHref = useMemo(
    () => `/arv-live/obs?preset=${encodeURIComponent(selectedPresetId)}&quality=obs&hud=none&transparent=true&embed=true`,
    [selectedPresetId],
  );

  const triggerLocalReaction = (reaction: ARVReactionKind) => {
    setLastReaction(reaction);
    setLocalReactionTrigger({ reaction, nonce: Date.now() });
  };

  useEffect(() => {
    document.title = `${selectedPreset.title} · ARV Preview`;
    document.documentElement.classList.add('dark');
  }, [selectedPreset.title]);

  return (
    <div className="arv-live-route arv-live-preview-route">
      <div className="arv-live-preview-shell">
        <section className="arv-live-preview-stage">
          <div className="arv-live-preview-header">
            <div className="arv-live-eyebrow">ARV Preview Player</div>
            <h1 className="arv-live-preview-title">{selectedPreset.title}</h1>
            <p className="arv-live-preview-copy">
              Lokale Vorschau mit kuratierter Schnellwahl. Der Player startet direkt im neuen monochromen Archive-Iris-Look und bleibt auf die staerksten ARV-Livewelten konzentriert.
            </p>
          </div>

          <div className="arv-live-preview-player">
            <ARVLiveCanvas
              mode="viewer"
              hudMode="preview"
              initialPresetId={selectedPresetId}
              presetIdOverride={selectedPresetId}
              localReactionTrigger={localReactionTrigger}
            />
          </div>
        </section>

        <aside className="arv-live-preview-sidebar">
          <div className="arv-live-preview-panel">
            <div className="arv-live-panel-title">Curated Presets</div>
            <div className="arv-live-preview-preset-grid">
              {ARV_CURATED_LIVE_PRESETS.map((preset) => (
                <button
                  key={preset.id}
                  type="button"
                  className={`arv-live-preview-preset ${selectedPresetId === preset.id ? 'is-active' : ''}`}
                  onClick={() => setSelectedPresetId(preset.id)}
                >
                  <span className="arv-live-preview-preset-title">{preset.title}</span>
                  <span className="arv-live-preview-preset-meta">{preset.id}</span>
                </button>
              ))}
            </div>
          </div>

          <div className="arv-live-preview-panel">
            <div className="arv-live-panel-title">Open Surface</div>
            <div className="arv-live-preview-actions">
              <a className="arv-live-preview-link" href={viewerHref}>Open Full Viewer</a>
              <a className="arv-live-preview-link arv-live-preview-link-accent" href={obsHref}>Open OBS Browser Source</a>
            </div>
          </div>

          <div className="arv-live-preview-panel">
            <div className="arv-live-panel-title">Local Reactions</div>
            <div className="arv-live-preview-reaction-grid">
              {Object.values(ARV_REACTION_PRESETS).map((reaction) => (
                <button
                  key={reaction.key}
                  type="button"
                  className={`arv-live-reaction arv-live-reaction-${reaction.key}`}
                  onClick={() => triggerLocalReaction(reaction.key)}
                >
                  {reaction.label}
                </button>
              ))}
            </div>
            <p className="arv-live-preview-status">
              {lastReaction
                ? `Last local trigger: ${ARV_REACTION_PRESETS[lastReaction].label}`
                : 'Triggers run locally in the preview player, no live hub required.'}
            </p>
          </div>

          <div className="arv-live-preview-panel arv-live-preview-panel-note">
            <div className="arv-live-panel-title">Current Palette</div>
            <div className="arv-live-preview-swatches">
              {[
                { chip: 'BG', hex: selectedPreset.backgroundHex },
                { chip: 'FOG', hex: selectedPreset.fogHex },
                { chip: 'CORE', hex: selectedPreset.portalHex },
                { chip: 'ACC', hex: selectedPreset.accentHex },
              ].map(({ chip, hex }) => (
                <div key={`${chip}-${hex}`} className="arv-live-preview-swatch-row">
                  <span className="arv-live-preview-swatch">{chip}</span>
                  <span className="arv-live-preview-swatch-label">{hex}</span>
                </div>
              ))}
            </div>
          </div>
        </aside>
      </div>
    </div>
  );
}
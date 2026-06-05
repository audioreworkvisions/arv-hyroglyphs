import React, { useCallback, useEffect, useState } from 'react';
import { ARV_CURATED_LIVE_PRESETS, ARV_LIVE_PRESETS } from '../../lib/arv-live/presets';
import {
  ARV_DEFAULT_LIVE_CONTROL_STATE,
  ARV_REACTION_PRESETS,
  type ARVLiveControlState,
  type ARVPhaseLock,
  type ARVReactionKind,
} from '../../lib/arv-live/types';

interface ARVLiveStatusResponse {
  success: boolean;
  configured: boolean;
  wsPath: string;
  mockChat: boolean;
  control: ARVLiveControlState | null;
  presetIds: string[];
  urls: {
    obs: string;
    obsBrowserSource: string;
    viewer: string;
    operator: string;
    dock: string;
  };
}

const PHASE_LOCK_OPTIONS: Array<{ value: ARVPhaseLock; label: string }> = [
  { value: 'auto', label: 'Auto' },
  { value: 'dormant', label: 'Dormant' },
  { value: 'invocation', label: 'Invocation' },
  { value: 'surge', label: 'Surge' },
  { value: 'peak', label: 'Peak' },
  { value: 'euphoria', label: 'Euphoria' },
];

const copyText = async (value: string): Promise<boolean> => {
  try {
    if (navigator.clipboard?.writeText) {
      await navigator.clipboard.writeText(value);
      return true;
    }
  } catch {
    // Fall back to legacy copy for OBS/embedded Chromium contexts.
  }

  const textarea = document.createElement('textarea');
  textarea.value = value;
  textarea.setAttribute('readonly', 'true');
  textarea.style.position = 'fixed';
  textarea.style.left = '-9999px';
  document.body.appendChild(textarea);
  textarea.select();

  try {
    return document.execCommand('copy');
  } finally {
    document.body.removeChild(textarea);
  }
};

export default function ARVLiveOperatorPage() {
  const [status, setStatus] = useState<ARVLiveStatusResponse | null>(null);
  const [control, setControl] = useState<ARVLiveControlState>(ARV_DEFAULT_LIVE_CONTROL_STATE);
  const [message, setMessage] = useState('portal ignition for the next drop');
  const [feedback, setFeedback] = useState<string | null>(null);
  const [busyKey, setBusyKey] = useState<string | null>(null);

  const pushFeedback = useCallback((value: string) => {
    setFeedback(value);
    window.setTimeout(() => setFeedback(null), 2600);
  }, []);

  const loadStatus = useCallback(async () => {
    const response = await fetch('/api/arv-live/status');
    const data = await response.json() as ARVLiveStatusResponse;
    setStatus(data);
    if (data.control) {
      setControl(data.control);
    }
  }, []);

  useEffect(() => {
    document.title = 'ARV MR Concert Canvas · Operator';
    document.documentElement.classList.add('dark');
    void loadStatus();
  }, [loadStatus]);

  const updateControl = useCallback(async (patch: Partial<ARVLiveControlState>, busyLabel: string) => {
    setBusyKey(busyLabel);
    try {
      const response = await fetch('/api/arv-live/control', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(patch),
      });
      const data = await response.json();
      if (!response.ok) {
        throw new Error(data.error || 'Control update failed');
      }
      setControl(data.control);
      pushFeedback(`Applied ${busyLabel}`);
    } catch (error) {
      pushFeedback(error instanceof Error ? error.message : 'Control update failed');
    } finally {
      setBusyKey(null);
    }
  }, [pushFeedback]);

  const triggerReaction = useCallback(async (reaction: ARVReactionKind) => {
    setBusyKey(reaction);
    try {
      const response = await fetch('/api/arv-live/trigger', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ reaction, userId: 'operator' }),
      });
      const data = await response.json();
      if (!response.ok) {
        throw new Error(data.error || 'Trigger failed');
      }
      pushFeedback(`Triggered ${ARV_REACTION_PRESETS[reaction].label}`);
    } catch (error) {
      pushFeedback(error instanceof Error ? error.message : 'Trigger failed');
    } finally {
      setBusyKey(null);
    }
  }, [pushFeedback]);

  const submitMockChat = useCallback(async (event: React.FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    if (!message.trim()) return;

    setBusyKey('chat');
    try {
      const response = await fetch('/api/arv-live/trigger', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ text: message, userId: 'operator' }),
      });
      const data = await response.json();
      if (!response.ok) {
        throw new Error(data.error || 'Chat trigger failed');
      }
      pushFeedback('Mock chat injected');
      setMessage('');
    } catch (error) {
      pushFeedback(error instanceof Error ? error.message : 'Chat trigger failed');
    } finally {
      setBusyKey(null);
    }
  }, [message, pushFeedback]);

  const activePresetId = control.presetId || ARV_DEFAULT_LIVE_CONTROL_STATE.presetId;
  const previewUrl = `/arv-live/preview?preset=${encodeURIComponent(activePresetId)}`;
  const viewerUrl = `/arv-live/viewer?preset=${encodeURIComponent(activePresetId)}&quality=ultra&hud=minimal`;
  const obsUrl = `/arv-live/obs?preset=${encodeURIComponent(activePresetId)}&quality=obs&hud=full`;
  const obsBrowserSourceUrl = `/arv-live/obs?preset=${encodeURIComponent(activePresetId)}&quality=obs&hud=none&transparent=true&embed=true`;

  return (
    <div className="arv-live-route arv-operator-route">
      <div className="arv-operator-shell">
        <div className="arv-operator-header">
          <div>
            <div className="arv-live-eyebrow">ARV Operator Surface</div>
            <h1 className="arv-operator-title">MR Concert Canvas Control</h1>
            <p className="arv-operator-subtitle">
              Presets, phase-lock and manual ritual triggers for the live Babylon scene.
            </p>
          </div>
          <div className="arv-operator-status-block">
            <div className="arv-live-badge">
              <div className="arv-live-badge-label">Hub</div>
              <div className="arv-live-badge-value">{status?.configured ? 'online' : 'offline'}</div>
            </div>
            <div className="arv-live-badge">
              <div className="arv-live-badge-label">WS</div>
              <div className="arv-live-badge-value">{status?.wsPath || '/ws/arv-live'}</div>
            </div>
          </div>
        </div>

        <div className="arv-operator-nav">
          <div className="arv-operator-history-row">
            <button type="button" className="arv-operator-copy-button" onClick={() => window.history.back()}>
              Back
            </button>
            <button type="button" className="arv-operator-copy-button" onClick={() => window.history.forward()}>
              Forward
            </button>
          </div>
          <div className="arv-operator-link-grid">
            <a className="arv-operator-link" href={previewUrl}>Preview</a>
            <a className="arv-operator-link" href={viewerUrl}>Viewer</a>
            <a className="arv-operator-link" href={obsUrl}>OBS Surface</a>
            <a className="arv-operator-link arv-operator-link-accent" href={obsBrowserSourceUrl}>OBS Browser Source</a>
            <a className="arv-operator-link" href="/arv-live/dock">Dock</a>
          </div>
        </div>

        {feedback && <div className="arv-operator-feedback">{feedback}</div>}

        <div className="arv-operator-grid">
          <section className="arv-operator-panel">
            <div className="arv-operator-section-title">OBS + Public URLs</div>
            <div className="arv-operator-url-list">
              {status && [
                ['OBS Browser Source', obsBrowserSourceUrl],
                ['OBS Dock', status.urls.dock],
                ['OBS Full', obsUrl],
                ['Viewer', viewerUrl],
                ['Preview', previewUrl],
              ].map(([label, value]) => (
                <div key={label} className="arv-operator-url-row">
                  <div>
                    <div className="arv-operator-url-label">{label}</div>
                    <div className="arv-operator-url-value">{value}</div>
                  </div>
                  <button
                    type="button"
                    className="arv-operator-copy-button"
                    onClick={() => {
                      void copyText(String(value)).then((copied) => {
                        pushFeedback(copied ? `${label} copied` : `${label} ready to copy`);
                      });
                    }}
                  >
                    Copy
                  </button>
                </div>
              ))}
            </div>
            <button type="button" className="arv-operator-ghost-button" onClick={() => void loadStatus()}>
              Refresh status
            </button>
          </section>

          <section className="arv-operator-panel">
            <div className="arv-operator-section-title">Curated Visual Presets</div>
            <div className="arv-operator-chip-grid">
              {ARV_CURATED_LIVE_PRESETS.map((preset) => (
                <button
                  key={preset.id}
                  type="button"
                  className={`arv-operator-chip ${control.presetId === preset.id ? 'is-active' : ''}`}
                  onClick={() => void updateControl({ presetId: preset.id }, `preset ${preset.title}`)}
                  disabled={busyKey !== null}
                >
                  {preset.title}
                </button>
              ))}
            </div>
          </section>

          <section className="arv-operator-panel">
            <div className="arv-operator-section-title">Phase Lock</div>
            <div className="arv-operator-chip-grid">
              {PHASE_LOCK_OPTIONS.map((option) => (
                <button
                  key={option.value}
                  type="button"
                  className={`arv-operator-chip ${control.phaseLock === option.value ? 'is-active' : ''}`}
                  onClick={() => void updateControl({ phaseLock: option.value }, `phase ${option.label}`)}
                  disabled={busyKey !== null}
                >
                  {option.label}
                </button>
              ))}
            </div>
          </section>

          <section className="arv-operator-panel">
            <div className="arv-operator-section-title">Manual Ritual Triggers</div>
            <div className="arv-live-reaction-grid">
              {Object.values(ARV_REACTION_PRESETS).map((reaction) => (
                <button
                  key={reaction.key}
                  type="button"
                  className={`arv-live-reaction arv-live-reaction-${reaction.key}`}
                  onClick={() => void triggerReaction(reaction.key)}
                  disabled={busyKey !== null}
                >
                  {reaction.label}
                </button>
              ))}
            </div>
            <form className="arv-operator-form" onSubmit={submitMockChat}>
              <label className="arv-operator-url-label" htmlFor="arv-operator-message">Mock chat message</label>
              <input
                id="arv-operator-message"
                className="arv-operator-input"
                value={message}
                onChange={(inputEvent) => setMessage(inputEvent.target.value)}
                placeholder="Inject ritual chat into the crowd"
              />
              <button type="submit" className="arv-operator-primary-button" disabled={busyKey !== null || !message.trim()}>
                Send mock chat
              </button>
            </form>
          </section>
        </div>
      </div>
    </div>
  );
}

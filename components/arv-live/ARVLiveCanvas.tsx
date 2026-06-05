import React, { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { Engine, Scene } from '@babylonjs/core';
import { AudioReactiveUniforms, type AudioReactiveSnapshot } from '../../lib/arv-live/AudioReactiveUniforms';
import type { ARVAudioFrame, ARVSceneController, ARVVisualEvent } from '../../lib/arv-live/babylon/controllers/ARVSceneController';
import { createARVSceneController } from '../../lib/arv-live/babylon/controllers/registry';
import { interpretCommunityEvent } from '../../lib/arv-live/ChatEventInterpreter';
import {
  ARV_CURATED_LIVE_PRESETS,
  ARV_DEFAULT_LIVE_CONTROL_PRESET_ID,
  ARV_LIVE_PRESETS,
  detectARVQualityTier,
  getARVLivePreset,
  getARVQualitySettings,
  isKnownARVLivePresetId,
  type ARVHudMode,
  type ARVLiveMode,
  type ARVLiveRuntimeOptions,
  type ARVQualityTier,
} from '../../lib/arv-live/presets';
import { RitualPhaseController, type RitualPhaseState } from '../../lib/arv-live/RitualPhaseController';
import {
  ARV_DEFAULT_LIVE_CONTROL_STATE,
  ARV_REACTION_PRESETS,
  createReactionEvent,
  type ARVCommunityEvent,
  type ARVLiveControlState,
  type ARVPhaseLock,
  type ARVReactionKind,
  type ARVSocketEnvelope,
} from '../../lib/arv-live/types';

const REACTION_BUTTONS = Object.values(ARV_REACTION_PRESETS);
const OBS_PRESET_OPTIONS = ARV_CURATED_LIVE_PRESETS;
const OBS_PHASE_SHORTCUTS: Array<{ value: ARVPhaseLock; label: string }> = [
  { value: 'dormant', label: 'Calm' },
  { value: 'auto', label: 'Auto' },
  { value: 'peak', label: 'Peak' },
];

const KEYBOARD_REACTION_SHORTCUTS: Record<string, ARVReactionKind> = {
  '1': 'pulse',
  '2': 'fire',
  '3': 'acid',
  '4': 'dark',
  '5': 'peace-love-techno',
};

const createInitialAudioSnapshot = (): AudioReactiveSnapshot => ({
  active: false,
  bass: 0,
  mid: 0,
  high: 0,
  rms: 0,
  kick: 0,
  bpm: 0,
  permission: 'idle',
});

const createInitialPhaseState = (): RitualPhaseState => ({
  name: 'dormant',
  label: 'Dormant Ritual',
  accentHex: '#818cf8',
  energy: 0,
  crowdMultiplier: 0.82,
  portalMultiplier: 0.72,
  bloomBoost: 0.08,
});

const createStandbyPhaseState = (accentHex: string): RitualPhaseState => ({
  name: 'dormant',
  label: 'Standby',
  accentHex,
  energy: 0,
  crowdMultiplier: 0.48,
  portalMultiplier: 0.44,
  bloomBoost: 0.02,
});

const isArcRotateCamera = (camera: ARVSceneController['camera']): boolean => {
  return camera?.getClassName?.() === 'ArcRotateCamera';
};

const createViewerId = (): string => {
  if (typeof window === 'undefined') return 'server';
  const storageKey = 'arv-live-viewer-id';
  const existing = window.localStorage.getItem(storageKey);
  if (existing) return existing;
  const created = typeof crypto !== 'undefined' && 'randomUUID' in crypto
    ? crypto.randomUUID()
    : `viewer-${Math.random().toString(36).slice(2, 10)}`;
  window.localStorage.setItem(storageKey, created);
  return created;
};

const getEventToneClass = (event: ARVCommunityEvent): string => {
  if (event.type === 'chat') {
    return 'arv-live-tone arv-live-tone-chat';
  }

  const reaction = typeof event.payload?.reaction === 'string'
    ? event.payload.reaction
    : 'system';

  return `arv-live-tone arv-live-tone-${reaction}`;
};

const getReactionButtonClass = (reaction: ARVReactionKind): string => {
  return `arv-live-reaction arv-live-reaction-${reaction}`;
};

const mapReactionToVisualEventType = (reaction: ARVReactionKind): ARVVisualEvent['type'] => {
  switch (reaction) {
    case 'fire':
      return 'reaction.fire';
    case 'acid':
      return 'reaction.acid';
    case 'dark':
      return 'reaction.dark';
    case 'peace-love-techno':
      return 'reaction.peaceLoveTechno';
    default:
      return 'reaction.pulse';
  }
};

const createControllerAudioFrame = (
  audio: AudioReactiveSnapshot,
  time: number,
  dt: number,
): ARVAudioFrame => ({
  time,
  dt,
  bass: audio.bass,
  mid: audio.mid,
  high: audio.high,
  rms: audio.rms,
  kick: audio.kick,
  bpm: audio.bpm,
});

const toControllerEvent = (event: ARVCommunityEvent): ARVVisualEvent => {
  if (event.type === 'reaction') {
    const reaction = typeof event.payload?.reaction === 'string'
      ? event.payload.reaction as ARVReactionKind
      : 'pulse';

    return {
      type: mapReactionToVisualEventType(reaction),
      intensity: event.intensity,
      color: event.palette,
      payload: {
        label: event.label,
        source: event.source,
        text: event.text,
        userId: event.userId,
      },
    };
  }

  if (event.type === 'chat') {
    const chatText = event.text || '';
    const isEmoji = /[\p{Extended_Pictographic}\p{Emoji_Presentation}]/u.test(chatText);

    return {
      type: isEmoji ? 'chat.emoji' : 'chat.message',
      intensity: event.intensity,
      color: event.palette,
      payload: {
        label: event.label,
        source: event.source,
        text: chatText,
        userId: event.userId,
      },
    };
  }

  return {
    type: 'audio.drop',
    intensity: event.intensity,
    color: event.palette,
    payload: {
      label: event.label,
      source: event.source,
      text: event.text,
      phaseHint: event.phaseHint,
    },
  };
};

interface ARVLiveCanvasProps {
  mode: ARVLiveMode;
  hudMode?: ARVHudMode;
  initialPresetId?: string;
  presetIdOverride?: string;
  qualityTierOverride?: ARVQualityTier;
  transparentBackground?: boolean;
  localReactionTrigger?: {
    reaction: ARVReactionKind;
    nonce: number;
  } | null;
}

export default function ARVLiveCanvas({
  mode,
  hudMode = 'full',
  initialPresetId,
  presetIdOverride,
  qualityTierOverride,
  transparentBackground = false,
  localReactionTrigger,
}: ARVLiveCanvasProps) {
  const resolvedInitialPresetId = isKnownARVLivePresetId(initialPresetId || '')
    ? initialPresetId || ARV_DEFAULT_LIVE_CONTROL_PRESET_ID
    : ARV_DEFAULT_LIVE_CONTROL_PRESET_ID;
  const resolvedPresetIdOverride = isKnownARVLivePresetId(presetIdOverride || '')
    ? presetIdOverride || undefined
    : undefined;
  const canvasRef = useRef<HTMLCanvasElement | null>(null);
  const audioControllerRef = useRef(new AudioReactiveUniforms());
  const socketRef = useRef<WebSocket | null>(null);
  const eventQueueRef = useRef<ARVCommunityEvent[]>([]);
  const viewerIdRef = useRef(createViewerId());
  const activeControllerRef = useRef<ARVSceneController | null>(null);
  const controlStateRef = useRef<ARVLiveControlState>({
    ...ARV_DEFAULT_LIVE_CONTROL_STATE,
    presetId: resolvedInitialPresetId,
  });
  const visualsEnabledRef = useRef(true);
  const initialPresetSyncRef = useRef<'idle' | 'pending' | 'done'>('idle');
  const [controlState, setControlState] = useState<ARVLiveControlState>({
    ...ARV_DEFAULT_LIVE_CONTROL_STATE,
    presetId: resolvedInitialPresetId,
  });
  const [connectionState, setConnectionState] = useState<'connecting' | 'open' | 'closed'>('connecting');
  const [audioSnapshot, setAudioSnapshot] = useState<AudioReactiveSnapshot>(createInitialAudioSnapshot);
  const [phaseState, setPhaseState] = useState<RitualPhaseState>(createInitialPhaseState);
  const [recentEvents, setRecentEvents] = useState<ARVCommunityEvent[]>([]);
  const [warning, setWarning] = useState<string | null>(null);
  const [obsVisualsEnabled, setObsVisualsEnabled] = useState(true);
  const [obsBusyKey, setObsBusyKey] = useState<string | null>(null);
  const [lastReaction, setLastReaction] = useState<ARVReactionKind | null>(null);
  const activePresetId = resolvedPresetIdOverride || controlState.presetId;
  const activePreset = useMemo(() => getARVLivePreset(activePresetId), [activePresetId]);
  const qualityTier = useMemo<ARVQualityTier>(
    () => qualityTierOverride ?? detectARVQualityTier(mode),
    [mode, qualityTierOverride],
  );
  const resolvedRuntimeOptions = useMemo<ARVLiveRuntimeOptions>(() => ({
    defaultHudMode: mode === 'obs' ? 'full' : 'minimal',
    showFeed: true,
    feedCollapsedByDefault: hudMode !== 'full',
    viewerControls: mode === 'viewer' ? 'compact' : 'hidden',
    keyboardReactions: mode === 'viewer',
    transparentBackground: false,
    ...(activePreset.runtimeOptions ?? {}),
    ...(transparentBackground ? { transparentBackground: true } : {}),
  }), [activePreset.runtimeOptions, hudMode, mode, transparentBackground]);
  const [feedCollapsed, setFeedCollapsed] = useState(
    () => resolvedRuntimeOptions.feedCollapsedByDefault !== false,
  );
  const [viewerControlsExpanded, setViewerControlsExpanded] = useState(
    () => resolvedRuntimeOptions.viewerControls === 'full',
  );
  const isCompactObsHud = mode === 'obs' && hudMode === 'minimal';
  const isPreviewHud = hudMode === 'preview';
  const showHud = !isPreviewHud && hudMode !== 'none';
  const showFeed = showHud && resolvedRuntimeOptions.showFeed !== false;
  const showViewerControlToggle =
    mode === 'viewer' &&
    !isPreviewHud &&
    hudMode !== 'none' &&
    resolvedRuntimeOptions.viewerControls === 'compact';
  const showViewerControls =
    mode === 'viewer' &&
    !isPreviewHud &&
    hudMode !== 'none' &&
    (resolvedRuntimeOptions.viewerControls === 'full' || viewerControlsExpanded);
  const isPassiveSurface = mode === 'obs' && hudMode === 'none';
  const liveTitle = activePreset.title;

  useEffect(() => {
    controlStateRef.current = controlState;
  }, [controlState]);

  useEffect(() => {
    const activeController = activeControllerRef.current;
    if (!activeController) {
      return;
    }

    if (controlState.mix.presetId !== activePreset.id) {
      return;
    }

    activeController.applyMixState(controlState.mix);
  }, [activePreset.id, controlState.mix]);

  useEffect(() => {
    if (!initialPresetId || resolvedPresetIdOverride) {
      return;
    }

    setControlState((current) => {
      if (current.presetId === resolvedInitialPresetId) {
        return current;
      }

      return {
        ...current,
        presetId: resolvedInitialPresetId,
      };
    });
  }, [initialPresetId, resolvedInitialPresetId, resolvedPresetIdOverride]);

  useEffect(() => {
    visualsEnabledRef.current = obsVisualsEnabled;
    if (!obsVisualsEnabled) {
      eventQueueRef.current.length = 0;
      setPhaseState(createStandbyPhaseState(activePreset.portalHex));
    }
  }, [activePreset.portalHex, obsVisualsEnabled]);

  const queueEvent = useCallback((event: ARVCommunityEvent, replay = false) => {
    eventQueueRef.current.push(event);
    if (!replay) {
      setRecentEvents((current) => [event, ...current].slice(0, 3));
    }
  }, []);

  useEffect(() => {
    setFeedCollapsed(resolvedRuntimeOptions.feedCollapsedByDefault !== false);
  }, [activePreset.id, resolvedRuntimeOptions.feedCollapsedByDefault]);

  useEffect(() => {
    setViewerControlsExpanded(resolvedRuntimeOptions.viewerControls === 'full');
  }, [activePreset.id, resolvedRuntimeOptions.viewerControls]);

  useEffect(() => {
    if (!localReactionTrigger) {
      return;
    }

    setLastReaction(localReactionTrigger.reaction);
    queueEvent(createReactionEvent(localReactionTrigger.reaction, 'system', 'preview-local'));
    setWarning(null);
  }, [localReactionTrigger, queueEvent]);

  const startAudio = useCallback(async () => {
    const snapshot = await audioControllerRef.current.start();
    setAudioSnapshot(snapshot);
    if (snapshot.permission === 'error') {
      setWarning(snapshot.error || 'Audio initialization failed');
    }
  }, []);

  const sendReaction = useCallback((reaction: ARVReactionKind) => {
    const socket = socketRef.current;
    const optimisticEvent = createReactionEvent(reaction, 'viewer', viewerIdRef.current);

    setLastReaction(reaction);
    if (!socket || socket.readyState !== WebSocket.OPEN) {
      queueEvent(optimisticEvent);
      setWarning('Live socket offline · local reaction applied');
      return;
    }

    queueEvent(optimisticEvent, true);
    setWarning(null);

    socket.send(JSON.stringify({
      type: 'viewer-reaction',
      reaction,
      userId: viewerIdRef.current,
    }));
  }, [queueEvent]);

  useEffect(() => {
    if (mode !== 'viewer' || resolvedRuntimeOptions.keyboardReactions === false) {
      return;
    }

    const handleKeyDown = (event: KeyboardEvent) => {
      if (event.altKey || event.ctrlKey || event.metaKey || event.shiftKey) {
        return;
      }

      const target = event.target as HTMLElement | null;
      if (
        target &&
        (target.tagName === 'INPUT' ||
          target.tagName === 'TEXTAREA' ||
          target.tagName === 'SELECT' ||
          target.isContentEditable)
      ) {
        return;
      }

      const reaction = KEYBOARD_REACTION_SHORTCUTS[event.key];
      if (!reaction) {
        return;
      }

      event.preventDefault();
      sendReaction(reaction);
    };

    window.addEventListener('keydown', handleKeyDown);
    return () => {
      window.removeEventListener('keydown', handleKeyDown);
    };
  }, [mode, resolvedRuntimeOptions.keyboardReactions, sendReaction]);

  const updateLiveControl = useCallback(async (patch: Partial<ARVLiveControlState>, busyKey: string) => {
    setObsBusyKey(busyKey);

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

      setControlState(data.control);
      setWarning(null);
      return data.control as ARVLiveControlState;
    } catch (error) {
      const fallbackControl: ARVLiveControlState = {
        ...controlStateRef.current,
        ...patch,
      };
      setControlState(fallbackControl);
      setWarning(error instanceof Error ? `${error.message} · local apply` : 'Control update failed · local apply');
      return fallbackControl;
    } finally {
      setObsBusyKey(null);
    }
  }, []);

  useEffect(() => {
    initialPresetSyncRef.current = 'idle';
  }, [initialPresetId]);

  useEffect(() => {
    if (mode !== 'obs' || !initialPresetId) {
      return;
    }

    if (resolvedPresetIdOverride) {
      return;
    }

    if (controlState.presetId === initialPresetId) {
      initialPresetSyncRef.current = 'done';
      return;
    }

    if (connectionState === 'connecting' || initialPresetSyncRef.current !== 'idle') {
      return;
    }

    initialPresetSyncRef.current = 'pending';

    void updateLiveControl({ presetId: initialPresetId }, `preset:${initialPresetId}`)
      .then((nextControl) => {
        initialPresetSyncRef.current = nextControl?.presetId === initialPresetId ? 'done' : 'idle';
      });
  }, [connectionState, controlState.presetId, initialPresetId, mode, resolvedPresetIdOverride, updateLiveControl]);

  useEffect(() => {
    if (!warning) return undefined;
    const timeout = window.setTimeout(() => setWarning(null), 3200);
    return () => window.clearTimeout(timeout);
  }, [warning]);

  useEffect(() => {
    let disposed = false;
    let retryTimer: number | null = null;

    const connect = () => {
      const protocol = window.location.protocol === 'https:' ? 'wss' : 'ws';
      const socket = new WebSocket(`${protocol}://${window.location.host}/ws/arv-live`);
      socketRef.current = socket;
      setConnectionState('connecting');

      socket.onopen = () => {
        setConnectionState('open');
      };

      socket.onmessage = (message) => {
        try {
          const payload = JSON.parse(message.data) as ARVSocketEnvelope;

          if (payload.control) {
            setControlState(payload.control);
          }

          if (payload.type === 'control') {
            return;
          }

          if (payload.type === 'event' && payload.event) {
            queueEvent(payload.event);
            return;
          }

          if (payload.type === 'snapshot') {
            const events = payload.events || [];
            const replayEvents = [...events].reverse();
            setRecentEvents(events.slice(0, 4));
            replayEvents.forEach((event) => queueEvent(event, true));
            return;
          }

          if (payload.type === 'warning' && payload.message) {
            setWarning(payload.message);
          }
        } catch {
          setWarning('Socket payload parse failed');
        }
      };

      socket.onerror = () => {
        setConnectionState('closed');
      };

      socket.onclose = () => {
        setConnectionState('closed');
        if (!disposed) {
          retryTimer = window.setTimeout(connect, 2000);
        }
      };
    };

    connect();

    return () => {
      disposed = true;
      if (retryTimer) {
        window.clearTimeout(retryTimer);
      }
      socketRef.current?.close();
      socketRef.current = null;
    };
  }, [queueEvent]);

  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return undefined;

    const quality = getARVQualitySettings(qualityTier);
    const ritual = new RitualPhaseController();
    const standbyPhase = createStandbyPhaseState(activePreset.portalHex);
    let disposed = false;
    let engine: Engine | null = null;
    let scene: Scene | null = null;
    let controllerScene: ARVSceneController | null = null;
    let handleResize: (() => void) | null = null;

    const cleanup = () => {
      if (handleResize) {
        window.removeEventListener('resize', handleResize);
        handleResize = null;
      }

      activeControllerRef.current = null;
      controllerScene?.dispose();
      controllerScene = null;
      scene?.dispose();
      scene = null;
      engine?.dispose();
      engine = null;
    };

    const initializeScene = async () => {
      try {
        if (disposed) {
          return;
        }

        engine = new Engine(canvas, quality.tier !== 'eco', {
          preserveDrawingBuffer: mode === 'obs' || resolvedRuntimeOptions.transparentBackground === true,
          stencil: quality.enableBloom,
        });
        engine.setHardwareScalingLevel(quality.hardwareScaling);

        scene = new Scene(engine);
        controllerScene = await createARVSceneController(activePreset.controllerId, activePreset);

        if (disposed || !engine || !scene || !controllerScene) {
          cleanup();
          return;
        }

        controllerScene.init({
          engine,
          scene,
          canvas,
          mode,
          quality,
          preset: activePreset,
          runtime: resolvedRuntimeOptions,
        });
        activeControllerRef.current = controllerScene;

        const currentMix = controlStateRef.current.mix;
        if (currentMix.presetId === activePreset.id) {
          controllerScene.applyMixState(currentMix);
        } else {
          const defaultMix = controllerScene.getDefaultMixState();
          controllerScene.applyMixState(defaultMix);

          if (!resolvedPresetIdOverride) {
            void updateLiveControl({ mix: defaultMix }, `mix:${activePreset.id}`);
          }
        }

        if (!isArcRotateCamera(controllerScene.camera)) {
          throw new Error(`ARV controller ${activePreset.controllerId} did not expose an ArcRotateCamera`);
        }

        if (resolvedRuntimeOptions.transparentBackground) {
          scene.clearColor.a = 0;
        }

        if (!visualsEnabledRef.current) {
          controllerScene.onEvent({
            type: 'system.phaseChange',
            payload: {
              phase: standbyPhase,
              standby: true,
            },
          });

          scene.render();
        }

        let lastFrame = performance.now();
        let hudAccumulator = 0;
        let standbyFrameRendered = !visualsEnabledRef.current;

        engine.runRenderLoop(() => {
          if (!scene || !controllerScene) {
            return;
          }

          const now = performance.now();
          const deltaSeconds = Math.min(0.05, (now - lastFrame) / 1000);
          lastFrame = now;

          const audio = audioControllerRef.current.update();
          const visualsEnabled = visualsEnabledRef.current;

          if (!visualsEnabled) {
            eventQueueRef.current.length = 0;
            controllerScene.onEvent({
              type: 'system.phaseChange',
              payload: {
                phase: standbyPhase,
                standby: true,
              },
            });

            if (!standbyFrameRendered) {
              scene.render();
              standbyFrameRendered = true;
            }

            hudAccumulator += deltaSeconds;
            if (hudAccumulator >= 0.2) {
              setAudioSnapshot(audio);
              setPhaseState(standbyPhase);
              hudAccumulator = 0;
            }
            return;
          }

          standbyFrameRendered = false;

          while (eventQueueRef.current.length > 0) {
            const nextEvent = eventQueueRef.current.shift();
            if (!nextEvent) break;
            const impulse = interpretCommunityEvent(nextEvent);
            ritual.registerImpulse(impulse);
            controllerScene.onEvent(toControllerEvent(nextEvent));
          }

          const phase = ritual.update(deltaSeconds, audio, controlStateRef.current.phaseLock);
          controllerScene.onEvent({
            type: 'system.phaseChange',
            payload: {
              phase,
              standby: false,
            },
          });
          controllerScene.update(createControllerAudioFrame(audio, now / 1000, deltaSeconds));

          scene.render();

          hudAccumulator += deltaSeconds;
          if (hudAccumulator >= 0.14) {
            setAudioSnapshot(audio);
            setPhaseState(phase);
            hudAccumulator = 0;
          }
        });

        handleResize = () => {
          if (!engine || !controllerScene) {
            return;
          }

          engine.resize();
          controllerScene.resize(canvas.clientWidth, canvas.clientHeight);
        };
        window.addEventListener('resize', handleResize);
      } catch (error) {
        cleanup();
        if (!disposed) {
          setWarning(error instanceof Error ? error.message : 'ARV live scene initialization failed');
        }
      }
    };

    void initializeScene();

    return () => {
      disposed = true;
      cleanup();
    };
  }, [activePreset, mode, qualityTier, resolvedPresetIdOverride, resolvedRuntimeOptions, updateLiveControl]);

  // Auto-start audio analysis on mount — succeeds silently in OBS Browser Source
  // and when microphone permission was previously granted; falls back to manual button.
  useEffect(() => {
    void audioControllerRef.current.start().then((snapshot) => {
      setAudioSnapshot(snapshot);
    });
    // intentionally no cleanup — the separate dispose-on-unmount effect handles teardown
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  useEffect(() => {
    return () => {
      void audioControllerRef.current.dispose();
    };
  }, []);

  return (
    <div
      className={`arv-live-shell arv-live-preset-${activePreset.id} ${isPreviewHud ? 'arv-live-shell-preview' : ''} ${resolvedRuntimeOptions.transparentBackground ? 'arv-live-shell-transparent' : ''} ${isPassiveSurface ? 'arv-live-shell-passive' : ''}`}
    >
      <div className="arv-live-grid" />
      <canvas ref={canvasRef} className="arv-live-canvas" />

      {showHud && hudMode === 'full' && <div className="arv-live-hud">
        <div className={`arv-live-brand ${isCompactObsHud ? 'arv-live-brand-compact' : ''}`}>
          <div className="arv-live-eyebrow">{isCompactObsHud ? 'OBS Control Overlay' : activePreset.title}</div>
          <div className={`arv-live-title ${isCompactObsHud ? 'arv-live-title-compact' : mode === 'obs' ? 'arv-live-title-obs' : 'arv-live-title-viewer'}`}>
            {isCompactObsHud ? (obsVisualsEnabled ? activePreset.title : 'Quiet Standby') : liveTitle}
          </div>
        </div>

        {hudMode === 'full' && (
          <div className="arv-live-badges">
          {[
            ['Preset', activePreset.title],
            ['Phase', phaseState.label],
            ['Socket', connectionState],
            ['Audio', audioSnapshot.active
              ? (audioSnapshot.bpm > 0 ? `${audioSnapshot.bpm} BPM` : 'live')
              : audioSnapshot.permission === 'error' ? 'error' : 'idle'],
            ['Quality', qualityTier],
          ].map(([label, value]) => (
            <div key={label} className="arv-live-badge">
              <div className="arv-live-badge-label">{label}</div>
              <div className="arv-live-badge-value">{value}</div>
            </div>
          ))}
          </div>
        )}
      </div>}

      {showFeed && <div className={`arv-live-footer ${mode === 'viewer' ? 'arv-live-footer-viewer' : ''}`}>
        <div className={`arv-live-panel arv-live-panel-feed ${feedCollapsed ? 'is-collapsed' : ''}`}>
            <div className="arv-live-panel-head">
              <div className="arv-live-panel-title">Live Event Feed</div>
              <div className="arv-live-panel-actions">
                {warning && <div className="arv-live-warning">{warning}</div>}
                <button
                  type="button"
                  className="arv-live-feed-toggle"
                  onClick={() => setFeedCollapsed((current) => !current)}
                >
                  {feedCollapsed ? 'Open' : 'Hide'}
                </button>
              </div>
            </div>

            {feedCollapsed ? (
              <div className="arv-live-feed-summary">
                {recentEvents[0]
                  ? recentEvents[0].text || recentEvents[0].label
                  : 'Waiting for chat, reactions, and ritual spikes.'}
              </div>
            ) : (
              <div className="arv-live-feed">
                {recentEvents.length === 0 ? (
                  <div className="arv-live-feed-empty">Waiting for chat, reactions, and ritual spikes.</div>
                ) : (
                  recentEvents.map((event) => (
                    <div key={event.id} className="arv-live-event">
                      <div className={getEventToneClass(event)}>{event.label}</div>
                      <div className="arv-live-event-text">
                        {event.text || `${event.type} • intensity ${event.intensity.toFixed(2)}`}
                      </div>
                    </div>
                  ))
                )}
              </div>
            )}
          </div>

        {!audioSnapshot.active && mode !== 'obs' && hudMode === 'full' && (
          <button onClick={startAudio} className="arv-live-audio-button">
            Activate Local Audio Analysis
          </button>
        )}
      </div>}

      {mode === 'obs' && hudMode !== 'none' && (
        <div className={`arv-live-obs-overlay ${isCompactObsHud ? 'arv-live-obs-overlay-compact' : ''}`}>
          <div className="arv-live-panel arv-live-obs-panel">
            <div className="arv-live-panel-head">
              <div className="arv-live-panel-title">OBS Control Overlay</div>
              <div className={`arv-live-obs-state ${obsVisualsEnabled ? 'is-live' : 'is-paused'}`}>
                {obsVisualsEnabled ? 'Live' : 'Paused'}
              </div>
            </div>

            <div className="arv-live-obs-button-row">
              <button
                type="button"
                className={`arv-live-obs-toggle ${obsVisualsEnabled ? 'is-live' : 'is-paused'}`}
                onClick={() => setObsVisualsEnabled((current) => !current)}
              >
                {obsVisualsEnabled ? 'Pause Visuals' : 'Start Visuals'}
              </button>

              {!audioSnapshot.active ? (
                <button type="button" onClick={startAudio} className="arv-live-audio-button arv-live-audio-button-compact">
                  Audio On
                </button>
              ) : (
                <div className="arv-live-obs-meta">Audio live</div>
              )}
            </div>

            <div className="arv-live-obs-section">
              <div className="arv-live-panel-title">Phase</div>
              <div className="arv-live-obs-chip-grid arv-live-obs-chip-grid-phase">
                {OBS_PHASE_SHORTCUTS.map((option) => (
                  <button
                    key={option.value}
                    type="button"
                    className={`arv-live-obs-chip ${controlState.phaseLock === option.value ? 'is-active' : ''}`}
                    onClick={() => void updateLiveControl({ phaseLock: option.value }, `phase-${option.value}`)}
                    disabled={obsBusyKey !== null}
                  >
                    {option.label}
                  </button>
                ))}
              </div>
            </div>

            <div className="arv-live-obs-section">
              <div className="arv-live-panel-title">Preset</div>
              <div className="arv-live-obs-chip-grid arv-live-obs-chip-grid-presets">
                {OBS_PRESET_OPTIONS.map((preset) => (
                  <button
                    key={preset.id}
                    type="button"
                    className={`arv-live-obs-chip ${controlState.presetId === preset.id ? 'is-active' : ''}`}
                    onClick={() => void updateLiveControl({ presetId: preset.id }, `preset-${preset.id}`)}
                    disabled={obsBusyKey !== null}
                  >
                    {preset.title}
                  </button>
                ))}
              </div>
            </div>

            {warning && <div className="arv-live-obs-feedback">{warning}</div>}
          </div>
        </div>
      )}

      {showViewerControlToggle && (
        <div className="arv-live-controls-stack">
          <button
            type="button"
            className={`arv-live-corner-toggle ${viewerControlsExpanded ? 'is-active' : ''}`}
            onClick={() => setViewerControlsExpanded((current) => !current)}
          >
            {viewerControlsExpanded ? 'Hide Reactions' : 'Reactions 1-5'}
          </button>
        </div>
      )}

      {showViewerControls && (
        <div className="arv-live-controls arv-live-controls-viewer">
          <div className="arv-live-panel">
            <div className="arv-live-panel-head">
              <div className="arv-live-panel-title">Viewer Ritual Controls</div>
              <div className="arv-live-panel-title">
                {lastReaction ? ARV_REACTION_PRESETS[lastReaction].label : 'Keys 1-5'}
              </div>
            </div>
            <div className="arv-live-reaction-grid">
              {REACTION_BUTTONS.map((reaction) => (
                <button
                  type="button"
                  key={reaction.key}
                  onClick={() => sendReaction(reaction.key)}
                  className={getReactionButtonClass(reaction.key)}
                >
                  {reaction.label}
                </button>
              ))}
            </div>
            <div className="arv-live-feed-summary">Keyboard shortcuts stay active even when this panel is hidden.</div>
          </div>
        </div>
      )}
    </div>
  );
}

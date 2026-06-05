import React, { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { ARV_LIVE_PRESETS, ARV_ORDERED_LIVE_PRESETS } from '../../lib/arv-live/presets';
import {
  ARV_DEFAULT_LIVE_CONTROL_STATE,
  ARV_REACTION_PRESETS,
  createDefaultARVLiveLayerState,
  type ARVLayerControl,
  type ARVLayerSchema,
  type ARVLiveControlState,
  type ARVLiveMixSnapshot,
  type ARVLiveMixState,
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

interface ARVLiveMixerSchemaResponse {
  success: boolean;
  presetId: string;
  controllerId: string;
  schema: ARVLayerSchema[];
  defaultMix: ARVLiveMixState;
}

interface ARVLiveMixerStateResponse {
  success: boolean;
  presetId: string;
  mix: ARVLiveMixState;
  control: ARVLiveControlState;
}

const PHASE_LOCK_OPTIONS: Array<{ value: ARVPhaseLock; label: string }> = [
  { value: 'auto', label: 'Auto' },
  { value: 'dormant', label: 'Dormant' },
  { value: 'invocation', label: 'Invocation' },
  { value: 'surge', label: 'Surge' },
  { value: 'peak', label: 'Peak' },
  { value: 'euphoria', label: 'Euphoria' },
];

const BLEND_MODE_OPTIONS = [
  { value: 'normal', label: 'Normal' },
  { value: 'add', label: 'Add' },
  { value: 'screen', label: 'Screen' },
  { value: 'multiply', label: 'Multiply' },
] as const;

const REACTION_OPTIONS = Object.values(ARV_REACTION_PRESETS);
const SNAPSHOT_STORAGE_KEY = 'arv-live-mix-snapshots-v1';
const MAX_LOCAL_SNAPSHOTS = 96;
const SLOT_OPTIONS = Array.from({ length: 8 }, (_, index) => ({
  value: String(index + 1),
  label: `S${index + 1}`,
}));

const copyText = async (value: string): Promise<boolean> => {
  try {
    if (navigator.clipboard?.writeText) {
      await navigator.clipboard.writeText(value);
      return true;
    }
  } catch {
    // Fall back for embedded Chromium/OBS.
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

const createSnapshotId = (): string => {
  if (typeof crypto !== 'undefined' && 'randomUUID' in crypto) {
    return crypto.randomUUID();
  }

  return `mix-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`;
};

const readSnapshots = (): ARVLiveMixSnapshot[] => {
  if (typeof window === 'undefined') {
    return [];
  }

  try {
    const raw = window.localStorage.getItem(SNAPSHOT_STORAGE_KEY);
    if (!raw) {
      return [];
    }

    const parsed = JSON.parse(raw);
    if (!Array.isArray(parsed)) {
      return [];
    }

    return parsed.filter((entry): entry is ARVLiveMixSnapshot => {
      return Boolean(
        entry &&
        typeof entry === 'object' &&
        typeof entry.id === 'string' &&
        typeof entry.name === 'string' &&
        typeof entry.presetId === 'string' &&
        (entry.slotIndex === undefined || (typeof entry.slotIndex === 'number' && entry.slotIndex >= 1 && entry.slotIndex <= 8)) &&
        typeof entry.createdAt === 'number' &&
        entry.mix &&
        typeof entry.mix === 'object',
      );
    });
  } catch {
    return [];
  }
};

const writeSnapshots = (snapshots: ARVLiveMixSnapshot[]): void => {
  if (typeof window === 'undefined') {
    return;
  }

  window.localStorage.setItem(SNAPSHOT_STORAGE_KEY, JSON.stringify(snapshots));
};

const getLayerState = (mix: ARVLiveMixState, layerId: string) => {
  return mix.layers[layerId] ?? createDefaultARVLiveLayerState();
};

const getLayerControlValue = (mix: ARVLiveMixState, layerId: string, control: ARVLayerControl) => {
  const layer = getLayerState(mix, layerId);
  const value = layer.controls[control.key];
  return value ?? control.defaultValue;
};

const clampNumber = (value: number, min: number, max: number) => {
  return Math.min(max, Math.max(min, value));
};

const getStepPrecision = (step: number) => {
  if (!Number.isFinite(step)) {
    return 0;
  }

  const serialized = step.toString();
  if (serialized.includes('e-')) {
    return Number(serialized.split('e-')[1] || 0);
  }

  const [, decimals = ''] = serialized.split('.');
  return decimals.length;
};

const normalizeStepValue = (value: number, min: number, max: number, step: number) => {
  const precision = Math.min(4, getStepPrecision(step));
  const relativeStep = Math.round((value - min) / step);
  const snapped = min + relativeStep * step;
  return clampNumber(Number(snapped.toFixed(precision)), min, max);
};

const nudgeStepValue = (value: number, min: number, max: number, step: number, direction: -1 | 1) => {
  return normalizeStepValue(value + step * direction, min, max, step);
};

const formatNumericValue = (value: number, step: number) => {
  return value.toFixed(Math.min(2, getStepPrecision(step)));
};

function RangeControl({
  label,
  value,
  min,
  max,
  step,
  onChange,
}: {
  label: string;
  value: number;
  min: number;
  max: number;
  step: number;
  onChange: (value: number) => void;
}) {
  const decreaseDisabled = value <= min + step / 2;
  const increaseDisabled = value >= max - step / 2;

  return (
    <div className="arv-mixer-inline-field arv-mixer-inline-field-range">
      <span className="arv-mixer-inline-label">{label}</span>
      <div className="arv-mixer-stepper">
        <button
          type="button"
          className="arv-mixer-stepper-button"
          onClick={() => onChange(nudgeStepValue(value, min, max, step, -1))}
          disabled={decreaseDisabled}
          aria-label={`${label} verringern`}
        >
          -
        </button>
        <input
          className="arv-mixer-stepper-slider"
          type="range"
          min={min}
          max={max}
          step={step}
          value={value}
          aria-label={label}
          onChange={(event) => onChange(Number(event.target.value))}
        />
        <button
          type="button"
          className="arv-mixer-stepper-button"
          onClick={() => onChange(nudgeStepValue(value, min, max, step, 1))}
          disabled={increaseDisabled}
          aria-label={`${label} erhoehen`}
        >
          +
        </button>
        <span className="arv-mixer-stepper-value">{formatNumericValue(value, step)}</span>
      </div>
    </div>
  );
}

function ToggleControl({
  label,
  checked,
  onChange,
}: {
  label: string;
  checked: boolean;
  onChange: (value: boolean) => void;
}) {
  return (
    <button
      type="button"
      className={`arv-mixer-toggle-chip${checked ? ' is-active' : ''}`}
      onClick={() => onChange(!checked)}
    >
      <span className="arv-mixer-inline-label">{label}</span>
      <span className="arv-mixer-toggle-state">{checked ? 'On' : 'Off'}</span>
    </button>
  );
}

function SelectControl({
  label,
  value,
  options,
  onChange,
}: {
  label: string;
  value: string;
  options: Array<{ value: string; label: string }>;
  onChange: (value: string) => void;
}) {
  return (
    <label className="arv-mixer-inline-field arv-mixer-inline-field-select">
      <span className="arv-mixer-inline-label">{label}</span>
      <select className="arv-mixer-inline-select" value={value} onChange={(event) => onChange(event.target.value)}>
        {options.map((option) => (
          <option key={option.value} value={option.value}>
            {option.label}
          </option>
        ))}
      </select>
    </label>
  );
}

export default function ARVLiveDockPage() {
  const [status, setStatus] = useState<ARVLiveStatusResponse | null>(null);
  const [control, setControl] = useState<ARVLiveControlState>(ARV_DEFAULT_LIVE_CONTROL_STATE);
  const [schema, setSchema] = useState<ARVLayerSchema[]>([]);
  const [defaultMix, setDefaultMix] = useState<ARVLiveMixState | null>(null);
  const [snapshots, setSnapshots] = useState<ARVLiveMixSnapshot[]>(() => readSnapshots());
  const [feedback, setFeedback] = useState<string | null>(null);
  const [busyKey, setBusyKey] = useState<string | null>(null);
  const [schemaLoading, setSchemaLoading] = useState(false);
  const [mockChatText, setMockChatText] = useState('');
  const [mockChatUserId, setMockChatUserId] = useState('vj-dock');
  const [snapshotName, setSnapshotName] = useState('');
  const [selectedSnapshotId, setSelectedSnapshotId] = useState('');
  const [selectedSlotIndex, setSelectedSlotIndex] = useState(1);
  const controlRef = useRef(control);
  const mixCommitTimerRef = useRef<number | null>(null);

  const pushFeedback = useCallback((value: string) => {
    setFeedback(value);
    window.setTimeout(() => setFeedback(null), 2600);
  }, []);

  useEffect(() => {
    controlRef.current = control;
  }, [control]);

  useEffect(() => {
    writeSnapshots(snapshots);
  }, [snapshots]);

  useEffect(() => {
    document.title = 'ARV Live VJ Mixer';
    document.documentElement.classList.add('dark');
  }, []);

  useEffect(() => {
    return () => {
      if (mixCommitTimerRef.current !== null) {
        window.clearTimeout(mixCommitTimerRef.current);
      }
    };
  }, []);

  const requestJson = useCallback(async <T,>(input: string, init?: RequestInit): Promise<T> => {
    const response = await fetch(input, {
      ...init,
      headers: {
        'Content-Type': 'application/json',
        ...(init?.headers ?? {}),
      },
    });
    const data = await response.json();
    if (!response.ok) {
      throw new Error(data.error || 'Request failed');
    }
    return data as T;
  }, []);

  const cancelPendingMixCommit = useCallback(() => {
    if (mixCommitTimerRef.current !== null) {
      window.clearTimeout(mixCommitTimerRef.current);
      mixCommitTimerRef.current = null;
    }
  }, []);

  const loadSchema = useCallback(async (presetId: string) => {
    setSchemaLoading(true);
    try {
      const data = await requestJson<ARVLiveMixerSchemaResponse>(`/api/arv-live/mixer/schema?preset=${encodeURIComponent(presetId)}`);
      setSchema(data.schema);
      setDefaultMix(data.defaultMix);
      return data;
    } finally {
      setSchemaLoading(false);
    }
  }, [requestJson]);

  const loadStatus = useCallback(async () => {
    const data = await requestJson<ARVLiveStatusResponse>('/api/arv-live/status', {
      headers: {},
    });
    setStatus(data);
    const nextControl = data.control || ARV_DEFAULT_LIVE_CONTROL_STATE;
    setControl(nextControl);
    controlRef.current = nextControl;
    await loadSchema(nextControl.presetId);
  }, [loadSchema, requestJson]);

  useEffect(() => {
    void loadStatus().catch((error: unknown) => {
      pushFeedback(error instanceof Error ? error.message : 'Status load failed');
    });
  }, [loadStatus, pushFeedback]);

  useEffect(() => {
    if (!control.presetId) {
      return;
    }

    void loadSchema(control.presetId).catch(() => {
      // handled through active actions and initial load feedback
    });
  }, [control.presetId, loadSchema]);

  useEffect(() => {
    if (!defaultMix) {
      return;
    }

    setControl((current) => {
      if (current.presetId !== defaultMix.presetId || current.mix.presetId === current.presetId) {
        return current;
      }

      const nextControl = {
        ...current,
        mix: defaultMix,
      };
      controlRef.current = nextControl;
      return nextControl;
    });
  }, [defaultMix]);

  const updateControl = useCallback(async (patch: Partial<ARVLiveControlState>, busyLabel: string) => {
    cancelPendingMixCommit();
    setBusyKey(busyLabel);
    try {
      const data = await requestJson<{ success: boolean; control: ARVLiveControlState }>('/api/arv-live/control', {
        method: 'POST',
        body: JSON.stringify(patch),
      });
      setControl(data.control);
      controlRef.current = data.control;
      if (patch.presetId) {
        pushFeedback(`Preset live: ${ARV_LIVE_PRESETS[data.control.presetId]?.title || data.control.presetId}`);
      } else if (patch.phaseLock) {
        pushFeedback(`Phase live: ${data.control.phaseLock}`);
      } else if (patch.mix) {
        pushFeedback('Mix live');
      }
      return data.control;
    } catch (error) {
      pushFeedback(error instanceof Error ? error.message : 'Control update failed');
      throw error;
    } finally {
      setBusyKey(null);
    }
  }, [cancelPendingMixCommit, pushFeedback, requestJson]);

  const commitMixUpdate = useCallback(async (nextMix: ARVLiveMixState, busyLabel: string) => {
    setBusyKey(busyLabel);
    try {
      const data = await requestJson<ARVLiveMixerStateResponse>('/api/arv-live/mixer/state', {
        method: 'POST',
        body: JSON.stringify({ presetId: controlRef.current.presetId, mix: nextMix }),
      });
      setControl(data.control);
      controlRef.current = data.control;
      return data.control;
    } catch (error) {
      pushFeedback(error instanceof Error ? error.message : 'Mix update failed');
      throw error;
    } finally {
      setBusyKey(null);
    }
  }, [pushFeedback, requestJson]);

  const queueMixChange = useCallback((updater: (currentMix: ARVLiveMixState) => ARVLiveMixState, busyLabel: string) => {
    const currentControl = controlRef.current;
    const nextMix = updater(currentControl.mix);
    const nextControl = {
      ...currentControl,
      mix: nextMix,
    };
    setControl(nextControl);
    controlRef.current = nextControl;

    if (mixCommitTimerRef.current !== null) {
      window.clearTimeout(mixCommitTimerRef.current);
    }

    mixCommitTimerRef.current = window.setTimeout(() => {
      mixCommitTimerRef.current = null;
      void commitMixUpdate(nextMix, busyLabel).catch(() => {
        // feedback handled inside commitMixUpdate
      });
    }, 90);
  }, [commitMixUpdate]);

  const updateLayerField = useCallback((layerId: string, field: 'enabled' | 'opacity' | 'intensity' | 'audioReactive' | 'blendMode', value: boolean | number | string) => {
    queueMixChange((currentMix) => {
      const currentLayer = getLayerState(currentMix, layerId);
      return {
        ...currentMix,
        layers: {
          ...currentMix.layers,
          [layerId]: {
            ...currentLayer,
            [field]: value,
          },
        },
      };
    }, `mix:${layerId}:${field}`);
  }, [queueMixChange]);

  const updateLayerControl = useCallback((layerId: string, controlKey: string, value: boolean | number | string) => {
    queueMixChange((currentMix) => {
      const currentLayer = getLayerState(currentMix, layerId);
      return {
        ...currentMix,
        layers: {
          ...currentMix.layers,
          [layerId]: {
            ...currentLayer,
            controls: {
              ...currentLayer.controls,
              [controlKey]: value,
            },
          },
        },
      };
    }, `mix:${layerId}:${controlKey}`);
  }, [queueMixChange]);

  const updatePostFxControl = useCallback((controlKey: string, value: number) => {
    queueMixChange((currentMix) => ({
      ...currentMix,
      postFx: {
        ...currentMix.postFx,
        [controlKey]: value,
      },
    }), `mix:postfx:${controlKey}`);
  }, [queueMixChange]);

  const updateCameraControl = useCallback((controlKey: string, value: boolean | number | string) => {
    queueMixChange((currentMix) => ({
      ...currentMix,
      camera: {
        ...currentMix.camera,
        [controlKey]: value,
      },
    }), `mix:camera:${controlKey}`);
  }, [queueMixChange]);

  const applyPreset = useCallback(async (presetId: string) => {
    const mixerSchema = await loadSchema(presetId);
    const nextControl = await updateControl({
      presetId,
      mix: mixerSchema.defaultMix,
    }, `preset:${presetId}`);
    controlRef.current = nextControl;
  }, [loadSchema, updateControl]);

  const resetMix = useCallback(async () => {
    cancelPendingMixCommit();
    setBusyKey('mix:reset');
    try {
      const data = await requestJson<ARVLiveMixerStateResponse>('/api/arv-live/mixer/reset', {
        method: 'POST',
        body: JSON.stringify({ presetId: controlRef.current.presetId }),
      });
      setControl(data.control);
      controlRef.current = data.control;
      pushFeedback('Mix reset');
    } catch (error) {
      pushFeedback(error instanceof Error ? error.message : 'Mix reset failed');
    } finally {
      setBusyKey(null);
    }
  }, [cancelPendingMixCommit, pushFeedback, requestJson]);

  const triggerReaction = useCallback(async (reaction: ARVReactionKind) => {
    setBusyKey(`reaction:${reaction}`);
    try {
      await requestJson('/api/arv-live/trigger', {
        method: 'POST',
        body: JSON.stringify({ reaction, userId: 'vj-dock' }),
      });
      pushFeedback(`Triggered ${ARV_REACTION_PRESETS[reaction].label}`);
    } catch (error) {
      pushFeedback(error instanceof Error ? error.message : 'Trigger failed');
    } finally {
      setBusyKey(null);
    }
  }, [pushFeedback, requestJson]);

  const sendMockChat = useCallback(async () => {
    if (!mockChatText.trim()) {
      pushFeedback('Mock chat text is required');
      return;
    }

    setBusyKey('mock-chat');
    try {
      await requestJson('/api/arv-live/mock-chat', {
        method: 'POST',
        body: JSON.stringify({
          text: mockChatText,
          userId: mockChatUserId.trim() || 'vj-dock',
        }),
      });
      setMockChatText('');
      pushFeedback('Mock chat injected');
    } catch (error) {
      pushFeedback(error instanceof Error ? error.message : 'Mock chat failed');
    } finally {
      setBusyKey(null);
    }
  }, [mockChatText, mockChatUserId, pushFeedback, requestJson]);

  const saveSnapshot = useCallback(() => {
    const slotIndex = selectedSlotIndex;
    const existingSlotSnapshot = snapshots.find(
      (entry) => entry.presetId === control.presetId && entry.slotIndex === slotIndex,
    );
    const nextSnapshot: ARVLiveMixSnapshot = {
      id: createSnapshotId(),
      name: snapshotName.trim()
        || existingSlotSnapshot?.name
        || `${ARV_LIVE_PRESETS[control.presetId]?.title || control.presetId} S${slotIndex}`,
      presetId: control.presetId,
      slotIndex,
      createdAt: Date.now(),
      mix: control.mix,
    };

    const nextSnapshots = [
      nextSnapshot,
      ...snapshots.filter((entry) => !(entry.presetId === control.presetId && entry.slotIndex === slotIndex)),
    ].slice(0, MAX_LOCAL_SNAPSHOTS);
    setSnapshots(nextSnapshots);
    setSelectedSnapshotId(nextSnapshot.id);
    setSnapshotName('');
    pushFeedback(`Stored to S${slotIndex}`);
  }, [control.mix, control.presetId, pushFeedback, selectedSlotIndex, snapshotName, snapshots]);

  const copyValue = useCallback(async (label: string, value: string) => {
    const copied = await copyText(value);
    pushFeedback(copied ? `${label} copied` : `${label} ready to copy`);
  }, [pushFeedback]);

  const activePreset = ARV_LIVE_PRESETS[control.presetId] || ARV_LIVE_PRESETS[ARV_DEFAULT_LIVE_CONTROL_STATE.presetId];
  const layerSchemas = useMemo(() => schema.filter((entry) => entry.kind !== 'postFx' && entry.kind !== 'camera'), [schema]);
  const postFxSchema = useMemo(() => schema.find((entry) => entry.kind === 'postFx') || null, [schema]);
  const cameraSchema = useMemo(() => schema.find((entry) => entry.kind === 'camera') || null, [schema]);
  const currentSnapshots = useMemo(
    () => snapshots
      .filter((snapshot) => snapshot.presetId === control.presetId)
      .sort((left, right) => {
        const leftSlot = left.slotIndex ?? Number.MAX_SAFE_INTEGER;
        const rightSlot = right.slotIndex ?? Number.MAX_SAFE_INTEGER;

        if (leftSlot !== rightSlot) {
          return leftSlot - rightSlot;
        }

        return right.createdAt - left.createdAt;
      }),
    [control.presetId, snapshots],
  );
  const visibleQuickSlots = useMemo(
    () => {
      const slots: Array<ARVLiveMixSnapshot | null> = Array.from({ length: 8 }, () => null);
      const legacySnapshots: ARVLiveMixSnapshot[] = [];

      currentSnapshots.forEach((snapshot) => {
        if (typeof snapshot.slotIndex === 'number' && snapshot.slotIndex >= 1 && snapshot.slotIndex <= 8) {
          const slotOffset = snapshot.slotIndex - 1;
          if (!slots[slotOffset]) {
            slots[slotOffset] = snapshot;
            return;
          }
        }

        legacySnapshots.push(snapshot);
      });

      let legacyIndex = 0;
      for (let slotOffset = 0; slotOffset < slots.length; slotOffset += 1) {
        if (!slots[slotOffset] && legacySnapshots[legacyIndex]) {
          slots[slotOffset] = legacySnapshots[legacyIndex];
          legacyIndex += 1;
        }
      }

      return slots;
    },
    [currentSnapshots],
  );
  const obsBrowserSourceUrl = status?.urls.obsBrowserSource || '/arv-live/obs?hud=none&quality=obs&transparent=true&embed=true';
  const isBusy = busyKey !== null;

  const recallSnapshotById = useCallback(async (snapshotId: string) => {
    const snapshot = snapshots.find((entry) => entry.id === snapshotId);
    if (!snapshot) {
      pushFeedback('Select a snapshot first');
      return;
    }

    setSelectedSnapshotId(snapshotId);
  setSelectedSlotIndex(snapshot.slotIndex ?? 1);

    if (snapshot.presetId !== controlRef.current.presetId) {
      await updateControl({ presetId: snapshot.presetId, mix: snapshot.mix }, `snapshot:${snapshot.id}`);
      await loadSchema(snapshot.presetId);
      pushFeedback(`Snapshot recalled: ${snapshot.name}`);
      return;
    }

    cancelPendingMixCommit();
    const nextControl = {
      ...controlRef.current,
      mix: snapshot.mix,
    };
    setControl(nextControl);
    controlRef.current = nextControl;
    await commitMixUpdate(snapshot.mix, `snapshot:${snapshot.id}`);
    pushFeedback(`Snapshot recalled: ${snapshot.name}`);
  }, [cancelPendingMixCommit, commitMixUpdate, loadSchema, pushFeedback, snapshots, updateControl]);

  const recallSnapshot = useCallback(async () => {
    await recallSnapshotById(selectedSnapshotId);
  }, [recallSnapshotById, selectedSnapshotId]);

  return (
    <div className="arv-live-route arv-dock-route">
      <div className="arv-mixer-shell">
        <div className="arv-mixer-topbar">
          <div>
            <div className="arv-live-eyebrow">ARV Live</div>
            <h1 className="arv-mixer-title">One-Page Dock</h1>
          </div>

          <div className="arv-mixer-statusbar">
            <div className="arv-live-badge">
              <div className="arv-live-badge-label">Hub</div>
              <div className="arv-live-badge-value">{status?.configured ? 'online' : 'offline'}</div>
            </div>
            <div className="arv-live-badge">
              <div className="arv-live-badge-label">Preset</div>
              <div className="arv-live-badge-value">{activePreset?.title || control.presetId}</div>
            </div>
            <div className="arv-live-badge">
              <div className="arv-live-badge-label">Phase</div>
              <div className="arv-live-badge-value">{control.phaseLock}</div>
            </div>
            <div className="arv-live-badge">
              <div className="arv-live-badge-label">Schema</div>
              <div className="arv-live-badge-value">{schemaLoading ? 'loading' : `${layerSchemas.length} layers`}</div>
            </div>
          </div>
        </div>

        {feedback && <div className="arv-operator-feedback arv-mixer-feedback">{feedback}</div>}

        <div className="arv-mixer-grid">
          <section className="arv-dock-panel arv-mixer-panel arv-mixer-panel-controls">
            <div className="arv-operator-section-title">Deck</div>
            <div className="arv-mixer-control-grid">
              <SelectControl
                label="Preset"
                value={control.presetId}
                options={ARV_ORDERED_LIVE_PRESETS.map((preset) => ({ value: preset.id, label: preset.title }))}
                onChange={(value) => { void applyPreset(value); }}
              />

              <SelectControl
                label="Phase"
                value={control.phaseLock}
                options={PHASE_LOCK_OPTIONS.map((option) => ({ value: option.value, label: option.label }))}
                onChange={(value) => { void updateControl({ phaseLock: value as ARVPhaseLock }, `phase:${value}`); }}
              />
            </div>

            <div className="arv-dock-button-row arv-mixer-action-row">
              <button type="button" className="arv-operator-ghost-button" onClick={() => void loadStatus()} disabled={isBusy}>
                Sync
              </button>
              <button type="button" className="arv-operator-ghost-button" onClick={() => void resetMix()} disabled={isBusy}>
                Reset
              </button>
              <button
                type="button"
                className="arv-operator-primary-button"
                onClick={() => void copyValue('OBS Browser Source', obsBrowserSourceUrl)}
                disabled={isBusy}
              >
                OBS URL
              </button>
            </div>

            <div className="arv-mixer-source-note">
              OBS: {obsBrowserSourceUrl}
            </div>
          </section>

          <section className="arv-dock-panel arv-mixer-panel arv-mixer-panel-snapshots">
            <div className="arv-operator-section-title">Slots</div>
            <div className="arv-mixer-inline-form arv-mixer-inline-form-store">
              <SelectControl
                label="Slot"
                value={String(selectedSlotIndex)}
                options={SLOT_OPTIONS}
                onChange={(value) => setSelectedSlotIndex(Number(value))}
              />
              <label className="arv-mixer-inline-field arv-mixer-inline-field-text arv-mixer-inline-field-grow">
                <span className="arv-mixer-inline-label">Store</span>
                <input
                  className="arv-mixer-inline-input"
                  value={snapshotName}
                  onChange={(event) => setSnapshotName(event.target.value)}
                  onKeyDown={(event) => {
                    if (event.key === 'Enter') {
                      event.preventDefault();
                      saveSnapshot();
                    }
                  }}
                  placeholder={`Preset S${selectedSlotIndex}`}
                />
              </label>
              <button type="button" className="arv-operator-primary-button arv-mixer-inline-button" onClick={saveSnapshot} disabled={isBusy}>
                Store
              </button>
            </div>

            <div className="arv-mixer-slot-grid">
              {visibleQuickSlots.map((snapshot, index) => (
                snapshot ? (
                  <button
                    type="button"
                    key={snapshot.id}
                    title={snapshot.name}
                    className={`arv-mixer-slot${selectedSnapshotId === snapshot.id ? ' is-selected' : ''}${selectedSlotIndex === index + 1 ? ' is-armed' : ''}`}
                    onClick={() => {
                      setSelectedSlotIndex(index + 1);
                      void recallSnapshotById(snapshot.id);
                    }}
                    disabled={isBusy}
                  >
                    <span className="arv-mixer-slot-index">S{index + 1}</span>
                    <span className="arv-mixer-slot-name">{snapshot.name}</span>
                  </button>
                ) : (
                  <button
                    type="button"
                    key={`slot-empty-${index}`}
                    className={`arv-mixer-slot is-empty${selectedSlotIndex === index + 1 ? ' is-armed' : ''}`}
                    onClick={() => {
                      setSelectedSlotIndex(index + 1);
                      setSelectedSnapshotId('');
                    }}
                    disabled={isBusy}
                    aria-label={`Slot ${index + 1} leer`}
                  >
                    <span className="arv-mixer-slot-index">S{index + 1}</span>
                    <span className="arv-mixer-slot-name">Empty</span>
                  </button>
                )
              ))}
            </div>

            <div className="arv-mixer-inline-form arv-mixer-inline-form-stack">
              <SelectControl
                label="Recall"
                value={selectedSnapshotId}
                options={[
                  { value: '', label: currentSnapshots.length > 0 ? 'Select slot snapshot' : 'No local snapshots' },
                  ...visibleQuickSlots.flatMap((snapshot, index) => snapshot ? [{
                    value: snapshot.id,
                    label: `S${index + 1} · ${snapshot.name}`,
                  }] : []),
                ]}
                onChange={setSelectedSnapshotId}
              />
              <button type="button" className="arv-operator-ghost-button arv-mixer-inline-button" onClick={() => { void recallSnapshot(); }} disabled={!selectedSnapshotId || isBusy}>
                Recall
              </button>
            </div>
          </section>

          <section className="arv-dock-panel arv-mixer-panel arv-mixer-panel-reactions">
            <div className="arv-operator-section-title">FX</div>
            <div className="arv-live-reaction-grid arv-dock-reaction-grid arv-mixer-reaction-grid">
              {REACTION_OPTIONS.map((reaction) => (
                <button
                  type="button"
                  key={reaction.key}
                  onClick={() => { void triggerReaction(reaction.key); }}
                  className={`arv-live-reaction arv-live-reaction-${reaction.key}`}
                  disabled={isBusy}
                >
                  {reaction.label}
                </button>
              ))}
            </div>
          </section>

          <section className="arv-dock-panel arv-mixer-panel arv-mixer-panel-chat">
            <div className="arv-operator-section-title">Chat</div>
            <div className="arv-mixer-chat-row">
              <label className="arv-mixer-inline-field arv-mixer-inline-field-text">
                <span className="arv-mixer-inline-label">User</span>
                <input
                  className="arv-mixer-inline-input"
                  value={mockChatUserId}
                  onChange={(event) => setMockChatUserId(event.target.value)}
                  placeholder="vj-dock"
                />
              </label>
              <label className="arv-mixer-inline-field arv-mixer-inline-field-text arv-mixer-inline-field-grow">
                <span className="arv-mixer-inline-label">Text</span>
                <input
                  className="arv-mixer-inline-input"
                  value={mockChatText}
                  onChange={(event) => setMockChatText(event.target.value)}
                  onKeyDown={(event) => {
                    if (event.key === 'Enter') {
                      event.preventDefault();
                      void sendMockChat();
                    }
                  }}
                  placeholder="Mock audience line"
                />
              </label>
              <button type="button" className="arv-operator-primary-button arv-mixer-inline-button" onClick={() => { void sendMockChat(); }} disabled={isBusy}>
                Send
              </button>
            </div>
          </section>

          <section className="arv-dock-panel arv-mixer-panel arv-mixer-panel-layers">
            <div className="arv-operator-section-title">One-Page Deck</div>
            <div className="arv-mixer-layer-grid">
              {layerSchemas.map((layerSchema) => {
                const layerState = getLayerState(control.mix, layerSchema.id);
                return (
                  <article key={layerSchema.id} className="arv-mixer-layer-card">
                    <div className="arv-mixer-layer-head">
                      <div>
                        <div className="arv-mixer-layer-title">{layerSchema.label}</div>
                        <div className="arv-mixer-layer-key">{layerSchema.id}</div>
                      </div>
                      <ToggleControl
                        label="Enabled"
                        checked={layerState.enabled}
                        onChange={(value) => updateLayerField(layerSchema.id, 'enabled', value)}
                      />
                    </div>

                    <div className="arv-mixer-layer-basics">
                      <RangeControl
                        label="Opacity"
                        value={layerState.opacity}
                        min={0}
                        max={1}
                        step={0.01}
                        onChange={(value) => updateLayerField(layerSchema.id, 'opacity', value)}
                      />
                      <RangeControl
                        label="Intensity"
                        value={layerState.intensity}
                        min={0}
                        max={2}
                        step={0.01}
                        onChange={(value) => updateLayerField(layerSchema.id, 'intensity', value)}
                      />
                    </div>

                    <div className="arv-mixer-layer-meta">
                      <ToggleControl
                        label="Audio Reactive"
                        checked={layerState.audioReactive}
                        onChange={(value) => updateLayerField(layerSchema.id, 'audioReactive', value)}
                      />
                      <SelectControl
                        label="Blend"
                        value={layerState.blendMode}
                        options={BLEND_MODE_OPTIONS.map((option) => ({ value: option.value, label: option.label }))}
                        onChange={(value) => updateLayerField(layerSchema.id, 'blendMode', value)}
                      />
                    </div>

                    <div className="arv-mixer-layer-controls">
                      {layerSchema.controls.map((controlEntry) => {
                        const controlValue = getLayerControlValue(control.mix, layerSchema.id, controlEntry);

                        if (controlEntry.type === 'slider') {
                          return (
                            <RangeControl
                              key={`${layerSchema.id}-${controlEntry.key}`}
                              label={controlEntry.label}
                              value={Number(controlValue)}
                              min={controlEntry.min}
                              max={controlEntry.max}
                              step={controlEntry.step ?? 0.01}
                              onChange={(value) => updateLayerControl(layerSchema.id, controlEntry.key, value)}
                            />
                          );
                        }

                        if (controlEntry.type === 'toggle') {
                          return (
                            <ToggleControl
                              key={`${layerSchema.id}-${controlEntry.key}`}
                              label={controlEntry.label}
                              checked={Boolean(controlValue)}
                              onChange={(value) => updateLayerControl(layerSchema.id, controlEntry.key, value)}
                            />
                          );
                        }

                        return (
                          <SelectControl
                            key={`${layerSchema.id}-${controlEntry.key}`}
                            label={controlEntry.label}
                            value={String(controlValue)}
                            options={controlEntry.options}
                            onChange={(value) => updateLayerControl(layerSchema.id, controlEntry.key, value)}
                          />
                        );
                      })}
                    </div>
                  </article>
                );
              })}
              {postFxSchema ? (
                <article className="arv-mixer-layer-card arv-mixer-layer-card-global">
                  <div className="arv-mixer-layer-head">
                    <div>
                      <div className="arv-mixer-layer-title">Post FX</div>
                      <div className="arv-mixer-layer-key">global</div>
                    </div>
                  </div>
                  <div className="arv-mixer-layer-controls arv-mixer-layer-controls-compact">
                    {postFxSchema.controls.map((controlEntry) => {
                      if (controlEntry.type !== 'slider') {
                        return null;
                      }

                      return (
                        <RangeControl
                          key={controlEntry.key}
                          label={controlEntry.label}
                          value={Number(control.mix.postFx[controlEntry.key as keyof ARVLiveMixState['postFx']] ?? controlEntry.defaultValue)}
                          min={controlEntry.min}
                          max={controlEntry.max}
                          step={controlEntry.step ?? 0.01}
                          onChange={(value) => updatePostFxControl(controlEntry.key, value)}
                        />
                      );
                    })}
                  </div>
                </article>
              ) : null}

              {cameraSchema ? (
                <article className="arv-mixer-layer-card arv-mixer-layer-card-global">
                  <div className="arv-mixer-layer-head">
                    <div>
                      <div className="arv-mixer-layer-title">Camera</div>
                      <div className="arv-mixer-layer-key">global</div>
                    </div>
                  </div>
                  <div className="arv-mixer-layer-controls arv-mixer-layer-controls-compact">
                    {cameraSchema.controls.map((controlEntry) => {
                      const cameraValue = control.mix.camera[controlEntry.key as keyof ARVLiveMixState['camera']] ?? controlEntry.defaultValue;

                      if (controlEntry.type === 'slider') {
                        return (
                          <RangeControl
                            key={controlEntry.key}
                            label={controlEntry.label}
                            value={Number(cameraValue)}
                            min={controlEntry.min}
                            max={controlEntry.max}
                            step={controlEntry.step ?? 0.01}
                            onChange={(value) => updateCameraControl(controlEntry.key, value)}
                          />
                        );
                      }

                      if (controlEntry.type === 'toggle') {
                        return (
                          <ToggleControl
                            key={controlEntry.key}
                            label={controlEntry.label}
                            checked={Boolean(cameraValue)}
                            onChange={(value) => updateCameraControl(controlEntry.key, value)}
                          />
                        );
                      }

                      return (
                        <SelectControl
                          key={controlEntry.key}
                          label={controlEntry.label}
                          value={String(cameraValue)}
                          options={controlEntry.options}
                          onChange={(value) => updateCameraControl(controlEntry.key, value)}
                        />
                      );
                    })}
                  </div>
                </article>
              ) : null}
            </div>
          </section>
        </div>
      </div>
    </div>
  );
}
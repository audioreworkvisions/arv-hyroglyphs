import { Router, type Request, type Response, type NextFunction } from 'express';
import { ARV_LIVE_PRESETS } from '../../lib/arv-live/presets';
import { createARVSceneController } from '../../lib/arv-live/babylon/controllers/registry';
import {
  ARV_REACTION_PRESETS,
  createDefaultARVLiveLayerState,
  createReactionEvent,
  isARVPhaseLock,
  normalizeARVLiveMixState,
  normalizeARVCommunityEvent,
  type ARVLayerControl,
  type ARVLiveMixState,
  type ARVLiveControlState,
  type ARVReactionKind,
} from '../../lib/arv-live/types';
import type { ARVSceneController } from '../../lib/arv-live/babylon/controllers/ARVSceneController';
import type { ARVLiveEventHub } from '../../lib/arv-live/server/ARVLiveEventHub';
import type { MockYouTubeChatIngest } from '../../lib/arv-live/server/MockYouTubeChatIngest';
import { buildPublicUrl } from '../utils/http';

interface ARVLiveRoutesDependencies {
  port: number;
  getHub: () => ARVLiveEventHub | null;
  getMockChatIngest: () => MockYouTubeChatIngest | null;
}

const isKnownLivePresetId = (value: string): boolean => {
  return Object.prototype.hasOwnProperty.call(ARV_LIVE_PRESETS, value);
};

const toObjectRecord = (value: unknown): Record<string, unknown> => {
  return value && typeof value === 'object' && !Array.isArray(value)
    ? value as Record<string, unknown>
    : {};
};

const sanitizeLayerControlValue = (control: ARVLayerControl, value: unknown): boolean | number | string => {
  if (control.type === 'toggle') {
    return typeof value === 'boolean' ? value : control.defaultValue;
  }

  if (control.type === 'select') {
    return control.options.some((option) => option.value === value)
      ? value as string
      : control.defaultValue;
  }

  const normalized = typeof value === 'number' && Number.isFinite(value)
    ? value
    : control.defaultValue;
  return Math.min(control.max, Math.max(control.min, normalized));
};

const loadControllerForPreset = async (presetId: string): Promise<ARVSceneController> => {
  const preset = ARV_LIVE_PRESETS[presetId];
  if (!preset) {
    throw new Error('Unknown presetId');
  }

  return createARVSceneController(preset.controllerId, preset);
};

const sanitizeMixForController = (
  rawMix: unknown,
  controller: ARVSceneController,
  presetId: string,
): ARVLiveMixState => {
  const normalizedInput = normalizeARVLiveMixState(
    {
      ...(toObjectRecord(rawMix) as Partial<ARVLiveMixState>),
      presetId,
    },
    presetId,
  );
  const defaultMix = controller.getDefaultMixState();
  const schema = controller.getLayerSchema();
  const schemaLayerIds = schema
    .filter((section) => section.kind !== 'postFx' && section.kind !== 'camera')
    .map((section) => section.id);
  const knownLayerIds = new Set([...Object.keys(defaultMix.layers), ...schemaLayerIds]);

  const layers = [...knownLayerIds].reduce<ARVLiveMixState['layers']>((accumulator, layerId) => {
    const defaultLayer = defaultMix.layers[layerId] ?? createDefaultARVLiveLayerState();
    const inputLayer = normalizedInput.layers[layerId];

    accumulator[layerId] = {
      ...defaultLayer,
      ...(inputLayer ?? {}),
      controls: {
        ...defaultLayer.controls,
        ...(inputLayer?.controls ?? {}),
      },
    };

    return accumulator;
  }, {});

  const nextMix = normalizeARVLiveMixState(
    {
      ...defaultMix,
      ...normalizedInput,
      presetId,
      layers,
      postFx: {
        ...defaultMix.postFx,
        ...normalizedInput.postFx,
      },
      camera: {
        ...defaultMix.camera,
        ...normalizedInput.camera,
      },
    },
    presetId,
  );

  schema.forEach((section) => {
    if (section.kind === 'postFx') {
      const postFx = nextMix.postFx as unknown as Record<string, unknown>;
      section.controls.forEach((control) => {
        postFx[control.key] = sanitizeLayerControlValue(control, postFx[control.key]);
      });
      return;
    }

    if (section.kind === 'camera') {
      const camera = nextMix.camera as unknown as Record<string, unknown>;
      section.controls.forEach((control) => {
        camera[control.key] = sanitizeLayerControlValue(control, camera[control.key]);
      });
      return;
    }

    const layer = nextMix.layers[section.id] ?? createDefaultARVLiveLayerState();
    section.controls.forEach((control) => {
      if (control.target === 'layer') {
        const layerRecord = layer as unknown as Record<string, unknown>;
        layerRecord[control.key] = sanitizeLayerControlValue(control, layerRecord[control.key]);
        return;
      }

      layer.controls[control.key] = sanitizeLayerControlValue(control, layer.controls[control.key]);
    });
    nextMix.layers[section.id] = layer;
  });

  return nextMix;
};

/**
 * Middleware: require a valid ARV_OPERATOR_TOKEN if one is configured.
 * Clients must send: Authorization: Bearer <token>
 * If ARV_OPERATOR_TOKEN is not set in env the check is skipped (dev mode).
 */
const requireOperatorToken = (req: Request, res: Response, next: NextFunction): void => {
  const envToken = process.env.ARV_OPERATOR_TOKEN;
  if (!envToken) {
    next();
    return;
  }

  const authHeader = req.headers['authorization'];
  if (typeof authHeader !== 'string' || !authHeader.startsWith('Bearer ')) {
    res.status(401).json({ error: 'Unauthorized: missing Bearer token' });
    return;
  }

  const provided = authHeader.slice('Bearer '.length);
  if (provided !== envToken) {
    res.status(403).json({ error: 'Forbidden: invalid operator token' });
    return;
  }

  next();
};

export const createARVLiveRoutes = ({ port, getHub, getMockChatIngest }: ARVLiveRoutesDependencies) => {
  const router = Router();

  router.get('/api/arv-live/status', (req, res) => {
    const hub = getHub();
    const control = hub?.getControlState() || null;

    return res.json({
      success: true,
      configured: Boolean(hub),
      wsPath: '/ws/arv-live',
      mockChat: Boolean(getMockChatIngest()),
      control,
      presetIds: Object.keys(ARV_LIVE_PRESETS),
      urls: {
        obs: buildPublicUrl(req, '/arv-live/obs', port),
        obsBrowserSource: buildPublicUrl(req, '/arv-live/obs?hud=none&quality=obs&transparent=true&embed=true', port),
        viewer: buildPublicUrl(req, '/arv-live/viewer?quality=ultra&hud=minimal', port),
        operator: buildPublicUrl(req, '/arv-live/operator', port),
        dock: buildPublicUrl(req, '/arv-live/dock', port),
      },
    });
  });

  router.get('/api/arv-live/control', (_req, res) => {
    const hub = getHub();
    if (!hub) {
      return res.status(503).json({ error: 'ARV Live hub not ready' });
    }

    return res.json({
      success: true,
      control: hub.getControlState(),
    });
  });

  router.post('/api/arv-live/control', requireOperatorToken, (req, res) => {
    const hub = getHub();
    if (!hub) {
      return res.status(503).json({ error: 'ARV Live hub not ready' });
    }

    const applyControlUpdate = async () => {
      const { presetId, phaseLock, mix } = req.body || {};
      const currentControl = hub.getControlState();
      const nextState: Partial<ARVLiveControlState> = {};

      if (typeof presetId === 'string') {
        const normalizedPresetId = presetId.trim();
        if (!normalizedPresetId || !isKnownLivePresetId(normalizedPresetId)) {
          return res.status(400).json({ error: 'Unknown presetId' });
        }
        nextState.presetId = normalizedPresetId;
      }

      if (phaseLock !== undefined) {
        if (!isARVPhaseLock(phaseLock)) {
          return res.status(400).json({ error: 'Invalid phaseLock' });
        }
        nextState.phaseLock = phaseLock;
      }

      if (mix !== undefined) {
        const targetPresetId = nextState.presetId || currentControl.presetId;
        const requestedMixPresetId = typeof toObjectRecord(mix).presetId === 'string'
          ? String(toObjectRecord(mix).presetId).trim()
          : '';

        if (requestedMixPresetId && requestedMixPresetId !== targetPresetId) {
          return res.status(400).json({ error: 'mix presetId does not match target presetId' });
        }

        const controller = await loadControllerForPreset(targetPresetId);
        nextState.mix = sanitizeMixForController(mix, controller, targetPresetId);
      }

      if (!nextState.presetId && !nextState.phaseLock && !nextState.mix) {
        return res.status(400).json({ error: 'presetId, phaseLock or mix is required' });
      }

      const control = hub.updateControlState(nextState);
      const statusParts = [
        nextState.presetId ? `Preset ${control.presetId}` : null,
        nextState.phaseLock ? `Phase ${control.phaseLock}` : null,
        nextState.mix ? `Mixer ${control.mix.presetId}` : null,
      ].filter(Boolean);

      hub.publish(
        normalizeARVCommunityEvent({
          type: 'system',
          source: 'system',
          label: 'Operator',
          text: statusParts.length > 0 ? statusParts.join(' · ') : `Preset ${control.presetId} · Phase ${control.phaseLock}`,
          palette: ARV_LIVE_PRESETS[control.presetId]?.accentHex || '#c084fc',
          intensity: 0.46,
          phaseHint: control.phaseLock === 'auto' ? 'surge' : control.phaseLock,
          tags: ['operator', 'control', ...(nextState.mix ? ['mixer'] : [])],
          payload: { control },
        }),
      );

      return res.json({ success: true, control });
    };

    void applyControlUpdate().catch((error: unknown) => {
      res.status(500).json({
        error: error instanceof Error ? error.message : 'Control update failed',
      });
    });
  });

  router.get('/api/arv-live/mixer/state', (req, res) => {
    const hub = getHub();
    if (!hub) {
      return res.status(503).json({ error: 'ARV Live hub not ready' });
    }

    const control = hub.getControlState();
    return res.json({
      success: true,
      presetId: control.presetId,
      mix: control.mix,
      control,
    });
  });

  router.post('/api/arv-live/mixer/state', requireOperatorToken, (req, res) => {
    const hub = getHub();
    if (!hub) {
      return res.status(503).json({ error: 'ARV Live hub not ready' });
    }

    const updateMixerState = async () => {
      const currentControl = hub.getControlState();
      const requestedPresetId = typeof req.body?.presetId === 'string'
        ? req.body.presetId.trim()
        : currentControl.presetId;

      if (!requestedPresetId || !isKnownLivePresetId(requestedPresetId)) {
        return res.status(400).json({ error: 'Unknown presetId' });
      }

      if (req.body?.mix === undefined) {
        return res.status(400).json({ error: 'mix is required' });
      }

      const controller = await loadControllerForPreset(requestedPresetId);
      const mix = sanitizeMixForController(req.body.mix, controller, requestedPresetId);
      const control = hub.updateControlState({
        ...(requestedPresetId !== currentControl.presetId ? { presetId: requestedPresetId } : {}),
        mix,
      });

      return res.json({ success: true, mix: control.mix, control });
    };

    void updateMixerState().catch((error: unknown) => {
      res.status(500).json({
        error: error instanceof Error ? error.message : 'Mixer state update failed',
      });
    });
  });

  router.get('/api/arv-live/mixer/schema', (req, res) => {
    const hub = getHub();
    const fallbackPresetId = hub?.getControlState().presetId || Object.keys(ARV_LIVE_PRESETS)[0];
    const requestedPresetId = typeof req.query.preset === 'string'
      ? req.query.preset.trim()
      : fallbackPresetId;

    if (!requestedPresetId || !isKnownLivePresetId(requestedPresetId)) {
      return res.status(400).json({ error: 'Unknown presetId' });
    }

    const loadSchema = async () => {
      const controller = await loadControllerForPreset(requestedPresetId);
      return res.json({
        success: true,
        presetId: requestedPresetId,
        controllerId: ARV_LIVE_PRESETS[requestedPresetId].controllerId,
        schema: controller.getLayerSchema(),
        defaultMix: controller.getDefaultMixState(),
      });
    };

    void loadSchema().catch((error: unknown) => {
      res.status(500).json({
        error: error instanceof Error ? error.message : 'Mixer schema load failed',
      });
    });
  });

  router.post('/api/arv-live/mixer/reset', requireOperatorToken, (req, res) => {
    const hub = getHub();
    if (!hub) {
      return res.status(503).json({ error: 'ARV Live hub not ready' });
    }

    const resetMixerState = async () => {
      const currentControl = hub.getControlState();
      const requestedPresetId = typeof req.body?.presetId === 'string'
        ? req.body.presetId.trim()
        : currentControl.presetId;

      if (!requestedPresetId || !isKnownLivePresetId(requestedPresetId)) {
        return res.status(400).json({ error: 'Unknown presetId' });
      }

      const controller = await loadControllerForPreset(requestedPresetId);
      const defaultMix = controller.getDefaultMixState();
      const control = hub.updateControlState({
        ...(requestedPresetId !== currentControl.presetId ? { presetId: requestedPresetId } : {}),
        mix: defaultMix,
      });

      return res.json({ success: true, mix: control.mix, control });
    };

    void resetMixerState().catch((error: unknown) => {
      res.status(500).json({
        error: error instanceof Error ? error.message : 'Mixer reset failed',
      });
    });
  });

  router.post('/api/arv-live/mock-chat', (req, res) => {
    const hub = getHub();
    const { text, userId } = req.body || {};

    if (!hub) {
      return res.status(503).json({ error: 'ARV Live hub not ready' });
    }

    if (typeof text !== 'string' || !text.trim()) {
      return res.status(400).json({ error: 'text is required' });
    }

    const moderation = hub.publishChatMessage(
      text,
      'mock-youtube',
      typeof userId === 'string' ? userId.trim() || undefined : undefined,
    );

    if (!moderation.allowed) {
      return res.status(400).json({
        error: moderation.reason || 'Message blocked',
        sanitizedText: moderation.sanitizedText,
      });
    }

    return res.json({
      success: true,
      sanitizedText: moderation.sanitizedText,
    });
  });

  router.post('/api/arv-live/trigger', requireOperatorToken, (req, res) => {
    const hub = getHub();
    const { reaction, text, userId } = req.body || {};

    if (!hub) {
      return res.status(503).json({ error: 'ARV Live hub not ready' });
    }

    const normalizedUserId = typeof userId === 'string' && userId.trim()
      ? userId.trim()
      : 'operator';

    if (typeof reaction === 'string') {
      if (!(reaction in ARV_REACTION_PRESETS)) {
        return res.status(400).json({ error: 'Unknown reaction' });
      }

      const event = createReactionEvent(reaction as ARVReactionKind, 'system', normalizedUserId);
      hub.publish(event);
      return res.json({ success: true, event });
    }

    if (typeof text === 'string' && text.trim()) {
      const moderation = hub.publishChatMessage(text, 'system', normalizedUserId);
      if (!moderation.allowed) {
        return res.status(400).json({
          error: moderation.reason || 'Message blocked',
          sanitizedText: moderation.sanitizedText,
        });
      }

      return res.json({
        success: true,
        sanitizedText: moderation.sanitizedText,
      });
    }

    return res.status(400).json({ error: 'reaction or text is required' });
  });

  return router;
};
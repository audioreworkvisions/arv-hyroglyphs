import type { IncomingMessage, Server as HttpServer } from 'http';
import type { Duplex } from 'stream';
import { WebSocketServer, WebSocket } from 'ws';
import {
  ARV_DEFAULT_LIVE_CONTROL_STATE,
  ARV_REACTION_PRESETS,
  createReactionEvent,
  normalizeARVLiveControlState,
  normalizeARVCommunityEvent,
  type ARVCommunityEvent,
  type ARVLiveControlState,
  type ARVReactionKind,
  type ARVSocketEnvelope,
} from '../types';
import { basicModerationHook, type ModerationResult } from './moderation';
import { FixedWindowRateLimiter } from './rateLimit';

interface ViewerReactionCommand {
  type: 'viewer-reaction';
  reaction: ARVReactionKind;
  userId?: string;
}

interface ChatInjectCommand {
  type: 'chat-inject';
  text: string;
  userId?: string;
}

interface PingCommand {
  type: 'ping';
}

type ARVClientCommand = ViewerReactionCommand | ChatInjectCommand | PingCommand;

export interface ARVLiveEventHubOptions {
  path?: string;
  maxEventsPerWindow?: number;
  rateLimitWindowMs?: number;
  moderationHook?: (value: string) => ModerationResult;
}

export class ARVLiveEventHub {
  private readonly server: HttpServer;
  private readonly wss: WebSocketServer;
  private readonly path: string;
  private readonly clients = new Set<WebSocket>();
  private readonly limiter: FixedWindowRateLimiter;
  private readonly moderationHook: (value: string) => ModerationResult;
  private readonly recentEvents: ARVCommunityEvent[] = [];
  private readonly reactionCounters = new Map<ARVReactionKind, number>();
  private controlState: ARVLiveControlState = ARV_DEFAULT_LIVE_CONTROL_STATE;
  private totalEvents = 0;
  private readonly upgradeHandler: (request: IncomingMessage, socket: Duplex, head: Buffer) => void;

  constructor(server: HttpServer, options: ARVLiveEventHubOptions = {}) {
    this.server = server;
    this.path = options.path || '/ws/arv-live';
    this.wss = new WebSocketServer({ noServer: true });
    this.limiter = new FixedWindowRateLimiter(
      options.rateLimitWindowMs ?? 10_000,
      options.maxEventsPerWindow ?? 6,
    );
    this.moderationHook = options.moderationHook ?? basicModerationHook;

    this.wss.on('connection', (socket, request) => {
      this.handleConnection(socket, request);
    });

    this.upgradeHandler = (request, socket, head) => {
      const requestUrl = request.url || '/';
      const host = request.headers.host || 'localhost';

      let pathname = '/';
      try {
        pathname = new URL(requestUrl, `http://${host}`).pathname;
      } catch {
        pathname = requestUrl;
      }

      if (pathname !== this.path) {
        return;
      }

      this.wss.handleUpgrade(request, socket, head, (upgradedSocket) => {
        this.wss.emit('connection', upgradedSocket, request);
      });
    };

    this.server.on('upgrade', this.upgradeHandler);
  }

  publish(event: ARVCommunityEvent): void {
    const normalized = normalizeARVCommunityEvent(event);
    this.totalEvents += 1;
    this.recentEvents.unshift(normalized);
    this.recentEvents.splice(12);

    const reaction = normalized.payload?.reaction;
    if (typeof reaction === 'string' && reaction in ARV_REACTION_PRESETS) {
      const typedReaction = reaction as ARVReactionKind;
      this.reactionCounters.set(
        typedReaction,
        (this.reactionCounters.get(typedReaction) ?? 0) + 1,
      );
    }

    this.broadcast({
      type: 'event',
      event: normalized,
      now: Date.now(),
    });
  }

  getControlState(): ARVLiveControlState {
    return { ...this.controlState };
  }

  updateControlState(nextState: Partial<ARVLiveControlState>): ARVLiveControlState {
    this.controlState = normalizeARVLiveControlState({
      ...this.controlState,
      ...nextState,
    });

    this.broadcast({
      type: 'control',
      control: this.controlState,
      now: Date.now(),
      stats: this.getStats(),
    });

    return this.getControlState();
  }

  publishChatMessage(text: string, source: ARVCommunityEvent['source'], userId?: string): ModerationResult {
    const moderation = this.moderationHook(text);
    if (!moderation.allowed) {
      return moderation;
    }

    this.publish(
      normalizeARVCommunityEvent({
        type: 'chat',
        source,
        label: userId ? `@${userId}` : 'ARV Chat',
        text: moderation.sanitizedText,
        intensity: 0.64,
        palette: '#22d3ee',
        phaseHint: 'surge',
        tags: ['chat', 'community'],
        payload: { channel: source },
      }),
    );

    return moderation;
  }

  close(): void {
    this.server.off('upgrade', this.upgradeHandler);
    for (const client of this.clients) {
      client.close();
    }
    this.wss.close();
  }

  private handleConnection(socket: WebSocket, request: IncomingMessage): void {
    this.clients.add(socket);

    this.send(socket, {
      type: 'hello',
      message: 'ARV live socket connected',
      now: Date.now(),
      control: this.controlState,
      stats: this.getStats(),
    });

    this.send(socket, {
      type: 'snapshot',
      now: Date.now(),
      events: this.recentEvents,
      control: this.controlState,
      stats: this.getStats(),
    });

    socket.on('message', (raw) => {
      this.handleMessage(socket, request, raw.toString('utf8'));
    });

    socket.on('close', () => {
      this.clients.delete(socket);
    });

    socket.on('error', () => {
      this.clients.delete(socket);
    });
  }

  private handleMessage(socket: WebSocket, request: IncomingMessage, rawMessage: string): void {
    const parsed = this.parseCommand(rawMessage);
    if (!parsed) {
      this.send(socket, {
        type: 'warning',
        message: 'Invalid command payload',
        now: Date.now(),
      });
      return;
    }

    if (parsed.type === 'ping') {
      this.send(socket, {
        type: 'pong',
        now: Date.now(),
      });
      return;
    }

    const clientKey = this.getClientKey(request, parsed.userId);
    const limitDecision = this.limiter.consume(clientKey);

    if (!limitDecision.allowed) {
      this.send(socket, {
        type: 'warning',
        message: `Rate limited. Retry in ${Math.ceil(limitDecision.retryAfterMs / 1000)}s`,
        now: Date.now(),
      });
      return;
    }

    if (parsed.type === 'viewer-reaction') {
      this.publish(createReactionEvent(parsed.reaction, 'viewer', parsed.userId));
      return;
    }

    const moderation = this.publishChatMessage(parsed.text, 'viewer', parsed.userId);
    if (!moderation.allowed) {
      this.send(socket, {
        type: 'warning',
        message: `Message blocked: ${moderation.reason ?? 'moderation'}`,
        now: Date.now(),
      });
    }
  }

  private parseCommand(rawMessage: string): ARVClientCommand | null {
    try {
      const parsed = JSON.parse(rawMessage) as Partial<ARVClientCommand>;
      if (parsed.type === 'ping') {
        return { type: 'ping' };
      }

      if (
        parsed.type === 'viewer-reaction' &&
        typeof parsed.reaction === 'string' &&
        parsed.reaction in ARV_REACTION_PRESETS
      ) {
        return {
          type: 'viewer-reaction',
          reaction: parsed.reaction as ARVReactionKind,
          ...(typeof parsed.userId === 'string' && parsed.userId.trim()
            ? { userId: parsed.userId.trim() }
            : {}),
        };
      }

      if (parsed.type === 'chat-inject' && typeof parsed.text === 'string') {
        return {
          type: 'chat-inject',
          text: parsed.text,
          ...(typeof parsed.userId === 'string' && parsed.userId.trim()
            ? { userId: parsed.userId.trim() }
            : {}),
        };
      }

      return null;
    } catch {
      return null;
    }
  }

  private getClientKey(request: IncomingMessage, userId?: string): string {
    const forwardedFor = request.headers['x-forwarded-for'];
    const forwardedValue = Array.isArray(forwardedFor)
      ? forwardedFor[0]
      : typeof forwardedFor === 'string'
        ? forwardedFor.split(',')[0]
        : '';

    return [
      forwardedValue,
      request.socket.remoteAddress || 'local',
      userId || 'anonymous',
    ]
      .filter(Boolean)
      .join(':');
  }

  private broadcast(payload: ARVSocketEnvelope): void {
    const encoded = JSON.stringify(payload);
    for (const client of this.clients) {
      if (client.readyState === WebSocket.OPEN) {
        client.send(encoded);
      }
    }
  }

  private send(socket: WebSocket, payload: ARVSocketEnvelope): void {
    if (socket.readyState === WebSocket.OPEN) {
      socket.send(JSON.stringify(payload));
    }
  }

  private getStats(): NonNullable<ARVSocketEnvelope['stats']> {
    return {
      clients: this.clients.size,
      totalEvents: this.totalEvents,
      recentReactions: Object.fromEntries(this.reactionCounters.entries()),
    };
  }
}

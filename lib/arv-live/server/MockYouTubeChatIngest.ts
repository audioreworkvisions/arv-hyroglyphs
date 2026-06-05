import { normalizeARVCommunityEvent, type ARVCommunityEvent } from '../types';

export interface ARVChatIngestSource {
  start(): void;
  stop(): void;
}

const MOCK_CHAT_MESSAGES = [
  { author: 'acid_angel', text: 'portal is breathing with the kick', palette: '#a3e635', intensity: 0.78, phaseHint: 'spiral' },
  { author: 'basel_loop', text: 'PEACE LOVE TECHNO in the machine cathedral', palette: '#f59e0b', intensity: 1, phaseHint: 'euphoria' },
  { author: 'night_train', text: 'crowd particles just detonated on that drop', palette: '#60a5fa', intensity: 0.72, phaseHint: 'surge' },
  { author: 'warehouse_echo', text: 'dark tunnel energy rising', palette: '#818cf8', intensity: 0.62, phaseHint: 'dormant' },
  { author: 'sacred_drum', text: 'fire in the portal ring right now', palette: '#fb7185', intensity: 0.9, phaseHint: 'peak' },
];

export class MockYouTubeChatIngest implements ARVChatIngestSource {
  private timer: NodeJS.Timeout | null = null;
  private cursor = 0;

  constructor(
    private readonly publish: (event: ARVCommunityEvent) => void,
    private readonly intervalMs = 6500,
  ) {}

  start(): void {
    if (this.timer) return;
    this.emitOnce();
    this.timer = setInterval(() => this.emitOnce(), this.intervalMs);
  }

  stop(): void {
    if (!this.timer) return;
    clearInterval(this.timer);
    this.timer = null;
  }

  private emitOnce(): void {
    const next = MOCK_CHAT_MESSAGES[this.cursor % MOCK_CHAT_MESSAGES.length];
    this.cursor += 1;

    this.publish(
      normalizeARVCommunityEvent({
        type: 'chat',
        source: 'mock-youtube',
        label: `@${next.author}`,
        text: next.text,
        palette: next.palette,
        intensity: next.intensity,
        phaseHint: next.phaseHint,
        tags: ['mock-chat', 'youtube-live', next.author],
        payload: {
          channel: 'mock-youtube',
          author: next.author,
        },
      }),
    );
  }
}

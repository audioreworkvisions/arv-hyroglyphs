export interface RateLimitDecision {
  allowed: boolean;
  remaining: number;
  retryAfterMs: number;
}

interface WindowState {
  count: number;
  resetAt: number;
}

export class FixedWindowRateLimiter {
  private readonly windows = new Map<string, WindowState>();

  constructor(
    private readonly windowMs: number,
    private readonly maxRequests: number,
  ) {}

  consume(key: string): RateLimitDecision {
    const now = Date.now();
    const existing = this.windows.get(key);

    if (!existing || now >= existing.resetAt) {
      this.windows.set(key, {
        count: 1,
        resetAt: now + this.windowMs,
      });

      this.prune(now);

      return {
        allowed: true,
        remaining: Math.max(0, this.maxRequests - 1),
        retryAfterMs: 0,
      };
    }

    if (existing.count >= this.maxRequests) {
      return {
        allowed: false,
        remaining: 0,
        retryAfterMs: Math.max(0, existing.resetAt - now),
      };
    }

    existing.count += 1;

    return {
      allowed: true,
      remaining: Math.max(0, this.maxRequests - existing.count),
      retryAfterMs: 0,
    };
  }

  private prune(now: number): void {
    for (const [key, value] of this.windows.entries()) {
      if (now >= value.resetAt) {
        this.windows.delete(key);
      }
    }
  }
}

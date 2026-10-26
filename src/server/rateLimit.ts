import type { Request, Response, NextFunction } from 'express';

interface BucketEntry {
  timestamps: number[];
}

export class SlidingWindowRateLimiter {
  private readonly store = new Map<string, BucketEntry>();
  private readonly windowMs: number;
  private readonly maxRequests: number;

  constructor(windowMs: number, maxRequests: number) {
    this.windowMs = windowMs;
    this.maxRequests = maxRequests;
  }

  public consume(key: string, now = Date.now()): { allowed: boolean; retryAfterSec: number } {
    const cutoff = now - this.windowMs;
    const existing = this.store.get(key) || { timestamps: [] };
    const recent = existing.timestamps.filter((t) => t > cutoff);

    if (recent.length >= this.maxRequests) {
      const oldest = recent[0];
      const retryAfterSec = Math.max(1, Math.ceil((oldest + this.windowMs - now) / 1000));
      this.store.set(key, { timestamps: recent });
      return { allowed: false, retryAfterSec };
    }

    recent.push(now);
    this.store.set(key, { timestamps: recent });
    return { allowed: true, retryAfterSec: 0 };
  }

  public reset(): void {
    this.store.clear();
  }
}

export function extractClientKey(req: Request): string {
  const forwarded = req.headers['x-forwarded-for'];
  if (typeof forwarded === 'string' && forwarded.length > 0) {
    return forwarded.split(',')[0].trim();
  }
  return req.ip || 'unknown-client';
}

export function createRateLimitMiddleware(limiter: SlidingWindowRateLimiter, errorMessage: string) {
  return (req: Request, res: Response, next: NextFunction) => {
    const key = extractClientKey(req);
    const result = limiter.consume(key);
    if (!result.allowed) {
      res.setHeader('Retry-After', String(result.retryAfterSec));
      res.status(429).json({
        error: errorMessage,
        retryAfterSeconds: result.retryAfterSec,
      });
      return;
    }
    next();
  };
}

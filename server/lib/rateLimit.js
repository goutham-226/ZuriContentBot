import { one } from './db.js';

export class RateLimitError extends Error {
  constructor(message, retryAfterSec) {
    super(message);
    this.status = 429;
    this.retryAfterSec = retryAfterSec;
  }
}

// Fixed-window counter stored in Postgres so limits hold across restarts and instances.
// Throws RateLimitError once `limit` hits within `windowSec`.
export async function hit(key, limit, windowSec, message = 'Too many requests, slow down.') {
  const windowStart = new Date(Math.floor(Date.now() / (windowSec * 1000)) * windowSec * 1000);
  const row = await one(
    `INSERT INTO rate_limits (key, window_start, count) VALUES ($1, $2, 1)
     ON CONFLICT (key, window_start) DO UPDATE SET count = rate_limits.count + 1
     RETURNING count`,
    [key, windowStart]
  );
  if (row.count > limit) {
    const retryAfterSec = Math.ceil((windowStart.getTime() + windowSec * 1000 - Date.now()) / 1000);
    throw new RateLimitError(message, retryAfterSec);
  }
  return limit - row.count;
}

// Express middleware: generic per-user (or per-IP) API throttle
export function apiThrottle(limit = 300, windowSec = 60) {
  return async (req, res, next) => {
    try {
      await hit(`api:${req.user?.id || req.ip}`, limit, windowSec);
      next();
    } catch (err) {
      next(err);
    }
  };
}

export async function pruneRateLimits() {
  await one(`DELETE FROM rate_limits WHERE window_start < now() - interval '2 days'`);
}

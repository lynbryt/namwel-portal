// Simple in-memory rate limiter for login attempts.
// For production with multiple instances, swap this for a Redis-backed
// implementation (Upstash or Supabase table). The interface stays the same.

type Window = { count: number; resetAt: number; locked: boolean };

const store = new Map<string, Window>();

export type RateLimitResult = {
  allowed: boolean;
  remaining: number;
  resetIn: number;
  locked: boolean;
};

const MAX_FAILS = 5;
const WINDOW_MS = 60 * 60 * 1000; // 1 hour
const LOCKOUT_MS = 60 * 60 * 1000; // 1 hour

export function checkRateLimit(key: string): RateLimitResult {
  const now = Date.now();
  const w = store.get(key);

  if (w?.locked && w.resetAt > now) {
    return { allowed: false, remaining: 0, resetIn: w.resetAt - now, locked: true };
  }

  if (!w || w.resetAt < now) {
    return { allowed: true, remaining: MAX_FAILS, resetIn: WINDOW_MS, locked: false };
  }

  return {
    allowed: w.count < MAX_FAILS,
    remaining: Math.max(0, MAX_FAILS - w.count),
    resetIn: w.resetAt - now,
    locked: false,
  };
}

export function recordFail(key: string): RateLimitResult {
  const now = Date.now();
  const w = store.get(key);

  if (!w || w.resetAt < now) {
    const fresh: Window = { count: 1, resetAt: now + WINDOW_MS, locked: false };
    store.set(key, fresh);
    return { allowed: true, remaining: MAX_FAILS - 1, resetIn: WINDOW_MS, locked: false };
  }

  w.count += 1;
  if (w.count >= MAX_FAILS) {
    w.locked = true;
    w.resetAt = now + LOCKOUT_MS;
    return { allowed: false, remaining: 0, resetIn: LOCKOUT_MS, locked: true };
  }
  return {
    allowed: true,
    remaining: MAX_FAILS - w.count,
    resetIn: w.resetAt - now,
    locked: false,
  };
}

export function recordSuccess(key: string): void {
  store.delete(key);
}

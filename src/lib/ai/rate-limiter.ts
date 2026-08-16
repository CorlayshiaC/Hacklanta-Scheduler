import "server-only";

import { AI_CONFIG } from "@/lib/ai/config";

/**
 * Proactive, in-memory throttle in front of Gemini. This is a per-instance best-effort governor,
 * not a source of truth: on Vercel Fluid Compute a cold start or a second concurrent instance
 * gets its own buckets, so the real backstop is Gemini's own 429 plus reportProviderRateLimited
 * below. Moving to a shared store (a Postgres row, Upstash via the Marketplace) is a reasonable
 * future step if multi-instance skew becomes a real problem; not worth a new dependency for a
 * free-tier wrapper serving one student org today.
 *
 * acquireSlot polls for up to timeoutMs instead of blocking indefinitely: callers must return the
 * fallback signal, not hang the UI, when nothing frees up in time.
 */

class TokenBucket {
  private tokens: number;
  private lastRefillMs: number;
  private refillPerMs: number;

  constructor(
    private readonly capacity: number,
    ratePerMinute: number,
  ) {
    this.tokens = capacity;
    this.lastRefillMs = Date.now();
    this.refillPerMs = ratePerMinute / 60_000;
  }

  private refill() {
    const now = Date.now();
    const elapsed = now - this.lastRefillMs;
    this.tokens = Math.min(this.capacity, this.tokens + elapsed * this.refillPerMs);
    this.lastRefillMs = now;
  }

  peek(): number {
    this.refill();
    return this.tokens;
  }

  take() {
    this.tokens -= 1;
  }

  setRatePerMinute(ratePerMinute: number) {
    this.refill();
    this.refillPerMs = ratePerMinute / 60_000;
  }
}

class DailyCounter {
  private count = 0;
  private resetAtMs = nextUtcMidnightMs();

  private maybeReset() {
    if (Date.now() >= this.resetAtMs) {
      this.count = 0;
      this.resetAtMs = nextUtcMidnightMs();
    }
  }

  peek(limit: number): boolean {
    this.maybeReset();
    return this.count < limit;
  }

  take() {
    this.count += 1;
  }
}

function nextUtcMidnightMs(): number {
  const now = new Date();
  return Date.UTC(now.getUTCFullYear(), now.getUTCMonth(), now.getUTCDate() + 1);
}

const globalMinuteBucket = new TokenBucket(AI_CONFIG.globalRpm, AI_CONFIG.globalRpm);
const globalDailyCounter = new DailyCounter();
const userMinuteBuckets = new Map<string, TokenBucket>();
const userDailyCounters = new Map<string, DailyCounter>();

const COOLDOWN_MS = 60_000;
let coolingDownUntilMs = 0;

function getUserMinuteBucket(userId: string): TokenBucket {
  let bucket = userMinuteBuckets.get(userId);
  if (!bucket) {
    bucket = new TokenBucket(AI_CONFIG.userRpm, AI_CONFIG.userRpm);
    userMinuteBuckets.set(userId, bucket);
  }
  return bucket;
}

function getUserDailyCounter(userId: string): DailyCounter {
  let counter = userDailyCounters.get(userId);
  if (!counter) {
    counter = new DailyCounter();
    userDailyCounters.set(userId, counter);
  }
  return counter;
}

/** Peek every bucket first, only commit (take) if every check passed, so a request that cannot
 * go through never burns a daily-budget unit. No `await` between peek and take: the whole
 * function runs as one synchronous tick, so this is atomic despite the shared module state. */
function tryAcquire(userId: string | undefined): boolean {
  if (Date.now() < coolingDownUntilMs) {
    return false;
  }

  const userDaily = userId ? getUserDailyCounter(userId) : null;
  const userMinute = userId ? getUserMinuteBucket(userId) : null;

  const globalDailyOk = globalDailyCounter.peek(AI_CONFIG.globalRpd);
  const userDailyOk = !userDaily || userDaily.peek(AI_CONFIG.userRpd);
  const globalMinuteOk = globalMinuteBucket.peek() >= 1;
  const userMinuteOk = !userMinute || userMinute.peek() >= 1;

  if (!globalDailyOk || !userDailyOk || !globalMinuteOk || !userMinuteOk) {
    return false;
  }

  globalDailyCounter.take();
  userDaily?.take();
  globalMinuteBucket.take();
  userMinute?.take();
  return true;
}

export type Slot = { ok: true } | { ok: false };

export async function acquireSlot(opts: { userId?: string; timeoutMs: number }): Promise<Slot> {
  const deadlineMs = Date.now() + opts.timeoutMs;
  const pollMs = 150;

  for (;;) {
    if (tryAcquire(opts.userId)) {
      return { ok: true };
    }

    const remainingMs = deadlineMs - Date.now();
    if (remainingMs <= 0) {
      return { ok: false };
    }

    await sleep(Math.min(pollMs, remainingMs));
  }
}

function sleep(ms: number): Promise<void> {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

/** Call when Gemini itself returns 429. Drains the global bucket and halves its refill rate for
 * one cooldown window, since a real quota hit means our local numbers are already optimistic. */
export function reportProviderRateLimited() {
  coolingDownUntilMs = Date.now() + COOLDOWN_MS;
  globalMinuteBucket.setRatePerMinute(Math.max(1, AI_CONFIG.globalRpm / 2));
}

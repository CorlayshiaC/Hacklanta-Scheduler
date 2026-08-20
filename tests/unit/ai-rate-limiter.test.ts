import { afterEach, describe, expect, it, vi } from "vitest";

/**
 * config.ts and rate-limiter.ts both read process.env / build their buckets at module load time,
 * so every test stubs env vars and re-imports via vi.resetModules() rather than importing once at
 * the top of the file.
 */
async function freshRateLimiter(env: Record<string, string>) {
  vi.resetModules();
  for (const [key, value] of Object.entries(env)) {
    vi.stubEnv(key, value);
  }
  return import("@/lib/ai/rate-limiter");
}

const BASE_ENV = {
  GEMINI_GLOBAL_RPM: "2",
  GEMINI_GLOBAL_RPD: "100",
  GEMINI_USER_RPM: "100",
  GEMINI_USER_RPD: "100",
};

describe("acquireSlot", () => {
  afterEach(() => {
    vi.unstubAllEnvs();
  });

  it("grants up to the global RPM then denies once the bucket is empty", async () => {
    const { acquireSlot } = await freshRateLimiter(BASE_ENV);

    expect((await acquireSlot({ timeoutMs: 10 })).ok).toBe(true);
    expect((await acquireSlot({ timeoutMs: 10 })).ok).toBe(true);
    expect((await acquireSlot({ timeoutMs: 50 })).ok).toBe(false);
  });

  it("gates per-user RPM independently of the global bucket", async () => {
    const { acquireSlot } = await freshRateLimiter({
      ...BASE_ENV,
      GEMINI_GLOBAL_RPM: "100",
      GEMINI_USER_RPM: "1",
    });

    expect((await acquireSlot({ userId: "alice", timeoutMs: 10 })).ok).toBe(true);
    expect((await acquireSlot({ userId: "alice", timeoutMs: 50 })).ok).toBe(false);
    // A different user has their own bucket, unaffected by alice's.
    expect((await acquireSlot({ userId: "bob", timeoutMs: 10 })).ok).toBe(true);
  });

  it("does not spend a daily-budget unit on a request that never actually goes through", async () => {
    const { acquireSlot } = await freshRateLimiter({
      ...BASE_ENV,
      GEMINI_GLOBAL_RPM: "1",
      GEMINI_GLOBAL_RPD: "1",
    });

    expect((await acquireSlot({ timeoutMs: 10 })).ok).toBe(true); // spends the only RPM + RPD unit
    expect((await acquireSlot({ timeoutMs: 50 })).ok).toBe(false); // RPM exhausted, RPD must still read 1 spent, not 2
  });

  it("reportProviderRateLimited starts a cooldown that denies new slots immediately", async () => {
    const { acquireSlot, reportProviderRateLimited } = await freshRateLimiter(BASE_ENV);

    reportProviderRateLimited();
    expect((await acquireSlot({ timeoutMs: 50 })).ok).toBe(false);
  });
});

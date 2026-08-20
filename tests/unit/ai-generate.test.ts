import { beforeEach, describe, expect, it, vi } from "vitest";
import { generate } from "@/lib/ai/generate";
import { GeminiTimeoutError } from "@/lib/ai/gemini-client";

/**
 * Exercises generate()'s orchestration (cache check, rate limit, call, schema/banned-word
 * validation, fallback) through the real "gap_analysis" kind, which has a deterministic fallback
 * and a small, easy-to-reason-about schema. The network boundary (gemini-client, rate-limiter,
 * cache) is mocked; kinds/registry.ts and the kind definitions themselves are real.
 */
const mocks = vi.hoisted(() => ({
  getGeminiClient: vi.fn(),
  callGemini: vi.fn(),
  isProviderRateLimitError: vi.fn(() => false),
  acquireSlot: vi.fn(),
  reportProviderRateLimited: vi.fn(),
  getCached: vi.fn(async (): Promise<unknown> => null),
  setCached: vi.fn(async () => undefined),
  cacheKeyFor: vi.fn(() => "fixed-cache-key"),
}));

vi.mock("@/lib/ai/gemini-client", async (importOriginal) => {
  const actual = await importOriginal<typeof import("@/lib/ai/gemini-client")>();
  return {
    ...actual,
    getGeminiClient: mocks.getGeminiClient,
    callGemini: mocks.callGemini,
    isProviderRateLimitError: mocks.isProviderRateLimitError,
  };
});

vi.mock("@/lib/ai/rate-limiter", () => ({
  acquireSlot: mocks.acquireSlot,
  reportProviderRateLimited: mocks.reportProviderRateLimited,
}));

vi.mock("@/lib/ai/cache", () => ({
  getCached: mocks.getCached,
  setCached: mocks.setCached,
  cacheKeyFor: mocks.cacheKeyFor,
}));

const GAP_INPUT = { gaps: [{ label: "Saturday teardown", shortBy: 3, availableUnassigned: 5 }] };
const FALLBACK_TEXT = "Saturday teardown is 3 short. 5 available members are unassigned.";

describe("generate", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mocks.getCached.mockResolvedValue(null);
    mocks.acquireSlot.mockResolvedValue({ ok: true });
  });

  it("falls back with reason no_api_key when Gemini is not configured", async () => {
    mocks.getGeminiClient.mockReturnValue(null);

    const result = await generate("gap_analysis", GAP_INPUT);

    expect(result).toEqual({
      ok: true,
      source: "fallback",
      data: { headlines: [{ label: "Saturday teardown", text: FALLBACK_TEXT }] },
    });
    expect(mocks.callGemini).not.toHaveBeenCalled();
  });

  it("falls back when the queue times out", async () => {
    mocks.getGeminiClient.mockReturnValue({});
    mocks.acquireSlot.mockResolvedValue({ ok: false });

    const result = await generate("gap_analysis", GAP_INPUT);

    expect(result.ok).toBe(true);
    expect(result.ok && result.source).toBe("fallback");
    expect(mocks.callGemini).not.toHaveBeenCalled();
  });

  it("returns the model's answer and caches it on success", async () => {
    mocks.getGeminiClient.mockReturnValue({});
    mocks.callGemini.mockResolvedValue(
      JSON.stringify({ headlines: [{ label: "Saturday teardown", text: "Short three, five open." }] }),
    );

    const result = await generate("gap_analysis", GAP_INPUT);

    expect(result).toEqual({
      ok: true,
      source: "model",
      data: { headlines: [{ label: "Saturday teardown", text: "Short three, five open." }] },
    });
    expect(mocks.setCached).toHaveBeenCalledWith(
      "fixed-cache-key",
      "gap_analysis",
      { headlines: [{ label: "Saturday teardown", text: "Short three, five open." }] },
      300,
    );
  });

  it("falls back when the model's JSON fails schema validation, and does not cache it", async () => {
    mocks.getGeminiClient.mockReturnValue({});
    mocks.callGemini.mockResolvedValue(JSON.stringify({ not: "the right shape" }));

    const result = await generate("gap_analysis", GAP_INPUT);

    expect(result.ok).toBe(true);
    expect(result.ok && result.source).toBe("fallback");
    expect(mocks.setCached).not.toHaveBeenCalled();
  });

  it("falls back when the model output contains a banned word", async () => {
    mocks.getGeminiClient.mockReturnValue({});
    mocks.callGemini.mockResolvedValue(
      JSON.stringify({ headlines: [{ label: "Saturday teardown", text: "This will elevate coverage." }] }),
    );

    const result = await generate("gap_analysis", GAP_INPUT);

    expect(result.ok).toBe(true);
    expect(result.ok && result.source).toBe("fallback");
    expect(mocks.setCached).not.toHaveBeenCalled();
  });

  it("serves a cache hit without calling Gemini", async () => {
    mocks.getCached.mockResolvedValue({ headlines: [{ label: "Saturday teardown", text: "Cached answer." }] });

    const result = await generate("gap_analysis", GAP_INPUT);

    expect(result).toEqual({
      ok: true,
      source: "cache",
      data: { headlines: [{ label: "Saturday teardown", text: "Cached answer." }] },
    });
    expect(mocks.callGemini).not.toHaveBeenCalled();
  });

  it("reports a real 429 to the rate limiter and falls back", async () => {
    mocks.getGeminiClient.mockReturnValue({});
    mocks.isProviderRateLimitError.mockReturnValue(true);
    mocks.callGemini.mockRejectedValue(new Error("429"));

    const result = await generate("gap_analysis", GAP_INPUT);

    expect(mocks.reportProviderRateLimited).toHaveBeenCalledOnce();
    expect(result.ok).toBe(true);
    expect(result.ok && result.source).toBe("fallback");
  });

  it("falls back with reason timeout when the request aborts", async () => {
    mocks.getGeminiClient.mockReturnValue({});
    mocks.callGemini.mockRejectedValue(new GeminiTimeoutError("timed out"));

    const result = await generate("gap_analysis", GAP_INPUT);

    expect(result.ok).toBe(true);
    expect(result.ok && result.source).toBe("fallback");
  });

  it("never throws, even when a kind has no fallback and everything fails", async () => {
    mocks.getGeminiClient.mockReturnValue(null);

    const result = await generate("shift_generation", { phrase: "x", nowIso: "2026-08-16T00:00:00.000Z", timezone: "America/New_York" });

    expect(result).toEqual({ ok: false, reason: "no_api_key", message: expect.any(String) });
  });
});

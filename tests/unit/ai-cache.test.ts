import { describe, expect, it } from "vitest";
import { cacheKeyFor } from "@/lib/ai/cache";

describe("cacheKeyFor", () => {
  it("is stable regardless of key order, including nested objects", () => {
    const a = cacheKeyFor("gap_analysis", { gaps: [{ label: "A", shortBy: 1, availableUnassigned: 2 }] });
    const b = cacheKeyFor("gap_analysis", { gaps: [{ availableUnassigned: 2, shortBy: 1, label: "A" }] });
    expect(a).toBe(b);
  });

  it("differs when the kind differs, even with identical input", () => {
    const input = { phrase: "friday setup crew" };
    const a = cacheKeyFor("shift_generation", input);
    const b = cacheKeyFor("availability_parse", input);
    expect(a).not.toBe(b);
  });

  it("differs when a value differs", () => {
    const a = cacheKeyFor("shift_generation", { phrase: "friday" });
    const b = cacheKeyFor("shift_generation", { phrase: "saturday" });
    expect(a).not.toBe(b);
  });

  it("produces a 64-character lowercase hex sha256 digest", () => {
    const key = cacheKeyFor("shift_generation", { phrase: "friday" });
    expect(key).toMatch(/^[0-9a-f]{64}$/);
  });
});

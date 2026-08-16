import { describe, expect, it } from "vitest";
import { findBannedWord } from "@/lib/ai/banned-words";

describe("findBannedWord", () => {
  it("passes clean, on-brand copy", () => {
    expect(findBannedWord({ headline: "Saturday teardown is 3 short. 5 members are unassigned." })).toBeNull();
  });

  it("catches a banned word case-insensitively, nested inside an object", () => {
    expect(findBannedWord({ nested: { text: "This will Elevate the schedule." } })).toBe("elevate");
  });

  it("catches a banned word inside an array of strings", () => {
    expect(findBannedWord(["fine", "let's unlock this workflow"])).toBe("unlock");
  });

  it("catches an em dash", () => {
    expect(findBannedWord("Short by three—five members are free.")).toBe("em dash");
  });

  it("catches any exclamation point", () => {
    expect(findBannedWord("Great work!")).toBe("exclamation point");
  });

  it('catches a "Ready to X?" construction', () => {
    expect(findBannedWord("Ready to publish?")).toBe('"Ready to X?" construction');
  });

  it("ignores numbers, booleans, and null", () => {
    expect(findBannedWord({ count: 5, active: true, note: null })).toBeNull();
  });
});

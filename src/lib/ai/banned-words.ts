import "server-only";

/**
 * Every model output that includes free text (a shift title, a gap-analysis headline, an
 * autofill rationale) is scanned before it reaches a caller. A hit is treated the same as a
 * schema-validation failure: the kind falls back to its pure-code answer.
 */
const BANNED_WORDS = [
  "seamless",
  "elevate",
  "empower",
  "supercharge",
  "unlock",
  "delve",
  "journey",
  "vibrant",
] as const;

const EM_DASH = "—";
const READY_TO_CONSTRUCTION = /ready to \w+\?/i;

export function findBannedWord(value: unknown): string | null {
  for (const text of collectStrings(value)) {
    const lower = text.toLowerCase();

    for (const word of BANNED_WORDS) {
      if (lower.includes(word)) {
        return word;
      }
    }

    if (text.includes(EM_DASH)) {
      return "em dash";
    }

    if (text.includes("!")) {
      return "exclamation point";
    }

    if (READY_TO_CONSTRUCTION.test(text)) {
      return '"Ready to X?" construction';
    }
  }

  return null;
}

function collectStrings(value: unknown): string[] {
  if (typeof value === "string") {
    return [value];
  }

  if (Array.isArray(value)) {
    return value.flatMap(collectStrings);
  }

  if (value && typeof value === "object") {
    return Object.values(value as Record<string, unknown>).flatMap(collectStrings);
  }

  return [];
}

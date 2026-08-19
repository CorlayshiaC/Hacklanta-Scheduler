import { readFileSync } from "node:fs";
import { join } from "node:path";
import { describe, expect, it } from "vitest";
import { PUBLIC_ENV_KEYS, getPublicEnv, getSiteUrl, readPublicEnv } from "@/lib/env";

describe("getPublicEnv", () => {
  it("returns validated Supabase public environment values", () => {
    expect(
      getPublicEnv({
        NEXT_PUBLIC_SUPABASE_URL: "https://example.supabase.co",
        NEXT_PUBLIC_SUPABASE_ANON_KEY: "anon-key",
      } as unknown as NodeJS.ProcessEnv),
    ).toEqual({
      NEXT_PUBLIC_SUPABASE_URL: "https://example.supabase.co",
      NEXT_PUBLIC_SUPABASE_ANON_KEY: "anon-key",
    });
  });

  it("rejects invalid public Supabase configuration", () => {
    expect(() =>
      getPublicEnv({
        NEXT_PUBLIC_SUPABASE_URL: "not-a-url",
        NEXT_PUBLIC_SUPABASE_ANON_KEY: "",
      } as unknown as NodeJS.ProcessEnv),
    ).toThrow();
  });

  it("treats a declared-but-empty optional URL as unset", () => {
    // .env.example ships `NEXT_PUBLIC_SITE_URL=` with no value, so copying it verbatim yields "".
    // That has to mean "not configured", not "invalid URL", or following our own setup docs throws.
    expect(
      getPublicEnv({
        NEXT_PUBLIC_SUPABASE_URL: "https://example.supabase.co",
        NEXT_PUBLIC_SUPABASE_ANON_KEY: "anon-key",
        NEXT_PUBLIC_SITE_URL: "",
      } as unknown as NodeJS.ProcessEnv),
    ).toEqual({
      NEXT_PUBLIC_SUPABASE_URL: "https://example.supabase.co",
      NEXT_PUBLIC_SUPABASE_ANON_KEY: "anon-key",
      NEXT_PUBLIC_SITE_URL: undefined,
    });

    expect(getSiteUrl({ NEXT_PUBLIC_SITE_URL: "" } as unknown as NodeJS.ProcessEnv)).toBe(
      "http://localhost:3000",
    );
  });
});

/**
 * The browser cannot see a variable that is not read as a literal `process.env.NEXT_PUBLIC_X`
 * member expression somewhere in the source: Next.js substitutes those at build time and hands
 * client bundles nothing else. A variable added to the schema but not to readPublicEnv() therefore
 * works perfectly on the server and is silently missing in the browser, which is the failure mode
 * that took the whole authenticated shell down once already. These two tests are the guard.
 */
describe("public env reaches the browser", () => {
  const envSource = readFileSync(join(process.cwd(), "src/lib/env.ts"), "utf8");
  // Comments in this file discuss `process.env` at length, including the exact anti-pattern below.
  // Scanning prose would fail on the documentation explaining why the rule exists.
  const envCode = envSource.replace(/\/\*[\s\S]*?\*\//g, "").replace(/\/\/.*$/gm, "");

  it("reads every public key as its own static member expression", () => {
    for (const key of PUBLIC_ENV_KEYS) {
      expect(envCode).toContain(`process.env.${key}`);
    }
  });

  it("never hands a bare process.env object to a validator", () => {
    // `process.env` followed by anything other than `.KEY` means the whole object is being passed
    // somewhere, which is the exact pattern that silently empties in a client bundle.
    const bareProcessEnv = /process\.env(?!\.[A-Z])/g;
    expect(envCode.match(bareProcessEnv)).toBeNull();
  });

  it("exposes the same keys the schema validates", () => {
    expect(Object.keys(readPublicEnv()).sort()).toEqual([...PUBLIC_ENV_KEYS].sort());
  });
});

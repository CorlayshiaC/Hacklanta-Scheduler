import { describe, expect, it } from "vitest";
import { getPublicEnv } from "@/lib/env";

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
});

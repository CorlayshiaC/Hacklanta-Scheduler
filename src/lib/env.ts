/**
 * Deliberately zod-free, unlike every other validation boundary in this codebase.
 *
 * This module is reachable from the browser: `src/lib/supabase/browser.ts` imports `getPublicEnv`,
 * and that file is imported by client components, so whatever this file imports lands in the client
 * bundle. Importing zod here put 55.8 KB parsed / 13.0 KB gzip of it on every authenticated route
 * (measured, see docs/perf-baseline.md) to validate three values that webpack has already
 * substituted as string literals at build time.
 *
 * The checks below are the same checks the zod schema performed, and every behavior the tests pin
 * is preserved: a missing or malformed URL throws, an empty anon key throws, and a declared-but-
 * empty optional URL reads as unset. Server-side validation elsewhere is unaffected and still uses
 * zod; this is the one boundary where the validator itself costs more than what it validates.
 */

/** Mirrors `z.string().url()`: parseable as an absolute URL. */
function isValidUrl(value: unknown): value is string {
  if (typeof value !== "string" || value === "") return false;
  try {
    new URL(value);
    return true;
  } catch {
    return false;
  }
}

/**
 * An unset optional variable and one declared-but-empty in a .env file must mean the same thing.
 * `.env.example` ships `NEXT_PUBLIC_SITE_URL=` with no value, so a developer copying it verbatim
 * produces an empty string, and treating "" as invalid rather than unset made following our own
 * setup instructions throw on every render.
 */
function readOptionalUrl(value: unknown, key: string): string | undefined {
  if (value === undefined || value === "") return undefined;
  if (!isValidUrl(value)) throw new Error(`${key}: Invalid url`);
  return value;
}

export type PublicEnv = {
  NEXT_PUBLIC_SUPABASE_URL: string;
  NEXT_PUBLIC_SUPABASE_ANON_KEY: string;
  NEXT_PUBLIC_SITE_URL?: string | undefined;
};

/**
 * What these readers accept. Deliberately looser than `NodeJS.ProcessEnv`, which Next augments to
 * require `NODE_ENV`: the point of readPublicEnv() is to build a small object holding only the
 * public keys, and that object legitimately has no NODE_ENV. A real `process.env` is assignable to
 * this, so server callers and tests are unaffected.
 */
type EnvSource = Record<string, string | undefined>;

/**
 * Reads each public variable as its own static `process.env.NEXT_PUBLIC_X` member expression.
 *
 * This shape is load-bearing, not style. Next.js does not hand client bundles a populated
 * `process.env` object: it statically finds literal `process.env.NEXT_PUBLIC_FOO` member
 * expressions at build time and substitutes the value in place. A bare `process.env` reference in
 * client code therefore carries none of them, so passing it wholesale to a validator parses an
 * empty object and reports every variable as missing, in the browser only, while the server keeps
 * working perfectly. That is exactly the bug this replaced: `getPublicEnv()` defaulted to
 * `process.env`, so the moment a client component called `createSupabaseBrowserClient()` the whole
 * authenticated shell died inside its error boundary with "NEXT_PUBLIC_SUPABASE_URL: Required",
 * with the value sitting correctly in `.env` the entire time.
 *
 * Adding a variable to `publicEnvSchema` means adding a line here too, or it will be invisible to
 * the browser. `tests/unit/env.test.ts` fails if the two ever drift apart.
 */
export function readPublicEnv(): EnvSource {
  return {
    NEXT_PUBLIC_SUPABASE_URL: process.env.NEXT_PUBLIC_SUPABASE_URL,
    NEXT_PUBLIC_SUPABASE_ANON_KEY: process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY,
    NEXT_PUBLIC_SITE_URL: process.env.NEXT_PUBLIC_SITE_URL,
  };
}

/** Every key the browser needs inlined. Kept beside the schema so the test can compare the two. */
export const PUBLIC_ENV_KEYS = [
  "NEXT_PUBLIC_SUPABASE_URL",
  "NEXT_PUBLIC_SUPABASE_ANON_KEY",
  "NEXT_PUBLIC_SITE_URL",
] as const;

export function getPublicEnv(env: EnvSource = readPublicEnv()): PublicEnv {
  const url = env.NEXT_PUBLIC_SUPABASE_URL;
  const anonKey = env.NEXT_PUBLIC_SUPABASE_ANON_KEY;

  if (!isValidUrl(url)) {
    throw new Error("NEXT_PUBLIC_SUPABASE_URL: Invalid url");
  }
  if (typeof anonKey !== "string" || anonKey.length === 0) {
    throw new Error("NEXT_PUBLIC_SUPABASE_ANON_KEY: Required");
  }

  return {
    NEXT_PUBLIC_SUPABASE_URL: url,
    NEXT_PUBLIC_SUPABASE_ANON_KEY: anonKey,
    NEXT_PUBLIC_SITE_URL: readOptionalUrl(env.NEXT_PUBLIC_SITE_URL, "NEXT_PUBLIC_SITE_URL"),
  };
}

/**
 * Absolute site origin (no trailing slash), for anywhere an absolute URL is required: OG metadata,
 * share links, ICS feed URLs, transactional email links. Requested by Agent 5
 * (docs/contracts/requests.md). Falls back to localhost in dev rather than failing, since most of
 * the app works fine on relative paths and only a handful of surfaces need an absolute origin.
 *
 * Reads its one variable directly instead of going through getPublicEnv(), for the same reason
 * getEmailProviderEnv() is separate from getServerEnv(): the Supabase URL/key have nothing to do
 * with whether a site origin is configured, and parsing them here made this throw in any context
 * that has an origin but no Supabase config (unit tests building email bodies, most obviously).
 * A malformed NEXT_PUBLIC_SITE_URL also falls back rather than throwing: a bad origin should
 * degrade one link, not take down a page render.
 */
export function getSiteUrl(env: EnvSource = readPublicEnv()): string {
  const raw = env.NEXT_PUBLIC_SITE_URL;
  // safeParse equivalent: a malformed value degrades to the fallback rather than throwing.
  const configured = isValidUrl(raw) ? raw : undefined;

  // Trailing slashes are stripped so callers can always concatenate a leading-slash path, which is
  // what every existing call site already assumes.
  return (configured ?? "http://localhost:3000").replace(/\/+$/, "");
}

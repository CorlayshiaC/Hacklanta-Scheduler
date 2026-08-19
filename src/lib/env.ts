import { z } from "zod";

/**
 * An unset optional variable and one declared-but-empty in a .env file must mean the same thing.
 * `.env.example` ships `NEXT_PUBLIC_SITE_URL=` with no value, so a developer copying it verbatim
 * produces an empty string, and `z.string().url().optional()` rejects "" (optional only tolerates
 * undefined). Without this, following our own setup instructions throws on every render.
 */
const optionalUrl = z.preprocess(
  (value) => (value === "" ? undefined : value),
  z.string().url().optional(),
);

const publicEnvSchema = z.object({
  NEXT_PUBLIC_SUPABASE_URL: z.string().url(),
  NEXT_PUBLIC_SUPABASE_ANON_KEY: z.string().min(1),
  NEXT_PUBLIC_SITE_URL: optionalUrl,
});

export type PublicEnv = z.infer<typeof publicEnvSchema>;

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
  return publicEnvSchema.parse(env);
}

const siteUrlSchema = z.object({ NEXT_PUBLIC_SITE_URL: optionalUrl });

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
  const parsed = siteUrlSchema.safeParse(env);
  const configured = parsed.success ? parsed.data.NEXT_PUBLIC_SITE_URL : undefined;

  // Trailing slashes are stripped so callers can always concatenate a leading-slash path, which is
  // what every existing call site already assumes.
  return (configured ?? "http://localhost:3000").replace(/\/+$/, "");
}

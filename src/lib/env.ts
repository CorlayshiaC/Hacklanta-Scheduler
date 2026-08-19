import { z } from "zod";

const publicEnvSchema = z.object({
  NEXT_PUBLIC_SUPABASE_URL: z.string().url(),
  NEXT_PUBLIC_SUPABASE_ANON_KEY: z.string().min(1),
  NEXT_PUBLIC_SITE_URL: z.string().url().optional(),
});

export type PublicEnv = z.infer<typeof publicEnvSchema>;

export function getPublicEnv(env: NodeJS.ProcessEnv = process.env): PublicEnv {
  return publicEnvSchema.parse(env);
}

const siteUrlSchema = z.object({
  NEXT_PUBLIC_SITE_URL: z.string().url().optional(),
});

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
export function getSiteUrl(env: NodeJS.ProcessEnv = process.env): string {
  const parsed = siteUrlSchema.safeParse(env);
  const configured = parsed.success ? parsed.data.NEXT_PUBLIC_SITE_URL : undefined;

  // Trailing slashes are stripped so callers can always concatenate a leading-slash path, which is
  // what every existing call site already assumes.
  return (configured ?? "http://localhost:3000").replace(/\/+$/, "");
}

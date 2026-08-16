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

/**
 * Absolute site origin (no trailing slash), for anywhere an absolute URL is required: OG metadata,
 * share links, ICS feed URLs. Requested by Agent 5 (docs/contracts/requests.md). Falls back to
 * localhost in dev rather than failing, since most of the app works fine on relative paths and only a
 * handful of surfaces need an absolute origin.
 */
export function getSiteUrl(env: NodeJS.ProcessEnv = process.env): string {
  return getPublicEnv(env).NEXT_PUBLIC_SITE_URL ?? "http://localhost:3000";
}

import "server-only";

import { z } from "zod";
import { getPublicEnv } from "@/lib/env";

const privateEnvSchema = z.object({
  SUPABASE_SERVICE_ROLE_KEY: z.string().min(1),
});

export type ServerEnv = ReturnType<typeof getServerEnv>;

export function getServerEnv(env: NodeJS.ProcessEnv = process.env) {
  return {
    ...getPublicEnv(env),
    ...privateEnvSchema.parse(env),
  };
}

const emailProviderEnvSchema = z.object({
  RESEND_API_KEY: z.string().min(1).optional(),
  NOTIFICATIONS_FROM_EMAIL: z.string().email().optional(),
});

export type EmailProviderEnv = z.infer<typeof emailProviderEnvSchema>;

/**
 * Deliberately separate from getServerEnv(): that schema also requires the Supabase URL/keys, which
 * have nothing to do with whether email delivery is configured. A caller that only needs to know "is
 * Resend set up" (src/lib/notifications/provider.ts) shouldn't fail in an environment that has Resend
 * configured but not Supabase (or vice versa, e.g. most unit tests).
 */
export function getEmailProviderEnv(env: NodeJS.ProcessEnv = process.env): EmailProviderEnv {
  return emailProviderEnvSchema.parse(env);
}

const pushProviderEnvSchema = z.object({
  VAPID_PUBLIC_KEY: z.string().min(1).optional(),
  VAPID_PRIVATE_KEY: z.string().min(1).optional(),
  VAPID_SUBJECT: z.string().min(1).optional(),
});

export type PushProviderEnv = z.infer<typeof pushProviderEnvSchema>;

/** Same "separate, optional" posture as getEmailProviderEnv(); see src/lib/notifications/push.ts. */
export function getPushProviderEnv(env: NodeJS.ProcessEnv = process.env): PushProviderEnv {
  return pushProviderEnvSchema.parse(env);
}

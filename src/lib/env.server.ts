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

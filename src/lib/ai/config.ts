import "server-only";

import { z } from "zod";

/**
 * Gemini free-tier limits, checked 2026-08-16. Google's rate-limits page
 * (https://ai.google.dev/gemini-api/docs/rate-limits) no longer publishes a static per-model
 * RPM/TPM/RPD table; it points to the authenticated dashboard at
 * https://aistudio.google.com/rate-limit. Cross-referenced third-party trackers agree on
 * 10 RPM / 250,000 TPM / 500 RPD for gemini-2.5-flash free tier, which is what the defaults
 * below encode. Verify against the dashboard and override via env if these drift: the queue in
 * rate-limiter.ts also backs off reactively on a real 429 from the API, so a stale default here
 * degrades to "queues a bit more" rather than silently over-spending the quota.
 *
 * The per-user limits (GEMINI_USER_*) are our own fairness policy, not a Google number: small
 * enough that one member cannot exhaust the shared daily budget alone.
 */
const configSchema = z.object({
  GEMINI_MODEL: z.string().min(1).default("gemini-2.5-flash"),
  GEMINI_GLOBAL_RPM: z.coerce.number().int().positive().default(10),
  GEMINI_GLOBAL_TPM: z.coerce.number().int().positive().default(250_000),
  GEMINI_GLOBAL_RPD: z.coerce.number().int().positive().default(500),
  GEMINI_USER_RPM: z.coerce.number().int().positive().default(4),
  GEMINI_USER_RPD: z.coerce.number().int().positive().default(60),
  GEMINI_QUEUE_TIMEOUT_MS: z.coerce.number().int().positive().default(3_000),
  GEMINI_REQUEST_TIMEOUT_MS: z.coerce.number().int().positive().default(12_000),
});

const parsed = configSchema.parse(process.env);

export const AI_CONFIG = {
  model: parsed.GEMINI_MODEL,
  globalRpm: parsed.GEMINI_GLOBAL_RPM,
  globalTpm: parsed.GEMINI_GLOBAL_TPM,
  globalRpd: parsed.GEMINI_GLOBAL_RPD,
  userRpm: parsed.GEMINI_USER_RPM,
  userRpd: parsed.GEMINI_USER_RPD,
  queueTimeoutMs: parsed.GEMINI_QUEUE_TIMEOUT_MS,
  requestTimeoutMs: parsed.GEMINI_REQUEST_TIMEOUT_MS,
} as const;

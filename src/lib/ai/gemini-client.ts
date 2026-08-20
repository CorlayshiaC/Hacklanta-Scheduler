import "server-only";

import { ApiError, GoogleGenAI } from "@google/genai";
import { AI_CONFIG } from "@/lib/ai/config";
import type { AiPromptSpec } from "@/lib/ai/types";

let cachedClient: GoogleGenAI | null | undefined;

/** Returns null when GEMINI_API_KEY is unset, the wrapper's "disabled" state. Never throws for a
 * missing key: callers treat null the same as any other unavailable-model case. */
export function getGeminiClient(): GoogleGenAI | null {
  if (cachedClient !== undefined) {
    return cachedClient;
  }

  const apiKey = process.env.GEMINI_API_KEY;
  cachedClient = apiKey ? new GoogleGenAI({ apiKey }) : null;
  return cachedClient;
}

export class GeminiTimeoutError extends Error {}

export async function callGemini(client: GoogleGenAI, promptSpec: AiPromptSpec): Promise<string> {
  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(), AI_CONFIG.requestTimeoutMs);

  try {
    const response = await client.models.generateContent({
      model: AI_CONFIG.model,
      contents: promptSpec.prompt,
      config: {
        systemInstruction: promptSpec.systemInstruction,
        responseMimeType: "application/json",
        responseJsonSchema: promptSpec.responseSchema,
        abortSignal: controller.signal,
      },
    });

    return response.text ?? "";
  } catch (error) {
    if (controller.signal.aborted) {
      throw new GeminiTimeoutError("Gemini request timed out.");
    }
    throw error;
  } finally {
    clearTimeout(timeout);
  }
}

export function isProviderRateLimitError(error: unknown): boolean {
  return error instanceof ApiError && error.status === 429;
}

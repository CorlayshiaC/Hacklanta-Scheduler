import { z } from "zod";

const quickchatQueryKindSchema = z.enum(["schedule", "next_event", "hours", "coworkers", "open_shifts"]);

export const quickchatRequestSchema = z.object({
  kind: quickchatQueryKindSchema,
});

export const quickchatRephraseRequestSchema = z.object({
  kind: quickchatQueryKindSchema,
  template: z.string().min(1).max(200),
});

import { z } from "zod";

/**
 * Pure grid generation for the bulk shift generator dialog. Turns a window, block length, and a
 * set of stations with headcounts into the flat list of shift drafts the dialog previews as
 * GridCells before a server action inserts them in one pass.
 */

export const bulkGenerationStationSchema = z.object({
  stationId: z.string().uuid(),
  name: z.string().trim().min(1, "Station name is required."),
  headcount: z.number().int().min(1, "Headcount must be at least 1.").max(99),
});

export const bulkGenerationInputSchema = z.object({
  windowStart: z.string().datetime({ message: "Choose a valid window start." }),
  windowEnd: z.string().datetime({ message: "Choose a valid window end." }),
  blockLengthMinutes: z.number().int().min(15, "Blocks must be at least 15 minutes.").max(24 * 60),
  stations: z.array(bulkGenerationStationSchema).min(1, "Add at least one station."),
});

export type BulkGenerationInput = z.infer<typeof bulkGenerationInputSchema>;

export type GeneratedShiftDraft = {
  title: string;
  stationId: string;
  startsAt: string;
  endsAt: string;
  requiredPeople: number;
};

export type BulkGenerationResult =
  | { ok: true; value: GeneratedShiftDraft[] }
  | { ok: false; message: string };

export function generateShiftGrid(input: BulkGenerationInput): BulkGenerationResult {
  const parsed = bulkGenerationInputSchema.safeParse(input);

  if (!parsed.success) {
    return { ok: false, message: parsed.error.issues[0]?.message ?? "Check the generator settings." };
  }

  const { windowStart, windowEnd, blockLengthMinutes, stations } = parsed.data;
  const start = new Date(windowStart).getTime();
  const end = new Date(windowEnd).getTime();

  if (start >= end) {
    return { ok: false, message: "Window start must be before window end." };
  }

  const blockMs = blockLengthMinutes * 60 * 1000;
  const blockCount = Math.ceil((end - start) / blockMs);
  const drafts: GeneratedShiftDraft[] = [];

  for (let block = 0; block < blockCount; block += 1) {
    const blockStart = start + block * blockMs;
    const blockEnd = Math.min(blockStart + blockMs, end);

    for (const station of stations) {
      drafts.push({
        title: station.name,
        stationId: station.stationId,
        startsAt: new Date(blockStart).toISOString(),
        endsAt: new Date(blockEnd).toISOString(),
        requiredPeople: station.headcount,
      });
    }
  }

  return { ok: true, value: drafts };
}

"use client";

import { useMemo, useState } from "react";
import { useRouter } from "next/navigation";
import { NeuInput } from "@/components/ui/neu-input";
import { NeuSelect } from "@/components/ui/neu-select";
import { PillButton } from "@/components/ui/neu-button";
import { IconButton } from "@/components/ui/icon-button";
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle, DialogTrigger } from "@/components/ui/dialog";
import { Card } from "@/components/ui/neu-card";
import { ShiftCapsule } from "@/components/ui/shift-capsule";
import { formatShiftTime } from "@/lib/utils/format";
import { generateShiftGrid } from "@/lib/scheduling/bulk-generation";
import { createStation, generateShifts } from "@/lib/scheduling/actions";
import { zonedTimeToUtcIso } from "@/lib/scheduling/timezone";

type Station = { id: string; name: string };

type StationRow = { stationId: string; headcount: number };

function CloseIcon() {
  return (
    <svg viewBox="0 0 16 16" fill="none" stroke="currentColor" strokeWidth={1.5} strokeLinecap="round" className="h-4 w-4">
      <path d="M4 4l8 8M12 4l-8 8" />
    </svg>
  );
}

export function GenerateShiftsForm({
  eventId,
  eventTimezone,
  stations,
}: {
  eventId: string;
  eventTimezone: string;
  stations: Station[];
}) {
  const router = useRouter();
  const [open, setOpen] = useState(false);
  const [windowStart, setWindowStart] = useState("");
  const [windowEnd, setWindowEnd] = useState("");
  const [blockLengthMinutes, setBlockLengthMinutes] = useState(120);
  const [rows, setRows] = useState<StationRow[]>(
    stations[0] ? [{ stationId: stations[0].id, headcount: 1 }] : [],
  );
  const [newStationName, setNewStationName] = useState("");
  const [availableStations, setAvailableStations] = useState(stations);
  const [message, setMessage] = useState<{ kind: "error" | "success"; text: string } | null>(null);
  const [isSubmitting, setIsSubmitting] = useState(false);

  const stationOptions = availableStations.map((station) => ({ value: station.id, label: station.name }));

  const preview = useMemo(() => {
    if (!windowStart || !windowEnd || rows.length === 0) {
      return null;
    }

    return generateShiftGrid({
      windowStart: zonedTimeToUtcIso(windowStart, eventTimezone),
      windowEnd: zonedTimeToUtcIso(windowEnd, eventTimezone),
      blockLengthMinutes,
      stations: rows.map((row) => ({
        stationId: row.stationId,
        name: availableStations.find((station) => station.id === row.stationId)?.name ?? "Station",
        headcount: row.headcount,
      })),
    });
  }, [windowStart, windowEnd, blockLengthMinutes, rows, availableStations, eventTimezone]);

  const previewByStation = useMemo(() => {
    if (!preview?.ok) {
      return [];
    }
    const byStation = new Map<string, { name: string; drafts: typeof preview.value }>();
    for (const draft of preview.value) {
      const group = byStation.get(draft.stationId) ?? {
        name: availableStations.find((station) => station.id === draft.stationId)?.name ?? "Station",
        drafts: [],
      };
      group.drafts.push(draft);
      byStation.set(draft.stationId, group);
    }
    return Array.from(byStation.values());
  }, [preview, availableStations]);

  async function handleAddStation() {
    if (!newStationName.trim()) {
      return;
    }

    const result = await createStation({ eventId, name: newStationName.trim() });

    if (!result.ok) {
      setMessage({ kind: "error", text: result.message });
      return;
    }

    const created = { id: result.data.stationId, name: newStationName.trim() };
    setAvailableStations((current) => [...current, created]);
    setRows((current) => [...current, { stationId: created.id, headcount: 1 }]);
    setNewStationName("");
  }

  async function handleSubmit(event: React.FormEvent) {
    event.preventDefault();

    if (!preview || !preview.ok) {
      setMessage({ kind: "error", text: preview?.ok === false ? preview.message : "Fill in the window and add a station." });
      return;
    }

    setIsSubmitting(true);
    setMessage(null);

    const result = await generateShifts({
      eventId,
      generation: {
        windowStart: zonedTimeToUtcIso(windowStart, eventTimezone),
        windowEnd: zonedTimeToUtcIso(windowEnd, eventTimezone),
        blockLengthMinutes,
        stations: rows.map((row) => ({
          stationId: row.stationId,
          name: availableStations.find((station) => station.id === row.stationId)?.name ?? "Station",
          headcount: row.headcount,
        })),
      },
    });

    setIsSubmitting(false);

    if (!result.ok) {
      setMessage({ kind: "error", text: result.message });
      return;
    }

    setMessage({ kind: "success", text: `Created ${result.data.count} shifts.` });
    setOpen(false);
    router.refresh();
  }

  return (
    <Dialog onOpenChange={setOpen} open={open}>
      <DialogTrigger asChild>
        <PillButton variant="primary">Generate shifts</PillButton>
      </DialogTrigger>
      <DialogContent className="max-w-2xl">
        <DialogHeader className="flex-row items-start justify-between">
          <div>
            <DialogTitle>Generate shifts</DialogTitle>
            <DialogDescription>
              Set a window, a block length, and stations. Every shift previews below before anything is created.
            </DialogDescription>
          </div>
        </DialogHeader>

        <form className="mt-4 flex flex-col gap-4" onSubmit={handleSubmit}>
          <div className="grid gap-4 sm:grid-cols-3">
            <div>
              <label className="text-sm font-medium text-text-primary" htmlFor="window-start">
                Window start
              </label>
              <NeuInput
                className="mt-1"
                id="window-start"
                onChange={(event) => setWindowStart(event.target.value)}
                required
                type="datetime-local"
                value={windowStart}
              />
            </div>
            <div>
              <label className="text-sm font-medium text-text-primary" htmlFor="window-end">
                Window end
              </label>
              <NeuInput
                className="mt-1"
                id="window-end"
                onChange={(event) => setWindowEnd(event.target.value)}
                required
                type="datetime-local"
                value={windowEnd}
              />
            </div>
            <div>
              <label className="text-sm font-medium text-text-primary" htmlFor="block-length">
                Block length (minutes)
              </label>
              <NeuInput
                className="mt-1"
                id="block-length"
                min={15}
                onChange={(event) => setBlockLengthMinutes(Number(event.target.value))}
                required
                step={15}
                type="number"
                value={blockLengthMinutes}
              />
            </div>
          </div>

          <div>
            <p className="text-sm font-medium text-text-primary">Stations</p>
            {availableStations.length === 0 ? <p className="mt-1 text-sm text-text-secondary">No stations yet. Add one below.</p> : null}
            <div className="mt-2 flex flex-col gap-2">
              {rows.map((row, index) => (
                <div className="flex items-center gap-2" key={`${row.stationId}-${index}`}>
                  <NeuSelect
                    className="flex-1"
                    onValueChange={(value) =>
                      setRows((current) => current.map((r, i) => (i === index ? { ...r, stationId: value } : r)))
                    }
                    options={stationOptions}
                    value={row.stationId}
                  />
                  <NeuInput
                    aria-label="Headcount"
                    className="w-20"
                    min={1}
                    onChange={(event) =>
                      setRows((current) =>
                        current.map((r, i) => (i === index ? { ...r, headcount: Number(event.target.value) } : r)),
                      )
                    }
                    type="number"
                    value={row.headcount}
                  />
                  <IconButton aria-label="Remove station row" onClick={() => setRows((current) => current.filter((_, i) => i !== index))} type="button">
                    <CloseIcon />
                  </IconButton>
                </div>
              ))}
            </div>
            {availableStations.length > 0 ? (
              <PillButton
                className="mt-2"
                onClick={() =>
                  availableStations[0] &&
                  setRows((current) => [...current, { stationId: availableStations[0]!.id, headcount: 1 }])
                }
                type="button"
                variant="default"
              >
                Add station row
              </PillButton>
            ) : null}
            <div className="mt-3 flex items-center gap-2">
              <NeuInput
                className="flex-1"
                onChange={(event) => setNewStationName(event.target.value)}
                placeholder="New station name"
                value={newStationName}
              />
              <PillButton onClick={handleAddStation} type="button" variant="default">
                Create station
              </PillButton>
            </div>
          </div>

          {previewByStation.length > 0 ? (
            <Card title={`Preview: ${preview?.ok ? preview.value.length : 0} shifts`}>
              <div className="flex flex-col gap-4">
                {previewByStation.map((group) => (
                  <section key={group.name}>
                    <h4 className="text-xs font-semibold uppercase tracking-wide text-text-secondary">{group.name}</h4>
                    <div className="mt-2 flex flex-wrap gap-2">
                      {group.drafts.map((draft) => (
                        <div className="flex w-16 flex-col items-center gap-1" key={`${draft.stationId}-${draft.startsAt}`}>
                          <ShiftCapsule className="w-fit" filled={0} needed={draft.requiredPeople} size="sm" state="empty" />
                          <p className="font-mono text-[10px] tabular-nums text-text-secondary">
                            {formatShiftTime(draft.startsAt, eventTimezone)}
                          </p>
                        </div>
                      ))}
                    </div>
                  </section>
                ))}
              </div>
            </Card>
          ) : preview && !preview.ok ? (
            <p className="text-sm text-accent-warn" role="alert">
              {preview.message}
            </p>
          ) : null}

          {message ? (
            <p
              className={message.kind === "error" ? "text-sm text-accent-warn" : "text-sm text-accent-go"}
              role={message.kind === "error" ? "alert" : "status"}
            >
              {message.text}
            </p>
          ) : null}

          <DialogFooter>
            <PillButton disabled={isSubmitting || rows.length === 0} type="submit" variant="primary">
              {isSubmitting ? "Generating..." : "Create these"}
            </PillButton>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}

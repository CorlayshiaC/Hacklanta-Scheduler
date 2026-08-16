"use client";

import { useMemo, useState } from "react";
import { useRouter } from "next/navigation";
import { NeuCard } from "@/components/ui/neu-card";
import { NeuButton } from "@/components/ui/neu-button";
import { NeuInput } from "@/components/ui/neu-input";
import { NeuSelect } from "@/components/ui/neu-select";
import { generateShiftGrid } from "@/lib/scheduling/bulk-generation";
import { createStation, generateShifts } from "@/lib/scheduling/actions";

type Station = { id: string; name: string };

type StationRow = { stationId: string; headcount: number };

// TODO(agent-1): this is the plain-form stand-in for the bulk generator dialog described in the
// brief (window + block length + stations, live GridCell preview, one confirm). The pieces are
// all here (generateShiftGrid already produces the preview list), it just needs the Dialog shell
// and GridCell preview rendering once there's time to build it (Dialog primitive already exists
// at src/components/ui/dialog.tsx, next unit of work).

export function GenerateShiftsForm({ eventId, stations }: { eventId: string; stations: Station[] }) {
  const router = useRouter();
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
      windowStart: new Date(windowStart).toISOString(),
      windowEnd: new Date(windowEnd).toISOString(),
      blockLengthMinutes,
      stations: rows.map((row) => ({
        stationId: row.stationId,
        name: availableStations.find((station) => station.id === row.stationId)?.name ?? "Station",
        headcount: row.headcount,
      })),
    });
  }, [windowStart, windowEnd, blockLengthMinutes, rows, availableStations]);

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
        windowStart: new Date(windowStart).toISOString(),
        windowEnd: new Date(windowEnd).toISOString(),
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
    router.refresh();
  }

  return (
    <NeuCard padded={false}>
      <form className="flex flex-col gap-4 p-4" onSubmit={handleSubmit}>
        <h3 className="text-lg font-semibold text-text-primary">Generate shifts</h3>
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
          {availableStations.length === 0 ? (
            <p className="mt-1 text-sm text-text-secondary">No stations yet. Add one below.</p>
          ) : null}
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
                <NeuButton
                  aria-label="Remove station row"
                  onClick={() => setRows((current) => current.filter((_, i) => i !== index))}
                  type="button"
                  variant="ghost"
                >
                  Remove
                </NeuButton>
              </div>
            ))}
          </div>
          {availableStations.length > 0 ? (
            <NeuButton
              className="mt-2"
              onClick={() =>
                availableStations[0] &&
                setRows((current) => [...current, { stationId: availableStations[0]!.id, headcount: 1 }])
              }
              type="button"
              variant="default"
            >
              Add station row
            </NeuButton>
          ) : null}
          <div className="mt-3 flex items-center gap-2">
            <NeuInput
              className="flex-1"
              onChange={(event) => setNewStationName(event.target.value)}
              placeholder="New station name"
              value={newStationName}
            />
            <NeuButton onClick={handleAddStation} type="button" variant="default">
              Create station
            </NeuButton>
          </div>
        </div>

        {preview ? (
          <p className="text-sm text-text-secondary" role="status">
            {preview.ok ? `Preview: ${preview.value.length} shifts will be created.` : preview.message}
          </p>
        ) : null}

        {message ? (
          <p
            className={message.kind === "error" ? "text-sm text-danger" : "text-sm text-purple-400"}
            role={message.kind === "error" ? "alert" : "status"}
          >
            {message.text}
          </p>
        ) : null}

        <NeuButton disabled={isSubmitting || rows.length === 0} type="submit" variant="primary">
          {isSubmitting ? "Generating..." : "Generate shifts"}
        </NeuButton>
      </form>
    </NeuCard>
  );
}

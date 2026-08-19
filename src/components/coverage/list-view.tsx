import { Card } from "@/components/ui/neu-card";
import { StatusPill } from "@/components/ui/status-pill";
import { formatShiftTime } from "@/lib/utils/format";
import type { ScheduleRow } from "@/lib/scheduling/data";

/** Compact table: time, station, person, StatusPill. */
export function ListView({ rows, timeZone }: { rows: ScheduleRow[]; timeZone: string }) {
  if (rows.length === 0) {
    return (
      <Card className="text-center">
        <p className="text-sm text-text-secondary">No shifts yet. Generate them from the event page.</p>
      </Card>
    );
  }

  return (
    <Card padded={false}>
      <div className="overflow-x-auto">
        <table className="w-full text-left text-sm">
          <thead>
            <tr className="border-b border-hairline text-xs uppercase tracking-wide text-text-secondary">
              <th className="px-4 py-3 font-medium">Time</th>
              <th className="px-4 py-3 font-medium">Station</th>
              <th className="px-4 py-3 font-medium">Person</th>
              <th className="px-4 py-3 font-medium">Status</th>
            </tr>
          </thead>
          <tbody>
            {rows.map((row) => (
              <tr className="border-b border-hairline last:border-0" key={row.assignmentId ?? `${row.shiftId}-open`}>
                <td className="whitespace-nowrap px-4 py-2 font-mono text-xs tabular-nums text-text-secondary">
                  {formatShiftTime(row.startsAt, timeZone)}–{formatShiftTime(row.endsAt, timeZone)}
                </td>
                <td className="px-4 py-2 text-text-primary">{row.station?.name ?? row.title}</td>
                <td className="px-4 py-2 text-text-primary">
                  {row.personName ?? (row.openCount > 0 ? `${row.openCount} open` : "Unassigned")}
                </td>
                <td className="px-4 py-2">
                  <StatusPill state={row.approvalState} />
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </Card>
  );
}

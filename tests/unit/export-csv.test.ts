import { describe, expect, it } from "vitest";
import { generateShiftsCsv } from "@/lib/export/csv";
import type { ShiftCsvRow } from "@/lib/export/csv";

const baseRow: ShiftCsvRow = {
  station: "Check-in",
  startsAt: "2026-10-09 07:00",
  endsAt: "2026-10-09 10:00",
  location: "Lobby",
  assignees: ["Ada Lovelace"],
  filled: 1,
  needed: 2,
};

describe("generateShiftsCsv", () => {
  it("starts with a UTF-8 byte order mark so Excel opens it correctly", () => {
    const csv = generateShiftsCsv([baseRow]);

    expect(csv.charCodeAt(0)).toBe(0xfeff);
  });

  it("writes the header row and one row per shift", () => {
    const csv = generateShiftsCsv([baseRow]);
    const lines = csv.replace("﻿", "").split("\r\n");

    expect(lines[0]).toBe("Station,Start,End,Location,Assignees,Filled,Needed");
    expect(lines[1]).toBe("Check-in,2026-10-09 07:00,2026-10-09 10:00,Lobby,Ada Lovelace,1,2");
  });

  it("joins multiple assignees with a semicolon", () => {
    const csv = generateShiftsCsv([{ ...baseRow, assignees: ["Ada Lovelace", "Grace Hopper"] }]);

    expect(csv).toContain("Ada Lovelace;Grace Hopper");
  });

  it("renders an empty location as an empty field, not the literal null", () => {
    const csv = generateShiftsCsv([{ ...baseRow, location: null }]);
    const lines = csv.replace("﻿", "").split("\r\n");

    expect(lines[1]).toBe("Check-in,2026-10-09 07:00,2026-10-09 10:00,,Ada Lovelace,1,2");
  });

  it("quotes and escapes a field containing a comma", () => {
    const csv = generateShiftsCsv([{ ...baseRow, station: "Check-in, Main Entrance" }]);

    expect(csv).toContain('"Check-in, Main Entrance"');
  });

  it("quotes and doubles internal quotes in a field containing a double quote", () => {
    const csv = generateShiftsCsv([{ ...baseRow, location: 'Room "B"' }]);

    expect(csv).toContain('"Room ""B"""');
  });

  it("quotes a field containing a newline", () => {
    const csv = generateShiftsCsv([{ ...baseRow, location: "Lobby\nSouth entrance" }]);

    expect(csv).toContain('"Lobby\nSouth entrance"');
  });

  it("returns just the header when there are no rows", () => {
    const csv = generateShiftsCsv([]);

    expect(csv).toBe("﻿Station,Start,End,Location,Assignees,Filled,Needed");
  });
});

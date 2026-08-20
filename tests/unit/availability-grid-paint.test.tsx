import { fireEvent, render, screen } from "@testing-library/react";
import React, { useCallback, useState } from "react";
import { beforeAll, describe, expect, it } from "vitest";
import { AvailabilityGrid } from "@/components/availability/availability-grid";
import { cellKey, type GridSpec } from "@/lib/availability/grid";

// jsdom implements neither Pointer Capture method. The grid calls setPointerCapture on pointerdown
// so a drag keeps receiving events after the pointer leaves the origin cell; without these stubs
// every pointerdown throws an unhandled TypeError that has nothing to do with what is under test.
beforeAll(() => {
  if (!HTMLElement.prototype.setPointerCapture) {
    HTMLElement.prototype.setPointerCapture = function setPointerCapture() {};
    HTMLElement.prototype.releasePointerCapture = function releasePointerCapture() {};
  }
});

/**
 * Behavior guard for the memoization work in availability-grid.tsx.
 *
 * That file's handlers were rewritten to read through a latest-value box so their identities stay
 * stable and the memoized cell can skip unchanged cells. The refactor is only worth anything if
 * painting, erasing, range-select and keyboard navigation still behave identically, which is what
 * these assert. The drag case in particular pins the intra-frame accumulation: several
 * `pointerenter` events between two React renders must all land, which is exactly what a stale
 * captured `value` used to get wrong.
 */

const SPEC: GridSpec = {
  days: [
    { id: "2026-10-09", label: "Fri" },
    { id: "2026-10-10", label: "Sat" },
  ],
  startMinute: 540, // 9:00
  endMinute: 660, // 11:00
  granularityMinutes: 30,
};

/** Mirrors AvailabilityManager's controlled-set wiring. */
function Harness({ onCommit }: { onCommit?: (next: Set<string>) => void }) {
  const [selected, setSelected] = useState<Set<string>>(new Set());
  const handleChange = useCallback(
    (next: Set<string>) => {
      setSelected(next);
      onCommit?.(next);
    },
    [onCommit],
  );

  return (
    <>
      <AvailabilityGrid onChange={handleChange} spec={SPEC} value={selected} />
      <output data-testid="selected">{[...selected].sort().join(",")}</output>
    </>
  );
}

const cellFor = (dayLabel: string, time: string) => screen.getByRole("button", { name: `${dayLabel} ${time}` });
const selectedValue = () => screen.getByTestId("selected").textContent;

describe("AvailabilityGrid painting", () => {
  it("paints a single cell on pointer down", () => {
    render(<Harness />);
    fireEvent.pointerDown(cellFor("Fri", "9 AM"), { pointerId: 1 });
    expect(selectedValue()).toBe(cellKey({ dayId: "2026-10-09", minute: 540 }));
  });

  it("accumulates every cell crossed in one drag, including several between renders", () => {
    render(<Harness />);
    const first = cellFor("Fri", "9 AM");
    fireEvent.pointerDown(first, { pointerId: 1 });
    // Three enters dispatched back to back: all three must land, not just the last.
    fireEvent.pointerEnter(cellFor("Fri", "9:30 AM"));
    fireEvent.pointerEnter(cellFor("Fri", "10 AM"));
    fireEvent.pointerEnter(cellFor("Fri", "10:30 AM"));

    expect(selectedValue()).toBe(
      [540, 570, 600, 630].map((minute) => cellKey({ dayId: "2026-10-09", minute })).sort().join(","),
    );
  });

  it("erases when the drag starts on an already-painted cell", () => {
    render(<Harness />);
    fireEvent.pointerDown(cellFor("Fri", "9 AM"), { pointerId: 1 });
    fireEvent.pointerEnter(cellFor("Fri", "9:30 AM"));
    fireEvent.pointerUp(cellFor("Fri", "9:30 AM"));
    expect(selectedValue()).not.toBe("");

    // Second drag begins on a painted cell, so the whole run erases.
    fireEvent.pointerDown(cellFor("Fri", "9 AM"), { pointerId: 2 });
    fireEvent.pointerEnter(cellFor("Fri", "9:30 AM"));
    expect(selectedValue()).toBe("");
  });

  it("does not repaint a cell already touched in the same drag", () => {
    const commits: string[] = [];
    render(<Harness onCommit={(next) => commits.push([...next].sort().join(","))} />);
    fireEvent.pointerDown(cellFor("Fri", "9 AM"), { pointerId: 1 });
    fireEvent.pointerEnter(cellFor("Fri", "9:30 AM"));
    fireEvent.pointerEnter(cellFor("Fri", "9:30 AM"));
    fireEvent.pointerEnter(cellFor("Fri", "9:30 AM"));
    expect(commits).toHaveLength(2);
  });

  it("stops painting after pointer up", () => {
    render(<Harness />);
    fireEvent.pointerDown(cellFor("Fri", "9 AM"), { pointerId: 1 });
    fireEvent.pointerUp(cellFor("Fri", "9 AM"));
    fireEvent.pointerEnter(cellFor("Fri", "10 AM"));
    expect(selectedValue()).toBe(cellKey({ dayId: "2026-10-09", minute: 540 }));
  });

  it("toggles a cell with the space key and range-selects with shift", () => {
    render(<Harness />);
    fireEvent.keyDown(cellFor("Fri", "9 AM"), { key: " " });
    expect(selectedValue()).toBe(cellKey({ dayId: "2026-10-09", minute: 540 }));

    // Shift+Enter from the anchor extends the run across the day's columns.
    fireEvent.keyDown(cellFor("Fri", "10:30 AM"), { key: "Enter", shiftKey: true });
    expect(selectedValue()).toBe(
      [540, 570, 600, 630].map((minute) => cellKey({ dayId: "2026-10-09", minute })).sort().join(","),
    );
  });

  it("keeps the eraser toggle authoritative for keyboard commits", () => {
    render(<Harness />);
    fireEvent.keyDown(cellFor("Sat", "9 AM"), { key: " " });
    expect(selectedValue()).toBe(cellKey({ dayId: "2026-10-10", minute: 540 }));

    fireEvent.click(screen.getByRole("button", { name: "Eraser" }));
    fireEvent.keyDown(cellFor("Sat", "9 AM"), { key: " " });
    expect(selectedValue()).toBe("");
  });

  it("moves the roving tab stop with the arrow keys", () => {
    render(<Harness />);
    expect(cellFor("Fri", "9 AM")).toHaveAttribute("tabindex", "0");

    fireEvent.keyDown(cellFor("Fri", "9 AM"), { key: "ArrowRight" });
    expect(cellFor("Fri", "9:30 AM")).toHaveAttribute("tabindex", "0");
    expect(cellFor("Fri", "9 AM")).toHaveAttribute("tabindex", "-1");

    fireEvent.keyDown(cellFor("Fri", "9:30 AM"), { key: "ArrowDown" });
    expect(cellFor("Sat", "9:30 AM")).toHaveAttribute("tabindex", "0");
  });

  it("ignores input entirely when disabled", () => {
    render(
      <>
        <AvailabilityGrid disabled onChange={() => { throw new Error("must not commit"); }} spec={SPEC} value={new Set()} />
      </>,
    );
    fireEvent.pointerDown(cellFor("Fri", "9 AM"), { pointerId: 1 });
    fireEvent.keyDown(cellFor("Fri", "9 AM"), { key: " " });
  });
});

import { render, screen } from "@testing-library/react";
import React from "react";
import { describe, expect, it } from "vitest";
import { AppShell } from "@/components/layout/app-shell";

describe("AppShell", () => {
  it("renders children", () => {
    render(
      <AppShell>
        <span>HackLanta Scheduler</span>
      </AppShell>,
    );

    expect(screen.getByText("HackLanta Scheduler")).toBeInTheDocument();
  });
});

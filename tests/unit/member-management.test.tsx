import { render, screen } from "@testing-library/react";
import React from "react";
import { describe, expect, it } from "vitest";
import { MemberManagement } from "@/components/admin/members/member-management";
import type { AdminMember, CoverageRole } from "@/lib/admin/member-data";

const eventId = "22222222-2222-4222-8222-222222222222";

const coverageRoles: CoverageRole[] = [
  {
    id: "33333333-3333-4333-8333-333333333333",
    event_id: eventId,
    name: "Operations",
    description: null,
    created_at: "2026-01-01T00:00:00.000Z",
    updated_at: "2026-01-01T00:00:00.000Z",
  },
  {
    id: "44444444-4444-4444-8444-444444444444",
    event_id: eventId,
    name: "Registration",
    description: null,
    created_at: "2026-01-01T00:00:00.000Z",
    updated_at: "2026-01-01T00:00:00.000Z",
  },
];

const members: AdminMember[] = [
  {
    id: "11111111-1111-4111-8111-111111111111",
    fullName: "Ada Lovelace",
    email: "ada@example.com",
    role: "admin",
    isActive: true,
    coverageRoles: [coverageRoles[0] as CoverageRole],
    availabilityWindows: [],
    totalAvailabilityHours: 0,
    settings: {
      id: "55555555-5555-4555-8555-555555555555",
      event_id: eventId,
      profile_id: "11111111-1111-4111-8111-111111111111",
      max_hours: 12,
      minimum_break_minutes: 30,
      created_at: "2026-01-01T00:00:00.000Z",
      updated_at: "2026-01-01T00:00:00.000Z",
    },
  },
];

describe("MemberManagement", () => {
  it("renders a clear empty state", () => {
    render(<MemberManagement coverageRoles={coverageRoles} eventId={eventId} members={[]} />);

    expect(screen.getByText("No members match the current filters.")).toBeInTheDocument();
  });

  it("shows member profile, status, assigned role, and available role controls", () => {
    render(<MemberManagement coverageRoles={coverageRoles} eventId={eventId} members={members} />);

    expect(screen.getByText("Ada Lovelace")).toBeInTheDocument();
    expect(screen.getByText("ada@example.com")).toBeInTheDocument();
    expect(screen.getAllByText("Admin").length).toBeGreaterThan(0);
    expect(screen.getAllByText("Active").length).toBeGreaterThan(0);
    expect(screen.getByRole("button", { name: "Operations remove" })).toBeInTheDocument();
    expect(screen.getByRole("button", { name: "Add role" })).toBeInTheDocument();
    expect(screen.getByDisplayValue("12")).toBeInTheDocument();
    expect(screen.getByDisplayValue("30")).toBeInTheDocument();
  });
});

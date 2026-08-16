// Shapes for the public, unauthenticated schedule surfaces (`/s/[token]`, `/api/og/[token]`).
// Mirrors the pre-shaped return value the requested `get_public_schedule()` database function
// will send once `share_tokens` and `org_settings` exist. See docs/contracts/public.md section 2
// and docs/contracts/schema-requests.md (Agent 5, item 1) for the real contract.

/** Matches `org_settings.public_name_display`, once that column exists. */
export type PublicNameDisplay = "full_name" | "first_name" | "initials";

export type PublicShift = {
  id: string;
  title: string;
  stationName: string | null;
  startsAt: string;
  endsAt: string;
  location: string | null;
  needed: number;
  filled: number;
  assignees: string[];
};

export type PublicSchedule = {
  event: {
    name: string;
    description: string | null;
    location: string | null;
    startsAt: string;
    endsAt: string;
    timezone: string;
  };
  shifts: PublicShift[];
  slotsFilled: number;
  slotsNeeded: number;
};

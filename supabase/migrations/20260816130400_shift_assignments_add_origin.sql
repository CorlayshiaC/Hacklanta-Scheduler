-- Agent 3 request #3 (docs/contracts/schema-requests.md), first half. "origin" is a second axis
-- alongside the existing assignment_status (draft/published/removed): who put this assignment here.
-- Kept as a plain checked text column, not an enum, since it is a closed two-value set that is cheap to
-- widen later without an enum migration if a third origin ever shows up.
--
-- Design decision (Agent 2), per docs/audit.md's "three conflated status concepts" finding: the existing
-- draft/published/removed axis keeps its current meaning for the single-event publish/review workflow
-- (src/lib/admin/schedule/review.ts) unchanged in this pass. Assignments created by the new self-signup
-- and swap-claim functions (see 20260816131000_server_authoritative_functions.sql) write
-- status = 'published' directly: visibility for the generalized, multi-event flow is governed by
-- events.status, not the per-assignment draft/publish gate. "removed" remains the terminal "dropped"
-- state from the shared vocabulary; this migration set does not introduce a separate "dropped" value.

alter table public.shift_assignments
add column origin text not null default 'assigned'
check (origin in ('assigned', 'signup'));

comment on column public.shift_assignments.origin is
  'assigned: an organizer placed this member. signup: the member claimed the shift themselves via claim_shift() or claim_swap().';

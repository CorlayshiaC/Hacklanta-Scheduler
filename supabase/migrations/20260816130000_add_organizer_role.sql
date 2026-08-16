-- Adds the "organizer" tier to app_role. Requested by Agent 3 (docs/contracts/schema-requests.md #1) so
-- organizer-only UI and RLS checks have a value to target now. The board_member -> member rename is
-- deferred to a later migration until Agent 3/4/5 confirm no code still string-matches "board_member"
-- (see docs/contracts/schema.md, "Role model" section, for the full rationale).
alter type public.app_role add value 'organizer';

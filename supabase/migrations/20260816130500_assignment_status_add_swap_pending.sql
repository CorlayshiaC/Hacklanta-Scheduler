-- Agent 3 request #3, second half. swap_pending must be added to the enum in its own migration:
-- Postgres forbids using a freshly added enum value (including in an index predicate) within the same
-- transaction that added it. See 20260816130600_organizer_write_access_and_swap_requests.sql for the
-- first place it is used (the unique_active_shift_assignment index).
alter type public.assignment_status add value 'swap_pending';

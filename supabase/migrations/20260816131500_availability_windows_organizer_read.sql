-- getAvailabilityForWindow(eventId) (src/lib/db/availability.ts, one of Agent 2's own lib/db
-- deliverables, needed for the coverage board and candidate recommendations) is unusable for an
-- organizer today: availability_windows_select_own_or_admin only ever let a member see their own row
-- or an admin see everything. Broadening read access to organizer, same is_organizer_or_admin()
-- pattern as every other table in 20260816130600. Write access (insert/update/delete, member-owns-it)
-- is unchanged: an organizer can see availability, not edit it on a member's behalf.
drop policy if exists "availability_windows_select_own_or_admin" on public.availability_windows;

create policy "availability_windows_select_own_or_organizer"
on public.availability_windows for select
to authenticated
using (profile_id = (select auth.uid()) or (select app_private.is_organizer_or_admin()));

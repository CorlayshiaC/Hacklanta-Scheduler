-- Agent 4 caught a real gap (docs/contracts/requests.md): swap_requests_select_own_or_organizer only
-- let a member see a row where they were requested_by, claimed_by, or organizer/admin. That means a
-- browsing member could never SELECT anyone else's open swap request to discover it, which defeats
-- claim_swap()'s entire "first eligible claimer wins, open marketplace" design (20260816131000). Widen
-- select to also admit any authenticated member when status = 'open'.
drop policy if exists "swap_requests_select_own_or_organizer" on public.swap_requests;

create policy "swap_requests_select_open_own_or_organizer"
on public.swap_requests for select
to authenticated
using (
  status = 'open'
  or requested_by = (select auth.uid())
  or claimed_by = (select auth.uid())
  or (select app_private.is_organizer_or_admin())
);

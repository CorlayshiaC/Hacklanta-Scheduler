-- Agent 4 request #1 (docs/contracts/schema-requests.md): recurring weekly availability ("generally
-- free Tuesday evenings"), independent of any event. availability_windows stays event-scoped for
-- per-event one-off availability (unchanged); this is a parallel table for the recurring case, not a
-- replacement. Stored in local time, no timezone conversion needed since it never crosses an event's
-- timezone boundary the way an event-scoped timestamptz window does. day_of_week: 0 = Sunday, matching
-- Date.getDay(), the existing convention in src/lib/availability/time.ts.

create table public.recurring_availability_windows (
  id uuid primary key default extensions.uuid_generate_v4(),
  profile_id uuid not null references public.profiles (id) on delete cascade,
  day_of_week smallint not null check (day_of_week between 0 and 6),
  starts_at_local time not null,
  ends_at_local time not null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  constraint recurring_availability_valid_range check (starts_at_local < ends_at_local)
);

create index recurring_availability_profile_idx on public.recurring_availability_windows (profile_id);

create trigger set_recurring_availability_windows_updated_at
before update on public.recurring_availability_windows
for each row execute function public.set_updated_at();

alter table public.recurring_availability_windows enable row level security;

-- A member reads/writes only their own rows; organizers/admins can read all rows (candidate
-- suggestions, "fits my availability" shift filter defaults).
create policy "recurring_availability_select_own_or_organizer"
on public.recurring_availability_windows for select
to authenticated
using (
  profile_id = (select auth.uid())
  or (select app_private.is_organizer_or_admin())
);

create policy "recurring_availability_insert_own"
on public.recurring_availability_windows for insert
to authenticated
with check (profile_id = (select auth.uid()));

create policy "recurring_availability_update_own"
on public.recurring_availability_windows for update
to authenticated
using (profile_id = (select auth.uid()))
with check (profile_id = (select auth.uid()));

create policy "recurring_availability_delete_own"
on public.recurring_availability_windows for delete
to authenticated
using (profile_id = (select auth.uid()));

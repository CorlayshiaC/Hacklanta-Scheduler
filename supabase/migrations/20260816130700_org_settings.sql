-- Agent 5 request #2 (docs/contracts/schema-requests.md): singleton org-wide settings row. Adopted
-- close to verbatim since docs/contracts/public.md already references org_settings.public_name_display
-- by name.
--
-- "id boolean primary key default true check (id)" is the standard Postgres singleton-row trick: a
-- boolean primary key can only ever hold one true row (a false row would violate the check).

create table public.org_settings (
  id boolean primary key default true,
  org_name text not null default 'progsu',
  default_shift_buffer_minutes integer not null default 0,
  fairness_settings jsonb not null default '{}'::jsonb,
  semester_starts_on date,
  semester_ends_on date,
  public_name_display text not null default 'first_name'
    check (public_name_display in ('full_name', 'first_name', 'initials')),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  constraint org_settings_singleton check (id)
);

insert into public.org_settings (id) values (true);

create trigger set_org_settings_updated_at
before update on public.org_settings
for each row execute function public.set_updated_at();

alter table public.org_settings enable row level security;

-- Readable by any authenticated member: several surfaces (public name display policy, semester dates,
-- shift buffers) read this outside admin screens. Writable by admin only: org-wide settings are an
-- admin capability, not organizer, per the shared-context role split.
create policy "org_settings_select_authenticated"
on public.org_settings for select
to authenticated
using (true);

create policy "org_settings_admin_update"
on public.org_settings for update
to authenticated
using ((select app_private.is_admin()))
with check ((select app_private.is_admin()));

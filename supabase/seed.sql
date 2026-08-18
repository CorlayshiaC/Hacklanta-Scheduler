-- progsu scheduler demo fixtures.
--
-- Everything below is idempotent: every row uses a fixed uuid and every insert targets
-- "on conflict (id) do nothing", so re-running this file against a database that already has this
-- data does not duplicate rows or error. One thing needs a workaround, called out inline where it
-- happens:
--
-- 1. public.profiles has a "prevent_self_role_escalation" trigger that only allows role/is_active
--    changes when app_private.is_admin() is true for the calling session. This script runs as the
--    postgres superuser with no auth.uid() in scope, so it is never "admin" from that trigger's point
--    of view. The trigger is disabled for the duration of the role/is_active updates below and
--    re-enabled immediately after.
--
-- V2 note: public.change_requests (which replaced public.swap_requests, see
-- docs/contracts/schema.md "V2 change requests") has a validate_and_link_change_request BEFORE
-- INSERT trigger too, but unlike the old swap trigger it has no side effect on shift_assignments (V2
-- decouples "a change request is open" from the assignment's own approval state), so a plain
-- "on conflict do nothing" is safe to re-run without the old where-not-exists workaround.
-- shift_assignments.state defaults to 'in_approval' (added by 20260817000200), so every assignment
-- fixture below is in_approval unless explicitly promoted to 'approved' or 'not_assigned' further
-- down, after the insert.

-- ============================================================================
-- Members (auth.users -> profiles via the existing handle_new_user trigger)
-- ============================================================================
-- Inserting into auth.users fires app_private.handle_new_user(), which creates a matching
-- public.profiles row defaulted to role 'member' with is_active = true. Roles are promoted
-- below in a separate step, after every profile row exists.

insert into auth.users (
  instance_id, id, aud, role, email, encrypted_password,
  email_confirmed_at, raw_app_meta_data, raw_user_meta_data,
  created_at, updated_at,
  confirmation_token, recovery_token, email_change_token_new, email_change
)
values
  ('00000000-0000-0000-0000-000000000000', '10000000-0000-4000-8000-000000000001', 'authenticated', 'authenticated', 'maya.whitfield@gsu.edu', 'seed-placeholder-password-hash', now(), '{"provider":"email","providers":["email"]}', '{"full_name":"Maya Whitfield"}', now(), now(), '', '', '', ''),
  ('00000000-0000-0000-0000-000000000000', '10000000-0000-4000-8000-000000000002', 'authenticated', 'authenticated', 'daniel.okafor@gsu.edu', 'seed-placeholder-password-hash', now(), '{"provider":"email","providers":["email"]}', '{"full_name":"Daniel Okafor"}', now(), now(), '', '', '', ''),
  ('00000000-0000-0000-0000-000000000000', '10000000-0000-4000-8000-000000000003', 'authenticated', 'authenticated', 'priya.ramaswamy@gsu.edu', 'seed-placeholder-password-hash', now(), '{"provider":"email","providers":["email"]}', '{"full_name":"Priya Ramaswamy"}', now(), now(), '', '', '', ''),
  ('00000000-0000-0000-0000-000000000000', '10000000-0000-4000-8000-000000000004', 'authenticated', 'authenticated', 'ethan.cho@gsu.edu', 'seed-placeholder-password-hash', now(), '{"provider":"email","providers":["email"]}', '{"full_name":"Ethan Cho"}', now(), now(), '', '', '', ''),
  ('00000000-0000-0000-0000-000000000000', '10000000-0000-4000-8000-000000000005', 'authenticated', 'authenticated', 'brianna.sutton@gsu.edu', 'seed-placeholder-password-hash', now(), '{"provider":"email","providers":["email"]}', '{"full_name":"Brianna Sutton"}', now(), now(), '', '', '', ''),
  ('00000000-0000-0000-0000-000000000000', '10000000-0000-4000-8000-000000000006', 'authenticated', 'authenticated', 'jayden.marsh@gsu.edu', 'seed-placeholder-password-hash', now(), '{"provider":"email","providers":["email"]}', '{"full_name":"Jayden Marsh"}', now(), now(), '', '', '', ''),
  ('00000000-0000-0000-0000-000000000000', '10000000-0000-4000-8000-000000000007', 'authenticated', 'authenticated', 'sofia.delgado@gsu.edu', 'seed-placeholder-password-hash', now(), '{"provider":"email","providers":["email"]}', '{"full_name":"Sofia Delgado"}', now(), now(), '', '', '', ''),
  ('00000000-0000-0000-0000-000000000000', '10000000-0000-4000-8000-000000000008', 'authenticated', 'authenticated', 'marcus.webb@gsu.edu', 'seed-placeholder-password-hash', now(), '{"provider":"email","providers":["email"]}', '{"full_name":"Marcus Webb"}', now(), now(), '', '', '', ''),
  ('00000000-0000-0000-0000-000000000000', '10000000-0000-4000-8000-000000000009', 'authenticated', 'authenticated', 'aaliyah.grant@gsu.edu', 'seed-placeholder-password-hash', now(), '{"provider":"email","providers":["email"]}', '{"full_name":"Aaliyah Grant"}', now(), now(), '', '', '', ''),
  ('00000000-0000-0000-0000-000000000000', '10000000-0000-4000-8000-000000000010', 'authenticated', 'authenticated', 'noah.petrov@gsu.edu', 'seed-placeholder-password-hash', now(), '{"provider":"email","providers":["email"]}', '{"full_name":"Noah Petrov"}', now(), now(), '', '', '', ''),
  ('00000000-0000-0000-0000-000000000000', '10000000-0000-4000-8000-000000000011', 'authenticated', 'authenticated', 'camila.reyes@gsu.edu', 'seed-placeholder-password-hash', now(), '{"provider":"email","providers":["email"]}', '{"full_name":"Camila Reyes"}', now(), now(), '', '', '', ''),
  ('00000000-0000-0000-0000-000000000000', '10000000-0000-4000-8000-000000000012', 'authenticated', 'authenticated', 'tyler.nguyen@gsu.edu', 'seed-placeholder-password-hash', now(), '{"provider":"email","providers":["email"]}', '{"full_name":"Tyler Nguyen"}', now(), now(), '', '', '', ''),
  ('00000000-0000-0000-0000-000000000000', '10000000-0000-4000-8000-000000000013', 'authenticated', 'authenticated', 'zoe.harrington@gsu.edu', 'seed-placeholder-password-hash', now(), '{"provider":"email","providers":["email"]}', '{"full_name":"Zoe Harrington"}', now(), now(), '', '', '', ''),
  ('00000000-0000-0000-0000-000000000000', '10000000-0000-4000-8000-000000000014', 'authenticated', 'authenticated', 'elijah.banks@gsu.edu', 'seed-placeholder-password-hash', now(), '{"provider":"email","providers":["email"]}', '{"full_name":"Elijah Banks"}', now(), now(), '', '', '', ''),
  ('00000000-0000-0000-0000-000000000000', '10000000-0000-4000-8000-000000000015', 'authenticated', 'authenticated', 'amara.chukwu@gsu.edu', 'seed-placeholder-password-hash', now(), '{"provider":"email","providers":["email"]}', '{"full_name":"Amara Chukwu"}', now(), now(), '', '', '', ''),
  ('00000000-0000-0000-0000-000000000000', '10000000-0000-4000-8000-000000000016', 'authenticated', 'authenticated', 'ryan.kessler@gsu.edu', 'seed-placeholder-password-hash', now(), '{"provider":"email","providers":["email"]}', '{"full_name":"Ryan Kessler"}', now(), now(), '', '', '', ''),
  ('00000000-0000-0000-0000-000000000000', '10000000-0000-4000-8000-000000000017', 'authenticated', 'authenticated', 'isabella.marchetti@gsu.edu', 'seed-placeholder-password-hash', now(), '{"provider":"email","providers":["email"]}', '{"full_name":"Isabella Marchetti"}', now(), now(), '', '', '', ''),
  ('00000000-0000-0000-0000-000000000000', '10000000-0000-4000-8000-000000000018', 'authenticated', 'authenticated', 'devon.blake@gsu.edu', 'seed-placeholder-password-hash', now(), '{"provider":"email","providers":["email"]}', '{"full_name":"Devon Blake"}', now(), now(), '', '', '', ''),
  ('00000000-0000-0000-0000-000000000000', '10000000-0000-4000-8000-000000000019', 'authenticated', 'authenticated', 'nia.robinson@gsu.edu', 'seed-placeholder-password-hash', now(), '{"provider":"email","providers":["email"]}', '{"full_name":"Nia Robinson"}', now(), now(), '', '', '', ''),
  ('00000000-0000-0000-0000-000000000000', '10000000-0000-4000-8000-000000000020', 'authenticated', 'authenticated', 'hunter.vance@gsu.edu', 'seed-placeholder-password-hash', now(), '{"provider":"email","providers":["email"]}', '{"full_name":"Hunter Vance"}', now(), now(), '', '', '', ''),
  ('00000000-0000-0000-0000-000000000000', '10000000-0000-4000-8000-000000000021', 'authenticated', 'authenticated', 'layla.haddad@gsu.edu', 'seed-placeholder-password-hash', now(), '{"provider":"email","providers":["email"]}', '{"full_name":"Layla Haddad"}', now(), now(), '', '', '', ''),
  ('00000000-0000-0000-0000-000000000000', '10000000-0000-4000-8000-000000000022', 'authenticated', 'authenticated', 'caleb.whitmore@gsu.edu', 'seed-placeholder-password-hash', now(), '{"provider":"email","providers":["email"]}', '{"full_name":"Caleb Whitmore"}', now(), now(), '', '', '', ''),
  ('00000000-0000-0000-0000-000000000000', '10000000-0000-4000-8000-000000000023', 'authenticated', 'authenticated', 'simone.dubois@gsu.edu', 'seed-placeholder-password-hash', now(), '{"provider":"email","providers":["email"]}', '{"full_name":"Simone Dubois"}', now(), now(), '', '', '', ''),
  ('00000000-0000-0000-0000-000000000000', '10000000-0000-4000-8000-000000000024', 'authenticated', 'authenticated', 'andre.fontaine@gsu.edu', 'seed-placeholder-password-hash', now(), '{"provider":"email","providers":["email"]}', '{"full_name":"Andre Fontaine"}', now(), now(), '', '', '', ''),
  ('00000000-0000-0000-0000-000000000000', '10000000-0000-4000-8000-000000000025', 'authenticated', 'authenticated', 'kayla.ferris@gsu.edu', 'seed-placeholder-password-hash', now(), '{"provider":"email","providers":["email"]}', '{"full_name":"Kayla Ferris"}', now(), now(), '', '', '', ''),
  ('00000000-0000-0000-0000-000000000000', '10000000-0000-4000-8000-000000000026', 'authenticated', 'authenticated', 'owen.malick@gsu.edu', 'seed-placeholder-password-hash', now(), '{"provider":"email","providers":["email"]}', '{"full_name":"Owen Malick"}', now(), now(), '', '', '', ''),
  ('00000000-0000-0000-0000-000000000000', '10000000-0000-4000-8000-000000000027', 'authenticated', 'authenticated', 'destiny.pratt@gsu.edu', 'seed-placeholder-password-hash', now(), '{"provider":"email","providers":["email"]}', '{"full_name":"Destiny Pratt"}', now(), now(), '', '', '', ''),
  ('00000000-0000-0000-0000-000000000000', '10000000-0000-4000-8000-000000000028', 'authenticated', 'authenticated', 'miles.yoon@gsu.edu', 'seed-placeholder-password-hash', now(), '{"provider":"email","providers":["email"]}', '{"full_name":"Miles Yoon"}', now(), now(), '', '', '', ''),
  ('00000000-0000-0000-0000-000000000000', '10000000-0000-4000-8000-000000000029', 'authenticated', 'authenticated', 'grace.abernathy@gsu.edu', 'seed-placeholder-password-hash', now(), '{"provider":"email","providers":["email"]}', '{"full_name":"Grace Abernathy"}', now(), now(), '', '', '', ''),
  ('00000000-0000-0000-0000-000000000000', '10000000-0000-4000-8000-000000000030', 'authenticated', 'authenticated', 'trevor.lindqvist@gsu.edu', 'seed-placeholder-password-hash', now(), '{"provider":"email","providers":["email"]}', '{"full_name":"Trevor Lindqvist"}', now(), now(), '', '', '', ''),
  ('00000000-0000-0000-0000-000000000000', '10000000-0000-4000-8000-000000000031', 'authenticated', 'authenticated', 'jasmine.okoye@gsu.edu', 'seed-placeholder-password-hash', now(), '{"provider":"email","providers":["email"]}', '{"full_name":"Jasmine Okoye"}', now(), now(), '', '', '', ''),
  ('00000000-0000-0000-0000-000000000000', '10000000-0000-4000-8000-000000000032', 'authenticated', 'authenticated', 'connor.sharpe@gsu.edu', 'seed-placeholder-password-hash', now(), '{"provider":"email","providers":["email"]}', '{"full_name":"Connor Sharpe"}', now(), now(), '', '', '', ''),
  ('00000000-0000-0000-0000-000000000000', '10000000-0000-4000-8000-000000000033', 'authenticated', 'authenticated', 'nadia.osei@gsu.edu', 'seed-placeholder-password-hash', now(), '{"provider":"email","providers":["email"]}', '{"full_name":"Nadia Osei"}', now(), now(), '', '', '', ''),
  ('00000000-0000-0000-0000-000000000000', '10000000-0000-4000-8000-000000000034', 'authenticated', 'authenticated', 'bryce.callahan@gsu.edu', 'seed-placeholder-password-hash', now(), '{"provider":"email","providers":["email"]}', '{"full_name":"Bryce Callahan"}', now(), now(), '', '', '', ''),
  ('00000000-0000-0000-0000-000000000000', '10000000-0000-4000-8000-000000000035', 'authenticated', 'authenticated', 'emily.zhou@gsu.edu', 'seed-placeholder-password-hash', now(), '{"provider":"email","providers":["email"]}', '{"full_name":"Emily Zhou"}', now(), now(), '', '', '', ''),
  ('00000000-0000-0000-0000-000000000000', '10000000-0000-4000-8000-000000000036', 'authenticated', 'authenticated', 'malik.freeman@gsu.edu', 'seed-placeholder-password-hash', now(), '{"provider":"email","providers":["email"]}', '{"full_name":"Malik Freeman"}', now(), now(), '', '', '', ''),
  ('00000000-0000-0000-0000-000000000000', '10000000-0000-4000-8000-000000000037', 'authenticated', 'authenticated', 'chloe.bergstrom@gsu.edu', 'seed-placeholder-password-hash', now(), '{"provider":"email","providers":["email"]}', '{"full_name":"Chloe Bergstrom"}', now(), now(), '', '', '', ''),
  ('00000000-0000-0000-0000-000000000000', '10000000-0000-4000-8000-000000000038', 'authenticated', 'authenticated', 'xavier.delacroix@gsu.edu', 'seed-placeholder-password-hash', now(), '{"provider":"email","providers":["email"]}', '{"full_name":"Xavier Delacroix"}', now(), now(), '', '', '', ''),
  ('00000000-0000-0000-0000-000000000000', '10000000-0000-4000-8000-000000000039', 'authenticated', 'authenticated', 'rachel.kowalski@gsu.edu', 'seed-placeholder-password-hash', now(), '{"provider":"email","providers":["email"]}', '{"full_name":"Rachel Kowalski"}', now(), now(), '', '', '', ''),
  ('00000000-0000-0000-0000-000000000000', '10000000-0000-4000-8000-000000000040', 'authenticated', 'authenticated', 'derek.holloway@gsu.edu', 'seed-placeholder-password-hash', now(), '{"provider":"email","providers":["email"]}', '{"full_name":"Derek Holloway"}', now(), now(), '', '', '', '')
on conflict (id) do nothing;

-- Promote a handful of the auto-created member profiles to director/admin, and mark two inactive
-- (one graduated, one stepped back), so the role split and active/inactive states are demoable. The
-- trigger is disabled only for this block; see the file header comment for why.
alter table public.profiles disable trigger prevent_self_role_escalation;

update public.profiles set role = 'admin'
where id in (
  '10000000-0000-4000-8000-000000000001', -- Maya Whitfield
  '10000000-0000-4000-8000-000000000002'  -- Daniel Okafor
);

update public.profiles set role = 'director'
where id in (
  '10000000-0000-4000-8000-000000000003', -- Priya Ramaswamy
  '10000000-0000-4000-8000-000000000004', -- Ethan Cho
  '10000000-0000-4000-8000-000000000005', -- Brianna Sutton
  '10000000-0000-4000-8000-000000000006', -- Jayden Marsh
  '10000000-0000-4000-8000-000000000007', -- Sofia Delgado
  '10000000-0000-4000-8000-000000000008'  -- Marcus Webb
);

update public.profiles set is_active = false
where id in (
  '10000000-0000-4000-8000-000000000039', -- Rachel Kowalski, graduated
  '10000000-0000-4000-8000-000000000040'  -- Derek Holloway, stepped back from the board
);

alter table public.profiles enable trigger prevent_self_role_escalation;

-- ============================================================================
-- Events: two past (one archived, one published) and one upcoming (published)
-- ============================================================================
-- Note on the archived/published split: the existing events_select_published_or_admin RLS policy only
-- ever allows status = 'published' or is_admin() through, director is not included in that particular
-- policy. An 'archived' event is therefore only visible to admins in the app today. Archiving the GBM
-- and keeping the workshop published demonstrates both states, but double check that admin-only
-- visibility for 'archived' is actually the intended behavior before relying on it in a demo.

insert into public.events (id, name, description, location, starts_at, ends_at, timezone, status, created_by)
values
  (
    '20000000-0000-4000-8000-000000000001',
    'Spring 2026 General Body Meeting',
    'Monthly general body meeting covering semester goals, project team signups, and open officer positions.',
    'Langdale Hall, Room 638',
    '2026-01-22 17:45:00-05',
    '2026-01-22 19:30:00-05',
    'America/New_York',
    'archived',
    '10000000-0000-4000-8000-000000000001'
  ),
  (
    '20000000-0000-4000-8000-000000000002',
    'Intro to Git and GitHub Workshop',
    'Hands-on workshop covering branches, pull requests, and resolving merge conflicts for members who are new to git.',
    '25 Park Place, Room 1502',
    '2026-03-05 17:30:00-05',
    '2026-03-05 19:45:00-05',
    'America/New_York',
    'published',
    '10000000-0000-4000-8000-000000000002'
  ),
  (
    '20000000-0000-4000-8000-000000000003',
    'HackGSU Fall 2026',
    'A weekend build event open to all progsu members. Teams pitch, build, and demo over the weekend with mentors and food provided.',
    'Student Center West, Ballroom',
    '2026-10-02 14:00:00-04',
    '2026-10-04 17:00:00-04',
    'America/New_York',
    'published',
    '10000000-0000-4000-8000-000000000001'
  )
on conflict (id) do nothing;

-- ============================================================================
-- Hackathon coverage roles and shift roles (stations)
-- ============================================================================
-- coverage_roles are the org-function categories used for member eligibility and per-shift headcount
-- breakdowns (shift_role_requirements). shift_roles are the physical stations a shift is tagged with.
-- Same two-axis pattern the original HackLanta migrations used, renamed for progsu.

insert into public.coverage_roles (id, event_id, name, description)
values
  (
    '30000000-0000-4000-8000-000000000001',
    '20000000-0000-4000-8000-000000000003',
    'Operations',
    'General event operations and floor coverage during the hackathon.'
  ),
  (
    '30000000-0000-4000-8000-000000000002',
    '20000000-0000-4000-8000-000000000003',
    'Registration',
    'Check-in and badge support for hackathon participants.'
  ),
  (
    '30000000-0000-4000-8000-000000000003',
    '20000000-0000-4000-8000-000000000003',
    'Logistics',
    'Venue setup, supplies, food, and equipment logistics for the hackathon.'
  )
on conflict (id) do nothing;

insert into public.shift_roles (id, event_id, name, description)
values
  (
    '40000000-0000-4000-8000-000000000001',
    '20000000-0000-4000-8000-000000000003',
    'Setup',
    'Friday setup: tables, signage, swag bags, and room prep before doors open.'
  ),
  (
    '40000000-0000-4000-8000-000000000002',
    '20000000-0000-4000-8000-000000000003',
    'Check-in Desk',
    'Participant check-in and badge distribution.'
  ),
  (
    '40000000-0000-4000-8000-000000000003',
    '20000000-0000-4000-8000-000000000003',
    'AV',
    'Audio and visual support for the opening ceremony, workshops, and closing demos.'
  ),
  (
    '40000000-0000-4000-8000-000000000004',
    '20000000-0000-4000-8000-000000000003',
    'Teardown',
    'Sunday breakdown: reset rooms, pack equipment, and haul trash.'
  )
on conflict (id) do nothing;

-- Coverage-role eligibility (member_coverage_roles) for the members who will be assigned to
-- hackathon shifts with a coverage_role_id set below.
insert into public.member_coverage_roles (id, event_id, profile_id, coverage_role_id)
values
  ('70000000-0000-4000-8000-000000000001', '20000000-0000-4000-8000-000000000003', '10000000-0000-4000-8000-000000000003', '30000000-0000-4000-8000-000000000001'), -- Priya, Operations
  ('70000000-0000-4000-8000-000000000002', '20000000-0000-4000-8000-000000000003', '10000000-0000-4000-8000-000000000004', '30000000-0000-4000-8000-000000000001'), -- Ethan, Operations
  ('70000000-0000-4000-8000-000000000003', '20000000-0000-4000-8000-000000000003', '10000000-0000-4000-8000-000000000008', '30000000-0000-4000-8000-000000000001'), -- Marcus, Operations
  ('70000000-0000-4000-8000-000000000004', '20000000-0000-4000-8000-000000000003', '10000000-0000-4000-8000-000000000010', '30000000-0000-4000-8000-000000000001'), -- Noah, Operations
  ('70000000-0000-4000-8000-000000000005', '20000000-0000-4000-8000-000000000003', '10000000-0000-4000-8000-000000000012', '30000000-0000-4000-8000-000000000001'), -- Tyler, Operations
  ('70000000-0000-4000-8000-000000000006', '20000000-0000-4000-8000-000000000003', '10000000-0000-4000-8000-000000000016', '30000000-0000-4000-8000-000000000001'), -- Ryan, Operations
  ('70000000-0000-4000-8000-000000000007', '20000000-0000-4000-8000-000000000003', '10000000-0000-4000-8000-000000000005', '30000000-0000-4000-8000-000000000002'), -- Brianna, Registration
  ('70000000-0000-4000-8000-000000000008', '20000000-0000-4000-8000-000000000003', '10000000-0000-4000-8000-000000000007', '30000000-0000-4000-8000-000000000002'), -- Sofia, Registration
  ('70000000-0000-4000-8000-000000000009', '20000000-0000-4000-8000-000000000003', '10000000-0000-4000-8000-000000000011', '30000000-0000-4000-8000-000000000002'), -- Camila, Registration
  ('70000000-0000-4000-8000-000000000010', '20000000-0000-4000-8000-000000000003', '10000000-0000-4000-8000-000000000013', '30000000-0000-4000-8000-000000000002'), -- Zoe, Registration
  ('70000000-0000-4000-8000-000000000011', '20000000-0000-4000-8000-000000000003', '10000000-0000-4000-8000-000000000009', '30000000-0000-4000-8000-000000000002'), -- Aaliyah, Registration
  ('70000000-0000-4000-8000-000000000012', '20000000-0000-4000-8000-000000000003', '10000000-0000-4000-8000-000000000006', '30000000-0000-4000-8000-000000000003'), -- Jayden, Logistics
  ('70000000-0000-4000-8000-000000000013', '20000000-0000-4000-8000-000000000003', '10000000-0000-4000-8000-000000000014', '30000000-0000-4000-8000-000000000003'), -- Elijah, Logistics
  ('70000000-0000-4000-8000-000000000014', '20000000-0000-4000-8000-000000000003', '10000000-0000-4000-8000-000000000015', '30000000-0000-4000-8000-000000000003'), -- Amara, Logistics
  ('70000000-0000-4000-8000-000000000015', '20000000-0000-4000-8000-000000000003', '10000000-0000-4000-8000-000000000017', '30000000-0000-4000-8000-000000000003'), -- Isabella, Logistics
  ('70000000-0000-4000-8000-000000000016', '20000000-0000-4000-8000-000000000003', '10000000-0000-4000-8000-000000000018', '30000000-0000-4000-8000-000000000003')  -- Devon, Logistics
on conflict (id) do nothing;

-- ============================================================================
-- Shifts: hackathon stations, GBM, workshop, and standalone weekly office hours
-- ============================================================================

insert into public.shifts (id, event_id, shift_role_id, title, starts_at, ends_at, required_people, location, notes)
values
  -- HackGSU Fall 2026
  (
    '50000000-0000-4000-8000-000000000001', '20000000-0000-4000-8000-000000000003', '40000000-0000-4000-8000-000000000001',
    'Setup Crew', '2026-10-02 14:00:00-04', '2026-10-02 17:00:00-04', 5,
    'Student Center West, Ballroom', 'Move tables, hang signage, and set up swag bags and the check-in area.'
  ),
  (
    '50000000-0000-4000-8000-000000000002', '20000000-0000-4000-8000-000000000003', '40000000-0000-4000-8000-000000000002',
    'Friday Check-in', '2026-10-02 17:00:00-04', '2026-10-02 20:00:00-04', 4,
    'Student Center West, Ballroom Lobby', 'Badge distribution and team roster check-in as participants arrive.'
  ),
  (
    '50000000-0000-4000-8000-000000000003', '20000000-0000-4000-8000-000000000003', '40000000-0000-4000-8000-000000000003',
    'Opening Ceremony AV', '2026-10-02 18:30:00-04', '2026-10-02 20:30:00-04', 2,
    'Student Center West, Ballroom', 'Run slides, mic, and sound for the opening ceremony.'
  ),
  (
    '50000000-0000-4000-8000-000000000004', '20000000-0000-4000-8000-000000000003', '40000000-0000-4000-8000-000000000002',
    'Saturday Morning Check-in', '2026-10-03 08:00:00-04', '2026-10-03 11:00:00-04', 2,
    'Student Center West, Ballroom Lobby', 'Late arrival check-in and day-two badge pickup.'
  ),
  (
    '50000000-0000-4000-8000-000000000005', '20000000-0000-4000-8000-000000000003', '40000000-0000-4000-8000-000000000003',
    'Saturday Workshop AV', '2026-10-03 10:00:00-04', '2026-10-03 14:00:00-04', 2,
    'Student Center West, Ballroom', 'AV support for sponsor workshops and mentor sessions.'
  ),
  (
    '50000000-0000-4000-8000-000000000006', '20000000-0000-4000-8000-000000000003', '40000000-0000-4000-8000-000000000003',
    'Saturday Evening AV', '2026-10-03 18:00:00-04', '2026-10-03 22:00:00-04', 2,
    'Student Center West, Ballroom', 'AV support for the evening activity block.'
  ),
  (
    '50000000-0000-4000-8000-000000000007', '20000000-0000-4000-8000-000000000003', '40000000-0000-4000-8000-000000000003',
    'Sunday Closing Demos AV', '2026-10-04 10:00:00-04', '2026-10-04 13:00:00-04', 3,
    'Student Center West, Ballroom', 'Run demo timers, mic, and judging room signage for closing presentations.'
  ),
  (
    '50000000-0000-4000-8000-000000000008', '20000000-0000-4000-8000-000000000003', '40000000-0000-4000-8000-000000000004',
    'Teardown Crew', '2026-10-04 13:00:00-04', '2026-10-04 17:00:00-04', 5,
    'Student Center West, Ballroom', 'Break down tables and signage, pack AV equipment, and clear trash.'
  ),
  -- Spring 2026 General Body Meeting
  (
    '50000000-0000-4000-8000-000000000009', '20000000-0000-4000-8000-000000000001', null,
    'Room Setup and Check-in', '2026-01-22 17:45:00-05', '2026-01-22 18:15:00-05', 2,
    'Langdale Hall, Room 638', 'Arrange chairs, set up the sign-in sheet, and greet members as they arrive.'
  ),
  (
    '50000000-0000-4000-8000-000000000010', '20000000-0000-4000-8000-000000000001', null,
    'Meeting Notes and Slides', '2026-01-22 18:00:00-05', '2026-01-22 19:30:00-05', 1,
    'Langdale Hall, Room 638', 'Drive the slide deck and take minutes for the meeting notes doc.'
  ),
  -- Intro to Git and GitHub Workshop
  (
    '50000000-0000-4000-8000-000000000011', '20000000-0000-4000-8000-000000000002', null,
    'Workshop Setup', '2026-03-05 17:30:00-05', '2026-03-05 18:00:00-05', 2,
    '25 Park Place, Room 1502', 'Set up laptops, test the projector, and lay out handouts.'
  ),
  (
    '50000000-0000-4000-8000-000000000012', '20000000-0000-4000-8000-000000000002', null,
    'Workshop Facilitation', '2026-03-05 18:00:00-05', '2026-03-05 19:45:00-05', 2,
    '25 Park Place, Room 1502', 'Co-teach the session and help attendees who get stuck on git commands.'
  ),
  -- Standalone weekly office hours (event_id null: this is the headline standalone-shift case)
  (
    '50000000-0000-4000-8000-000000000013', null, null,
    'Weekly Office Hours', '2026-08-18 14:00:00-04', '2026-08-18 16:00:00-04', 1,
    '25 Park Place, CS Commons Suite 1300', 'Drop-in help with coursework, personal projects, or club project work. No sign-up required to attend.'
  ),
  (
    '50000000-0000-4000-8000-000000000014', null, null,
    'Weekly Office Hours', '2026-08-20 14:00:00-04', '2026-08-20 16:00:00-04', 1,
    '25 Park Place, CS Commons Suite 1300', 'Drop-in help with coursework, personal projects, or club project work. No sign-up required to attend.'
  ),
  (
    '50000000-0000-4000-8000-000000000015', null, null,
    'Weekly Office Hours', '2026-08-25 14:00:00-04', '2026-08-25 16:00:00-04', 1,
    '25 Park Place, CS Commons Suite 1300', 'Drop-in help with coursework, personal projects, or club project work. No sign-up required to attend.'
  ),
  (
    '50000000-0000-4000-8000-000000000016', null, null,
    'Weekly Office Hours', '2026-08-27 14:00:00-04', '2026-08-27 16:00:00-04', 1,
    '25 Park Place, CS Commons Suite 1300', 'Drop-in help with coursework, personal projects, or club project work. No sign-up required to attend.'
  ),
  (
    '50000000-0000-4000-8000-000000000017', null, null,
    'Weekly Office Hours', '2026-09-01 14:00:00-04', '2026-09-01 16:00:00-04', 1,
    '25 Park Place, CS Commons Suite 1300', 'Drop-in help with coursework, personal projects, or club project work. No sign-up required to attend.'
  ),
  (
    '50000000-0000-4000-8000-000000000018', null, null,
    'Weekly Office Hours', '2026-09-03 14:00:00-04', '2026-09-03 16:00:00-04', 1,
    '25 Park Place, CS Commons Suite 1300', 'Drop-in help with coursework, personal projects, or club project work. No sign-up required to attend.'
  )
on conflict (id) do nothing;

-- Per-shift coverage-role headcount breakdown for the hackathon stations.
insert into public.shift_role_requirements (id, shift_id, coverage_role_id, required_people)
values
  ('60000000-0000-4000-8000-000000000001', '50000000-0000-4000-8000-000000000001', '30000000-0000-4000-8000-000000000001', 3), -- Setup Crew: Operations 3
  ('60000000-0000-4000-8000-000000000002', '50000000-0000-4000-8000-000000000001', '30000000-0000-4000-8000-000000000003', 2), -- Setup Crew: Logistics 2
  ('60000000-0000-4000-8000-000000000003', '50000000-0000-4000-8000-000000000002', '30000000-0000-4000-8000-000000000002', 4), -- Friday Check-in: Registration 4
  ('60000000-0000-4000-8000-000000000004', '50000000-0000-4000-8000-000000000003', '30000000-0000-4000-8000-000000000001', 2), -- Opening Ceremony AV: Operations 2
  ('60000000-0000-4000-8000-000000000005', '50000000-0000-4000-8000-000000000004', '30000000-0000-4000-8000-000000000002', 2), -- Saturday Morning Check-in: Registration 2
  ('60000000-0000-4000-8000-000000000006', '50000000-0000-4000-8000-000000000005', '30000000-0000-4000-8000-000000000001', 2), -- Saturday Workshop AV: Operations 2
  ('60000000-0000-4000-8000-000000000007', '50000000-0000-4000-8000-000000000006', '30000000-0000-4000-8000-000000000001', 2), -- Saturday Evening AV: Operations 2
  ('60000000-0000-4000-8000-000000000008', '50000000-0000-4000-8000-000000000007', '30000000-0000-4000-8000-000000000001', 2), -- Sunday Closing Demos AV: Operations 2
  ('60000000-0000-4000-8000-000000000009', '50000000-0000-4000-8000-000000000007', '30000000-0000-4000-8000-000000000002', 1), -- Sunday Closing Demos AV: Registration 1
  ('60000000-0000-4000-8000-000000000010', '50000000-0000-4000-8000-000000000008', '30000000-0000-4000-8000-000000000003', 3), -- Teardown Crew: Logistics 3
  ('60000000-0000-4000-8000-000000000011', '50000000-0000-4000-8000-000000000008', '30000000-0000-4000-8000-000000000001', 2)  -- Teardown Crew: Operations 2
on conflict (id) do nothing;

-- ============================================================================
-- Availability windows for the upcoming event (HackGSU Fall 2026)
-- ============================================================================
-- Mixed coverage: most members give a partial window (a few hours, one day of the weekend), a couple
-- give the whole span, and two mark themselves unavailable rather than just not showing up at all.

insert into public.availability_windows (id, event_id, profile_id, starts_at, ends_at, status, note)
values
  ('90000000-0000-4000-8000-000000000001', '20000000-0000-4000-8000-000000000003', '10000000-0000-4000-8000-000000000003', '2026-10-02 14:00:00-04', '2026-10-02 22:00:00-04', 'available', null),
  ('90000000-0000-4000-8000-000000000002', '20000000-0000-4000-8000-000000000003', '10000000-0000-4000-8000-000000000004', '2026-10-02 17:00:00-04', '2026-10-02 22:00:00-04', 'available', null),
  ('90000000-0000-4000-8000-000000000003', '20000000-0000-4000-8000-000000000003', '10000000-0000-4000-8000-000000000004', '2026-10-03 08:00:00-04', '2026-10-03 22:00:00-04', 'available', null),
  ('90000000-0000-4000-8000-000000000004', '20000000-0000-4000-8000-000000000003', '10000000-0000-4000-8000-000000000005', '2026-10-02 16:00:00-04', '2026-10-02 20:00:00-04', 'available', null),
  ('90000000-0000-4000-8000-000000000005', '20000000-0000-4000-8000-000000000003', '10000000-0000-4000-8000-000000000006', '2026-10-02 14:00:00-04', '2026-10-02 18:00:00-04', 'available', null),
  ('90000000-0000-4000-8000-000000000006', '20000000-0000-4000-8000-000000000003', '10000000-0000-4000-8000-000000000006', '2026-10-04 10:00:00-04', '2026-10-04 17:00:00-04', 'available', null),
  ('90000000-0000-4000-8000-000000000007', '20000000-0000-4000-8000-000000000003', '10000000-0000-4000-8000-000000000007', '2026-10-02 14:00:00-04', '2026-10-04 17:00:00-04', 'available', 'Free the whole weekend, happy to float wherever is needed.'),
  ('90000000-0000-4000-8000-000000000008', '20000000-0000-4000-8000-000000000003', '10000000-0000-4000-8000-000000000008', '2026-10-03 08:00:00-04', '2026-10-03 22:00:00-04', 'available', null),
  ('90000000-0000-4000-8000-000000000009', '20000000-0000-4000-8000-000000000003', '10000000-0000-4000-8000-000000000008', '2026-10-04 08:00:00-04', '2026-10-04 17:00:00-04', 'available', null),
  ('90000000-0000-4000-8000-000000000010', '20000000-0000-4000-8000-000000000003', '10000000-0000-4000-8000-000000000009', '2026-10-02 17:00:00-04', '2026-10-02 20:00:00-04', 'available', null),
  ('90000000-0000-4000-8000-000000000011', '20000000-0000-4000-8000-000000000003', '10000000-0000-4000-8000-000000000010', '2026-10-03 08:00:00-04', '2026-10-03 14:00:00-04', 'available', null),
  ('90000000-0000-4000-8000-000000000012', '20000000-0000-4000-8000-000000000003', '10000000-0000-4000-8000-000000000011', '2026-10-02 17:00:00-04', '2026-10-02 20:00:00-04', 'available', null),
  ('90000000-0000-4000-8000-000000000013', '20000000-0000-4000-8000-000000000003', '10000000-0000-4000-8000-000000000011', '2026-10-03 08:00:00-04', '2026-10-03 20:00:00-04', 'unavailable', 'Family event on Saturday.'),
  ('90000000-0000-4000-8000-000000000014', '20000000-0000-4000-8000-000000000003', '10000000-0000-4000-8000-000000000012', '2026-10-03 09:00:00-04', '2026-10-03 14:00:00-04', 'available', null),
  ('90000000-0000-4000-8000-000000000015', '20000000-0000-4000-8000-000000000003', '10000000-0000-4000-8000-000000000013', '2026-10-03 08:00:00-04', '2026-10-03 11:00:00-04', 'available', null),
  ('90000000-0000-4000-8000-000000000016', '20000000-0000-4000-8000-000000000003', '10000000-0000-4000-8000-000000000014', '2026-10-04 13:00:00-04', '2026-10-04 17:00:00-04', 'available', null),
  ('90000000-0000-4000-8000-000000000017', '20000000-0000-4000-8000-000000000003', '10000000-0000-4000-8000-000000000015', '2026-10-04 13:00:00-04', '2026-10-04 17:00:00-04', 'available', null),
  ('90000000-0000-4000-8000-000000000018', '20000000-0000-4000-8000-000000000003', '10000000-0000-4000-8000-000000000016', '2026-10-03 18:00:00-04', '2026-10-03 22:00:00-04', 'available', null),
  ('90000000-0000-4000-8000-000000000019', '20000000-0000-4000-8000-000000000003', '10000000-0000-4000-8000-000000000017', '2026-10-04 13:00:00-04', '2026-10-04 17:00:00-04', 'available', null),
  ('90000000-0000-4000-8000-000000000020', '20000000-0000-4000-8000-000000000003', '10000000-0000-4000-8000-000000000018', '2026-10-02 14:00:00-04', '2026-10-02 18:00:00-04', 'available', null),
  ('90000000-0000-4000-8000-000000000021', '20000000-0000-4000-8000-000000000003', '10000000-0000-4000-8000-000000000019', '2026-10-02 14:00:00-04', '2026-10-04 17:00:00-04', 'unavailable', 'Working a family obligation this weekend, cannot help at the event.'),
  ('90000000-0000-4000-8000-000000000022', '20000000-0000-4000-8000-000000000003', '10000000-0000-4000-8000-000000000020', '2026-10-03 10:00:00-04', '2026-10-03 14:00:00-04', 'available', null),
  ('90000000-0000-4000-8000-000000000023', '20000000-0000-4000-8000-000000000003', '10000000-0000-4000-8000-000000000020', '2026-10-04 10:00:00-04', '2026-10-04 13:00:00-04', 'available', null),
  ('90000000-0000-4000-8000-000000000024', '20000000-0000-4000-8000-000000000003', '10000000-0000-4000-8000-000000000021', '2026-10-02 18:00:00-04', '2026-10-02 22:00:00-04', 'available', null),
  ('90000000-0000-4000-8000-000000000025', '20000000-0000-4000-8000-000000000003', '10000000-0000-4000-8000-000000000022', '2026-10-03 08:00:00-04', '2026-10-03 22:00:00-04', 'available', null),
  ('90000000-0000-4000-8000-000000000026', '20000000-0000-4000-8000-000000000003', '10000000-0000-4000-8000-000000000023', '2026-10-04 10:00:00-04', '2026-10-04 17:00:00-04', 'available', null)
on conflict (id) do nothing;

-- ============================================================================
-- Shift assignments: partial staffing and visible gaps
-- ============================================================================
-- Every required_people count below is intentionally not fully met on several shifts: two hackathon
-- shifts (Opening Ceremony AV, Sunday Closing Demos AV) get zero assignments, several more are
-- partially staffed, and a couple are fully staffed, mixing status (mostly published, a few draft) and
-- origin (assigned vs. self-service signup).

insert into public.shift_assignments (id, shift_id, profile_id, coverage_role_id, assigned_by, status, origin, published_at)
values
  -- Setup Crew (needs 5, 3 assigned)
  ('80000000-0000-4000-8000-000000000001', '50000000-0000-4000-8000-000000000001', '10000000-0000-4000-8000-000000000003', '30000000-0000-4000-8000-000000000001', '10000000-0000-4000-8000-000000000001', 'published', 'assigned', '2026-08-10 12:00:00-04'),
  ('80000000-0000-4000-8000-000000000002', '50000000-0000-4000-8000-000000000001', '10000000-0000-4000-8000-000000000006', '30000000-0000-4000-8000-000000000003', '10000000-0000-4000-8000-000000000001', 'published', 'assigned', '2026-08-10 12:00:00-04'),
  ('80000000-0000-4000-8000-000000000003', '50000000-0000-4000-8000-000000000001', '10000000-0000-4000-8000-000000000004', '30000000-0000-4000-8000-000000000001', '10000000-0000-4000-8000-000000000003', 'draft', 'assigned', null),
  -- Friday Check-in (needs 4, 4 assigned, fully staffed)
  ('80000000-0000-4000-8000-000000000004', '50000000-0000-4000-8000-000000000002', '10000000-0000-4000-8000-000000000005', '30000000-0000-4000-8000-000000000002', '10000000-0000-4000-8000-000000000001', 'published', 'assigned', '2026-08-11 09:00:00-04'),
  ('80000000-0000-4000-8000-000000000005', '50000000-0000-4000-8000-000000000002', '10000000-0000-4000-8000-000000000007', '30000000-0000-4000-8000-000000000002', null, 'published', 'signup', '2026-08-12 10:15:00-04'),
  ('80000000-0000-4000-8000-000000000006', '50000000-0000-4000-8000-000000000002', '10000000-0000-4000-8000-000000000011', '30000000-0000-4000-8000-000000000002', '10000000-0000-4000-8000-000000000007', 'published', 'assigned', '2026-08-11 09:00:00-04'),
  ('80000000-0000-4000-8000-000000000007', '50000000-0000-4000-8000-000000000002', '10000000-0000-4000-8000-000000000009', '30000000-0000-4000-8000-000000000002', null, 'published', 'signup', '2026-08-13 16:40:00-04'),
  -- Opening Ceremony AV (needs 2, 0 assigned: open gap)
  -- Saturday Morning Check-in (needs 2, 1 assigned)
  ('80000000-0000-4000-8000-000000000008', '50000000-0000-4000-8000-000000000004', '10000000-0000-4000-8000-000000000013', '30000000-0000-4000-8000-000000000002', null, 'published', 'signup', '2026-08-14 08:20:00-04'),
  -- Saturday Workshop AV (needs 2, 2 assigned, fully staffed)
  ('80000000-0000-4000-8000-000000000009', '50000000-0000-4000-8000-000000000005', '10000000-0000-4000-8000-000000000010', '30000000-0000-4000-8000-000000000001', '10000000-0000-4000-8000-000000000004', 'published', 'assigned', '2026-08-11 09:00:00-04'),
  ('80000000-0000-4000-8000-000000000010', '50000000-0000-4000-8000-000000000005', '10000000-0000-4000-8000-000000000012', '30000000-0000-4000-8000-000000000001', null, 'published', 'signup', '2026-08-15 19:05:00-04'),
  -- Saturday Evening AV (needs 2, 1 assigned)
  ('80000000-0000-4000-8000-000000000011', '50000000-0000-4000-8000-000000000006', '10000000-0000-4000-8000-000000000016', '30000000-0000-4000-8000-000000000001', '10000000-0000-4000-8000-000000000001', 'draft', 'assigned', null),
  -- Sunday Closing Demos AV (needs 3, 0 assigned: open gap)
  -- Teardown Crew (needs 5, 3 assigned)
  ('80000000-0000-4000-8000-000000000012', '50000000-0000-4000-8000-000000000008', '10000000-0000-4000-8000-000000000014', '30000000-0000-4000-8000-000000000003', '10000000-0000-4000-8000-000000000006', 'published', 'assigned', '2026-08-11 09:00:00-04'),
  ('80000000-0000-4000-8000-000000000013', '50000000-0000-4000-8000-000000000008', '10000000-0000-4000-8000-000000000015', '30000000-0000-4000-8000-000000000003', null, 'published', 'signup', '2026-08-13 21:10:00-04'),
  ('80000000-0000-4000-8000-000000000014', '50000000-0000-4000-8000-000000000008', '10000000-0000-4000-8000-000000000017', '30000000-0000-4000-8000-000000000003', '10000000-0000-4000-8000-000000000006', 'draft', 'assigned', null),
  -- Spring GBM: Room Setup and Check-in (needs 2, 1 assigned)
  ('80000000-0000-4000-8000-000000000015', '50000000-0000-4000-8000-000000000009', '10000000-0000-4000-8000-000000000029', null, null, 'published', 'signup', '2026-01-20 10:00:00-05'),
  -- Spring GBM: Meeting Notes and Slides (needs 1, 1 assigned, fully staffed)
  ('80000000-0000-4000-8000-000000000016', '50000000-0000-4000-8000-000000000010', '10000000-0000-4000-8000-000000000026', null, '10000000-0000-4000-8000-000000000001', 'published', 'assigned', '2026-01-18 09:00:00-05'),
  -- Workshop Setup (needs 2, 0 assigned: open gap, even a past shift can go unstaffed)
  -- Workshop Facilitation (needs 2, 2 assigned, fully staffed)
  ('80000000-0000-4000-8000-000000000017', '50000000-0000-4000-8000-000000000012', '10000000-0000-4000-8000-000000000008', null, '10000000-0000-4000-8000-000000000002', 'published', 'assigned', '2026-03-01 09:00:00-05'),
  ('80000000-0000-4000-8000-000000000018', '50000000-0000-4000-8000-000000000012', '10000000-0000-4000-8000-000000000027', null, null, 'published', 'signup', '2026-03-02 14:00:00-05'),
  -- Weekly Office Hours: Aug 18 (needs 1, 1 assigned, fully staffed)
  ('80000000-0000-4000-8000-000000000019', '50000000-0000-4000-8000-000000000013', '10000000-0000-4000-8000-000000000036', null, null, 'published', 'signup', '2026-08-12 09:00:00-04'),
  -- Weekly Office Hours: Aug 20 (needs 1, 0 assigned: open gap)
  -- Weekly Office Hours: Aug 25 (needs 1, 1 assigned, draft)
  ('80000000-0000-4000-8000-000000000020', '50000000-0000-4000-8000-000000000015', '10000000-0000-4000-8000-000000000037', null, '10000000-0000-4000-8000-000000000005', 'draft', 'assigned', null),
  -- Weekly Office Hours: Aug 27 (needs 1, 1 assigned, fully staffed)
  ('80000000-0000-4000-8000-000000000021', '50000000-0000-4000-8000-000000000016', '10000000-0000-4000-8000-000000000038', null, null, 'published', 'signup', '2026-08-20 11:00:00-04'),
  -- Weekly Office Hours: Sep 1 (needs 1, 0 assigned: open gap)
  -- Weekly Office Hours: Sep 3 (needs 1, 1 assigned, fully staffed)
  ('80000000-0000-4000-8000-000000000022', '50000000-0000-4000-8000-000000000018', '10000000-0000-4000-8000-000000000033', null, '10000000-0000-4000-8000-000000000001', 'published', 'assigned', '2026-08-25 08:00:00-04')
on conflict (id) do nothing;

-- V2: promote a handful of the assignments above out of the in_approval default so the approval
-- queue and my-schedule both have something of every state to render. Priya/Brianna's are approved
-- outright; Noah's is approved but carries a warning (the approval queue's whole reason to exist:
-- something the admin should notice, not block on); Isabella's demonstrates not_assigned (a past
-- drop/removal, kept as row history rather than deleted).
update public.shift_assignments set state = 'approved', approved_by = '10000000-0000-4000-8000-000000000001', approved_at = '2026-08-11 10:00:00-04'
where id in ('80000000-0000-4000-8000-000000000001', '80000000-0000-4000-8000-000000000004');

update public.shift_assignments
set state = 'approved', approved_by = '10000000-0000-4000-8000-000000000001', approved_at = '2026-08-16 09:00:00-04',
    warnings = '[{"kind":"heavy_hours","message":"Already scheduled 14 hours this event."}]'::jsonb
where id = '80000000-0000-4000-8000-000000000009';

update public.shift_assignments set state = 'not_assigned'
where id = '80000000-0000-4000-8000-000000000014';

-- ============================================================================
-- V2: event_directors (director authority scoped to specific events)
-- ============================================================================
insert into public.event_directors (event_id, user_id, assigned_by)
values
  ('20000000-0000-4000-8000-000000000003', '10000000-0000-4000-8000-000000000003', '10000000-0000-4000-8000-000000000001'), -- Priya directs HackGSU
  ('20000000-0000-4000-8000-000000000003', '10000000-0000-4000-8000-000000000004', '10000000-0000-4000-8000-000000000001'), -- Ethan directs HackGSU
  ('20000000-0000-4000-8000-000000000002', '10000000-0000-4000-8000-000000000005', '10000000-0000-4000-8000-000000000002'), -- Brianna directs the Git workshop
  ('20000000-0000-4000-8000-000000000001', '10000000-0000-4000-8000-000000000007', '10000000-0000-4000-8000-000000000002')  -- Sofia directs the Spring GBM
on conflict (event_id, user_id) do nothing;
-- Jayden and Marcus are directors with no event assignment yet: the empty-state case for "a director
-- signed in with nothing scoped to them."

-- ============================================================================
-- V2: change requests, one of each kind
-- ============================================================================
insert into public.change_requests (id, assignment_id, event_id, requested_by, kind, note)
values
  (
    'a0000000-0000-4000-8000-000000000001', '80000000-0000-4000-8000-000000000003',
    '20000000-0000-4000-8000-000000000003', '10000000-0000-4000-8000-000000000004',
    'swap_any', 'Conflicts with a night class, hoping someone can take Friday setup instead.'
  ),
  (
    'a0000000-0000-4000-8000-000000000003', '80000000-0000-4000-8000-000000000011',
    '20000000-0000-4000-8000-000000000003', '10000000-0000-4000-8000-000000000016',
    'drop', 'Running late from a family event, need to drop this shift.'
  )
on conflict (id) do nothing;

insert into public.change_requests (id, assignment_id, event_id, requested_by, kind, target_user_id, note)
values (
  'a0000000-0000-4000-8000-000000000004', '80000000-0000-4000-8000-000000000012',
  '20000000-0000-4000-8000-000000000003', '10000000-0000-4000-8000-000000000014', -- Elijah's own Teardown assignment
  'swap_with', '10000000-0000-4000-8000-000000000017', -- asking specifically for Isabella
  'We already agreed to trade, just need it made official.'
)
on conflict (id) do nothing;

insert into public.change_requests (id, event_id, requested_by, kind, note)
values (
  'a0000000-0000-4000-8000-000000000005', '20000000-0000-4000-8000-000000000003',
  '10000000-0000-4000-8000-000000000009', 'more_hours',
  'Free most of Saturday if there is anything else that needs covering.'
)
on conflict (id) do nothing;

-- cant_make_time needs an assignment in in_approval/approved (the validate trigger rejects
-- not_assigned targets); Tyler's Saturday Workshop AV signup fits.
insert into public.change_requests (id, assignment_id, event_id, requested_by, kind, note)
values (
  'a0000000-0000-4000-8000-000000000006', '80000000-0000-4000-8000-000000000010',
  '20000000-0000-4000-8000-000000000003', '10000000-0000-4000-8000-000000000012',
  'cant_make_time', 'Midterm got moved, can I do an evening slot instead?'
)
on conflict (id) do nothing;

-- ============================================================================
-- V2: announcements
-- ============================================================================
insert into public.announcements (id, event_id, author_id, body, created_at)
values
  (
    'b0000000-0000-4000-8000-000000000001', '20000000-0000-4000-8000-000000000003',
    '10000000-0000-4000-8000-000000000001',
    'HackGSU schedules are live. Check your assignments and submit availability if you have not yet.',
    '2026-08-15 09:00:00-04'
  ),
  (
    'b0000000-0000-4000-8000-000000000002', '20000000-0000-4000-8000-000000000003',
    '10000000-0000-4000-8000-000000000003',
    'Setup crew: meet at the Ballroom loading dock, not the main entrance. Parking passes at check-in.',
    '2026-08-16 14:30:00-04'
  )
on conflict (id) do nothing;

-- ============================================================================
-- V2: an invite link (director, scoped to HackGSU, unused)
-- ============================================================================
insert into public.invites (id, token, role, event_id, expires_at, max_uses, created_by)
values (
  'c0000000-0000-4000-8000-000000000001', 'seed-demo-director-invite-hackgsu',
  'director', '20000000-0000-4000-8000-000000000003', now() + interval '30 days', 1,
  '10000000-0000-4000-8000-000000000001'
)
on conflict (id) do nothing;

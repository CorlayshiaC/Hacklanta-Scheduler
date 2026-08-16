# HackLanta Scheduler

HackLanta Scheduler is a planned web application for scheduling hackathon board members across HackLanta II. The app supports a 56-hour operational coverage window for the event, while keeping the 36-hour hacking/submission period conceptually separate. Admins configure the event and build the schedule, and board members submit availability and view assigned shifts.

This repository currently contains the approved architecture proposal, development conventions, Phase 1 Next.js scaffold, Phase 2 Supabase schema/RLS foundation, Phase 3 email/password authentication, Phase 4 admin member management, Phase 5 HackLanta II event setup, Phase 6 board member availability, Phase 7 admin shift management with human-in-the-loop candidate recommendations, Phase 8A registration profile capture, Phase 9 central schedule planning workspace, Phase 11 member schedule viewing, Phase 12 schedule review and publishing, Phase 13 schedule quality/operations polish, and Phase 14 schedule notification architecture. Product dashboards beyond the schedule workspace have not been implemented yet.

## Goals

- Schedule board members across the full operational event window.
- Prevent invalid assignments with reusable server-side validation.
- Track general coverage, role-specific coverage, conflicts, maximum hours, and insufficient breaks.
- Provide clear admin and board member workflows.
- Treat HackLanta as one continuous event timeline, including overnight hours and cross-day scheduling.
- Optimize schedule viewing for mobile first, while keeping admin timeline tools usable on larger screens.
- Use Supabase authentication and PostgreSQL row-level security as core security boundaries.

## Core Users

### Admin

- Manage board members.
- Configure the event.
- Create shifts.
- Assign board members.
- View coverage and conflicts.
- Publish the schedule.
- Work primarily from a scheduling command center where the full timeline is the centerpiece.

### Board Member

- Sign in.
- Submit availability across the full HackLanta II operational window.
- View personal schedule.
- View the published event schedule.

## Proposed Tech Stack

- Next.js with the App Router.
- TypeScript.
- Tailwind CSS.
- Supabase PostgreSQL and Auth.
- Vercel deployment.
- GitHub version control.

## Proposed Application Architecture

The app should use a server-first architecture:

- Next.js App Router for routing and layouts.
- Server components for data-heavy schedule and dashboard views.
- Server actions or route handlers for authenticated mutations.
- Supabase browser client only for safe client-side session reads when needed.
- Supabase server client for privileged user-context database operations.
- Reusable scheduling domain logic in `src/lib/scheduling`.
- Input validation in `src/lib/validation`.
- Generated Supabase database types in `src/types`.
- A command-center admin experience built around the event schedule timeline, with direct access to coverage, conflicts, members, shifts, and publishing.
- A visual availability editor that writes normalized availability windows to the database.

Suggested structure:

```text
src/
  app/
    (auth)/
      sign-in/
    (board)/
      availability/
      schedule/
    admin/
      dashboard/
      event/
      members/
      shifts/
      assignments/
      coverage/
      conflicts/
      publish/
    api/
  components/
    admin/
    availability/
    layout/
    schedule/
    ui/
  lib/
    auth/
    scheduling/
    supabase/
    validation/
  types/
supabase/
  migrations/
  seed.sql
tests/
  unit/
  integration/
  e2e/
```

## Architecture Review Notes

The architecture supports the required MVP capabilities with a few important constraints:

- The MVP should operate on one active HackLanta 2026 event record. Tables keep `event_id` so rules, queries, and future reuse remain clear, but routes do not need event slugs or event switching yet.
- The current schema is intentionally relational rather than snapshot-heavy. This keeps the MVP maintainable, but schedule publication should be implemented as a controlled server-side operation so draft and published assignment states cannot drift accidentally.
- Role-specific staffing adds necessary complexity. It should be kept focused on coverage requirements and member eligibility, not expanded into a permissions system.
- Future shift coverage and swap requests are documented but should remain out of the MVP.

## Operational Event Model

HackLanta Scheduler should treat HackLanta II as one continuous 56-hour operational coverage window. The UI should not assume that the event begins and ends on the same calendar day.

Architecture implications:

- Store event, shift, assignment, and availability times as `timestamptz`.
- Store the event display timezone on `events.timezone`.
- Render schedule and availability views as event-relative timelines, while still showing calendar dates where helpful.
- Make overnight hours visually clear instead of hiding them behind day-based tabs only.
- Support timeline labels such as event hour, day/date, and local time.
- Validate all windows and shifts against the full event range, even when they cross midnight.
- Preserve `starts_at < ends_at` and allow the confirmed 56-hour operational window.

The MVP should make the full operational timeline easy to scan for admins and board members. Day-specific filtering can be added later, but the primary model should remain one continuous event.

## Proposed Database Schema

### `profiles`

Application profile for each authenticated user.

| Column       | Type              | Notes                              |
| ------------ | ----------------- | ---------------------------------- |
| `id`         | uuid, primary key | References `auth.users.id`         |
| `full_name`  | text              | Display name                       |
| `email`      | text              | Snapshot from auth account         |
| `role`       | text              | `admin` or `board_member`          |
| `is_active`  | boolean           | Allows deactivating a board member |
| `created_at` | timestamptz       |                                    |
| `updated_at` | timestamptz       |                                    |

### `coverage_roles`

Staffing roles that may be required for shift coverage, such as Operations, Registration, or Logistics. These are scheduling roles, not authentication roles.

| Column        | Type              | Notes                  |
| ------------- | ----------------- | ---------------------- |
| `id`          | uuid, primary key |                        |
| `event_id`    | uuid              | References `events.id` |
| `name`        | text              | Example: `Operations`  |
| `description` | text              | Optional               |
| `created_at`  | timestamptz       |                        |
| `updated_at`  | timestamptz       |                        |

Recommended constraint: unique `event_id, name`.

### `member_coverage_roles`

Roles a board member can satisfy for an event.

| Column             | Type              | Notes                          |
| ------------------ | ----------------- | ------------------------------ |
| `id`               | uuid, primary key |                                |
| `event_id`         | uuid              | References `events.id`         |
| `profile_id`       | uuid              | References `profiles.id`       |
| `coverage_role_id` | uuid              | References `coverage_roles.id` |
| `created_at`       | timestamptz       |                                |

Recommended constraint: unique `event_id, profile_id, coverage_role_id`.

### `events`

Hackathon event configuration.

| Column       | Type              | Notes                            |
| ------------ | ----------------- | -------------------------------- |
| `id`         | uuid, primary key |                                  |
| `name`       | text              | Example: `HackLanta 2026`        |
| `starts_at`  | timestamptz       | Event start                      |
| `ends_at`    | timestamptz       | Event end                        |
| `timezone`   | text              | Display timezone                 |
| `status`     | text              | `draft`, `published`, `archived` |
| `created_by` | uuid              | References `profiles.id`         |
| `created_at` | timestamptz       |                                  |
| `updated_at` | timestamptz       |                                  |

### `member_settings`

Scheduling settings for each board member within an event.

| Column                  | Type              | Notes                          |
| ----------------------- | ----------------- | ------------------------------ |
| `id`                    | uuid, primary key |                                |
| `event_id`              | uuid              | References `events.id`         |
| `profile_id`            | uuid              | References `profiles.id`       |
| `max_hours`             | numeric           | Maximum assignable event hours |
| `minimum_break_minutes` | integer           | Required break between shifts  |
| `created_at`            | timestamptz       |                                |
| `updated_at`            | timestamptz       |                                |

Recommended constraint: unique `event_id, profile_id`.

### `availability_windows`

Board member availability or unavailability windows.

| Column       | Type              | Notes                        |
| ------------ | ----------------- | ---------------------------- |
| `id`         | uuid, primary key |                              |
| `event_id`   | uuid              | References `events.id`       |
| `profile_id` | uuid              | References `profiles.id`     |
| `starts_at`  | timestamptz       |                              |
| `ends_at`    | timestamptz       |                              |
| `status`     | text              | `available` or `unavailable` |
| `note`       | text              | Optional member note         |
| `created_at` | timestamptz       |                              |
| `updated_at` | timestamptz       |                              |

Recommended constraints: `starts_at < ends_at`; windows must fall within the event window.

The database should stay window-based because it is compact, queryable, and works well for conflict detection. The board member UX should not expose that as repetitive timestamp entry. The Phase 6 availability interface uses date/time controls and a simple day-by-day representation across the full operational event window. More visual editing can be added later if needed while still writing normalized `availability_windows` rows.

Availability validation should treat `unavailable` windows as hard conflicts. If the product later requires affirmative availability, validation can also require assignments to be fully contained within `available` windows. The MVP should choose one interpretation before migration work begins and document it in tests.

### `shift_roles`

Optional classification for shift type, such as check-in, mentor desk, security, food, or general coverage. This describes what the shift is; it does not define the staffing roles required to cover it.

| Column        | Type              | Notes                  |
| ------------- | ----------------- | ---------------------- |
| `id`          | uuid, primary key |                        |
| `event_id`    | uuid              | References `events.id` |
| `name`        | text              |                        |
| `description` | text              | Optional               |
| `created_at`  | timestamptz       |                        |
| `updated_at`  | timestamptz       |                        |

### `shifts`

Work periods that need board member coverage.

| Column            | Type              | Notes                                    |
| ----------------- | ----------------- | ---------------------------------------- |
| `id`              | uuid, primary key |                                          |
| `event_id`        | uuid              | References `events.id`                   |
| `shift_role_id`   | uuid              | Nullable reference to `shift_roles.id`   |
| `title`           | text              |                                          |
| `starts_at`       | timestamptz       |                                          |
| `ends_at`         | timestamptz       |                                          |
| `required_people` | integer           | Optional general minimum needed coverage |
| `location`        | text              | Optional                                 |
| `notes`           | text              | Optional admin notes                     |
| `created_at`      | timestamptz       |                                          |
| `updated_at`      | timestamptz       |                                          |

Recommended constraints: `starts_at < ends_at`; `required_people >= 0`; shifts must fall within the event window.

`required_people` is useful for general staffing needs. It should not be the only coverage model because some shifts need specific role coverage.

### `shift_role_requirements`

Role-specific staffing requirements for a shift.

| Column             | Type              | Notes                          |
| ------------------ | ----------------- | ------------------------------ |
| `id`               | uuid, primary key |                                |
| `shift_id`         | uuid              | References `shifts.id`         |
| `coverage_role_id` | uuid              | References `coverage_roles.id` |
| `required_people`  | integer           | Required members for this role |
| `created_at`       | timestamptz       |                                |
| `updated_at`       | timestamptz       |                                |

Recommended constraints: unique `shift_id, coverage_role_id`; `required_people > 0`.

A shift can use:

- Only `shifts.required_people` for general coverage.
- Only `shift_role_requirements` for role-specific coverage.
- Both, when a shift needs a total headcount and specific roles within that headcount.

### `shift_assignments`

Assignments of board members to shifts.

| Column             | Type              | Notes                                        |
| ------------------ | ----------------- | -------------------------------------------- |
| `id`               | uuid, primary key |                                              |
| `shift_id`         | uuid              | References `shifts.id`                       |
| `profile_id`       | uuid              | References `profiles.id`                     |
| `coverage_role_id` | uuid              | Nullable role this assignment is satisfying  |
| `assigned_by`      | uuid              | References `profiles.id`                     |
| `status`           | text              | `draft`, `published`, or `removed`           |
| `published_at`     | timestamptz       | Nullable timestamp for published assignments |
| `created_at`       | timestamptz       |                                              |
| `updated_at`       | timestamptz       |                                              |

Recommended constraint: unique active assignment per `shift_id, profile_id`.

When `coverage_role_id` is set, validation should confirm the member is eligible for that role through `member_coverage_roles`. Any active assignment can count toward general headcount. Assignments with a `coverage_role_id` can also count toward that role's requirement.

Database constraints or server-side validation should ensure the assignment's `coverage_role_id`, if present, belongs to the same event as the assigned shift.

### `schedule_publications`

Records schedule publishing events.

| Column         | Type              | Notes                    |
| -------------- | ----------------- | ------------------------ |
| `id`           | uuid, primary key |                          |
| `event_id`     | uuid              | References `events.id`   |
| `published_by` | uuid              | References `profiles.id` |
| `published_at` | timestamptz       |                          |
| `notes`        | text              | Optional                 |

Publishing validates the full schedule, marks active draft assignments as `published`, sets `published_at`, and writes a `schedule_publications` record. Before publication, board members can see their own draft assignments. After publication, the member schedule view clearly labels the schedule as published.

### `audit_log`

Security and operational audit trail for important admin actions.

| Column        | Type              | Notes                             |
| ------------- | ----------------- | --------------------------------- |
| `id`          | uuid, primary key |                                   |
| `actor_id`    | uuid              | References `profiles.id`          |
| `event_id`    | uuid              | Nullable reference to `events.id` |
| `action`      | text              |                                   |
| `entity_type` | text              |                                   |
| `entity_id`   | uuid              |                                   |
| `metadata`    | jsonb             |                                   |
| `created_at`  | timestamptz       |                                   |

### Future: `shift_coverage_requests`

This table is not required for the MVP, but the current architecture should leave room for board members to request coverage or shift swaps later.

Likely model:

| Column                   | Type              | Notes                                          |
| ------------------------ | ----------------- | ---------------------------------------------- |
| `id`                     | uuid, primary key |                                                |
| `event_id`               | uuid              | References `events.id`                         |
| `shift_assignment_id`    | uuid              | References `shift_assignments.id`              |
| `requester_id`           | uuid              | References `profiles.id`                       |
| `replacement_profile_id` | uuid              | Nullable proposed replacement                  |
| `status`                 | text              | `pending`, `approved`, `rejected`, `cancelled` |
| `reason`                 | text              | Optional                                       |
| `reviewed_by`            | uuid              | Nullable reference to `profiles.id`            |
| `reviewed_at`            | timestamptz       | Nullable                                       |
| `created_at`             | timestamptz       |                                                |
| `updated_at`             | timestamptz       |                                                |

Future workflow:

1. Board member requests coverage for an assigned shift.
2. Admin reviews the request and potential replacement.
3. Replacement member is assigned if approved.
4. Original assignment is removed or marked replaced.
5. `audit_log` records the change.

This should remain outside the MVP unless explicitly approved.

### Derived Views or Queries

These do not need dedicated tables in the MVP:

- Coverage summaries can be computed from `shifts`, `shift_role_requirements`, and active `shift_assignments`.
- Conflict summaries can be computed by the scheduling validation modules.
- Maximum-hours totals can be computed from assigned shift durations grouped by member.
- "Who's Working Now?" can query published assignments whose shift satisfies `starts_at <= now < ends_at`.

If performance becomes an issue later, these can become database views or materialized views after the core rules are stable.

## Table Relationships

- One Supabase auth user has one `profiles` row.
- One `events` row has many `coverage_roles`, `member_settings`, `availability_windows`, `shift_roles`, `shifts`, and `schedule_publications`.
- One `profiles` row can have many `member_coverage_roles`, `member_settings`, `availability_windows`, and `shift_assignments`.
- One `coverage_roles` row can be attached to many members through `member_coverage_roles`.
- One `coverage_roles` row can be required by many shifts through `shift_role_requirements`.
- One `shift_roles` row can be used by many `shifts`.
- One `shifts` row has many `shift_assignments`.
- One `shifts` row can have many `shift_role_requirements`.
- One `shift_assignments` row connects one board member to one shift.
- One `shift_assignments` row may satisfy one role-specific coverage requirement.
- One `schedule_publications` row records a publication event for one event; published assignments are represented on `shift_assignments`.
- `audit_log` records important changes performed by admins.

## Scheduling Validation Rules

Scheduling validation should live in reusable server-side modules, with pure functions where possible.

Proposed modules:

- `src/lib/scheduling/overlap.ts`
- `src/lib/scheduling/availability.ts`
- `src/lib/scheduling/max-hours.ts`
- `src/lib/scheduling/breaks.ts`
- `src/lib/scheduling/coverage.ts`
- `src/lib/scheduling/role-coverage.ts`
- `src/lib/scheduling/validate-schedule.ts`

Validation should detect:

- A member assigned to overlapping shifts.
- A member assigned during an unavailable window.
- A member exceeding configured maximum hours.
- A member scheduled without enough break time between shifts.
- A shift with fewer assignments than `required_people`.
- A shift missing one or more required coverage roles.
- A member assigned to satisfy a coverage role they are not eligible for.
- Coverage status for every shift: `uncovered`, `partially_covered`, or `fully_covered`.
- Published schedule views containing only published assignments.
- "Who's Working Now?" based on the current time and published assignments.

Validation results should be structured, for example:

```ts
type ScheduleValidationIssue = {
  rule:
    | "overlapping_shift"
    | "unavailable"
    | "max_hours_exceeded"
    | "insufficient_break"
    | "understaffed"
    | "role_understaffed"
    | "role_mismatch";
  severity: "error" | "warning";
  eventId: string;
  shiftId?: string;
  profileId?: string;
  coverageRoleId?: string;
  message: string;
};
```

Coverage validation should evaluate both total headcount and role requirements. For example, a shift that requires one Operations member, one Registration member, and one Logistics member should not be considered fully covered merely because three people are assigned. It is fully covered only when the required roles are satisfied and any general headcount requirement is also met.

Maximum-hours tracking should sum assigned shift duration per member across active draft and published assignments in the event. Minimum-break tracking should sort each member's assigned shifts by start time and compare the gap between each previous `ends_at` and next `starts_at`.

## Proposed Route and Page Structure

### Public and Auth Routes

- `/` redirects users based on role and authentication state.
- `/sign-in` handles login.
- `/sign-up` creates board-member accounts through Supabase Email/Password auth.
- Sign-out is handled through a server action.
- `/callback` exchanges Supabase auth codes for sessions for future OAuth or email-link flows.

### Board Member Routes

- `/my-schedule` allows a board member to submit and manage availability for HackLanta II.
- Future schedule views will show the signed-in member's assigned shifts.
- `/schedule` shows the published event schedule with a mobile-first timeline/list view.
- `/working-now` shows who is currently working based on published assignments.

### Admin Routes

- `/admin` shows the scheduling command center with the event timeline as the centerpiece.
- `/admin/event` configures event dates, timezone, and status.
- `/admin/members` manages board member profiles and settings.
- `/admin/shifts` creates and edits shifts.
- `/admin/assignments` assigns members to shifts.
- `/admin/coverage` shows coverage by shift and time period.
- `/admin/conflicts` shows validation issues.
- `/admin/publish` validates and publishes the schedule.

The admin routes can remain separate for maintainability, but `/admin` should give direct access to schedule, coverage, conflicts, members, shifts, and publishing. Administrators should not need to hop through disconnected pages to understand the state of the schedule.

The board-member schedule pages should be mobile-first: readable on a phone during the event, with clear current/next shift states and no dependency on wide tables.

## Board Member Availability

Phase 6 replaces the `/my-schedule` placeholder with a member availability experience for the configured `HackLanta II` event.

HackLanta II operational window:

- Starts: October 9, 2026 at 7:00 AM America/New_York.
- Ends: October 11, 2026 at 3:00 PM America/New_York.
- Duration: 56 operational coverage hours.

The 36-hour hacking/submission period is separate from this operational window and is not modeled yet.

Availability behavior:

- Members submit `available` windows only.
- Periods without an availability window are treated as unavailable for future scheduling.
- Multiple separate availability windows are supported for the same member/event.
- Submitted windows must have `start < end`.
- Submitted windows must stay inside the HackLanta II operational window.
- Timestamps are stored as `timestamptz` and rendered/edited in `America/New_York`.
- Optional notes are allowed and bounded to short text.
- Overlapping windows for the same member/event are rejected server-side with a clear message.
- Adjacent windows are allowed.

Security behavior:

- Availability actions determine the authenticated active profile server-side.
- Client-submitted `profile_id`, `event_id`, role, or ownership information is not trusted.
- Members manage only their own windows through the board member UI.
- Admins can access their own member availability experience without losing access to `/admin`.
- The existing Admin Members page shows read-only availability visibility for each member.

## Admin Member Management

Phase 4 implements `/admin/members` as an admin-only server-rendered management page.

Admins can:

- View all application profiles without exposing Supabase Auth internals.
- Search by name or email.
- Filter active and inactive profiles.
- Edit a member's full name, application role, and active status.
- Assign and remove event-specific coverage roles from `coverage_roles`.
- Configure per-event work constraints through `member_settings`.

The page manages existing authenticated profiles only. It does not create users, invite users, or bypass Supabase Auth. Board members still create their own accounts through `/sign-up`, and profile rows are created by the database bootstrap behavior.

Safeguards:

- `/admin/members` uses server-side admin authorization and is also covered by middleware route protection.
- Application roles are limited to `admin` and `board_member`.
- Inactive profiles remain blocked from protected app areas by the Phase 3 auth gates.
- The profile update action prevents removing the final active admin.
- Mutations are implemented as server actions and re-check admin authorization before writing.
- Audit entries are created for profile updates, coverage-role assignment/removal, and member settings changes.

Coverage roles are not hardcoded in application logic. They are read from the database for the configured HackLanta event. Member settings validate `max_hours > 0` and `minimum_break_minutes >= 0` before writing.

## Admin Shift Management

Phase 7 implements `/admin/shifts` as an admin-only shift builder for the configured `HackLanta II` event.

Admins can:

- Create, edit, and delete draft coverage shifts within the HackLanta II operational window.
- Set a general required headcount for each shift.
- Add role-specific staffing requirements from event coverage roles in the database.
- View shifts grouped by event day and filter by date, coverage role, and staffing status.
- See current draft assignments and remove draft assignments.
- Review dynamically ranked eligible candidates and explicitly confirm assignments.

The recommendation flow is human-in-the-loop. The system calculates candidates from current data, but it never automatically creates assignments. An admin must press `Assign`, and the server action re-checks admin authorization and candidate eligibility before inserting a draft `shift_assignments` row.

Current hard eligibility checks:

- Member profile is active.
- Member has the required coverage role when assigning against a role-specific requirement.
- Member has an `available` window covering the entire shift.
- Member has no overlapping active draft or published assignment.
- Assignment would not exceed configured maximum hours.
- Assignment would satisfy configured minimum break after the previous shift.

Candidate ranking currently favors lower assigned hours, greater remaining capacity, longer break, and more availability buffer. Recommendations are calculated dynamically and are not persisted in a recommendation table. Candidate cards show eligibility reasons, and excluded candidates can be inspected with concise rejection reasons such as unavailable, role mismatch, overlap, max-hours, minimum-break, or inactive status. Manual selection of a lower-ranked eligible candidate is audited.

Audit entries are written for shift creation, shift edits, shift deletion, draft assignment creation, draft assignment removal, and manual candidate selection.

## Admin Schedule Planning Workspace

Phase 9 implements `/admin/schedule` as the primary admin planning workspace for HackLanta II. The existing `/admin/shifts` route remains available and reuses the same server-side shift, recommendation, assignment, validation, and audit-log behavior.

The schedule workspace shows:

- HackLanta II event metadata, timezone, 56-hour operational window, and draft status.
- Schedule health with healthy, warning, and blocker states.
- Summary metrics for total shifts, staffing status counts, required positions, assigned positions, draft assignments, published assignments, and open positions.
- Filters for event date, database-backed coverage role, and staffing status.
- Needs Attention items for general staffing gaps and role-specific coverage gaps with shift links.
- Member workload summaries based on active draft and published assignments, configured max hours, remaining hours, and threshold status.
- A Conflict Center that uses the same hard blockers as the publish review.
- The reusable shift management surface for creating shifts, editing shifts, removing unassigned shifts, reviewing recommendations, assigning candidates, and removing draft assignments.

Staffing status is calculated dynamically from current active assignments and role-specific requirements. It is not stored as a database field. Recommendations also remain dynamic and are not persisted. The system remains human-in-the-loop: candidates may be suggested and ranked, but an admin must explicitly assign a member and every new assignment remains `draft`.

Schedule health, Needs Attention, workload warnings, conflict summaries, and recommendation reasoning are all calculated from existing tables. Phase 13 does not add conflict, workload, recommendation, readiness, or schedule-health tables.

Current limitations:

- `/admin/schedule` links to the controlled review and publishing flow at `/admin/schedule/review`.
- It does not automatically generate shifts or assignments.
- It does not create recommendation, workload, or summary tables.

## Schedule Review And Publishing

Phase 12 implements `/admin/schedule/review` as the admin-only readiness and publication checkpoint for HackLanta II.

The review page shows:

- Schedule health with fully staffed, partially staffed, unstaffed, open-position, and blocker counts.
- Summary metrics for shifts, staffing status, required positions, assigned positions, open positions, draft assignments, and published assignments.
- Hard blockers for invalid assignments, inactive members, coverage-role eligibility violations, availability violations, overlapping assignments, maximum-hours violations, and minimum-break violations.
- Warnings for open positions and partially staffed role requirements.
- A disabled publishing state when blockers exist or the schedule has already been published.
- An explicit confirmation control before publishing.

Publishing is implemented as a server action. It re-checks active admin authorization, rebuilds the readiness review immediately before writing, audits the publication attempt, blocks if any hard blocker remains, marks draft assignments as `published`, sets `published_at`, inserts a `schedule_publications` row, audits success, and revalidates the admin and member schedule routes.

The operation does not change the HackLanta II event status, does not bypass assignment RLS from the browser, does not auto-generate assignments, does not persist recommendation scores, and treats the server-side review as authoritative if UI summaries ever disagree.

## Schedule Notifications

Phase 14 adds server-controlled notification generation for meaningful HackLanta II schedule changes.

Supported notification events:

- `SCHEDULE_PUBLISHED`
- `ASSIGNMENT_ADDED`
- `ASSIGNMENT_CHANGED`
- `ASSIGNMENT_REMOVED`

Current integration points:

- Schedule publication generates one schedule-published notification per affected active member with at least one newly published assignment.
- Draft assignment creation generates a tentative draft-schedule notification for the assigned active member.
- Assignment removal generates a notification for the affected active member, using draft or official wording based on the removed assignment status.
- `ASSIGNMENT_CHANGED` is supported by the notification content/service layer for a future assignment-edit workflow, but there is no dedicated assignment-change mutation in the app yet.

Recipient rules:

- Recipients are resolved from authenticated database profile and assignment data.
- Browser-submitted email addresses are ignored.
- Inactive users are not notified.
- Unrelated members are not notified.
- Admins are notified only if they are the affected assigned member.

Draft vs published behavior:

- Draft assignment notifications use tentative wording and do not imply the schedule is official.
- Published schedule notifications clearly state that the HackLanta II schedule is official.
- Published assignment removals use official schedule-change wording.

Provider status:

- No transactional email provider is currently configured.
- No SMTP/API credentials are committed or invented.
- The server-only provider boundary currently reports `Transactional email delivery is not configured.`
- Future real delivery should be added behind `src/lib/notifications/provider.ts` with server-only environment variables for the chosen provider.

Failure behavior:

- Notification delivery runs only after the schedule or assignment mutation succeeds.
- Notification failure or unavailable delivery does not roll back schedule publication or assignment changes.
- Provider errors are logged with safe operational context and without credentials.

## Proposed Component Structure

### Layout Components

- `AppShell`
- `TopNav`
- `SideNav`
- `RoleGuard`
- `PageHeader`

### Admin Components

- `AdminCommandCenter`
- `AdminDashboardCards`
- `ScheduleWorkspace`
- `AdminScheduleTimeline`
- `CommandCenterNav`
- `EventSettingsForm`
- `MemberTable`
- `MemberSettingsForm`
- `CoverageRoleManager`
- `ShiftTable`
- `ShiftForm`
- `ShiftRoleRequirementEditor`
- `AssignmentMatrix`
- `CoverageTimeline`
- `RoleCoverageMatrix`
- `ConflictList`
- `PublishSchedulePanel`

### Board Member Components

- `AvailabilityEditor`
- `AvailabilityTimeline`
- `AvailabilityWindowEditor`
- `MyScheduleList`
- `PublishedScheduleView`
- `WorkingNowPanel`
- `CurrentShiftCard`
- `NextShiftCard`

### Shared Schedule Components

- `ScheduleTimeline`
- `EventHourAxis`
- `OvernightMarker`
- `ShiftCard`
- `CoverageBadge`
- `RoleCoverageBadge`
- `ConflictBadge`
- `MemberAvatar`
- `DateTimeRange`
- `MobileScheduleList`

### UI Components

Keep shared primitives small and accessible:

- `Button`
- `Input`
- `Select`
- `Dialog`
- `Table`
- `Tabs`
- `Toast`
- `Badge`

## Supabase Authentication and RLS Security Considerations

- Enable row-level security on all application tables.
- Store app roles in `profiles.role`; do not rely only on client-side checks.
- Use server-side authorization helpers to determine whether a user is an admin.
- Use a carefully reviewed security-definer helper or equivalent pattern for admin RLS checks to avoid recursive `profiles` policies.
- Do not expose the service-role key to the browser.
- Board members should only update their own profile details where allowed.
- Board members should only insert, update, and delete their own availability windows.
- Board members should only read published schedule assignments, plus their own draft assignments if the product requires that.
- Admins should manage event configuration, members, coverage roles, shift requirements, shifts, assignments, publication, and audit logs.
- Admin actions should write to `audit_log`.
- Middleware may redirect by auth state, but final authorization must happen in RLS and server-side mutation logic.
- Consider database functions for sensitive operations such as publishing a schedule.
- Email/password sign-up does not accept a role input. New profiles are created by the database bootstrap trigger with `role = board_member`.
- Admin access must be granted by updating the authenticated user's `profiles.role` through an admin-controlled path, not by registration.

Initial policy outline:

- `profiles`: users can read their own profile; admins can read and update all profiles.
- `events`: authenticated users can read published events; admins can manage draft and published events.
- `coverage_roles`: authenticated users can read event roles; admins can manage them.
- `member_coverage_roles`: members can read their own coverage roles; admins can manage all rows.
- `member_settings`: members can read their own settings; admins can manage all settings.
- `availability_windows`: members can manage their own rows; admins can read all rows for scheduling.
- `shift_role_requirements`: authenticated users can read requirements for published shifts; admins can manage all rows.
- `shifts`: members can read published event shifts; admins can manage all event shifts.
- `shift_assignments`: members can read their own assignments and published assignments; admins can manage all assignments.
- `schedule_publications`: authenticated users can read published records; admins can insert.
- `audit_log`: admins can read; inserts should happen through controlled server-side operations.

The service-role key should be avoided for normal user-scoped actions. If it is used for controlled operations such as publication or audit writes, the server action must first verify the current authenticated user's admin role.

## Testing Strategy

### Unit Tests

Focus on pure scheduling logic:

- Overlap detection.
- Availability conflicts.
- Maximum-hours calculation.
- Minimum-break detection.
- General and role-specific coverage status calculation.
- Full schedule validation output.

### Integration Tests

Use Supabase local development or test database fixtures to verify:

- RLS policies.
- Server actions and route handlers.
- Input validation.
- Admin-only mutations.
- Admin member management mutations and audit logging.
- Board member availability submission.
- Role-specific coverage validation.
- Schedule publication behavior.
- Published-only board member schedule reads.
- "Who's Working Now?" query behavior.

### End-to-End Tests

Use Playwright once UI work begins:

- Board member sign-in and availability submission.
- Availability editing across the full operational event timeline.
- Admin shift creation.
- Admin role requirement configuration.
- Admin assignment flow.
- Conflict review.
- Schedule publishing.
- Board member published schedule view.
- Mobile schedule viewing.
- "Who's Working Now?" view during an active shift.

### Static Checks

- TypeScript type checking.
- ESLint.
- Prettier or the formatter configured by the starter.
- Supabase migration validation.

## Development Instructions

The app has been scaffolded with Next.js, TypeScript, Tailwind CSS, ESLint, Prettier, Vitest, and Supabase client dependencies. Supabase migrations and generated database types are included.

Install dependencies:

```bash
npm install
```

Run the development server:

```bash
npm run dev
```

Run baseline checks:

```bash
npm run typecheck
npm run lint
npm test
npm run build
```

### Supabase Environment

Create a local `.env.local` file using `.env.example` as a template:

```bash
NEXT_PUBLIC_SUPABASE_URL=
NEXT_PUBLIC_SUPABASE_ANON_KEY=
SUPABASE_SERVICE_ROLE_KEY=
```

`SUPABASE_SERVICE_ROLE_KEY` must only be used in trusted server-side contexts. It is consumed only through server-only modules and must never be exposed to browser code.

### Email/Password Authentication

Phase 3 implements Supabase Email/Password authentication with cookie-backed sessions through `@supabase/ssr`.

Implemented routes:

- `/sign-in`: signs in with email and password.
- `/sign-up`: creates an account with email, password, and password confirmation.
- `/callback`: exchanges an auth code for a session. Email/password does not normally need this route, but it keeps the auth architecture ready for Google OAuth or email-link confirmation flows.
- `/my-schedule`: protected placeholder for authenticated active users.
- `/admin`: protected placeholder for active admins only.

Sign-out is implemented as a server action submitted by a POST form and redirects to `/sign-in`.

Post-authentication routing:

- Active admins go to `/admin`.
- Active board members go to `/my-schedule`.
- Inactive or missing-profile users are rejected from protected areas.

Authorization rules:

- Server code uses `supabase.auth.getUser()` and then reads `profiles.role` and `profiles.is_active`.
- Browser-submitted role values are ignored; registration cannot self-assign admin.
- Middleware refreshes Supabase auth cookies and performs minimal route redirects.
- Server components/actions still enforce authorization and RLS remains the final database boundary.

Supabase dashboard settings:

- Email provider must be enabled under Authentication providers.
- Configure the Site URL and redirect URLs for local and deployed environments.
- If email confirmation is enabled, users must confirm email before signing in.

Future Google OAuth can be added by enabling the provider in Supabase, adding an OAuth start action that calls `signInWithOAuth`, and redirecting back through `/callback`. The app authorization model does not change because roles remain in `profiles`.

Connected Supabase project used for Phase 2:

- Project name: `hacklanta-scheduler`
- Project ref: `ibrnzmltfebvdorsjazn`

### Supabase Migrations

Migration files live in `supabase/migrations`.

Current migrations:

- `20260815221959_initial_schema.sql`
- `20260815223043_harden_functions_and_indexes.sql`
- `20260815223209_rewrite_rls_policies.sql`

These migrations create:

- Application tables and enums.
- Foreign keys, indexes, constraints, and timestamp triggers.
- Event-window validation triggers for shifts and availability windows.
- Private auth helper functions under `app_private`.
- Profile bootstrap trigger for new Supabase Auth users.
- RLS policies for all application tables.

Schema changes should continue to be made through migration files and applied through the connected Supabase MCP workflow or the Supabase CLI after linking the project. Do not create tables manually in the Supabase dashboard.

### Type Generation

Types are generated from the live Supabase schema into `src/types/database.ts`.

Supabase CLI equivalent:

```bash
supabase gen types typescript --project-id ibrnzmltfebvdorsjazn --schema public > src/types/database.ts
```

When using Codex with the Supabase MCP connection, use the MCP TypeScript type generation tool and replace `src/types/database.ts` with the returned output.

### Seed Data

Development-only seed data lives in `supabase/seed.sql`.

It contains safe example data only:

- HackLanta 2026 draft event.
- Operations, Registration, and Logistics coverage roles.
- Example shift roles.

It does not create real users, fake authentication users, personal information, shifts, or assignments.

Apply seed data only to a local or development database:

```bash
supabase db seed
```

Do not seed production without explicit approval.

### Supabase Validation

Phase 2 was validated against the connected Supabase project with:

- Project lookup through Supabase MCP.
- Existing table and migration inspection before changes.
- Migration application through Supabase MCP.
- Live table/RLS inspection after migration.
- Live rollback-style constraint probes for the previous event duration rule, shift event windows, and role/event consistency.
- Supabase security and performance advisors.

Security advisors returned no findings after the hardening migrations. Performance advisors currently report only unused indexes, which is expected for a new empty database.

Complete RLS behavior testing with real JWTs should be added against a local Supabase test environment in a later phase.

After Phase 2, recommended setup steps are:

1. Configure Supabase Auth email settings and test sign-up/sign-in in a real environment.
2. Continue expanding scheduling validation modules and tests as assignment behavior grows.
3. Add RLS integration testing against a local Supabase test environment.
4. Add RLS integration testing against a local Supabase test environment.

## Recommended Build Order

1. Scaffold the Next.js app and baseline tooling.
2. Add Supabase setup, migrations, generated types, and RLS policies.
3. Implement authentication and profile bootstrap.
4. Implement admin event, member, and coverage-role management.
5. Implement visual availability submission backed by window-based storage.
6. Implement shift creation with general and role-specific staffing requirements.
7. Implement human-in-the-loop assignment recommendations.
8. Implement the admin command center, coverage, conflicts, and maximum-hours dashboards.
9. Implement coverage and conflict dashboards.
10. Implement "Who's Working Now?" views.
11. Add future coverage/swap request workflows if approved.
12. Prepare Vercel deployment.

## Current Status

- Architecture proposal created.
- Database schema proposal updated for role-specific coverage.
- Route, component, security, UX, and testing strategy documented.
- Future shift coverage and swap workflow documented as non-MVP.
- Development conventions documented in `AGENTS.md`.
- Phase 1 scaffold created with Next.js App Router, TypeScript strict mode, Tailwind CSS, linting, formatting, and test tooling.
- Phase 2 Supabase migrations, generated types, RLS policies, Supabase clients, env validation, and seed file created.
- Phase 3 Supabase Email/Password authentication, route protection, auth pages, and placeholder protected routes created.
- Phase 4 admin member management created.
- Phase 5 HackLanta II draft event and event-specific coverage roles created.
- Phase 6 board member availability management created.
- Phase 7 admin shift management and human-in-the-loop recommendations created.
- Phase 8A registration profile capture created.
- Phase 9 central admin schedule planning workspace created.
- Phase 11 member schedule and assignment view created.
- Phase 12 admin schedule review and publishing flow created.
- Phase 13 schedule health, Needs Attention, workload warnings, Conflict Center, and recommendation transparency created.
- Phase 14 server-controlled schedule notification architecture created.

Implemented so far:

- Basic `src/app` shell and landing page.
- Project folders for components, libraries, types, Supabase, and tests.
- Generated Supabase database type file.
- Browser, server, and admin Supabase client factories.
- Server-side admin authorization helpers.
- Server-side authenticated-user, board-member, and admin authorization helpers.
- `/sign-in`, `/sign-up`, `/callback`, `/my-schedule`, and `/admin` route surfaces.
- Middleware for Supabase session refresh and minimal protected-route redirects.
- `/admin/members` profile, coverage-role, and work-constraint management.
- Server actions for member updates with validation, final-active-admin safeguard, and audit logging.
- `/my-schedule` availability entry and management for HackLanta II.
- Server-side availability create, update, delete actions with ownership, event, boundary, note, and overlap validation.
- Read-only availability visibility in `/admin/members`.
- `/admin/shifts` shift creation, editing, deletion, role-specific requirements, staffing filters, draft assignment confirmation/removal, and dynamic candidate ranking.
- `/admin/schedule` central planning workspace with HackLanta II header, schedule health, date/role/staffing filters, staffing summaries, Needs Attention, workload thresholds, Conflict Center, and reused shift/recommendation/assignment workflows.
- `/admin/schedule/review` readiness review with health metrics, blockers, warnings, explicit publish confirmation, assignment publication, publication records, and audit logging.
- `/my-schedule` member schedule view with draft and published schedule states.
- Server-only notification service for schedule publication and assignment changes, with delivery unavailable until a provider is configured.
- Server-side shift validation and candidate recommendation modules.
- Supabase migrations for approved schema, RLS, private auth helpers, constraints, triggers, and indexes.
- Development-only seed file with safe example event/role data.
- Minimal unit tests for app shell, environment validation, authorization helpers, auth input validation, route protection helpers, member management validation/UI/actions, availability validation/actions, shift validation/actions, recommendations, and migration coverage.

Not implemented yet:

- Admin event and coverage-role creation/editing screens.
- Dedicated coverage dashboard and conflict dashboard.
- "Who's Working Now?"
- Final UI design refinements beyond the Phase 10 visual system.

# HackLanta Scheduler Development Conventions

This project is a maintainable, security-conscious scheduling application for HackLanta 2026. It should be built incrementally. Do not implement broad product areas without first defining the data model, authorization model, and server-side validation rules they depend on.

## Product Scope

- Build for a 36-hour hackathon board scheduling workflow.
- Prioritize correctness, auditability, and clear user flows over large feature batches.
- Do not add unrelated event-management features unless explicitly approved.
- Treat scheduling validation as shared server-side domain logic, not as UI-only checks.
- Treat HackLanta as one continuous 36-hour event, including overnight hours and cross-day schedule views.
- Treat the MVP as one active HackLanta 2026 event. Keep `event_id` relationships, but do not add event-switching UI unless approved.

## Tech Stack

- Next.js with the App Router.
- TypeScript in strict mode.
- Tailwind CSS for styling.
- Supabase for PostgreSQL, authentication, and row-level security.
- Vercel for deployment.
- GitHub for source control and pull requests.

## Architecture Principles

- Keep database access on the server whenever possible.
- Use Supabase row-level security as a hard authorization boundary.
- Use server actions or route handlers for mutations.
- Keep scheduling rules in reusable domain modules that can be called by pages, API handlers, and tests.
- Separate UI components from data-loading and mutation logic.
- Prefer explicit, small modules over broad utility files.
- Center the admin experience on a scheduling command center with the event timeline as the primary workspace.
- Keep derived dashboards such as coverage, conflicts, maximum hours, and "Who's Working Now?" query-based until performance requires persisted summaries.

## Suggested Project Structure

```text
src/
  app/
    (auth)/
    (board)/
    admin/
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

## TypeScript Conventions

- Keep `strict` enabled.
- Avoid `any`; prefer typed query results, explicit DTOs, or generated Supabase types.
- Use discriminated unions for scheduling validation results.
- Validate all mutation inputs with a schema library before writing to the database.
- Keep date/time values as timezone-aware timestamps in storage and convert only for display.

## Database Conventions

- Use UUID primary keys unless there is a clear reason not to.
- Include `created_at` and `updated_at` timestamps on core tables.
- Store role and status values as enums or constrained text.
- Add database constraints for invariants that must never be violated.
- Add indexes for foreign keys, time-range queries, and common dashboard filters.
- Generate and commit Supabase migration files; do not rely on manual dashboard-only schema changes.

## Security Conventions

- Enable row-level security on every application table.
- Use least-privilege policies for admin and board member access.
- Do not expose Supabase service-role keys to the browser.
- Never trust client-side role checks as authorization.
- Validate ownership and role permissions on the server before mutations.
- Use a reviewed security-definer helper or equivalent pattern for admin RLS checks to avoid recursive role policies.
- Verify the authenticated admin before any controlled service-role operation.
- Keep sensitive configuration in environment variables.

## Scheduling Conventions

Server-side scheduling validation must cover:

- Overlapping assigned shifts for the same member.
- Assignments during unavailable periods.
- Maximum-hours limits.
- Insufficient breaks between shifts.
- General required coverage per shift.
- Role-specific required coverage per shift.
- Assignment of members only to coverage roles they are eligible to satisfy.
- Coverage status: uncovered, partially covered, or fully covered.
- Draft vs published assignment visibility.
- Current published assignments for "Who's Working Now?".

Validation should return structured results that identify the affected member, shift, rule, severity, and explanation.

## Testing Conventions

- Unit test scheduling rule logic heavily.
- Integration test database policies and server mutations.
- Add end-to-end tests for critical user flows after the first UI implementation.
- Include regression tests for every scheduling bug fix.
- Keep tests deterministic by using fixed event windows and seed data.
- Include role-specific coverage cases in scheduling validation tests.
- Test draft/published schedule visibility and current-shift query behavior.

## UX Conventions

- Admin workflows should favor the command center, scannable timelines, filters, and clear status indicators.
- Board member workflows should be simple: sign in, submit availability visually, view schedule.
- Availability entry should use a visual 36-hour timeline, while persisting normalized availability windows.
- Schedule views should make overnight hours and cross-day shifts easy to understand.
- Board-member schedule views should be mobile-first and readable during the event.
- Clearly distinguish draft schedules from published schedules.
- Show validation problems near the affected shift or assignment.
- Avoid decorative UI that slows down operational scheduling tasks.

## Git Conventions

- Keep changes scoped and reviewable.
- Use descriptive branch names, preferably with the `codex/` prefix for Codex-created branches.
- Do not commit secrets or generated local environment files.
- Include schema migrations with code that depends on them.

<!-- BEGIN:nextjs-agent-rules -->

# This is NOT the Next.js you know

This version has breaking changes — APIs, conventions, and file structure may all differ from your training data. Read the relevant guide in `node_modules/next/dist/docs/` (resolved from this file's directory; in monorepos the `next` package may not be visible from the repo root) before writing any code. Heed deprecation notices.

This block is written and re-added by `next dev` — verify at `node_modules/next/dist/server/lib/generate-agent-files.js`. Removing it from a diff only re-creates the uncommitted change; committing it with your work keeps the tree clean.

<!-- END:nextjs-agent-rules -->

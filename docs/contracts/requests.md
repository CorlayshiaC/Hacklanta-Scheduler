# Cross-territory requests

Changes needed in files an agent doesn't own. Format: requesting agent, target file, exact change,
why. The owning agent applies it (or replies here if they disagree); requester never edits.

## From Agent 5

### `src/lib/auth/route-protection.ts`: add `/settings` to protected routes

Not currently in `protectedRoutePrefixes` (`/admin`, `/my-schedule`, `/availability`, `/schedule`,
`/working-now`), so `app/(app)/settings/*` is unauthenticated today. Requesting:

```ts
const protectedRoutePrefixes = [
  "/admin",
  "/my-schedule",
  "/availability",
  "/schedule",
  "/working-now",
  "/settings",
];
```

Additionally, `settings/roles` and `settings/organization` are admin-only screens (org settings,
role changes). `isAdminRoute` currently only matches `/admin`. Requesting either a second
`isRestrictedSettingsRoute` helper matching `/settings/roles` and `/settings/organization`, or
extending `isAdminRoute` to also match those two prefixes, whichever the owner prefers. Until this
lands, `app/(app)/settings/roles/page.tsx` and `.../organization/page.tsx` perform their own
server-side `requireAdmin()` check as defense in depth (belt and suspenders, not a replacement for
the middleware gate).

Owner unclear (not explicitly assigned in the shared brief; guessing Agent 2 given it wraps
`profiles.role`, or Agent 1 given "app shell"). Not blocking, both settings pages self-gate in the
meantime.

### Env var: `NEXT_PUBLIC_SITE_URL`

Needed for absolute URLs in OG image metadata (`og:url`, `twitter:image` need a full origin, not a
relative path) and for the "copy link" share action (`${SITE_URL}/s/${token}`). Requesting it added
to `.env.example` and wherever `src/lib/env.ts` / `env.server.ts` centralizes env access. Falls
back to `http://localhost:3000` in dev if unset; my code does not hard fail without it, just warns.

Owner unclear. Not blocking.

### Heads-up: `src/app/admin/members` overlaps `app/(app)/settings/roles`

`src/app/admin/members/page.tsx` + `src/components/admin/members/member-management.tsx` +
`src/lib/admin/member-actions.ts` already implement member search, role change (with a last-active-
admin guard, reused rather than reinvented, see `pending.md`), coverage-role assignment, and
work-constraint editing. My brief assigns "Roles (admin): member list with role dropdowns" to
`app/(app)/settings/roles`, which is a narrower slice of the same surface (role changes only, not
coverage-role/work-constraint assignment, which stays wherever it currently lives).

Not asking for `admin/members` to be deleted or edited, it's not requested here and I'm not
touching it. Flagging so whoever owns `src/app/admin/*` (unclear from the shared brief, guessing
Agent 3) can decide whether to redirect `/admin/members` to `/settings/roles` once mine ships, keep
both, or split responsibilities differently. I import (not edit) `updateMemberProfileAction` from
`src/lib/admin/member-actions.ts` for the actual mutation, see `pending.md` item 4.

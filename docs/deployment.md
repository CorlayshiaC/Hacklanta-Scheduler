# Deploying prog scheduler

Everything below assumes the `revamp` branch. Steps 1-6 are the first deploy; step 7 onward is what
you repeat.

Two things are worth knowing before you start:

- **The app is invite-only.** A brand-new Google sign-in creates a profile with `is_active = false`
  and can see nothing. There are exactly two ways out of that state: redeem an invite link, or have
  an admin flip the toggle in Settings > Roles.
- **The first admin has to be created from outside the app**, because only an admin can promote
  anyone and a fresh database has none. That is step 5, and skipping it leaves you locked out of
  your own deployment.

---

## 1. Create the Supabase project

Supabase dashboard > New project. Pick the region closest to Atlanta (`us-east-1`). Save the
database password somewhere real; you cannot read it back later.

## 2. Push the schema

```bash
supabase login
supabase link --project-ref <your-project-ref>   # from the dashboard URL
supabase db push
```

`db push` applies every migration in `supabase/migrations/` in order. It does **not** run
`supabase/seed.sql`, which is correct: that file is 40 fictional GSU students and a demo event, and
it belongs nowhere near production.

Verify it landed:

```bash
supabase db diff --linked      # should report no schema differences
```

## 3. Configure auth

**Supabase dashboard > Authentication > URL Configuration**

- Site URL: `https://<your-domain>`
- Redirect URLs: `https://<your-domain>/callback` (and your Vercel preview domain if you want
  sign-in to work on previews: `https://*-<your-org>.vercel.app/callback`)

**Supabase dashboard > Authentication > Providers > Google**: enable it, and paste the client ID and
secret from step 3b.

**3b. Google Cloud Console** > APIs & Services > Credentials > OAuth 2.0 Client ID (Web
application):

- Authorized JavaScript origins: `https://<your-domain>`
- Authorized redirect URIs: `https://<your-project-ref>.supabase.co/auth/v1/callback`
  (Supabase's callback, not yours — this trips people up)

The consent screen needs to be published, or only accounts you list as test users can sign in.

## 4. Deploy the app

Vercel > New Project > import the repo. Framework preset: Next.js. Root directory: the repo root.

Environment variables (copy the names from `.env.example`):

| Variable | Required | Where it comes from |
| --- | --- | --- |
| `NEXT_PUBLIC_SUPABASE_URL` | yes | Supabase > Project Settings > API |
| `NEXT_PUBLIC_SUPABASE_ANON_KEY` | yes | same page |
| `SUPABASE_SERVICE_ROLE_KEY` | yes | same page — server-only, never expose |
| `NEXT_PUBLIC_SITE_URL` | yes in prod | `https://<your-domain>`, no trailing slash |
| `GEMINI_API_KEY` | optional | Google AI Studio. Unset = AI features fall back to manual |
| `RESEND_API_KEY` | optional | Resend. Unset = no outbound email, in-app notifications still work |
| `NOTIFICATIONS_FROM_EMAIL` | with Resend | must be on a domain verified in Resend |
| `VAPID_PUBLIC_KEY` / `VAPID_PRIVATE_KEY` / `VAPID_SUBJECT` | optional | `npx web-push generate-vapid-keys` |

`NEXT_PUBLIC_*` variables are inlined into the client bundle **at build time**. Changing one and
redeploying without a rebuild leaves the old value baked in.

## 5. Make yourself the first admin

1. Sign in to the deployed app with Google. You will be told your account is inactive. That is
   correct and expected — the profile row now exists, which is all this step needed.
2. Supabase dashboard > SQL Editor:

```sql
select app_private.bootstrap_admin('you@gsu.edu');
```

3. Sign out and back in. You should land on `/coverage`.

Notes:

- The email must match the Google account you signed in with, exactly (case-insensitive).
- A plain `update public.profiles set role = 'admin' ...` does **not** work here. The
  `prevent_self_role_escalation` trigger rejects it because `auth.uid()` is null in the SQL editor,
  so `is_admin()` is false. `bootstrap_admin()` exists specifically to be the sanctioned way through
  that, and it is not callable by anyone signed in to the app.
- Run it again any time you need to restore admin access to yourself.

## 6. Invite everyone else

Settings > Invites. Pick a role, expiry, and use count; copy the link; send it.

- **Member** links are the normal case. One link with 50 uses is fine for onboarding a whole board.
- **Director** links need an event UUID and scope that person's write access to that one event.
- **Admin** links grant full control. Prefer promoting someone in Settings > Roles instead, so the
  grant is deliberate rather than forwardable.
- Redemption never demotes: an admin who clicks a member link stays an admin.
- Revoking a link stops future redemptions and does not affect anyone who already used it.

Anyone who signs in without a link sits pending until an admin activates them in Settings > Roles.
That list is the de facto "requests to join" queue.

## 7. Redeploying

Vercel deploys on push. Schema changes need `supabase db push` separately, and should go out
**before** the code that depends on them.

---

## Still missing, if you care about it before launch

- **Nothing schedules the shift reminders.** `reminder24h` / `reminder1h` have complete email and
  push rendering and no caller. They need a cron (a Vercel cron hitting an authenticated route, or
  `pg_cron` in Supabase) before anyone gets reminded of anything.
- **Push is configured but unreachable from the UI.** `sendPush()` works once the VAPID keys are
  set; the Settings toggle that would subscribe a browser is still a stub.
- **No error tracking.** A server-action failure in production is currently invisible unless someone
  reports it.
- **No backups configured beyond the Supabase plan default.** Check what your plan retains.

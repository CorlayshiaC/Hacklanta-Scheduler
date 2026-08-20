import { readdirSync, readFileSync } from "node:fs";
import { join } from "node:path";
import { describe, expect, it } from "vitest";

/**
 * The production entry gate, asserted against the migrations themselves.
 *
 * These are string assertions over SQL, which is a weak form of test, but the thing being guarded is
 * exactly the kind of thing that rots silently: a later migration redefining a function and quietly
 * undoing the gate, or repeating the enum-literal bug this migration fixed.
 *
 * That bug is the reason the "effective definition" helper below exists rather than just grepping
 * the whole corpus. `create or replace function` means only the LAST definition in timestamp order
 * is real, and app_private.handle_new_user() had been broken since 20260817000100 renamed
 * app_role's 'board_member' value out from under a definition that still wrote that literal: every
 * new Google sign-in aborted inside the auth trigger with `invalid input value for enum app_role`.
 * A test that searched all migrations for the right content would have passed throughout, because
 * the correct-looking older definition was still sitting there in the file it was written in.
 */

const MIGRATIONS_DIR = join(process.cwd(), "supabase/migrations");

function migrationsInOrder(): { name: string; sql: string }[] {
  return readdirSync(MIGRATIONS_DIR)
    .filter((name) => name.endsWith(".sql"))
    .sort()
    .map((name) => ({ name, sql: readFileSync(join(MIGRATIONS_DIR, name), "utf8") }));
}

/**
 * The body of the last `create or replace function <name>` in migration order: what the database
 * actually ends up running. Bodies are dollar-quoted ($$ ... $$), so the block runs from the
 * signature to the closing $$.
 */
function effectiveFunctionBody(functionName: string): string {
  let found: string | null = null;

  for (const { sql } of migrationsInOrder()) {
    const escaped = functionName.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
    const pattern = new RegExp(
      `create or replace function ${escaped}[\\s\\S]*?\\$\\$([\\s\\S]*?)\\$\\$`,
      "g",
    );
    for (const match of sql.matchAll(pattern)) {
      found = match[1];
    }
  }

  if (found === null) {
    throw new Error(`No definition of ${functionName} found in supabase/migrations.`);
  }

  return found;
}

describe("new-user gate", () => {
  const trigger = effectiveFunctionBody("app_private.handle_new_user()");

  it("lands a brand-new account pending, not active", () => {
    expect(trigger).toContain("is_active");
    expect(trigger).toMatch(/'member',\s*false/);
  });

  it("writes a role that still exists in app_role", () => {
    // The specific regression: 20260817000100 renamed 'board_member' to 'member', and a plpgsql
    // body is text parsed at execution, so the literal did not travel with the rename.
    expect(trigger).not.toContain("board_member");
    expect(trigger).not.toContain("organizer");
  });
});

describe("invite redemption", () => {
  const redeem = effectiveFunctionBody("public.redeem_invite(p_token text)");

  it("is what activates a pending account", () => {
    expect(redeem).toContain("is_active = true");
  });

  it("refuses a revoked or expired link", () => {
    expect(redeem).toContain("revoked_at is not null");
    expect(redeem).toContain("expires_at <= now()");
  });

  it("treats a null expiry as never-expiring and null max_uses as unlimited", () => {
    expect(redeem).toContain("v_invite.expires_at is not null and v_invite.expires_at <= now()");
    expect(redeem).toContain("v_invite.max_uses is not null and v_invite.used_count >= v_invite.max_uses");
  });

  it("never demotes an existing higher role", () => {
    expect(redeem).toContain("app_private.role_rank(v_invite.role) > app_private.role_rank(v_current)");
  });

  it("requires an authenticated caller", () => {
    expect(redeem).toContain("raise exception 'authentication required'");
  });
});

describe("first-admin bootstrap", () => {
  const corpus = migrationsInOrder()
    .map((migration) => migration.sql)
    .join("\n");

  it("exists, since the gate leaves a fresh database with no admin and no way to make one", () => {
    expect(corpus).toContain("create or replace function app_private.bootstrap_admin(p_email text)");
  });

  it("is not callable by a signed-in user", () => {
    // app_private's USAGE grant makes the schema visible to `authenticated`; only the absence of an
    // EXECUTE grant keeps this out of reach of anyone who can log in.
    expect(corpus).toContain("revoke all on function app_private.bootstrap_admin(text) from public");
    expect(corpus).not.toContain("grant execute on function app_private.bootstrap_admin(text) to authenticated");
  });

  it("sets the system_write flag, without which the escalation trigger blocks it", () => {
    const bootstrap = effectiveFunctionBody("app_private.bootstrap_admin(p_email text)");
    expect(bootstrap).toContain("set_config('app_private.system_write', 'on', true)");
  });
});

describe("anonymous invite preview", () => {
  it("does not widen table access to reach it", () => {
    const corpus = migrationsInOrder()
      .map((migration) => migration.sql)
      .join("\n");

    // The join screen needs to name the role before sign-in. That must stay an exact-token
    // security-definer lookup: no select policy for anon on the table itself, or invite metadata
    // becomes enumerable.
    expect(corpus).toContain("create or replace function public.get_invite_preview(p_token text)");
    expect(corpus).toContain("grant execute on function public.get_invite_preview(text) to anon");
    expect(corpus).not.toMatch(/create policy[^;]*on public\.invites for select\s*\n\s*to anon/);
  });
});

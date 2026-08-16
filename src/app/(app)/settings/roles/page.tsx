import { requireAdmin } from "@/lib/auth/authorization";
import { createSupabaseServerClient } from "@/lib/supabase/server";
import { RolesTable } from "@/components/settings/roles-table";
import type { RolesTableMember } from "@/components/settings/roles-table";
// STUB(agent-1): replace with the real primitives once components/ui publishes it.
import { Slab, TextInput, Well } from "@/components/settings/_stub-primitives";
import type { Database } from "@/types/database";

export const dynamic = "force-dynamic";

type ProfileRow = Pick<
  Database["public"]["Tables"]["profiles"]["Row"],
  "id" | "full_name" | "email" | "role" | "is_active"
>;

type SettingsRolesPageProps = {
  searchParams?: Promise<{ q?: string }>;
};

export default async function SettingsRolesPage({ searchParams }: SettingsRolesPageProps) {
  // Admin only. Not yet in the middleware protected route list (requested in
  // docs/contracts/requests.md, "From Agent 5"), so this server-side check is defense in depth
  // until that lands, not redundant with anything upstream today.
  await requireAdmin();

  const params = await searchParams;
  const query = params?.q?.trim() ?? "";

  const supabase = await createSupabaseServerClient();
  let profilesQuery = supabase
    .from("profiles")
    .select("id,full_name,email,role,is_active")
    .order("full_name", { ascending: true });

  if (query) {
    // Same escaping convention as src/lib/admin/member-data.ts: guard the literal ilike wildcard
    // characters so a search string containing "%" or "_" is matched literally, not as a pattern.
    const escaped = query.replaceAll("%", "\\%").replaceAll("_", "\\_");
    profilesQuery = profilesQuery.or(`full_name.ilike.%${escaped}%,email.ilike.%${escaped}%`);
  }

  const { data, error } = await profilesQuery;

  if (error) {
    return (
      <Slab>
        <h1 className="text-lg font-semibold text-zinc-100">Roles</h1>
        <p className="mt-4 text-sm text-rose-400">
          Could not load members. Refresh the page, or try again later.
        </p>
      </Slab>
    );
  }

  const members: RolesTableMember[] = ((data ?? []) as ProfileRow[]).map((profile) => ({
    id: profile.id,
    fullName: profile.full_name,
    email: profile.email,
    role: profile.role,
    isActive: profile.is_active,
  }));

  return (
    <Slab>
      <h1 className="text-lg font-semibold text-zinc-100">Roles</h1>
      <p className="mt-2 text-sm text-zinc-400">
        Search members and change their role. Role changes save immediately.
      </p>

      <form className="mt-4 flex flex-wrap gap-3" method="GET">
        <label className="sr-only" htmlFor="roles-search">
          Search by name or email
        </label>
        <TextInput
          className="max-w-sm"
          defaultValue={query}
          id="roles-search"
          name="q"
          placeholder="Search by name or email"
          type="search"
        />
        <button
          className="rounded-xl border border-white/10 bg-white/5 px-4 py-2 text-sm font-medium text-zinc-200 transition hover:bg-white/10"
          type="submit"
        >
          Search
        </button>
      </form>

      <div className="mt-6">
        {members.length === 0 ? (
          <Well>
            <p className="text-sm text-zinc-300">No members match that search.</p>
          </Well>
        ) : (
          <RolesTable members={members} />
        )}
      </div>
    </Slab>
  );
}

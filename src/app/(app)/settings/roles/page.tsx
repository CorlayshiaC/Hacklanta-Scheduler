import { requireAdmin } from "@/lib/auth/authorization";
import { createSupabaseServerClient } from "@/lib/supabase/server";
import { RolesTable } from "@/components/settings/roles-table";
import type { RolesTableMember } from "@/components/settings/roles-table";
import { PillButton } from "@/components/ui/neu-button";
import { NeuInput as TextInput } from "@/components/ui/neu-input";
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
      <div>
        <h1 className="font-display text-[20px] font-medium normal-case text-text-primary">Roles</h1>
        <p className="mt-4 text-[13px] text-accent-warn">
          Could not load members. Refresh the page, or try again later.
        </p>
      </div>
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
    <div>
      <h1 className="font-display text-[20px] font-medium normal-case text-text-primary">Roles</h1>
      <p className="mt-2 text-[13px] text-text-secondary">
        Search members and change their role. Role changes save immediately.
      </p>

      <form className="mt-4 flex flex-wrap items-center gap-3" method="GET">
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
        <PillButton type="submit" variant="link">
          Search
        </PillButton>
      </form>

      <div className="mt-6">
        {members.length === 0 ? (
          <p className="text-[13px] text-text-secondary">No members match that search.</p>
        ) : (
          <RolesTable members={members} />
        )}
      </div>
    </div>
  );
}

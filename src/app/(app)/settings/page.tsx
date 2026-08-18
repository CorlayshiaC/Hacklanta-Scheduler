import { requireAuthenticatedUser } from "@/lib/auth/authorization";
import { createSupabaseServerClient } from "@/lib/supabase/server";
import { ProfileForm } from "@/components/settings/profile-form";
import { updateProfileAction } from "@/lib/settings/profile-actions";

export const dynamic = "force-dynamic";

type ProfileRow = {
  id: string;
  full_name: string;
  email: string;
  timezone: string;
  avatar_url: string | null;
};
type MemberSettingsRow = { max_hours: number };

export default async function SettingsPage() {
  const { user } = await requireAuthenticatedUser();
  const supabase = await createSupabaseServerClient();

  const { data, error: profileError } = await supabase
    .from("profiles")
    .select("id, full_name, email, timezone, avatar_url")
    .eq("id", user.id)
    .maybeSingle();
  // The Supabase client's select-string literal type inference does not resolve reliably in
  // this project (same workaround used in src/lib/auth/authorization.ts), so cast explicitly.
  const profile = data as ProfileRow | null;

  if (profileError || !profile) {
    return (
      <div>
        <h1 className="text-2xl font-black uppercase tracking-tight text-[#F5F5F5]">Profile</h1>
        <p className="mt-4 text-sm text-[#FF9F2E]">
          Could not load your profile. Refresh the page, or try again later.
        </p>
      </div>
    );
  }

  // STUB: there is no clean id based lookup yet for "the current active event" for a member
  // (see docs/contracts/schema-requests.md item 4, event resolution is name based today, not id
  // based). member_settings is per event, so for this pass we take the most recently created
  // member_settings row for this profile rather than resolving a specific active event. Revisit
  // once an id based active-event contract exists.
  const { data: memberSettingsData } = await supabase
    .from("member_settings")
    .select("max_hours")
    .eq("profile_id", profile.id)
    .order("created_at", { ascending: false })
    .limit(1)
    .maybeSingle();
  const memberSettings = memberSettingsData as MemberSettingsRow | null;

  return (
    <div>
      <h1 className="text-2xl font-black uppercase tracking-tight text-[#F5F5F5]">Profile</h1>
      <p className="mt-1 text-sm text-[#9A9A9A]">Your name, email, and weekly max hours.</p>
      <div className="mt-6">
        <ProfileForm
          email={profile.email}
          initialAvatarUrl={profile.avatar_url}
          initialFullName={profile.full_name}
          initialMaxHours={memberSettings?.max_hours ?? null}
          initialTimezone={profile.timezone}
          onSave={updateProfileAction}
          profileId={profile.id}
        />
      </div>
    </div>
  );
}

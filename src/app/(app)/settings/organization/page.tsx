import { requireAdmin } from "@/lib/auth/authorization";
import { createSupabaseServerClient } from "@/lib/supabase/server";
import { OrganizationForm } from "@/components/settings/organization-form";
import type { OrgSettingsValues } from "@/components/settings/organization-form";
import { updateOrgSettingsAction } from "@/lib/settings/organization-actions";
// STUB(agent-1): replace with the real primitives once components/ui publishes it.
import { Card, MonoText } from "@/components/settings/_stub-primitives";

export const dynamic = "force-dynamic";

type OrgSettingsRow = {
  org_name: string;
  default_shift_buffer_minutes: number;
  semester_starts_on: string | null;
  semester_ends_on: string | null;
  public_name_display: string;
};

// Literal two-line embed snippet, exactly as documented in docs/contracts/public.md section 4.
// The script src below is intentionally a placeholder host, not a real one: NEXT_PUBLIC_SITE_URL
// does not exist yet (requested in docs/contracts/requests.md, "From Agent 5"), so there is no
// environment value to read here. This block is documentation to paste elsewhere, not a live
// link, so a literal placeholder is correct until that env var ships and the real domain is
// known.
const EMBED_SNIPPET = [
  '<div id="progsu-shifts"></div>',
  '<script src="https://<deployment-host>/api/embed/widget.js" data-target="progsu-shifts" data-count="5" data-event-id="" async></script>',
].join("\n");

export default async function SettingsOrganizationPage() {
  // Admin only. Not yet in the middleware protected route list (requested in
  // docs/contracts/requests.md, "From Agent 5"), so this server-side check is defense in depth
  // until that lands, not redundant with anything upstream today.
  await requireAdmin();

  const supabase = await createSupabaseServerClient();
  const { data } = await supabase
    .from("org_settings")
    .select("org_name,default_shift_buffer_minutes,semester_starts_on,semester_ends_on,public_name_display")
    .eq("id", true)
    .maybeSingle();
  // Same select-string inference workaround as src/lib/auth/authorization.ts.
  const row = data as OrgSettingsRow | null;

  const initialValues: OrgSettingsValues = {
    orgName: row?.org_name ?? "progsu",
    defaultShiftBufferMinutes: row?.default_shift_buffer_minutes ?? 0,
    semesterStartsOn: row?.semester_starts_on ?? null,
    semesterEndsOn: row?.semester_ends_on ?? null,
    publicNameDisplay:
      (row?.public_name_display as OrgSettingsValues["publicNameDisplay"] | undefined) ?? "first_name",
  };

  return (
    <div className="flex flex-col gap-6">
      <h1 className="text-2xl font-black uppercase tracking-tight text-[#F5F5F5]">Organization</h1>

      <OrganizationForm initialValues={initialValues} onSave={updateOrgSettingsAction} />

      <Card title="Embed widget">
        <p className="text-sm text-[#9A9A9A]">
          This snippet can be pasted on any page to show upcoming shifts. Replace the placeholder
          host with the real domain once deployed.
        </p>
        <pre className="mt-4 overflow-x-auto rounded-2xl bg-[#1E1E1E] p-4">
          <MonoText className="whitespace-pre text-xs text-[#9A9A9A]">{EMBED_SNIPPET}</MonoText>
        </pre>
      </Card>
    </div>
  );
}

import { requireAdmin } from "@/lib/auth/authorization";
import { listInvitesAction } from "@/lib/settings/invite-actions";
import { InviteLinksPanel } from "@/components/settings/invite-links-panel";

export const dynamic = "force-dynamic";

export default async function SettingsInvitesPage() {
  // Admin only, same defense-in-depth pattern as /settings/roles and /settings/organization: not
  // yet in the middleware protected route list, see docs/contracts/requests.md.
  await requireAdmin();

  const invites = await listInvitesAction();

  return (
    <div className="flex flex-col gap-6">
      <div>
        <h1 className="font-display text-2xl font-bold uppercase tracking-tight text-text-primary">Invites</h1>
        <p className="mt-1 text-sm text-text-secondary">
          Create a link to grant a role. Roles are not self-service, someone with an admin-created
          link is the only way in.
        </p>
      </div>

      <InviteLinksPanel initialInvites={invites} />
    </div>
  );
}

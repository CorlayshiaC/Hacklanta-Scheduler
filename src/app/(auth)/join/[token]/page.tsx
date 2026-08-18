import { getAuthenticatedUserContext } from "@/lib/auth/authorization";
import { createSupabaseServerClient } from "@/lib/supabase/server";
import { getInviteByTokenAction, type InviteRole } from "@/lib/settings/invite-actions";
import { ContinueWithGoogleButton } from "@/components/auth/continue-with-google-button";
import { JoinWelcomeForm } from "@/components/auth/join-welcome-form";

export const dynamic = "force-dynamic";

type JoinPageProps = {
  params: Promise<{ token: string }>;
};

const ROLE_COPY: Record<InviteRole, string> = {
  admin: "as an admin",
  director: "as a director",
  member: "as a member",
};

export default async function JoinPage({ params }: JoinPageProps) {
  const { token } = await params;
  const invite = await getInviteByTokenAction(token);

  if (!invite) {
    return (
      <JoinShell>
        <p className="text-sm text-text-secondary">
          This invite link is invalid or has expired. Ask whoever sent it for a new one.
        </p>
      </JoinShell>
    );
  }

  const context = await getAuthenticatedUserContext();

  if (!context) {
    return (
      <JoinShell>
        <p className="text-sm text-text-secondary">
          You&apos;ve been invited to progsu {ROLE_COPY[invite.role]}
          {invite.eventId ? ` for one event` : ""}.
        </p>
        <ContinueWithGoogleButton next={`/join/${token}`} />
      </JoinShell>
    );
  }

  const supabase = await createSupabaseServerClient();
  const { data } = await supabase
    .from("profiles")
    .select("full_name")
    .eq("id", context.user.id)
    .maybeSingle();
  const initialFullName = (data as { full_name: string } | null)?.full_name ?? "";

  return (
    <JoinShell>
      <p className="text-sm text-text-secondary">
        {/* STUB(agent-2): role redemption is not wired up yet, see docs/contracts/pending.md.
            Honest about that rather than implying the role already took effect. */}
        Signed in. Role assignment isn&apos;t wired up yet, an admin will need to confirm your
        access once that ships. In the meantime, set your name.
      </p>
      <JoinWelcomeForm initialFullName={initialFullName} />
    </JoinShell>
  );
}

function JoinShell({ children }: { children: React.ReactNode }) {
  return (
    <main className="flex min-h-screen w-full flex-col items-center justify-center bg-app px-6">
      <div className="flex w-full max-w-xs flex-col items-center gap-6 text-center">
        <p className="font-display text-2xl font-bold uppercase tracking-tight text-text-primary">progsu</p>
        {children}
      </div>
    </main>
  );
}

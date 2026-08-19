import { getAuthenticatedUserContext } from "@/lib/auth/authorization";
import { createSupabaseServerClient } from "@/lib/supabase/server";
import { getInviteByTokenAction, type InviteRole } from "@/lib/settings/invite-actions";
import { ContinueWithGoogleButton } from "@/components/auth/continue-with-google-button";
import { JoinWelcomeForm } from "@/components/auth/join-welcome-form";
import { Card } from "@/components/ui/neu-card";
import { JoinPanel } from "./join-panel";

// V4: "no decorative shapes anywhere except the sign-in page" per the design system, so unlike
// /sign-in this page has no Hero wash/shapes treatment: a flat dark canvas plus a Card, same as
// every other non-sign-in screen. Built directly against the real design(a1) V4 primitives, no
// local stub.
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
        <JoinPanel>
          <p className="text-[13px] text-text-secondary">
            This invite link is invalid or has expired. Ask whoever sent it for a new one.
          </p>
        </JoinPanel>
      </JoinShell>
    );
  }

  const context = await getAuthenticatedUserContext();

  if (!context) {
    return (
      <JoinShell>
        <JoinPanel>
          <p className="text-[13px] text-text-secondary">
            You&apos;ve been invited to progsu {ROLE_COPY[invite.role]}
            {invite.eventId ? ` for one event` : ""}.
          </p>
          <ContinueWithGoogleButton next={`/join/${token}`} />
        </JoinPanel>
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
      <JoinPanel>
        <p className="text-[13px] text-text-secondary">
          {/* STUB(agent-2): role redemption is not wired up yet, see docs/contracts/pending.md.
              Honest about that rather than implying the role already took effect. */}
          Signed in. Role assignment isn&apos;t wired up yet, an admin will need to confirm your
          access once that ships. In the meantime, set your name.
        </p>
        <JoinWelcomeForm initialFullName={initialFullName} />
      </JoinPanel>
    </JoinShell>
  );
}

function JoinShell({ children }: { children: React.ReactNode }) {
  return (
    <main className="flex min-h-screen w-full flex-col items-center justify-center bg-surface-canvas px-6">
      <div className="w-full max-w-xs">
        <Card className="flex flex-col items-center gap-6 text-center">
          <p className="font-display text-[20px] font-medium text-text-primary">progsu</p>
          {children}
        </Card>
      </div>
    </main>
  );
}

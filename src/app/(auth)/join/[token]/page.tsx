import { getPendingUserContext } from "@/lib/auth/authorization";
import { redeemInvite } from "@/lib/invites/data";
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

  // getPendingUserContext, not getAuthenticatedUserContext: since 20260820000100 a brand-new
  // account is is_active = false until an invite is redeemed, and every other auth helper reports a
  // pending user as signed out. Using one of those here would show a signed-in visitor the
  // "Continue with Google" branch below, which sends them through Google and back to this same
  // screen, forever.
  const context = await getPendingUserContext();

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

  // Redeemed on render rather than behind an "Accept" button. This is the confirmation-link
  // pattern (the same shape as an email verification link): the click that arrived here IS the
  // acceptance, and asking someone to confirm twice on their first screen is friction with nothing
  // behind it. Safe to do on a GET because redeem_invite() is idempotent per caller as of
  // 20260820000100 -- a reload, a React double-render, or a bookmarked join URL re-opened next week
  // all resolve to the same role and cannot burn a second use of a multi-use link.
  const redemption = await redeemInvite(token);

  if (!redemption.ok) {
    return (
      <JoinShell>
        <JoinPanel>
          <p className="text-[13px] text-text-secondary">
            You&apos;re signed in, but this invite could not be redeemed: {redemption.message}. Ask
            whoever sent it for a new link.
          </p>
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
          You&apos;re in {ROLE_COPY[redemption.role]}. Set your name and you&apos;re done.
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

import { redirect } from "next/navigation";
import { SignUpForm } from "@/components/auth/sign-up-form";
import { AppShell } from "@/components/layout/app-shell";
import { getAuthenticatedUserContext } from "@/lib/auth/authorization";
import { getPostAuthPath } from "@/lib/auth/route-protection";

export const dynamic = "force-dynamic";

export default async function SignUpPage() {
  const context = await getAuthenticatedUserContext();

  if (context) {
    redirect(getPostAuthPath(context.profile.role));
  }

  return (
    <AppShell>
      <main className="mx-auto flex min-h-screen w-full max-w-md flex-col justify-center px-6 py-8">
        <p className="hl-label text-xs font-semibold">HackLanta Scheduler</p>
        <h1 className="mt-2 text-3xl font-semibold text-ink">
          Create your HackLanta Scheduler account
        </h1>
        <p className="mt-2 text-sm leading-6 text-muted">
          New accounts are created as board members. Admin access is granted separately by an
          existing admin.
        </p>
        <div className="hl-card hl-card-accent mt-5 rounded-lg p-5">
          <SignUpForm />
        </div>
      </main>
    </AppShell>
  );
}

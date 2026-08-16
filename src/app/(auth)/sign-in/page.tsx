import { redirect } from "next/navigation";
import { SignInForm } from "@/components/auth/sign-in-form";
import { AppShell } from "@/components/layout/app-shell";
import { getAuthenticatedUserContext } from "@/lib/auth/authorization";
import { getPostAuthPath } from "@/lib/auth/route-protection";

export const dynamic = "force-dynamic";

type SignInPageProps = {
  searchParams?: Promise<{
    error?: string;
  }>;
};

export default async function SignInPage({ searchParams }: SignInPageProps) {
  const context = await getAuthenticatedUserContext();
  const params = await searchParams;

  if (context) {
    redirect(getPostAuthPath(context.profile.role));
  }

  const message =
    params?.error === "inactive"
      ? "Your account is inactive. Contact a HackLanta Scheduler admin."
      : null;

  return (
    <AppShell>
      <main className="mx-auto flex min-h-screen w-full max-w-md flex-col justify-center px-6 py-8">
        <p className="hl-label text-xs font-semibold">HackLanta Scheduler</p>
        <h1 className="mt-2 text-3xl font-semibold text-ink">Sign in</h1>
        <p className="mt-2 text-sm leading-6 text-muted">
          Access the HackLanta II scheduling command center.
        </p>
        {message ? (
          <p className="mt-4 rounded-md border border-danger/35 bg-danger/10 px-3 py-2 text-sm text-danger">
            {message}
          </p>
        ) : null}
        <div className="hl-card hl-card-accent mt-5 rounded-lg p-5">
          <SignInForm />
        </div>
      </main>
    </AppShell>
  );
}

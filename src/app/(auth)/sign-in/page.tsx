import { redirect } from "next/navigation";
import { ContinueWithGoogleButton } from "@/components/auth/continue-with-google-button";
import { getAuthenticatedUserContext } from "@/lib/auth/authorization";
import { getPostAuthPath } from "@/lib/auth/route-protection";

// V2: sign-in is Google-only per _shared-context.md's V2 shared decisions ("Auth: Google sign-in
// (Supabase Google OAuth). Roles granted via invite links."), no email/password form here anymore.
// The calmest page in the app: black canvas, wordmark, one white pill, nothing else.
export const dynamic = "force-dynamic";

type SignInPageProps = {
  searchParams?: Promise<{ error?: string; next?: string }>;
};

export default async function SignInPage({ searchParams }: SignInPageProps) {
  const context = await getAuthenticatedUserContext();
  const params = await searchParams;

  if (context) {
    redirect(getPostAuthPath(context.profile.role));
  }

  const message =
    params?.error === "inactive"
      ? "Your account is inactive. Contact an admin."
      : params?.error === "oauth"
        ? "Could not sign you in with Google. Try again."
        : null;

  return (
    <main className="flex min-h-screen w-full flex-col items-center justify-center bg-app px-6">
      <div className="flex w-full max-w-xs flex-col items-center gap-8 text-center">
        <p className="font-display text-2xl font-bold uppercase tracking-tight text-text-primary">
          progsu
        </p>

        {message ? <p className="text-sm text-accent-warn">{message}</p> : null}

        <ContinueWithGoogleButton next={params?.next} />
      </div>
    </main>
  );
}

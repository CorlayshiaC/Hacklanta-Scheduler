import { redirect } from "next/navigation";
import { Hero } from "@/components/illustration/hero";
import { getAuthenticatedUserContext } from "@/lib/auth/authorization";
import { getPostAuthPath } from "@/lib/auth/route-protection";
import { SignInContent } from "./sign-in-content";

// V2: sign-in is Google-only per _shared-context.md's V2 shared decisions ("Auth: Google sign-in
// (Supabase Google OAuth). Roles granted via invite links."), no email/password form here anymore.
//
// V4: the sign-in page is the one screen the design system's "no decorative shapes anywhere except
// the sign-in page" law exempts, so it's the one call site in the app that passes `wash`/`shapes`
// to the real Hero primitive (docs/contracts/design.md, "V4: precision instrument"). Built directly
// against the real design(a1) V4 primitives and motion presets, no local stub.
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
    <main className="flex min-h-screen w-full items-center justify-center p-6">
      <Hero wash shapes className="flex w-full max-w-md flex-col items-center py-16">
        <SignInContent message={message} next={params?.next} />
      </Hero>
    </main>
  );
}

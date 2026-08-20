import { redirect } from "next/navigation";
import { getPendingUserContext } from "@/lib/auth/authorization";
import { getPostAuthPath } from "@/lib/auth/route-protection";

export const dynamic = "force-dynamic";

export default async function Home() {
  const context = await getPendingUserContext();

  if (context?.profile.is_active) {
    redirect(getPostAuthPath(context.profile.role));
  }

  // A signed-in but pending account (the state every new Google sign-in starts in as of
  // 20260820000100) needs the reason, not a bare sign-in form. Without the flag this route is a
  // loop for them: sign in -> land here -> sent to /sign-in -> sign in again.
  if (context) {
    redirect("/sign-in?error=inactive");
  }

  redirect("/sign-in");
}

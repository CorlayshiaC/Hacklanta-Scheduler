import { redirect } from "next/navigation";
import { getAuthenticatedUserContext } from "@/lib/auth/authorization";
import { getPostAuthPath } from "@/lib/auth/route-protection";

export const dynamic = "force-dynamic";

export default async function Home() {
  const context = await getAuthenticatedUserContext();

  if (context) {
    redirect(getPostAuthPath(context.profile.role));
  }

  redirect("/sign-in");
}

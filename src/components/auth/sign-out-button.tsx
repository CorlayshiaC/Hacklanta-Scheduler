import { signOutAction } from "@/lib/auth/actions";

export function SignOutButton() {
  return (
    <form action={signOutAction}>
      <button
        type="submit"
        className="hl-button-secondary rounded-md px-3 py-2 text-sm font-medium"
      >
        Sign out
      </button>
    </form>
  );
}

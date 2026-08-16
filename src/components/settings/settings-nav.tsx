import Link from "next/link";

const linkClassName =
  "rounded-lg px-3 py-2 text-sm text-zinc-300 transition hover:bg-white/5 hover:text-zinc-100";

// Active state highlighting (bolding/underlining the current section) is deferred until this
// nav moves under the real app shell primitives, which will supply its own nav affordances.
export function SettingsNav({ isAdmin }: { isAdmin: boolean }) {
  return (
    <nav className="flex flex-row gap-2 overflow-x-auto lg:flex-col lg:overflow-visible">
      <Link className={linkClassName} href="/settings">
        Profile
      </Link>
      <Link className={linkClassName} href="/settings/notifications">
        Notifications
      </Link>
      {isAdmin ? (
        <>
          <Link className={linkClassName} href="/settings/organization">
            Organization
          </Link>
          <Link className={linkClassName} href="/settings/roles">
            Roles
          </Link>
        </>
      ) : null}
    </nav>
  );
}

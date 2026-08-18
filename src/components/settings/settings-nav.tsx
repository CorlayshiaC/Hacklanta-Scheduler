import Link from "next/link";

// STUB(agent-1): pill nav items, matches the app shell's own nav treatment per
// _shared-context.md's design system section ("nav becomes a row of pill tabs"). Active state
// highlighting (a white pill for the current section) is deferred until this nav moves under the
// real app shell primitives, which will supply pathname-aware active state.
// hover:brightness-110 rather than a second background color: the shared spec's approved palette
// has no "elevated, but hovered" token, and inventing one locally is exactly what the stub
// precedent in docs/contracts/pending.md warns against.
const pillClassName =
  "rounded-full bg-[#1E1E1E] px-4 py-2 text-sm font-medium text-[#F5F5F5] transition-[filter] duration-150 ease-out hover:brightness-110";

export function SettingsNav({ isAdmin }: { isAdmin: boolean }) {
  return (
    <nav className="flex flex-row gap-2 overflow-x-auto lg:flex-col lg:overflow-visible">
      <Link className={pillClassName} href="/settings">
        Profile
      </Link>
      <Link className={pillClassName} href="/settings/notifications">
        Notifications
      </Link>
      {isAdmin ? (
        <>
          <Link className={pillClassName} href="/settings/organization">
            Organization
          </Link>
          <Link className={pillClassName} href="/settings/roles">
            Roles
          </Link>
        </>
      ) : null}
    </nav>
  );
}

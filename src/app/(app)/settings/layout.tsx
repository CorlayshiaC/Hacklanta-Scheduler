// Nested inside Agent 1's real app shell (src/app/(app)/layout.tsx), which already supplies
// sidebar/top bar/mobile tab bar chrome, full height, and outer page padding, so this layout only
// adds the settings-section sub-nav, not another page-level chrome wrapper (that was the double-
// chrome mistake Agent 1 flagged for admin/board pages in docs/contracts/requests.md, avoided here
// by not repeating a min-h-screen / max-w container of its own).
import type { ReactNode } from "react";
import { requireAuthenticatedUser } from "@/lib/auth/authorization";
import { SettingsNav } from "@/components/settings/settings-nav";
// STUB(agent-1): replace with the real primitive once components/ui publishes it.
import { Slab } from "@/components/settings/_stub-primitives";

export default async function SettingsLayout({ children }: { children: ReactNode }) {
  const { profile } = await requireAuthenticatedUser();
  const isAdmin = profile.role === "admin";

  return (
    <div className="flex flex-col gap-6 lg:flex-row lg:items-start">
      <div className="lg:w-56 lg:flex-none">
        <SettingsNav isAdmin={isAdmin} />
      </div>
      <div className="min-w-0 flex-1">
        <Slab>{children}</Slab>
      </div>
    </div>
  );
}

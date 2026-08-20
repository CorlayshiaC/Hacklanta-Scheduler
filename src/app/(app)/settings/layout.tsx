// Nested inside Agent 1's real app shell (src/app/(app)/layout.tsx), which already supplies
// sidebar/top bar/mobile tab bar chrome, full height, and outer page padding, so this layout only
// adds the settings-section sub-nav, not another page-level chrome wrapper (that was the double-
// chrome mistake Agent 1 flagged for admin/board pages in docs/contracts/requests.md, avoided here
// by not repeating a min-h-screen / max-w container of its own).
//
// No local theme plumbing needed anymore: Agent 1's real V4 dual-theme system (design(a1) "V4
// precision instrument") drives every token globally via the `data-theme` attribute the root
// layout already stamps, so this file went from owning a cookie-read/context-provider pair
// (`SettingsThemeShell`, deleted this pass) down to plain server-rendered chrome. `ThemeToggle`
// (`@/components/ui/theme-toggle`) is a self-contained client component, safe to render directly
// from this server component with no wrapper needed.
import type { ReactNode } from "react";
import { requireAuthenticatedUser } from "@/lib/auth/authorization";
import { SettingsNav } from "@/components/settings/settings-nav";
import { NeuCard as Card } from "@/components/ui/neu-card";
import { PageEntrance } from "@/components/ui/page-entrance";
import { ThemeToggle } from "@/components/ui/theme-toggle";

export default async function SettingsLayout({ children }: { children: ReactNode }) {
  const { profile } = await requireAuthenticatedUser();
  const isAdmin = profile.role === "admin";

  return (
    <div className="flex flex-col gap-6 lg:flex-row lg:items-start">
      <div className="flex flex-row items-center justify-between gap-3 lg:w-56 lg:flex-none lg:flex-col lg:items-stretch lg:gap-4">
        <SettingsNav isAdmin={isAdmin} />
        <div className="flex items-center gap-2 lg:justify-start">
          <span className="text-[11px] text-text-secondary">Theme</span>
          <ThemeToggle />
        </div>
      </div>
      {/* PageEntrance keys on the pathname, so the settings card lands once per sub-page
          navigation. Wrapping the Card rather than its contents means the card itself arrives,
          and keeping it off the nav/theme column means that chrome does not re-animate every time
          you move between settings pages. */}
      <div className="min-w-0 flex-1">
        <PageEntrance>
          <Card>{children}</Card>
        </PageEntrance>
      </div>
    </div>
  );
}

import type { ReactNode } from "react";
import { redirect } from "next/navigation";
import { Sidebar } from "@/components/layout/sidebar";
import { TopBar } from "@/components/layout/topbar";
import { MobileTabBar } from "@/components/layout/mobile-tab-bar";
import { CommandPaletteProvider, PaletteTriggerButton } from "@/components/command-palette";
import { getShellSession } from "./get-shell-session";

export default async function AppShellLayout({ children }: { children: ReactNode }) {
  const session = await getShellSession();

  if (!session) {
    redirect("/sign-in");
  }

  return (
    <CommandPaletteProvider role={session.role}>
      <div className="flex min-h-screen bg-bg-base">
        <Sidebar role={session.role} />
        <div className="flex min-h-screen flex-1 flex-col">
          <TopBar paletteSlot={<PaletteTriggerButton />} />
          <main className="flex-1 px-4 pb-20 pt-6 md:px-8 md:pb-10">
            <div className="mx-auto w-full max-w-6xl">{children}</div>
          </main>
        </div>
        <MobileTabBar role={session.role} />
      </div>
    </CommandPaletteProvider>
  );
}

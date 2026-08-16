import type { ReactNode } from "react";
import { signOutAction } from "@/lib/auth/actions";
import { NeuButton } from "@/components/ui/neu-button";

export type TopBarProps = {
  /** Agent 6 mounts the Cmd+K palette trigger here. */
  paletteSlot?: ReactNode;
  /** Agent 2 mounts the notification center here. */
  notificationSlot?: ReactNode;
};

export function TopBar({ paletteSlot, notificationSlot }: TopBarProps) {
  return (
    <header className="flex h-16 items-center justify-between gap-3 border-b border-hairline bg-bg-base px-4 md:px-6">
      <div className="flex-1">{paletteSlot}</div>
      <div className="flex items-center gap-2">
        {notificationSlot}
        <form action={signOutAction}>
          <NeuButton type="submit" variant="ghost" size="sm">
            Sign out
          </NeuButton>
        </form>
      </div>
    </header>
  );
}

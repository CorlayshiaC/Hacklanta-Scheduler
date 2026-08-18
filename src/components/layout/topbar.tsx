import type { ReactNode, SVGAttributes } from "react";
import { signOutAction } from "@/lib/auth/actions";
import { IconButton } from "@/components/ui/icon-button";

export type TopBarProps = {
  /** Agent 6 mounts the Cmd+K palette trigger here. */
  paletteSlot?: ReactNode;
  /** Agent 2 mounts the notification center here. */
  notificationSlot?: ReactNode;
};

function SignOutIcon(props: SVGAttributes<SVGSVGElement>) {
  return (
    <svg
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth={2}
      strokeLinecap="round"
      strokeLinejoin="round"
      {...props}
    >
      <path d="M9 21H5a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h4" />
      <path d="M16 17l5-5-5-5" />
      <path d="M21 12H9" />
    </svg>
  );
}

export function TopBar({ paletteSlot, notificationSlot }: TopBarProps) {
  return (
    <header className="flex h-16 items-center justify-between gap-3 border-b border-hairline bg-app px-4 md:px-6">
      <div className="flex-1">{paletteSlot}</div>
      <div className="flex items-center gap-2">
        {notificationSlot}
        <form action={signOutAction}>
          <IconButton aria-label="Sign out" type="submit" variant="ghost">
            <SignOutIcon aria-hidden className="h-4 w-4" />
          </IconButton>
        </form>
      </div>
    </header>
  );
}

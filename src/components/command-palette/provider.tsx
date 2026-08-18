"use client";

import { createContext, useCallback, useContext, useMemo, useState, type ReactNode } from "react";
import { useRouter } from "next/navigation";
import { CommandPalette } from "@/components/command-palette/command-palette";
import { useCommands } from "@/components/command-palette/registry";
import { useGlobalHotkeys } from "@/components/command-palette/use-hotkeys";
import { NeuBadge } from "@/components/ui/neu-badge";
import type { Command, CommandContext, Role } from "@/components/command-palette/types";

type PaletteMode = "commands" | "search" | "nl";

type Controls = {
  open: (initialMode?: PaletteMode) => void;
  close: () => void;
};

const ControlsContext = createContext<Controls | null>(null);

/** For a mount point outside the provider tree, e.g. Agent 1's top-bar trigger button, to open
 * the palette programmatically. Must be called from a descendant of CommandPaletteProvider. */
export function useCommandPaletteControls(): Controls {
  const ctx = useContext(ControlsContext);
  if (!ctx) {
    throw new Error("useCommandPaletteControls must be called inside CommandPaletteProvider.");
  }
  return ctx;
}

/** Mount once near the root, inside the app shell, with the current user's role. See
 * docs/contracts/command-palette.md for where role comes from today (app_role is still
 * admin | board_member, map it here) and how other agents register their own commands. */
export function CommandPaletteProvider({ role, children }: { role: Role; children: ReactNode }) {
  const router = useRouter();
  const commands = useCommands();
  const [isOpen, setIsOpen] = useState(false);
  const [initialMode, setInitialMode] = useState<PaletteMode>("commands");
  // Bumped on every open() so <CommandPalette key={openKey}> remounts fresh (query, activeIndex,
  // mode reset to initialMode) instead of resetting that state via an effect.
  const [openKey, setOpenKey] = useState(0);

  const open = useCallback((mode: PaletteMode = "commands") => {
    setInitialMode(mode);
    setIsOpen(true);
    setOpenKey((key) => key + 1);
  }, []);
  const close = useCallback(() => setIsOpen(false), []);

  const ctx = useMemo<CommandContext>(
    () => ({ role, navigate: (href: string) => router.push(href) }),
    [role, router],
  );

  const runCommand = useCallback((command: Command) => void command.perform(ctx), [ctx]);

  useGlobalHotkeys({
    isPaletteOpen: isOpen,
    commands,
    onOpenPalette: () => open("commands"),
    onFocusSearch: () => open("search"),
    onRunCommand: runCommand,
  });

  const controls = useMemo<Controls>(() => ({ open, close }), [open, close]);

  return (
    <ControlsContext.Provider value={controls}>
      {children}
      <CommandPalette
        key={openKey}
        isOpen={isOpen}
        onClose={close}
        commands={commands}
        ctx={ctx}
        initialMode={initialMode}
      />
    </ControlsContext.Provider>
  );
}

/** Fills Agent 1's TopBar paletteSlot: `<TopBar paletteSlot={<PaletteTriggerButton />} />`, inside
 * a tree wrapped by CommandPaletteProvider. See docs/contracts/command-palette.md. */
export function PaletteTriggerButton() {
  const { open } = useCommandPaletteControls();

  return (
    <button
      type="button"
      onClick={() => open("commands")}
      className="flex w-full max-w-sm items-center justify-between gap-3 rounded-pill bg-elevated px-3 py-1.5 text-sm text-text-muted transition-colors duration-fast ease-neu-out hover:text-text-secondary focus-visible:shadow-focus-ring"
    >
      <span>Search or run a command.</span>
      <NeuBadge className="font-mono text-[10px]">⌘K</NeuBadge>
    </button>
  );
}

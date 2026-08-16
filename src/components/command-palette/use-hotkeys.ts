"use client";

import { useEffect, useRef } from "react";
import type { Command } from "@/components/command-palette/types";

const CHORD_TIMEOUT_MS = 900;

function isEditableTarget(target: EventTarget | null): boolean {
  if (!(target instanceof HTMLElement)) {
    return false;
  }
  return target.tagName === "INPUT" || target.tagName === "TEXTAREA" || target.isContentEditable;
}

function sequenceMatches(shortcut: string[], sequence: string[]): boolean {
  return shortcut.length === sequence.length && shortcut.every((key, index) => key === sequence[index]);
}

/**
 * Global: Cmd/Ctrl+K always opens the palette, even while typing. Everything else (bare "/" and
 * registered single-key or two-key chord shortcuts) is suppressed while an editable element has
 * focus or the palette is already open, the palette owns its own keyboard handling while open.
 */
export function useGlobalHotkeys(opts: {
  isPaletteOpen: boolean;
  commands: Command[];
  onOpenPalette: () => void;
  onFocusSearch: () => void;
  onRunCommand: (command: Command) => void;
}) {
  const { isPaletteOpen, commands, onOpenPalette, onFocusSearch, onRunCommand } = opts;
  const pendingKeyRef = useRef<{ key: string; expiresAtMs: number } | null>(null);

  useEffect(() => {
    function onKeyDown(event: KeyboardEvent) {
      const isModified = event.metaKey || event.ctrlKey || event.altKey;

      if ((event.metaKey || event.ctrlKey) && event.key.toLowerCase() === "k") {
        event.preventDefault();
        onOpenPalette();
        return;
      }

      if (isPaletteOpen || isModified || isEditableTarget(event.target)) {
        return;
      }

      if (event.key === "/") {
        event.preventDefault();
        onFocusSearch();
        return;
      }

      const nowMs = Date.now();
      const pending = pendingKeyRef.current;

      if (pending && nowMs < pending.expiresAtMs) {
        pendingKeyRef.current = null;
        const sequence = [pending.key, event.key];
        const match = commands.find((command) => command.shortcut && sequenceMatches(command.shortcut, sequence));
        if (match) {
          event.preventDefault();
          onRunCommand(match);
        }
        return;
      }

      const single = commands.find(
        (command) => command.shortcut?.length === 1 && command.shortcut[0] === event.key,
      );
      if (single) {
        event.preventDefault();
        onRunCommand(single);
        return;
      }

      const chordStarters = new Set(
        commands.filter((command) => command.shortcut?.length === 2).map((command) => command.shortcut![0]),
      );
      if (chordStarters.has(event.key)) {
        pendingKeyRef.current = { key: event.key, expiresAtMs: nowMs + CHORD_TIMEOUT_MS };
      }
    }

    window.addEventListener("keydown", onKeyDown);
    return () => window.removeEventListener("keydown", onKeyDown);
  }, [isPaletteOpen, commands, onOpenPalette, onFocusSearch, onRunCommand]);
}

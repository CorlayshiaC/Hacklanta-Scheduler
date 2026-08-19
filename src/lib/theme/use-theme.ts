"use client";

import { useCallback, useEffect, useState } from "react";
import { startThemeTransition } from "@/lib/utils/motion";
import { updateProfileThemeAction } from "@/lib/settings/theme-actions";
import type { ProfileTheme } from "@/lib/settings/theme";

/**
 * Owned by Agent 1. Theme architecture for the V4 dual-theme system: dark is the default and the
 * showcase, light is opt-in (flipped from V3, where light was the default: see
 * docs/contracts/design.md "V4: precision instrument"). Persisted two ways: localStorage for the
 * instant/offline/pre-hydration read, and profiles.theme (Agent 2, src/lib/settings/theme*.ts) for
 * the per-account, cross-device source of truth the root layout reads server-side.
 *
 * Known gap, not mine to fix: profiles.theme's column default and Agent 2's DEFAULT_PROFILE_THEME
 * both still default to 'light', a V3 leftover. Every signed-in member renders light server-side
 * until that flips, tracked in docs/contracts/requests.md. This file already treats "dark" as the
 * client-side default (readStoredTheme, THEME_INIT_SCRIPT) for the signed-out/pre-account case.
 */

export type Theme = ProfileTheme;

const STORAGE_KEY = "ps-theme";

function readStoredTheme(): Theme {
  if (typeof window === "undefined") return "dark";
  return window.localStorage.getItem(STORAGE_KEY) === "light" ? "light" : "dark";
}

export function useTheme(): {
  theme: Theme;
  setTheme: (next: Theme) => void;
  toggleTheme: () => void;
} {
  // Starts "dark" to match the server-rendered fallback markup (tokens.css's bare :root is dark),
  // then syncs on mount from whichever the DOM attribute already reflects (the root layout stamped
  // it from profiles.theme for a signed-in member, THEME_INIT_SCRIPT stamped it from localStorage
  // otherwise), so this state never fights what already painted.
  const [theme, setThemeState] = useState<Theme>("dark");

  useEffect(() => {
    const domTheme = document.documentElement.getAttribute("data-theme");
    const resolved = domTheme === "light" ? "light" : domTheme === "dark" ? "dark" : readStoredTheme();
    // Syncing from an external system (the DOM attribute the server/init script already painted)
    // into React state after mount is the sanctioned case this rule allows for; starting at "dark"
    // and correcting here is what avoids a hydration mismatch, see the comment above.
    // eslint-disable-next-line react-hooks/set-state-in-effect
    setThemeState(resolved);
    window.localStorage.setItem(STORAGE_KEY, resolved);
  }, []);

  const applyTheme = useCallback((next: Theme) => {
    // Always an explicit value, never removed: tokens.css keys dark off both a bare :root and
    // :root[data-theme="dark"], so "dark" here is redundant with the CSS default but keeps every
    // consumer that reads the attribute directly (this hook's own sync above, a hypothetical
    // Tailwind dark: variant) unambiguous rather than depending on attribute absence.
    document.documentElement.setAttribute("data-theme", next);
    window.localStorage.setItem(STORAGE_KEY, next);
    setThemeState(next);
  }, []);

  const setTheme = useCallback(
    (next: Theme) => {
      startThemeTransition(() => applyTheme(next));
      // Fire-and-forget: the theme already applied optimistically above. A signed-out caller (no
      // session) or a network failure just means this device's choice doesn't follow the account
      // yet; localStorage still makes it stick on this device, so there is nothing to roll back.
      void updateProfileThemeAction(next).catch(() => {});
    },
    [applyTheme],
  );

  const toggleTheme = useCallback(() => {
    setTheme(theme === "dark" ? "light" : "dark");
  }, [theme, setTheme]);

  return { theme, setTheme, toggleTheme };
}

/**
 * Inline script text: inject via <script dangerouslySetInnerHTML> as the first thing in <head> in
 * the root layout, before any content paints. Skips entirely if the server already stamped
 * data-theme from profiles.theme (a signed-in member); otherwise reads the same localStorage key
 * useTheme does, so a signed-out visitor's local choice still applies before first paint.
 * Deliberately does not read prefers-color-scheme: dark is the product's default regardless of OS
 * theme, per the shared design spec, not a system-matching default.
 */
export const THEME_INIT_SCRIPT = `(function(){try{var el=document.documentElement;if(el.getAttribute("data-theme"))return;if(window.localStorage.getItem(${JSON.stringify(
  STORAGE_KEY,
)})==="light"){el.setAttribute("data-theme","light");}}catch(e){}})();`;

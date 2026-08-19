"use client";

import { useCallback, useEffect, useState } from "react";
import { startThemeTransition } from "@/lib/utils/motion";
import { updateProfileThemeAction } from "@/lib/settings/theme-actions";
import type { ProfileTheme } from "@/lib/settings/theme";

/**
 * Owned by Agent 1. Theme architecture for the V3 dual-theme glass system: light is the default,
 * dark is opt-in. Persisted two ways: localStorage for the instant/offline/pre-hydration read, and
 * profiles.theme (Agent 2, src/lib/settings/theme*.ts) for the per-account, cross-device source of
 * truth that the root layout reads server-side. See docs/contracts/design.md "V3: dual-theme
 * glass".
 */

export type Theme = ProfileTheme;

const STORAGE_KEY = "ps-theme";

function readStoredTheme(): Theme {
  if (typeof window === "undefined") return "light";
  return window.localStorage.getItem(STORAGE_KEY) === "dark" ? "dark" : "light";
}

export function useTheme(): {
  theme: Theme;
  setTheme: (next: Theme) => void;
  toggleTheme: () => void;
} {
  // Starts "light" to match the server-rendered fallback markup, then syncs on mount from
  // whichever the DOM attribute already reflects (the root layout stamped it from profiles.theme
  // for a signed-in member, THEME_INIT_SCRIPT stamped it from localStorage otherwise), so this
  // state never fights what already painted.
  const [theme, setThemeState] = useState<Theme>("light");

  useEffect(() => {
    const domTheme = document.documentElement.getAttribute("data-theme");
    const resolved = domTheme === "dark" ? "dark" : domTheme === "light" ? "light" : readStoredTheme();
    // Syncing from an external system (the DOM attribute the server/init script already painted)
    // into React state after mount is the sanctioned case this rule allows for; starting at
    // "light" and correcting here is what avoids a hydration mismatch, see the comment above.
    // eslint-disable-next-line react-hooks/set-state-in-effect
    setThemeState(resolved);
    window.localStorage.setItem(STORAGE_KEY, resolved);
  }, []);

  const applyTheme = useCallback((next: Theme) => {
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
 * useTheme does, so a signed-out visitor's local choice (or a signed-in member's very first load
 * before this device has a cookie session yet) still applies before first paint. Deliberately does
 * not read prefers-color-scheme: light is the product's default regardless of OS theme, per the
 * shared design spec, not a system-matching default.
 */
export const THEME_INIT_SCRIPT = `(function(){try{var el=document.documentElement;if(el.getAttribute("data-theme"))return;if(window.localStorage.getItem(${JSON.stringify(
  STORAGE_KEY,
)})==="dark"){el.setAttribute("data-theme","dark");}}catch(e){}})();`;

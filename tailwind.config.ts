import type { Config } from "tailwindcss";

/**
 * Owned by Agent 1 (Foundation and Design System). Colors, radii, blur, and shadow read from the
 * CSS custom properties in src/styles/tokens.css, that file is the single source of truth, this is
 * just the Tailwind-facing mapping. No other agent should add colors here or in tokens.css;
 * request additions via docs/contracts/requests.md.
 *
 * 2026-08-19 V4 redesign ("precision instrument"): replaces the V3 dual-theme glass system with a
 * flatter, sleeker one, dark default. Every utility class name from V1 through V3 keeps resolving,
 * repointed at the new tokens, same zero-forced-edits migration strategy as every prior redesign.
 * The one visually loud consequence: `rounded-pill` now resolves to a 6px control radius instead
 * of a 999px stadium, so every existing button/badge/chip/tab/toggle across the other five agents'
 * already-shipped files flattens automatically. Avatars are unaffected: `avatar.tsx` uses the raw
 * Tailwind `rounded-full` utility, not `rounded-pill`, matching the spec's "radius-pill reserved
 * for avatars only" intent without needing an explicit exception here. See
 * docs/contracts/design.md "V4: precision instrument" for the full token table and class-alias
 * table, and docs/contracts/motion-spec.md for the timing tokens surfaced under `theme.extend`
 * below (durations/easings only; springs live in `lib/utils/motion.ts` since Tailwind has no
 * spring primitive).
 */

/**
 * Resolves to rgb(var(--x-rgb) / <alpha-value>) so opacity modifiers (bg-accent-primary/10,
 * border-accent-warn/40, ...) work. Plain var(--x) breaks opacity modifiers, Tailwind can't inject
 * an alpha channel into an opaque CSS variable at build time and silently emits no class, verified
 * empirically. The "<alpha-value>" placeholder is Tailwind's own substitution syntax (a plain
 * string, not a function: the function form is accepted at runtime but isn't accepted by
 * tailwindcss's own Config type), Tailwind replaces it with the opacity modifier or "1". Requires
 * a matching "--x-rgb: R G B" (space separated, no rgb() wrapper) variable in tokens.css.
 */
function withOpacity(variableRgb: string): string {
  return `rgb(var(${variableRgb}) / <alpha-value>)`;
}

const config: Config = {
  darkMode: ["selector", '[data-theme="dark"]'],
  content: ["./src/**/*.{js,ts,jsx,tsx,mdx}"],
  theme: {
    extend: {
      colors: {
        // ---- V4 canonical surface names. surface-card/surface-elevated are flat opaque colors
        // now (no alpha baked in), resolved via plain var() same as border-hairline: no opacity-
        // modifier support, matching the precedent rather than adding -rgb siblings nothing needs
        // yet. surface-canvas keeps its -rgb sibling (chrome bars use bg-surface-canvas/NN).
        "surface-canvas": withOpacity("--surface-canvas-rgb"),
        "surface-card": "var(--surface-card)",
        "surface-elevated": "var(--surface-elevated)",
        // Back-compat only: V3 code that referenced the "no-blur-support fallback" variant. Both
        // now equal their non-solid counterpart, nothing is translucent in V4.
        "surface-card-solid": "var(--surface-card-solid)",
        "surface-elevated-solid": "var(--surface-elevated-solid)",

        // ---- Back-compat: V1-era flat-system surface names.
        app: withOpacity("--surface-canvas-rgb"),
        card: "var(--surface-card)",
        elevated: "var(--surface-elevated)",
        bg: {
          base: withOpacity("--surface-canvas-rgb"),
          surface: "var(--surface-card)",
          sunken: "var(--surface-elevated)",
        },

        // ---- V4 canonical accents. See tokens.css header for the fill-vs-glow split rationale
        // (retuned this pass with an actual computed WCAG ratio for every pair, not eyeballed).
        "accent-primary": withOpacity("--accent-primary-rgb"),
        "accent-primary-glow": withOpacity("--accent-primary-glow-rgb"),
        "accent-warn": withOpacity("--accent-warn-rgb"),
        // V4.1 "champagne" addendum: warn-hot is reserved for exactly three urgent states (see
        // tokens.css), warn-pale is a light-theme-only solid pale fill, not yet consumed anywhere.
        "accent-warn-hot": withOpacity("--accent-warn-hot-rgb"),
        "accent-warn-pale": withOpacity("--accent-warn-pale-rgb"),
        "accent-warn-fill": withOpacity("--accent-warn-fill-rgb"),
        "accent-delta": withOpacity("--accent-delta-rgb"),
        delta: "var(--accent-delta-text)", // readable delta-numeral text color, solid, no opacity modifier
        "on-accent": withOpacity("--on-accent-rgb"),

        // ---- Back-compat: old accent-go/pill-white/danger/warning/purple-400/500 all still
        // resolve, same mapping as V3 (accent-go/pill-white -> the fill-safe accent-primary value,
        // danger/warning -> accent-warn). See docs/contracts/design.md "V4 migration strategy".
        "accent-go": withOpacity("--accent-primary-rgb"),
        "pill-white": withOpacity("--accent-primary-rgb"),
        purple: {
          400: withOpacity("--accent-primary-rgb"),
          500: withOpacity("--accent-primary-rgb"),
        },
        danger: withOpacity("--accent-warn-rgb"),
        warning: withOpacity("--accent-warn-rgb"),

        text: {
          primary: withOpacity("--text-primary-rgb"),
          secondary: withOpacity("--text-secondary-rgb"),
          muted: withOpacity("--text-secondary-rgb"), // no separate muted token since V3, see design.md
        },
        hairline: "var(--border-hairline)",

        // ---- V4 new: the one gradient panel per view, and the active-nav tint. Both consumed as
        // plain CSS custom properties rather than Tailwind color utilities, see globals.css's
        // .gradient-panel class and the sidebar's layoutId tint element, because a two-stop
        // gradient and a fixed-alpha tint aren't expressible as a single Tailwind color token.
      },
      borderRadius: {
        card: "var(--radius-card)",
        control: "var(--radius-control)",
        pill: "var(--radius-pill)", // V4: resolves to the 6px control radius, see file header
        // Back-compat: V1/V2 names.
        neu: "var(--radius-card)",
        "neu-lg": "var(--radius-card)",
        "neu-sm": "var(--radius-pill)",
      },
      backdropBlur: {
        glass: "var(--blur-glass)", // the floating-layer exception only: palette/dialog/popover scrims
      },
      boxShadow: {
        "focus-ring": "0 0 0 2px var(--surface-card-solid), 0 0 0 4px rgb(var(--accent-primary-rgb))",
        "neu-focus": "0 0 0 2px var(--surface-card-solid), 0 0 0 4px rgb(var(--accent-primary-rgb))",
        // V4: glow budget is zero by default, soft/glow are both opt-in utilities, never applied
        // to a primitive's default state (see neu-card.tsx: shadow-soft is now the ambient 1px/2px
        // card shadow, not a lift shadow; shadow-glow is reserved for the gradient panel and the
        // AI reveal moment).
        soft: "var(--shadow-soft)",
        glow: "var(--shadow-glow)",
      },
      fontFamily: {
        sans: ["var(--font-geist-sans)", "Inter", "ui-sans-serif", "system-ui", "sans-serif"],
        mono: ["var(--font-geist-mono)", "JetBrains Mono", "ui-monospace", "monospace"],
        display: ["var(--font-display)", "Inter", "ui-sans-serif", "system-ui", "sans-serif"],
      },
      transitionDuration: {
        fast: "120ms",
        base: "200ms",
        // V4 motion-spec.md section 1 timing tokens, Tailwind-facing (springs are JS-only, see
        // lib/utils/motion.ts; these cover the plain-CSS ease-out cases: opacity, color, underline).
        "ease-fast": "140ms",
        "ease-slow": "240ms",
      },
      transitionTimingFunction: {
        "neu-out": "cubic-bezier(0.16, 1, 0.3, 1)", // legacy V2/V3 ease, still used by a few untouched primitives
        "out-fast": "cubic-bezier(0.22, 1, 0.36, 1)",
      },
    },
  },
  plugins: [],
};

export default config;

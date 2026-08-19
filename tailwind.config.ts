import type { Config } from "tailwindcss";

/**
 * Owned by Agent 1 (Foundation and Design System). Colors, radii, blur, and shadow read from the
 * CSS custom properties in src/styles/tokens.css, that file is the single source of truth, this is
 * just the Tailwind-facing mapping. No other agent should add colors here or in tokens.css;
 * request additions via docs/contracts/requests.md.
 *
 * 2026-08-19 V3 redesign: dual-theme aurora/midnight glass replaces the flat true-black pill/bento
 * system. Every OLD utility class name from both the v1 and v2 systems keeps resolving, now
 * pointed at the new glass tokens, so every already-shipped file across the other five agents
 * repaints into the new look automatically with zero required edits, same migration strategy as
 * the prior redesign. New canonical V3 names are additive. See docs/contracts/design.md "V3:
 * dual-theme glass" for the full token table, the accent fill-vs-glow split, and the exact
 * class-name alias table.
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
        // ---- V3 canonical surface names ----
        "surface-canvas": withOpacity("--surface-canvas-rgb"),
        // Glass surfaces: alpha is baked into the CSS var itself (see tokens.css header), so these
        // resolve straight from var(--x), same pattern as border-hairline. No opacity-modifier
        // support (bg-surface-card/40 will not work); use surface-card-solid for an opaque variant.
        "surface-card": "var(--surface-card)",
        "surface-card-solid": "var(--surface-card-solid)",
        "surface-elevated": "var(--surface-elevated)",
        "surface-elevated-solid": "var(--surface-elevated-solid)",

        // ---- Back-compat: old flat-system surface names now resolve to the glass tokens above.
        app: withOpacity("--surface-canvas-rgb"),
        card: "var(--surface-card)",
        elevated: "var(--surface-elevated)",
        bg: {
          base: withOpacity("--surface-canvas-rgb"),
          surface: "var(--surface-card)",
          sunken: "var(--surface-elevated)",
        },

        // ---- V3 canonical accents. See tokens.css header for the fill-vs-glow split rationale.
        "accent-primary": withOpacity("--accent-primary-rgb"),
        "accent-primary-glow": withOpacity("--accent-primary-glow-rgb"),
        "accent-warn": withOpacity("--accent-warn-rgb"),
        "accent-warn-fill": withOpacity("--accent-warn-fill-rgb"),
        "accent-delta": withOpacity("--accent-delta-rgb"),
        delta: "var(--accent-delta-text)", // readable delta-numeral text color, solid, no opacity modifier
        "on-accent": withOpacity("--on-accent-rgb"),

        // ---- Back-compat: old accent-go/pill-white/danger/warning/purple-400/500 all still
        // resolve. accent-go -> the fill-safe accent-primary value (not accent-primary-glow), so
        // every existing solid-fill usage (StatusPill "approved", PillButton "primary", the
        // sidebar's active nav pill, NeuToggle's checked track) stays AA-compliant with white
        // on-accent text with zero call-site changes. pill-white folds into the same fill-safe
        // purple: the old "white selection pill" concept is retired in V3 (the shared spec doesn't
        // call for a third neutral accent, and "at most two accents per view" already covers
        // purple/orange), so what used to render as a white chip now renders as a purple one,
        // which is exactly the "primary/selected" semantic in the new system. NeuToggle's thumb
        // (a literal switch knob, not a semantic pill) is fixed separately to a plain white so it
        // never disappears into a purple track, see neu-toggle.tsx.
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
          // text-muted has no token in V3 (it failed the contrast floor in the prior system and
          // nothing used it correctly); back-compat resolves it to text-secondary, the safe floor.
          muted: withOpacity("--text-secondary-rgb"),
        },
        hairline: "var(--border-hairline)",
      },
      borderRadius: {
        card: "var(--radius-card)",
        pill: "var(--radius-pill)",
        neu: "var(--radius-card)",
        "neu-lg": "var(--radius-card)",
        "neu-sm": "var(--radius-pill)",
      },
      backdropBlur: {
        glass: "var(--blur-glass)",
      },
      boxShadow: {
        "focus-ring": "0 0 0 2px var(--surface-card-solid), 0 0 0 4px rgb(var(--accent-primary-rgb))",
        "neu-focus": "0 0 0 2px var(--surface-card-solid), 0 0 0 4px rgb(var(--accent-primary-rgb))",
        // V3: real elevation is back, glass needs it. soft = diffuse ambient (light) / purple-tinted
        // (dark); glow = the tighter purple-tinted lift shadow for hoverLift and pressed states.
        soft: "var(--shadow-soft)",
        glow: "var(--shadow-glow)",
      },
      fontFamily: {
        sans: ["var(--font-geist-sans)", "Inter", "ui-sans-serif", "system-ui", "sans-serif"],
        mono: ["var(--font-geist-mono)", "JetBrains Mono", "ui-monospace", "monospace"],
        // Friendly geometric display face for page titles, heroes, and hero stat numerals. See
        // docs/contracts/design.md "Type".
        display: ["var(--font-display)", "Inter", "ui-sans-serif", "system-ui", "sans-serif"],
      },
      transitionDuration: {
        fast: "120ms",
        base: "200ms",
      },
      transitionTimingFunction: {
        "neu-out": "cubic-bezier(0.16, 1, 0.3, 1)",
      },
    },
  },
  plugins: [],
};

export default config;

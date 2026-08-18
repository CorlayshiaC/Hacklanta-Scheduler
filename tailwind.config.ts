import type { Config } from "tailwindcss";

/**
 * Owned by Agent 1 (Foundation and Design System). Colors and radii read from the CSS custom
 * properties in src/styles/tokens.css, that file is the single source of truth, this is just the
 * Tailwind-facing mapping. No other agent should add colors here or in tokens.css; request
 * additions via docs/contracts/requests.md.
 *
 * 2026-08-17 UI redesign: replaces the neumorphic dark-purple palette wholesale with a flat
 * true-black pill/bento language, see docs/audit.md and docs/contracts/design.md. Every neu
 * shadow utility and the coverage purple ramp are deleted outright (no shadows, no ramp, in the
 * new system, dropping them is correct, not a regression). Surface, accent, and radius utilities
 * keep their OLD class names as aliases onto the new tokens (bg-bg-surface, text-danger,
 * rounded-neu, ...) alongside new canonical names (bg-card, text-accent-warn, rounded-card, ...),
 * so the ~20 files across Agents 2 through 6 that already reference the old raw utility classes
 * repaint into the new look automatically with zero required edits on their side. See the design
 * contract's "Migration strategy" section for the full rationale and the exact alias table.
 */

/**
 * Resolves to rgb(var(--x-rgb) / <alpha-value>) so opacity modifiers (bg-accent-go/10,
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
  content: ["./src/**/*.{js,ts,jsx,tsx,mdx}"],
  theme: {
    extend: {
      colors: {
        // Canonical surface names.
        app: withOpacity("--bg-app-rgb"),
        card: withOpacity("--bg-card-rgb"),
        elevated: withOpacity("--bg-elevated-rgb"),
        // Back-compat: old nested bg.base/surface/sunken -> bg-bg-base/bg-bg-surface/bg-bg-sunken.
        bg: {
          base: withOpacity("--bg-app-rgb"),
          surface: withOpacity("--bg-card-rgb"),
          sunken: withOpacity("--bg-elevated-rgb"),
        },

        // Canonical accents. Exactly two, both semantic.
        "accent-go": withOpacity("--accent-go-rgb"),
        "accent-warn": withOpacity("--accent-warn-rgb"),
        "pill-white": withOpacity("--pill-white-rgb"),
        "on-accent": withOpacity("--on-accent-rgb"),
        // Back-compat: old purple-400/500 both collapse onto the single accent-go purple, old
        // danger/warning both collapse onto accent-warn orange (design.md "Danger folds into warn").
        purple: {
          400: withOpacity("--accent-go-rgb"),
          500: withOpacity("--accent-go-rgb"),
        },
        danger: withOpacity("--accent-warn-rgb"),
        warning: withOpacity("--accent-warn-rgb"),

        text: {
          primary: withOpacity("--text-primary-rgb"),
          secondary: withOpacity("--text-secondary-rgb"),
          muted: withOpacity("--text-muted-rgb"),
        },
        hairline: "var(--border-hairline)",
      },
      borderRadius: {
        card: "var(--radius-card)",
        pill: "var(--radius-pill)",
        // Back-compat: old rounded-neu/-lg (large card radius) and rounded-neu-sm (small control
        // radius) both had one radius each; rounded-neu-sm now resolves to the full pill radius
        // since small controls (inputs, badges, buttons) are pills in the new system, not
        // small-radius rectangles.
        neu: "var(--radius-card)",
        "neu-lg": "var(--radius-card)",
        "neu-sm": "var(--radius-pill)",
      },
      boxShadow: {
        // The only shadow utility that survives the redesign: it is a focus ring (a hard-edged
        // double ring via box-shadow), not an elevation shadow, so it belongs in a flat system.
        // "focus-ring" is the canonical name, "neu-focus" is kept as an alias so every existing
        // focus-visible:shadow-neu-focus className keeps working unchanged.
        "focus-ring": "0 0 0 2px var(--bg-card), 0 0 0 4px rgb(var(--accent-go-rgb))",
        "neu-focus": "0 0 0 2px var(--bg-card), 0 0 0 4px rgb(var(--accent-go-rgb))",
        // Deliberately no neu-raised/-sm/-lg/-pressed/-glow/-floating alias: those encoded
        // neumorphic elevation, which has no equivalent here. Any leftover raw usage of those
        // class names now resolves to no box-shadow, which is the correct flat-design outcome.
      },
      fontFamily: {
        sans: ["var(--font-geist-sans)", "Inter", "ui-sans-serif", "system-ui", "sans-serif"],
        mono: ["var(--font-geist-mono)", "JetBrains Mono", "ui-monospace", "monospace"],
        // Bold condensed uppercase display face for page titles, hero numerals, card overline
        // titles. See docs/contracts/design.md "Type" for why Space Grotesk over Archivo Black.
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

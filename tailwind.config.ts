import type { Config } from "tailwindcss";

/**
 * Owned by Agent 1 (Foundation and Design System). Colors and shadows read from the CSS custom
 * properties in src/styles/tokens.css, that file is the single source of truth, this is just the
 * Tailwind-facing mapping. No other agent should add colors or shadows here or in tokens.css;
 * request additions via docs/contracts/requests.md.
 *
 * Replaces the prior hacker-theme palette (ink/muted/field/panel/elevated/signal/electric/pulse)
 * wholesale, see docs/audit.md. Feature code still referencing those class names renders unstyled
 * (not a build break) until each owning agent restyles against the tokens below, see
 * docs/contracts/requests.md.
 */

/**
 * Resolves to rgb(var(--x-rgb) / <alpha-value>) so opacity modifiers (bg-purple-500/10,
 * border-danger/40, ...) work. Plain var(--x) breaks opacity modifiers, Tailwind can't inject an
 * alpha channel into an opaque CSS variable at build time and silently emits no class, verified
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
        bg: {
          base: withOpacity("--bg-base-rgb"),
          surface: withOpacity("--bg-surface-rgb"),
          sunken: withOpacity("--bg-sunken-rgb"),
        },
        purple: {
          400: withOpacity("--purple-400-rgb"),
          500: withOpacity("--purple-500-rgb"),
        },
        "purple-glow": "var(--purple-glow)",
        text: {
          primary: withOpacity("--text-primary-rgb"),
          secondary: withOpacity("--text-secondary-rgb"),
          muted: withOpacity("--text-muted-rgb"),
        },
        hairline: "var(--border-hairline)",
        warning: withOpacity("--warning-rgb"),
        danger: withOpacity("--danger-rgb"),
        coverage: {
          0: "var(--coverage-0)",
          1: "var(--coverage-1)",
          2: "var(--coverage-2)",
          3: "var(--coverage-3)",
          4: "var(--coverage-4)",
        },
      },
      borderRadius: {
        neu: "var(--radius-md)",
        "neu-sm": "var(--radius-sm)",
        "neu-lg": "var(--radius-lg)",
      },
      boxShadow: {
        "neu-raised": "-4px -4px 10px var(--shadow-light), 6px 6px 16px var(--shadow-dark)",
        "neu-raised-sm": "-2px -2px 6px var(--shadow-light), 3px 3px 8px var(--shadow-dark)",
        "neu-raised-lg": "-6px -6px 14px var(--shadow-light), 10px 10px 24px var(--shadow-dark)",
        "neu-pressed":
          "inset 3px 3px 8px var(--shadow-dark), inset -3px -3px 8px var(--shadow-light)",
        "neu-glow":
          "0 0 0 1px rgba(139, 92, 246, 0.4), 0 4px 16px rgba(139, 92, 246, 0.3), 0 0 32px var(--purple-glow)",
        "neu-floating": "0 16px 48px rgba(0, 0, 0, 0.55), 0 0 20px var(--purple-glow)",
        "neu-focus": "0 0 0 2px var(--bg-surface), 0 0 0 4px var(--purple-400)",
      },
      fontFamily: {
        sans: ["var(--font-geist-sans)", "Inter", "ui-sans-serif", "system-ui", "sans-serif"],
        mono: ["var(--font-geist-mono)", "JetBrains Mono", "ui-monospace", "monospace"],
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

// STUB(agent-1): Agent 1 has not published the pill/bento primitive library yet (no tokens.css
// rewrite, no Card/PillButton/FilterPill in components/ui/ as of this commit). These are the
// literal hex constants from the shared design spec, used directly rather than redefined as new
// tokens (nothing to import from yet), matching the same stub pattern Agent 5 used for
// components/public/_stub-primitives.tsx. Swap for the real primitives once Agent 1 publishes.
// Tracking removal: grep STUB(agent-1) in src/components/command-palette/.
import type { ButtonHTMLAttributes, HTMLAttributes, InputHTMLAttributes, ReactNode } from "react";

export function PillPanel({ className = "", ...rest }: HTMLAttributes<HTMLDivElement>) {
  return (
    <div
      className={`rounded-[24px] border border-[rgba(255,255,255,0.08)] bg-[#131313] ${className}`}
      {...rest}
    />
  );
}

export function PillTab({
  active,
  className = "",
  ...rest
}: { active: boolean } & ButtonHTMLAttributes<HTMLButtonElement>) {
  return (
    <button
      type="button"
      className={
        "rounded-full px-3 py-1 text-xs font-medium transition-colors duration-150 ease-out " +
        (active ? "bg-white text-[#0A0A0A]" : "text-[#9A9A9A] hover:text-[#F5F5F5]") +
        ` ${className}`
      }
      {...rest}
    />
  );
}

type PillButtonVariant = "primary" | "neutral" | "ghost" | "white";

const PILL_BUTTON_VARIANTS: Record<PillButtonVariant, string> = {
  primary: "bg-[#A78BFA] text-[#0A0A0A] hover:brightness-110",
  neutral: "bg-[#1E1E1E] text-[#F5F5F5] hover:bg-[#262626]",
  ghost: "bg-transparent text-[#9A9A9A] hover:text-[#F5F5F5]",
  white: "bg-white text-[#0A0A0A] hover:brightness-95",
};

export function PillButton({
  variant = "neutral",
  className = "",
  ...rest
}: { variant?: PillButtonVariant } & ButtonHTMLAttributes<HTMLButtonElement>) {
  return (
    <button
      type="button"
      className={
        "rounded-full px-3 py-1.5 text-sm font-medium transition-[filter,background-color] " +
        "duration-150 ease-out active:scale-[0.97] disabled:cursor-not-allowed disabled:opacity-40 " +
        `disabled:active:scale-100 ${PILL_BUTTON_VARIANTS[variant]} ${className}`
      }
      {...rest}
    />
  );
}

export function PillInput({ className = "", ...rest }: InputHTMLAttributes<HTMLInputElement>) {
  return (
    <input
      className={
        "w-full rounded-full bg-[#1E1E1E] px-4 py-2 text-sm text-[#F5F5F5] outline-none " +
        `placeholder:text-[#5E5E5E] focus-visible:ring-1 focus-visible:ring-[#A78BFA] ${className}`
      }
      {...rest}
    />
  );
}

/** Small neutral mono hint chip, e.g. a keyboard shortcut. `onFill` renders it for use on top of
 * a solid fill (a selected white pill row) instead of the card background. */
export function Chip({ children, onFill = false }: { children: ReactNode; onFill?: boolean }) {
  return (
    <span
      className={
        "rounded-full px-2 py-0.5 font-mono text-[10px] " +
        (onFill ? "bg-black/10 text-[#0A0A0A]" : "bg-[#1E1E1E] text-[#9A9A9A]")
      }
    >
      {children}
    </span>
  );
}

/** Empty-state echo of Agent 1's ShiftCapsule: a hollow dashed stadium, matching the "AI drafts
 * render hollow until confirmed" convention for the shift-generation preview. */
export function HollowCapsule({ children }: { children: ReactNode }) {
  return (
    <span className="inline-flex items-center rounded-full border border-dashed border-[rgba(255,255,255,0.2)] px-3 py-1 text-xs text-[#9A9A9A]">
      {children}
    </span>
  );
}

/** A parsed instant, shown as a plain elevated pill (not the MatrixDot hollow-ring convention,
 * which is Agent 4's grid metaphor, not this text confirm list). */
export function TimePill({ children }: { children: ReactNode }) {
  return (
    <span className="inline-flex items-center rounded-full bg-[#1E1E1E] px-3 py-1 font-mono text-xs text-[#F5F5F5]">
      {children}
    </span>
  );
}

/** Confidence flags render as a small orange dot on low-confidence fields, replacing the old
 * purple-underline treatment. */
export function ConfidenceDot({ low }: { low: boolean }) {
  if (!low) {
    return null;
  }
  return (
    <span
      aria-hidden="true"
      className="inline-block h-1.5 w-1.5 shrink-0 rounded-full bg-[#FF9F2E]"
    />
  );
}

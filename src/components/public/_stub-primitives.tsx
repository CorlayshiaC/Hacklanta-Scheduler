// STUB(agent-1): temporary placeholder surfaces for the flat black pill/bento language (see
// _shared-context.md's design system section, replacing neumorphism entirely). Every class below
// is a literal, fully-written Tailwind arbitrary-value string (never built with `${...}`
// interpolation): Tailwind's compiler statically scans source text for class tokens, it does not
// evaluate JS, so an interpolated `bg-[${x}]` silently produces no CSS. Hex values match the
// shared spec exactly (bg-card #131313, bg-elevated #1E1E1E, accent-go #A78BFA, accent-warn
// #FF9F2E, on-accent #0A0A0A, text-secondary #9A9A9A, text-muted #5E5E5E, hairline
// rgba(255,255,255,.08)) since there is no token layer to import from yet. Replace with Card /
// PillButton / FilterPill / ShiftCapsule from components/ui/ once Agent 1 republishes the
// primitive library for the new language, see docs/contracts/pending.md.
import type { ButtonHTMLAttributes, InputHTMLAttributes, ReactNode, SelectHTMLAttributes } from "react";

export function Card({
  title,
  menu,
  children,
  className = "",
}: {
  title?: ReactNode;
  menu?: ReactNode;
  children: ReactNode;
  className?: string;
}) {
  return (
    <div className={`rounded-[24px] bg-[#131313] p-6 ${className}`}>
      {title ? (
        <div className="mb-4 flex items-center justify-between">
          <h2 className="text-xs font-semibold uppercase tracking-wide text-[#9A9A9A]">{title}</h2>
          {menu}
        </div>
      ) : null}
      {children}
    </div>
  );
}

const PILL_VARIANTS = {
  primary: "bg-[#A78BFA] text-[#0A0A0A]",
  warn: "bg-[#FF9F2E] text-[#0A0A0A]",
  neutral: "bg-[#1E1E1E] text-[#F5F5F5]",
  white: "bg-white text-[#0A0A0A]",
  ghost: "bg-transparent text-[#9A9A9A] hover:bg-[#1E1E1E]",
  "outline-warn": "border border-[#FF9F2E] bg-transparent text-[#FF9F2E]",
} as const;

export function PillButton({
  variant = "neutral",
  className = "",
  ...rest
}: ButtonHTMLAttributes<HTMLButtonElement> & { variant?: keyof typeof PILL_VARIANTS }) {
  return (
    <button
      className={`rounded-full px-4 py-2 text-sm font-medium transition-transform duration-150 ease-out active:scale-[0.97] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#A78BFA] disabled:cursor-not-allowed disabled:opacity-40 ${PILL_VARIANTS[variant]} ${className}`}
      {...rest}
    />
  );
}

export function TextInput({ className = "", ...rest }: InputHTMLAttributes<HTMLInputElement>) {
  return (
    <input
      className={`w-full rounded-full bg-[#1E1E1E] px-4 py-2 text-sm text-[#F5F5F5] placeholder:text-[#5E5E5E] focus:outline-none focus:ring-2 focus:ring-[#A78BFA] ${className}`}
      {...rest}
    />
  );
}

export function FilterPillSelect({
  label,
  className = "",
  children,
  ...rest
}: SelectHTMLAttributes<HTMLSelectElement> & { label: string }) {
  return (
    <span className={`inline-flex items-center gap-1.5 rounded-full bg-[#1E1E1E] py-1 pl-4 pr-2 text-sm ${className}`}>
      <span className="text-[#9A9A9A]">{label}:</span>
      <select
        className="cursor-pointer appearance-none bg-transparent pr-4 font-medium text-[#F5F5F5] focus:outline-none"
        {...rest}
      >
        {children}
      </select>
    </span>
  );
}

export function MonoText({ children, className = "" }: { children: ReactNode; className?: string }) {
  return <span className={`font-mono tabular-nums ${className}`}>{children}</span>;
}

type CapsuleState = "empty" | "partial" | "full" | "match";

const CAPSULE_STATE_STYLE: Record<CapsuleState, string> = {
  empty: "border border-dashed border-[rgba(255,255,255,0.08)] bg-transparent text-[#5E5E5E]",
  partial: "bg-[#FF9F2E] text-[#0A0A0A]",
  full: "bg-[#A78BFA] text-[#0A0A0A]",
  match: "bg-white text-[#0A0A0A]",
};

const STATUS_DOT_STYLE: Record<CapsuleState, string> = {
  empty: "border border-[#5E5E5E]",
  partial: "bg-[#0A0A0A]",
  full: "bg-[#0A0A0A]",
  match: "bg-[#0A0A0A]",
};

/** STUB(agent-1) approximation of the hero ShiftCapsule primitive, scoped to the public schedule
 * page only. State is driven by filled/needed so status reads without color: the count is always
 * printed inside. */
export function ShiftCapsule({
  filled,
  needed,
  matched = false,
  className = "",
}: {
  filled: number;
  needed: number;
  matched?: boolean;
  className?: string;
}) {
  const state: CapsuleState = matched ? "match" : filled <= 0 ? "empty" : filled < needed ? "partial" : "full";

  return (
    <span
      className={`inline-flex items-center gap-1 rounded-full px-3 py-1 text-xs font-medium ${CAPSULE_STATE_STYLE[state]} ${className}`}
    >
      <StatusDot state={state} />
      <MonoText>
        {filled}/{needed}
      </MonoText>
    </span>
  );
}

/** Carries the status signal on its own (shape/fill, not just hue) so it survives in print, where
 * everything but this dot is forced transparent, see components/public/print.css. */
export function StatusDot({ state, className = "" }: { state: CapsuleState; className?: string }) {
  return <span data-status-dot className={`h-1.5 w-1.5 shrink-0 rounded-full ${STATUS_DOT_STYLE[state]} ${className}`} />;
}

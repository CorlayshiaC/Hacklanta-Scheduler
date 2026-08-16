// STUB(agent-1): temporary placeholder surfaces. Replace with NeuCard / NeuButton / NeuWell
// from components/ui/ once Agent 1 publishes the primitive library, see docs/contracts/pending.md.
import type { ButtonHTMLAttributes, InputHTMLAttributes, ReactNode } from "react";

export function Slab({ children, className = "" }: { children: ReactNode; className?: string }) {
  return (
    <div className={`rounded-2xl border border-white/10 bg-zinc-900/60 p-6 ${className}`}>
      {children}
    </div>
  );
}

export function Well({ children, className = "" }: { children: ReactNode; className?: string }) {
  return (
    <div className={`rounded-xl border border-white/5 bg-black/30 p-4 ${className}`}>
      {children}
    </div>
  );
}

export function PrimaryButton({
  className = "",
  ...rest
}: ButtonHTMLAttributes<HTMLButtonElement>) {
  return (
    <button
      className={`rounded-xl bg-violet-600 px-4 py-2 text-sm font-medium text-white transition hover:bg-violet-500 disabled:cursor-not-allowed disabled:opacity-40 ${className}`}
      {...rest}
    />
  );
}

export function SecondaryButton({
  className = "",
  ...rest
}: ButtonHTMLAttributes<HTMLButtonElement>) {
  return (
    <button
      className={`rounded-xl border border-white/10 bg-white/5 px-4 py-2 text-sm font-medium text-zinc-200 transition hover:bg-white/10 disabled:cursor-not-allowed disabled:opacity-40 ${className}`}
      {...rest}
    />
  );
}

export function TextInput({ className = "", ...rest }: InputHTMLAttributes<HTMLInputElement>) {
  return (
    <input
      className={`w-full rounded-lg border border-white/5 bg-black/30 px-3 py-2 text-sm text-zinc-100 placeholder:text-zinc-500 focus:border-violet-500 focus:outline-none focus:ring-1 focus:ring-violet-500 ${className}`}
      {...rest}
    />
  );
}

export function MonoText({ children, className = "" }: { children: ReactNode; className?: string }) {
  return <span className={`font-mono tabular-nums ${className}`}>{children}</span>;
}

type AppShellProps = {
  children: React.ReactNode;
};

export function AppShell({ children }: AppShellProps) {
  return (
    <div className="hl-shell relative overflow-hidden text-ink">
      <div className="pointer-events-none absolute inset-x-0 top-0 h-px bg-gradient-to-r from-transparent via-signal/70 to-transparent" />
      <div className="pointer-events-none absolute left-0 top-0 h-72 w-72 rounded-full bg-signal/10 blur-3xl" />
      <div className="pointer-events-none absolute right-0 top-20 h-80 w-80 rounded-full bg-pulse/10 blur-3xl" />
      <div className="relative">{children}</div>
    </div>
  );
}

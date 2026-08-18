type AppShellProps = {
  children: React.ReactNode;
};

/**
 * Legacy per-page shell, superseded by src/app/(app)/layout.tsx. Left in place only for the pages
 * that have not migrated under the (app) route group yet, see docs/contracts/design.md "App
 * shell". Restyled onto the flat black canvas so those pages are not stuck on the old broken
 * pre-redesign theme in the meantime; not adding new capability here, this file is on its way out.
 */
export function AppShell({ children }: AppShellProps) {
  return <div className="min-h-screen bg-app text-text-primary">{children}</div>;
}

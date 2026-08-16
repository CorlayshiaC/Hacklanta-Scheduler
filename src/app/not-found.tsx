/**
 * No other agent owns a 404 page yet (not in any agent's listed directories), created here since
 * the one sanctioned easter egg needs a page to trigger on. Detection itself is global
 * (EasterEggListener is mounted once in the root layout by Agent 1, see
 * docs/contracts/requests.md), so this page stays plain: typing "progsu" here fires it the same
 * as it would on any other page. Minimal on purpose: restyle freely.
 */
export default function NotFound() {
  return (
    <main className="flex min-h-screen flex-col items-center justify-center gap-2 bg-bg-base px-6 text-center">
      <p className="font-mono text-xs uppercase tracking-widest text-text-muted">404</p>
      <h1 className="text-xl text-text-primary">This page does not exist.</h1>
      <p className="text-sm text-text-secondary">Check the link, or go back to what you were doing.</p>
    </main>
  );
}

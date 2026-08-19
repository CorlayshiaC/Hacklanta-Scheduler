import type { Metadata } from "next";
import { Space_Grotesk } from "next/font/google";
import { GeistSans } from "geist/font/sans";
import { GeistMono } from "geist/font/mono";
import { TooltipProvider } from "@/components/ui/tooltip";
import { Toaster } from "@/components/ui/toast";
import { SoundManagerProvider, EasterEggListener } from "@/components/polish";
import { PwaRegister } from "@/components/pwa/pwa-register";
import { THEME_INIT_SCRIPT } from "@/lib/theme/use-theme";
import { getProfileTheme } from "@/lib/settings/theme.server";
import "./globals.css";

/**
 * Display face for page titles, hero stat numerals, and uppercase card overline titles. Space
 * Grotesk over Archivo Black: it ships 500/600/700 weights so the same family covers both a huge
 * display numeral and a small uppercase card title without switching back to Inter at smaller
 * sizes, and its geometric letterforms pair naturally with Geist Mono's tabular figures; Archivo
 * Black is a single 900-weight face, correct only at hero scale.
 */
const spaceGrotesk = Space_Grotesk({
  subsets: ["latin"],
  weight: ["500", "600", "700"],
  variable: "--font-display",
  display: "swap",
});

export const metadata: Metadata = {
  title: "prog scheduler",
  description: "Shift scheduling for progsu events.",
};

export default async function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  // Signed-in members get their stored theme (profiles.theme, Agent 2) stamped server-side, so a
  // dark-theme member never sees a light flash on a fresh load, even on a device that has never
  // opened the app before (no localStorage entry to race). Signed out (sign-in, /join, public
  // schedule pages) resolves to the light default, same as every other unauthenticated render.
  const serverTheme = await getProfileTheme();

  return (
    <html
      className={`${GeistSans.variable} ${GeistMono.variable} ${spaceGrotesk.variable}`}
      data-theme={serverTheme === "dark" ? "dark" : undefined}
      lang="en"
    >
      <head>
        {/* Client-side fallback/sync only: if the server already stamped data-theme above, this
            script leaves it alone. It exists for the signed-out and pre-hydration edge cases
            (localStorage remembers a choice the server render doesn't know about yet). See
            src/lib/theme/use-theme.ts. */}
        <script dangerouslySetInnerHTML={{ __html: THEME_INIT_SCRIPT }} />
      </head>
      <body>
        <SoundManagerProvider>
          <TooltipProvider>
            {children}
            <Toaster />
          </TooltipProvider>
          <EasterEggListener />
          <PwaRegister />
        </SoundManagerProvider>
      </body>
    </html>
  );
}

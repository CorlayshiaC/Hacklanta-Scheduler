import type { Metadata } from "next";
import { Space_Grotesk } from "next/font/google";
import { GeistSans } from "geist/font/sans";
import { GeistMono } from "geist/font/mono";
import { TooltipProvider } from "@/components/ui/tooltip";
import { Toaster } from "@/components/ui/toast";
import { SoundManagerProvider, EasterEggListener } from "@/components/polish";
import { PwaRegister } from "@/components/pwa/pwa-register";
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

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html
      className={`${GeistSans.variable} ${GeistMono.variable} ${spaceGrotesk.variable}`}
      lang="en"
    >
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

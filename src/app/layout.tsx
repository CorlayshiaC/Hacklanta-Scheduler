import type { Metadata } from "next";
import { GeistSans } from "geist/font/sans";
import { GeistMono } from "geist/font/mono";
import { TooltipProvider } from "@/components/ui/tooltip";
import { Toaster } from "@/components/ui/toast";
import { SoundManagerProvider, EasterEggListener } from "@/components/polish";
import "./globals.css";

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
    <html className={`${GeistSans.variable} ${GeistMono.variable}`} lang="en">
      <body>
        <SoundManagerProvider>
          <TooltipProvider>
            {children}
            <Toaster />
          </TooltipProvider>
          <EasterEggListener />
        </SoundManagerProvider>
      </body>
    </html>
  );
}

import type { Metadata } from "next";
import "./globals.css";

export const metadata: Metadata = {
  title: "HackLanta Scheduler",
  description: "Board scheduling for HackLanta 2026.",
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="en">
      <body>{children}</body>
    </html>
  );
}

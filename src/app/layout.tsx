import type { Metadata } from "next";
import "./globals.css";

export const metadata: Metadata = {
  title: "Word Quest: Infinite Tome",
  description: "An AI-assisted, game-based vocabulary learning system with SRS, mastery analytics, and guardian-facing learning evidence.",
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="en">
      <body className="antialiased">
        {children}
      </body>
    </html>
  );
}

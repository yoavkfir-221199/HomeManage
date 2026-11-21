// =============================================================================
// ROOT LAYOUT — wraps every page of the app
// =============================================================================
// Sets the font, the page metadata and the mobile viewport. The visual shell
// (bottom navigation, section tabs) lives in each section's own layout, e.g.
// src/app/food/layout.tsx.
// =============================================================================

import type { Metadata, Viewport } from "next";
import { Rubik } from "next/font/google";

import "./globals.css";
import "./homemanage.css";

// Rubik: rounded and friendly like Riseup's font, and it supports Hebrew too.
// `variable` exposes it as the CSS variable --hm-font (used in homemanage.css).
const rubik = Rubik({
  subsets: ["latin", "hebrew"],
  variable: "--hm-font",
});

export const metadata: Metadata = {
  title: "HomeManage",
  description: "Everything for our home: food, plants, money.",
  appleWebApp: { title: "HomeManage", statusBarStyle: "default" },
};

// Mobile settings: use the device width, and color the browser bar cream.
export const viewport: Viewport = {
  width: "device-width",
  initialScale: 1,
  viewportFit: "cover", // lets us respect the iPhone notch/home bar (safe areas)
  themeColor: "#f9f7ed",
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="en" className={rubik.variable} suppressHydrationWarning>
      <body className="hm-body">{children}</body>
    </html>
  );
}

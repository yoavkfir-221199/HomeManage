// =============================================================================
// ROOT LAYOUT — wraps every page of the app
// =============================================================================
// Sets the font, the page metadata and the mobile viewport. It also applies
// the user's settings (from cookies, see src/lib/settings.ts):
//   lang + dir  -> Hebrew pages are right-to-left (dir="rtl")
//   data-theme  -> "light" | "dark" | "system"; homemanage.css picks the colors
// The visual shell (bottom navigation, tabs) lives in each section's layout.
// =============================================================================

import type { Metadata, Viewport } from "next";
import { Rubik } from "next/font/google";

import { SettingsProvider } from "@/components/settings-provider";
import { getSettings } from "@/lib/settings";

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

// Mobile settings: use the device width, and color the browser bar to match
// the page in light and dark mode.
export const viewport: Viewport = {
  width: "device-width",
  initialScale: 1,
  viewportFit: "cover", // lets us respect the iPhone notch/home bar (safe areas)
  themeColor: [
    { media: "(prefers-color-scheme: light)", color: "#f9f7ed" },
    { media: "(prefers-color-scheme: dark)", color: "#121613" },
  ],
};

export default async function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  const { lang, theme } = await getSettings();

  return (
    <html
      lang={lang}
      dir={lang === "he" ? "rtl" : "ltr"}
      data-theme={theme}
      className={rubik.variable}
      suppressHydrationWarning
    >
      <body className="hm-body">
        <SettingsProvider lang={lang} theme={theme}>
          {children}
        </SettingsProvider>
      </body>
    </html>
  );
}

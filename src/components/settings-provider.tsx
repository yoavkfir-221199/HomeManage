"use client";

// =============================================================================
// SETTINGS PROVIDER — gives every client component the language and theme
// =============================================================================
// The root layout reads the cookies on the server and passes the values in
// here. Client components then call `useSettings()` to get:
//   t       -> the texts in the chosen language
//   locale  -> for formatting dates ("he-IL" / "en-GB")
//   mode    -> "light" or "dark" right now (resolves "Auto" using the phone's
//              setting, and follows it live if it changes)
// =============================================================================

import { createContext, useContext, useSyncExternalStore } from "react";

import { dictionaries, type Lang, LOCALES } from "@/lib/i18n/dictionaries";

const DARK_QUERY = "(prefers-color-scheme: dark)";

function subscribeToSystemTheme(onChange: () => void) {
  const query = window.matchMedia(DARK_QUERY);
  query.addEventListener("change", onChange);
  return () => query.removeEventListener("change", onChange);
}

function getSystemDark() {
  return window.matchMedia(DARK_QUERY).matches;
}

type ThemePreference = "light" | "dark" | "system";

type SettingsValue = {
  lang: Lang;
  theme: ThemePreference;
  mode: "light" | "dark";
  t: (typeof dictionaries)[Lang];
  locale: string;
};

const SettingsContext = createContext<SettingsValue | null>(null);

export function SettingsProvider({
  lang,
  theme,
  children,
}: {
  lang: Lang;
  theme: ThemePreference;
  children: React.ReactNode;
}) {
  // What the phone prefers (only matters when the theme is "Auto").
  // useSyncExternalStore = React's way to read a value that lives OUTSIDE
  // React (here: the browser's dark-mode setting) and re-render when it changes.
  const systemDark = useSyncExternalStore(subscribeToSystemTheme, getSystemDark, () => false);

  const mode = theme === "system" ? (systemDark ? "dark" : "light") : theme;

  return (
    <SettingsContext.Provider value={{ lang, theme, mode, t: dictionaries[lang], locale: LOCALES[lang] }}>
      {children}
    </SettingsContext.Provider>
  );
}

export function useSettings() {
  const value = useContext(SettingsContext);
  if (!value) throw new Error("useSettings must be used inside <SettingsProvider>");
  return value;
}

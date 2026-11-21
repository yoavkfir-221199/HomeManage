// =============================================================================
// APP SETTINGS — language and theme, stored in cookies
// =============================================================================
// Why cookies (and not the database)? These are per-DEVICE choices: you might
// want Hebrew on your phone while Noa keeps English on hers. And the server
// can read a cookie while rendering, so the page arrives already in the right
// language, direction (RTL) and colors, with no flash of the wrong ones.
// =============================================================================

import "server-only";

import { cookies } from "next/headers";

import { dictionaries, type Lang, LANGS, LOCALES } from "@/lib/i18n/dictionaries";

export const THEMES = ["light", "dark", "system"] as const;
export type ThemePreference = (typeof THEMES)[number];

export const LANG_COOKIE = "hm-lang";
export const THEME_COOKIE = "hm-theme";

export async function getSettings(): Promise<{ lang: Lang; theme: ThemePreference }> {
  const store = await cookies();
  const lang = store.get(LANG_COOKIE)?.value;
  const theme = store.get(THEME_COOKIE)?.value;
  return {
    lang: LANGS.includes(lang as Lang) ? (lang as Lang) : "en",
    theme: THEMES.includes(theme as ThemePreference) ? (theme as ThemePreference) : "system",
  };
}

/** For server components: the texts in the chosen language, plus its locale. */
export async function getI18n() {
  const { lang } = await getSettings();
  return { lang, t: dictionaries[lang], locale: LOCALES[lang], dir: lang === "he" ? "rtl" : "ltr" } as const;
}

// Server actions for the Settings page: save the choice in a cookie, then
// re-render every page so the new language/theme applies everywhere.

"use server";

import { cookies } from "next/headers";
import { revalidatePath } from "next/cache";

import { LANGS, type Lang } from "@/lib/i18n/dictionaries";
import { LANG_COOKIE, THEME_COOKIE, THEMES, type ThemePreference } from "@/lib/settings";

const ONE_YEAR = 60 * 60 * 24 * 365;

async function save(name: string, value: string) {
  const store = await cookies();
  store.set(name, value, { path: "/", maxAge: ONE_YEAR, sameSite: "lax" });
  revalidatePath("/", "layout");
}

export async function setLanguage(lang: Lang) {
  if (!LANGS.includes(lang)) throw new Error("Unknown language");
  await save(LANG_COOKIE, lang);
}

export async function setTheme(theme: ThemePreference) {
  if (!THEMES.includes(theme)) throw new Error("Unknown theme");
  await save(THEME_COOKIE, theme);
}

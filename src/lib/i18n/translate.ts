// =============================================================================
// TRANSLATE — show item names and dish titles in the app's language
// =============================================================================
// Names are saved in whatever language they were written in ("egg" from an
// English session, "ביצה" from a Hebrew one). When a page shows them, it calls
// translateTexts(names, lang) to get each name in the current language.
//
// How it stays fast and cheap:
//   1. Text already in the target language is returned as is (no AI).
//   2. Every translation is saved in the `translations` table, so each text is
//      translated only ONCE, ever.
//   3. Only the missing ones go to the AI, all in one request.
// If the AI is unreachable, the original names are shown; nothing breaks.
// =============================================================================

import "server-only";

import { createOpenAI } from "@ai-sdk/openai";
import { generateText } from "ai";
import { and, eq, inArray } from "drizzle-orm";

import { getDb, schema } from "@/lib/db";
import { requiredEnv } from "@/lib/env";
import type { Lang } from "@/lib/i18n/dictionaries";
import { DEFAULT_MODEL } from "@/lib/models";

const { translations } = schema;

const HEBREW = /[֐-׿]/;
const LATIN = /[a-z]/i;

/** Does this text need translating to reach `lang`? */
function needsTranslation(text: string, lang: Lang) {
  return lang === "he" ? LATIN.test(text) && !HEBREW.test(text) : HEBREW.test(text);
}

/**
 * Translate many short texts at once. Returns a Map from each original text to
 * its translation (or to itself when no translation was needed or possible).
 */
export async function translateTexts(
  texts: string[],
  lang: Lang,
  kind: "item" | "dish" = "item",
): Promise<Map<string, string>> {
  const result = new Map(texts.map((text) => [text, text]));
  const pending = [...new Set(texts.filter((text) => text.trim() && needsTranslation(text, lang)))];
  if (!pending.length) return result;

  try {
    // 1. Look in the cache.
    const db = getDb();
    const cached = await db
      .select()
      .from(translations)
      .where(and(eq(translations.lang, lang), inArray(translations.source, pending)));
    for (const row of cached) result.set(row.source, row.translated);

    // 2. Ask the AI for the rest, in one request.
    const missing = pending.filter((text) => !cached.some((row) => row.source === text));
    if (!missing.length) return result;

    const translated = await askModel(missing, lang, kind);
    const rows = missing
      .map((source, i) => ({ source, lang, translated: translated[i]?.trim() }))
      .filter((row): row is { source: string; lang: Lang; translated: string } => !!row.translated);
    for (const row of rows) result.set(row.source, row.translated);

    // 3. Save them for next time (ignore duplicates from a parallel request).
    if (rows.length) await db.insert(translations).values(rows).onConflictDoNothing();
  } catch (error) {
    console.error("Translation failed, showing original names:", error);
  }
  return result;
}

async function askModel(texts: string[], lang: Lang, kind: "item" | "dish"): Promise<string[]> {
  // The same OpenUI Gateway as the chat. Without the OpenUI system prompt it's
  // a plain model call.
  const gateway = createOpenAI({ baseURL: "https://api.thesys.dev/v1/embed", apiKey: requiredEnv("THESYS_API_KEY") });
  const target = lang === "he" ? "Hebrew" : "English";

  const { text } = await generateText({
    model: gateway.chat(DEFAULT_MODEL),
    system:
      (kind === "item"
        ? `You translate grocery item names for an Israeli household's shopping list into ${target}. ` +
          "Use the everyday word people write on a shopping list (e.g. 'egg' -> 'ביצה', " +
          "'ground chicken' -> 'עוף טחון'). Keep names short and singular, lowercase in English. "
        : `You translate dish titles for an Israeli household's weekly menu into ${target}. ` +
          "Use the name people would call the dish (e.g. 'שקשוקה' -> 'Shakshuka', " +
          "'Eggs & Fresh Salad' -> 'ביצים וסלט טרי'). In English use Title Case. ") +
      "Keep brand and product names recognisable (Grana Padano -> גרנה פדנו). " +
      "Reply with ONLY a JSON array of strings: the translations, in the same order and the same count as the input.",
    prompt: JSON.stringify(texts),
  });

  // Models sometimes wrap JSON in a ``` fence; take what's between the brackets.
  const json = text.slice(text.indexOf("["), text.lastIndexOf("]") + 1);
  const parsed: unknown = JSON.parse(json);
  if (!Array.isArray(parsed) || parsed.length !== texts.length) {
    throw new Error(`Expected ${texts.length} translations, got ${Array.isArray(parsed) ? parsed.length : "none"}`);
  }
  return parsed.map((item) => (typeof item === "string" ? item : ""));
}

/** Items (shopping list, pantry) with their `name` shown in `lang`. */
export async function localizeNames<T extends { name: string }>(items: T[], lang: Lang): Promise<T[]> {
  const names = await translateTexts(
    items.map((item) => item.name),
    lang,
  );
  return items.map((item) => ({ ...item, name: names.get(item.name) ?? item.name }));
}

/** Planned meals with their `title` shown in `lang`. */
export async function localizeMeals<T extends { title: string }>(meals: T[], lang: Lang): Promise<T[]> {
  const titles = await translateTexts(
    meals.map((meal) => meal.title),
    lang,
    "dish",
  );
  // Dish titles start with a capital letter (Hebrew has none; this is a no-op there).
  const capitalize = (text: string) => text.charAt(0).toUpperCase() + text.slice(1);
  return meals.map((meal) => ({ ...meal, title: capitalize(titles.get(meal.title) ?? meal.title) }));
}

import {
  type AnyPgColumn,
  boolean,
  date,
  doublePrecision,
  integer,
  jsonb,
  pgTable,
  serial,
  text,
  timestamp,
  unique,
} from "drizzle-orm/pg-core";

// What you have at home right now.
export const pantryItems = pgTable("pantry_items", {
  id: serial("id").primaryKey(),
  name: text("name").notNull(),
  quantity: doublePrecision("quantity"),
  unit: text("unit"), // "g", "ml", "pcs", ...
  category: text("category"), // "dairy", "produce", "spices", ...
  expiresOn: date("expires_on"),
  createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
  updatedAt: timestamp("updated_at", { withTimezone: true }).notNull().defaultNow(),
});

export type RecipeIngredient = { name: string; quantity?: number; unit?: string };

// Recipes you've saved (from the chat, the web, or later Instagram).
export const recipes = pgTable("recipes", {
  id: serial("id").primaryKey(),
  title: text("title").notNull(),
  description: text("description"),
  servings: integer("servings"),
  totalMinutes: integer("total_minutes"),
  ingredients: jsonb("ingredients").$type<RecipeIngredient[]>().notNull().default([]),
  steps: jsonb("steps").$type<string[]>().notNull().default([]),
  tags: text("tags").array().notNull().default([]),
  sourceUrl: text("source_url"),
  // Where it came from: "chat", "manual", and later "instagram" (the
  // Instagram automation will save recipe ideas here with their post URL).
  source: text("source").notNull().default("chat"),
  createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
});

// One row per week you plan. `weekStart` is the Sunday the week starts on.
export const mealPlans = pgTable("meal_plans", {
  id: serial("id").primaryKey(),
  weekStart: date("week_start").notNull().unique(),
  notes: text("notes"),
  createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
});

// The meals inside a week plan: "Tuesday dinner: shakshuka".
export const plannedMeals = pgTable("planned_meals", {
  id: serial("id").primaryKey(),
  planId: integer("plan_id")
    .notNull()
    .references(() => mealPlans.id, { onDelete: "cascade" }),
  day: date("day").notNull(),
  meal: text("meal").notNull(), // "breakfast" | "lunch" | "dinner"
  title: text("title").notNull(),
  recipeId: integer("recipe_id").references(() => recipes.id, { onDelete: "set null" }),
  notes: text("notes"),
  createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
});

// Translations of item names and dish titles, so each text is translated by
// the AI only once. "egg" + "he" -> "ביצה". See src/lib/i18n/translate.ts.
export const translations = pgTable(
  "translations",
  {
    id: serial("id").primaryKey(),
    source: text("source").notNull(),
    lang: text("lang").notNull(), // the language translated INTO
    translated: text("translated").notNull(),
    createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
  },
  (table) => [unique("translations_source_lang").on(table.source, table.lang)],
);

// Long-term memory about how you eat, set on the Settings page (or by asking
// the planner to "remember…"). Every chat request includes these.
export const foodPreferences = pgTable("food_preferences", {
  id: serial("id").primaryKey(),
  text: text("text").notNull(),
  createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
});

// What you need to buy.
export const shoppingListItems = pgTable("shopping_list_items", {
  id: serial("id").primaryKey(),
  name: text("name").notNull(),
  quantity: doublePrecision("quantity"),
  unit: text("unit"),
  category: text("category"),
  checked: boolean("checked").notNull().default(false),
  recipeId: integer("recipe_id").references(() => recipes.id, { onDelete: "set null" }),
  // `(): AnyPgColumn` is needed because meal_plans is defined further down.
  planId: integer("plan_id").references((): AnyPgColumn => mealPlans.id, { onDelete: "set null" }),
  createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
});

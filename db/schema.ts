import {
  boolean,
  date,
  doublePrecision,
  integer,
  jsonb,
  pgTable,
  serial,
  text,
  timestamp,
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
  createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
});

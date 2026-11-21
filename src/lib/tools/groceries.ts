// =============================================================================
// GROCERY & COOKING TOOLS — the AI's access to your pantry, list and recipes
// =============================================================================
// Each tool below reads or writes the Netlify database (tables in
// db/schema.ts) through Drizzle. They're merged into `appTools` in
// src/lib/tools.ts, so the chat model can call them.
//
// Things to notice while reading:
//   - `description` is written FOR THE MODEL: it says when to use the tool.
//   - Inputs are validated with Zod before `execute` runs, so the database
//     only ever sees clean values.
//   - Every tool returns plain JSON. The model reads that JSON and then draws
//     the answer in OpenUI Lang (a Table of your pantry, a checklist, …).
//   - Tools that take an `id` get it from an earlier "get" tool result. The
//     model never invents ids; it reads them from data we returned.
// =============================================================================

import { tool } from "ai";
import { and, asc, desc, eq, ilike, isNull, or, sql } from "drizzle-orm";
import { z } from "zod";

import { getDb, schema } from "@/lib/db";
import { addShoppingItems } from "@/lib/food/data";

const { pantryItems, shoppingListItems, recipes } = schema;

// Shared shape for "a thing with an amount": used for pantry, list and
// recipe ingredients. All fields except `name` are optional, because
// "add milk" is a perfectly good request.
const itemInput = z.object({
  name: z.string().trim().min(1).describe("Item name, singular and lowercase, e.g. 'egg', 'olive oil'."),
  quantity: z.number().positive().optional().describe("How much, as a number."),
  unit: z
    .string()
    .trim()
    .optional()
    .describe("Unit for quantity: g, kg, ml, l, pcs, tbsp, tsp, cup, pack…"),
  category: z
    .string()
    .trim()
    .optional()
    .describe("Store section: produce, dairy, meat, bakery, pantry, spices, frozen, drinks, household, other."),
});

// Small helper: turn any thrown error into a JSON message the model can read
// and explain to you, instead of crashing the whole chat.
async function safely<T>(run: () => Promise<T>) {
  try {
    return await run();
  } catch (error) {
    console.error("Grocery tool failed:", error);
    return { error: error instanceof Error ? error.message : String(error) };
  }
}

export const groceryTools = {
  // ---------------------------------------------------------------------------
  // PANTRY — what you have at home
  // ---------------------------------------------------------------------------
  get_pantry: tool({
    description:
      "List what's in the user's pantry/fridge. Use before suggesting what to cook, " +
      "when the user asks what they have, or before changing a pantry item.",
    inputSchema: z.object({
      category: z.string().trim().optional().describe("Only this category, e.g. 'dairy'."),
    }),
    execute: ({ category }) =>
      safely(async () => {
        const rows = await getDb()
          .select()
          .from(pantryItems)
          // ilike = case-insensitive match, so "Dairy" finds "dairy".
          .where(category ? ilike(pantryItems.category, category) : undefined)
          .orderBy(asc(pantryItems.category), asc(pantryItems.name));
        return { items: rows };
      }),
  }),

  add_pantry_items: tool({
    description:
      "Add items to the pantry (e.g. after shopping). If an item with the same name " +
      "and unit already exists, its quantity is increased instead of adding a duplicate.",
    inputSchema: z.object({
      items: z
        .array(itemInput.extend({ expiresOn: z.string().date().optional().describe("YYYY-MM-DD") }))
        .min(1),
    }),
    execute: ({ items }) =>
      safely(async () => {
        const db = getDb();
        const saved = [];
        for (const item of items) {
          // Look for the same item (same name + same unit) to merge into.
          const [existing] = await db
            .select()
            .from(pantryItems)
            .where(
              and(
                ilike(pantryItems.name, item.name),
                item.unit ? ilike(pantryItems.unit, item.unit) : isNull(pantryItems.unit),
              ),
            )
            .limit(1);

          if (existing) {
            const [row] = await db
              .update(pantryItems)
              .set({
                quantity:
                  item.quantity === undefined
                    ? existing.quantity
                    : (existing.quantity ?? 0) + item.quantity,
                expiresOn: item.expiresOn ?? existing.expiresOn,
                updatedAt: new Date(),
              })
              .where(eq(pantryItems.id, existing.id))
              .returning();
            saved.push(row);
          } else {
            const [row] = await db.insert(pantryItems).values(item).returning();
            saved.push(row);
          }
        }
        return { saved };
      }),
  }),

  update_pantry_item: tool({
    description:
      "Change or remove one pantry item by id (get ids from get_pantry). " +
      "Set quantity to 0 or remove=true when the user used it up or threw it away.",
    inputSchema: z.object({
      id: z.number().int(),
      quantity: z.number().min(0).optional(),
      unit: z.string().trim().optional(),
      expiresOn: z.string().date().optional(),
      remove: z.boolean().optional(),
    }),
    execute: ({ id, remove, ...changes }) =>
      safely(async () => {
        const db = getDb();
        if (remove || changes.quantity === 0) {
          const [row] = await db.delete(pantryItems).where(eq(pantryItems.id, id)).returning();
          return row ? { removed: row } : { error: `No pantry item with id ${id}` };
        }
        const [row] = await db
          .update(pantryItems)
          .set({ ...changes, updatedAt: new Date() })
          .where(eq(pantryItems.id, id))
          .returning();
        return row ? { updated: row } : { error: `No pantry item with id ${id}` };
      }),
  }),

  // ---------------------------------------------------------------------------
  // SHOPPING LIST — what you need to buy
  // ---------------------------------------------------------------------------
  get_shopping_list: tool({
    description:
      "Show the user's shopping list, grouped by store section. Use when they ask " +
      "what to buy, or before changing an item on the list.",
    inputSchema: z.object({
      includeChecked: z.boolean().optional().describe("Also show items already ticked off."),
    }),
    execute: ({ includeChecked }) =>
      safely(async () => {
        const rows = await getDb()
          .select()
          .from(shoppingListItems)
          .where(includeChecked ? undefined : eq(shoppingListItems.checked, false))
          .orderBy(asc(shoppingListItems.checked), asc(shoppingListItems.category), asc(shoppingListItems.name));
        return { items: rows };
      }),
  }),

  add_to_shopping_list: tool({
    description:
      "Add items to the shopping list. When adding a recipe's ingredients, call " +
      "get_pantry first and skip what the user already has, then pass recipeId.",
    inputSchema: z.object({
      items: z.array(itemInput).min(1),
      recipeId: z.number().int().optional().describe("The saved recipe these items are for, if any."),
    }),
    execute: ({ items, recipeId }) =>
      safely(async () => {
        // The shared data layer merges duplicates (also across languages).
        return { added: await addShoppingItems(items, { recipeId }) };
      }),
  }),

  update_shopping_list: tool({
    description:
      "Tick off, untick or remove shopping list items by id (get ids from " +
      "get_shopping_list). Use clearChecked=true to delete everything already ticked off.",
    inputSchema: z.object({
      check: z.array(z.number().int()).optional().describe("Ids to mark as bought."),
      uncheck: z.array(z.number().int()).optional().describe("Ids to mark as not bought."),
      remove: z.array(z.number().int()).optional().describe("Ids to delete from the list."),
      clearChecked: z.boolean().optional(),
    }),
    execute: ({ check = [], uncheck = [], remove = [], clearChecked }) =>
      safely(async () => {
        const db = getDb();
        // sql`... = ANY(...)` lets us update many ids in one query.
        const anyOf = (ids: number[]) => sql`${shoppingListItems.id} = ANY(${ids})`;
        if (check.length) await db.update(shoppingListItems).set({ checked: true }).where(anyOf(check));
        if (uncheck.length) await db.update(shoppingListItems).set({ checked: false }).where(anyOf(uncheck));
        if (remove.length) await db.delete(shoppingListItems).where(anyOf(remove));
        if (clearChecked) await db.delete(shoppingListItems).where(eq(shoppingListItems.checked, true));
        const items = await db
          .select()
          .from(shoppingListItems)
          .orderBy(asc(shoppingListItems.checked), asc(shoppingListItems.category), asc(shoppingListItems.name));
        return { items };
      }),
  }),

  // ---------------------------------------------------------------------------
  // RECIPES — your saved cookbook
  // ---------------------------------------------------------------------------
  save_recipe: tool({
    description:
      "Save a recipe to the user's cookbook. Only use when the user asks to save/keep a recipe.",
    inputSchema: z.object({
      title: z.string().trim().min(1),
      description: z.string().optional(),
      servings: z.number().int().positive().optional(),
      totalMinutes: z.number().int().positive().optional(),
      ingredients: z.array(itemInput.omit({ category: true })).min(1),
      steps: z.array(z.string().min(1)).min(1).describe("One instruction per step, in order."),
      tags: z.array(z.string()).optional().describe("e.g. 'italian', 'vegetarian', 'quick'."),
      sourceUrl: z.string().url().optional().describe("Where the recipe came from, if any."),
    }),
    execute: (recipe) =>
      safely(async () => {
        const [row] = await getDb()
          .insert(recipes)
          .values({ ...recipe, tags: recipe.tags ?? [] })
          .returning();
        return { saved: row };
      }),
  }),

  find_recipes: tool({
    description:
      "Search the user's saved recipes by words in the title or tags, or list the newest. " +
      "Use when the user asks about their saved/own recipes.",
    inputSchema: z.object({
      query: z.string().trim().optional().describe("Words to look for, e.g. 'pasta'. Omit to list recent."),
      limit: z.number().int().min(1).max(50).optional(),
    }),
    execute: ({ query, limit = 20 }) =>
      safely(async () => {
        const rows = await getDb()
          .select()
          .from(recipes)
          .where(
            query
              ? or(ilike(recipes.title, `%${query}%`), sql`${query} ILIKE ANY(${recipes.tags})`)
              : undefined,
          )
          .orderBy(desc(recipes.createdAt))
          .limit(limit);
        return { recipes: rows };
      }),
  }),
} as const;

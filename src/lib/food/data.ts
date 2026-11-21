// =============================================================================
// FOOD DATA — every read and write for the Food section, in one place
// =============================================================================
// Two kinds of callers use these functions:
//   1. The PAGES (Plan, Pantry, History, Settings) through server actions in
//      src/app/food/actions.ts — when YOU tap a button.
//   2. The AI TOOLS in src/lib/tools/ — when the PLANNER changes something.
// Sharing them means the app and the AI always change data the same way.
//
// This file runs only on the server (it talks to the database).
// =============================================================================

import "server-only";

import { and, asc, desc, eq, gte, ilike, inArray, isNull, lt } from "drizzle-orm";

import { getDb, schema } from "@/lib/db";
import { type ISODate, type Meal, MEALS, weekStartOf } from "@/lib/food/week";
import { translateTexts } from "@/lib/i18n/translate";
import { normalizeUnit } from "@/lib/food/units";

export { normalizeUnit };

const { foodPreferences, mealPlans, pantryItems, plannedMeals, shoppingListItems } = schema;

export type PantryItem = typeof pantryItems.$inferSelect;
export type ShoppingItem = typeof shoppingListItems.$inferSelect;
export type PlannedMeal = typeof plannedMeals.$inferSelect;
export type FoodPreference = typeof foodPreferences.$inferSelect;

export type ItemInput = {
  name: string;
  quantity?: number | null;
  unit?: string | null;
  category?: string | null;
};

// Order meals breakfast → lunch → dinner (alphabetical would put dinner first).
function sortMeals(meals: PlannedMeal[]) {
  return meals.sort(
    (a, b) =>
      a.day.localeCompare(b.day) ||
      MEALS.indexOf(a.meal as Meal) - MEALS.indexOf(b.meal as Meal),
  );
}

// -----------------------------------------------------------------------------
// WEEK PLANS
// -----------------------------------------------------------------------------

/** The plan for one week (or null if nothing is planned yet), with its meals. */
export async function getWeekPlan(weekStart: ISODate = weekStartOf()) {
  const db = getDb();
  const [plan] = await db.select().from(mealPlans).where(eq(mealPlans.weekStart, weekStart));
  if (!plan) return null;
  const meals = await db.select().from(plannedMeals).where(eq(plannedMeals.planId, plan.id));
  return { ...plan, meals: sortMeals(meals) };
}

/** Find this week's plan row, creating it the first time. */
async function ensurePlan(weekStart: ISODate) {
  const db = getDb();
  const [existing] = await db.select().from(mealPlans).where(eq(mealPlans.weekStart, weekStart));
  if (existing) return existing;
  const [created] = await db.insert(mealPlans).values({ weekStart }).returning();
  return created;
}

export type MealInput = { day: ISODate; meal: Meal; title: string; notes?: string; recipeId?: number };

/**
 * Put meals into a week. Each meal REPLACES whatever was planned for the same
 * day + meal slot, so "change Tuesday dinner to pizza" just works.
 */
export async function setMeals(weekStart: ISODate, meals: MealInput[]) {
  const db = getDb();
  const plan = await ensurePlan(weekStart);
  for (const meal of meals) {
    await db
      .delete(plannedMeals)
      .where(
        and(
          eq(plannedMeals.planId, plan.id),
          eq(plannedMeals.day, meal.day),
          eq(plannedMeals.meal, meal.meal),
        ),
      );
  }
  if (meals.length) {
    await db.insert(plannedMeals).values(meals.map((m) => ({ ...m, planId: plan.id })));
  }
  return getWeekPlan(weekStart);
}

export async function removeMeal(id: number) {
  await getDb().delete(plannedMeals).where(eq(plannedMeals.id, id));
}

/** Past weeks (newest first) with their meals, for the History page. */
export async function getPastPlans(before: ISODate = weekStartOf(), limit = 12) {
  const db = getDb();
  const plans = await db
    .select()
    .from(mealPlans)
    .where(lt(mealPlans.weekStart, before))
    .orderBy(desc(mealPlans.weekStart))
    .limit(limit);
  if (!plans.length) return [];
  const meals = await db
    .select()
    .from(plannedMeals)
    .where(inArray(plannedMeals.planId, plans.map((p) => p.id)));
  return plans.map((plan) => ({
    ...plan,
    meals: sortMeals(meals.filter((m) => m.planId === plan.id)),
  }));
}

/** Upcoming weeks that already have a plan (this week and later). */
export async function getPlannedWeekStarts(from: ISODate = weekStartOf()) {
  const rows = await getDb()
    .select({ weekStart: mealPlans.weekStart })
    .from(mealPlans)
    .where(gte(mealPlans.weekStart, from))
    .orderBy(asc(mealPlans.weekStart));
  return rows.map((r) => r.weekStart);
}

// -----------------------------------------------------------------------------
// SHOPPING LIST
// -----------------------------------------------------------------------------

export async function getShoppingList() {
  await mergeDuplicateShoppingItems();
  return getDb()
    .select()
    .from(shoppingListItems)
    .orderBy(asc(shoppingListItems.checked), asc(shoppingListItems.category), asc(shoppingListItems.name));
}

/**
 * Add items. If the same item (same name + unit) is already on the list and
 * not yet bought, add to its quantity instead of creating a duplicate line.
 */
export async function addShoppingItems(items: ItemInput[], extra: { planId?: number; recipeId?: number } = {}) {
  const db = getDb();
  const saved: ShoppingItem[] = [];
  for (const raw of items) {
    const item = { ...raw, unit: normalizeUnit(raw.unit) };
    const name = item.name.trim().toLowerCase();
    const [existing] = await db
      .select()
      .from(shoppingListItems)
      .where(
        and(
          ilike(shoppingListItems.name, name),
          item.unit ? ilike(shoppingListItems.unit, item.unit) : isNull(shoppingListItems.unit),
          eq(shoppingListItems.checked, false),
        ),
      )
      .limit(1);
    if (existing) {
      const quantity =
        item.quantity == null ? existing.quantity : (existing.quantity ?? 0) + item.quantity;
      const [row] = await db
        .update(shoppingListItems)
        .set({ quantity })
        .where(eq(shoppingListItems.id, existing.id))
        .returning();
      saved.push(row);
    } else {
      const [row] = await db
        .insert(shoppingListItems)
        .values({ ...item, name, ...extra })
        .returning();
      saved.push(row);
    }
  }
  // Catch duplicates written in another language ("lemon" + "לימון").
  await mergeDuplicateShoppingItems();
  return saved;
}

/**
 * Merge list items that are the same thing written differently: same item in
 * two languages ("egg" / "ביצה") or the same unit spelled two ways ("pcs" /
 * "יח׳"). Each name is mapped to English (cached, see translate.ts) and items
 * with the same English name and unit become one line with the quantities
 * added up. Only items not yet bought are merged.
 */
export async function mergeDuplicateShoppingItems() {
  const db = getDb();
  const open = await db
    .select()
    .from(shoppingListItems)
    .where(eq(shoppingListItems.checked, false))
    .orderBy(asc(shoppingListItems.id));
  // Older rows may still have a unit spelled another way ("גרם"): store the
  // standard form so it's shown in the right language.
  for (const item of open) {
    const unit = normalizeUnit(item.unit);
    if (unit !== item.unit) {
      await db.update(shoppingListItems).set({ unit }).where(eq(shoppingListItems.id, item.id));
      item.unit = unit;
    }
  }
  if (open.length < 2) return;

  const english = await translateTexts(
    open.map((item) => item.name),
    "en",
  );
  const groups = new Map<string, ShoppingItem[]>();
  for (const item of open) {
    const key = `${(english.get(item.name) ?? item.name).trim().toLowerCase()}|${normalizeUnit(item.unit) ?? ""}`;
    groups.set(key, [...(groups.get(key) ?? []), item]);
  }

  for (const group of groups.values()) {
    if (group.length < 2) continue;
    const [keep, ...rest] = group;
    const quantities = group.map((item) => item.quantity);
    const quantity = quantities.every((q) => q != null)
      ? quantities.reduce((sum, q) => sum! + q!, 0)
      : keep.quantity;
    await db
      .update(shoppingListItems)
      .set({ quantity, unit: normalizeUnit(keep.unit) })
      .where(eq(shoppingListItems.id, keep.id));
    await db.delete(shoppingListItems).where(inArray(shoppingListItems.id, rest.map((item) => item.id)));
  }
}

export async function updateShoppingItem(
  id: number,
  changes: Partial<Pick<ShoppingItem, "name" | "quantity" | "unit" | "category" | "checked">>,
) {
  if ("unit" in changes) changes = { ...changes, unit: normalizeUnit(changes.unit) };
  const [row] = await getDb()
    .update(shoppingListItems)
    .set(changes)
    .where(eq(shoppingListItems.id, id))
    .returning();
  return row;
}

export async function deleteShoppingItems(ids: number[]) {
  if (ids.length) await getDb().delete(shoppingListItems).where(inArray(shoppingListItems.id, ids));
}

export async function clearCheckedShoppingItems() {
  await getDb().delete(shoppingListItems).where(eq(shoppingListItems.checked, true));
}

// -----------------------------------------------------------------------------
// PANTRY
// -----------------------------------------------------------------------------

export async function getPantry() {
  return getDb().select().from(pantryItems).orderBy(asc(pantryItems.category), asc(pantryItems.name));
}

export async function addPantryItem(item: ItemInput & { expiresOn?: ISODate | null }) {
  const [row] = await getDb()
    .insert(pantryItems)
    .values({ ...item, name: item.name.trim().toLowerCase(), unit: normalizeUnit(item.unit) })
    .returning();
  return row;
}

export async function updatePantryItem(
  id: number,
  changes: Partial<Pick<PantryItem, "name" | "quantity" | "unit" | "category" | "expiresOn">>,
) {
  if ("unit" in changes) changes = { ...changes, unit: normalizeUnit(changes.unit) };
  const [row] = await getDb()
    .update(pantryItems)
    .set({ ...changes, updatedAt: new Date() })
    .where(eq(pantryItems.id, id))
    .returning();
  return row;
}

export async function deletePantryItem(id: number) {
  await getDb().delete(pantryItems).where(eq(pantryItems.id, id));
}

// -----------------------------------------------------------------------------
// PREFERENCES (the planner's memory)
// -----------------------------------------------------------------------------

export async function getPreferences() {
  return getDb().select().from(foodPreferences).orderBy(asc(foodPreferences.createdAt));
}

export async function addPreference(text: string) {
  const [row] = await getDb().insert(foodPreferences).values({ text: text.trim() }).returning();
  return row;
}

export async function deletePreference(id: number) {
  await getDb().delete(foodPreferences).where(eq(foodPreferences.id, id));
}

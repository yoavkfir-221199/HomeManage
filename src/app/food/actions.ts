// =============================================================================
// FOOD SERVER ACTIONS — what happens when you tap a button on a Food page
// =============================================================================
// "use server" turns every exported function here into a SERVER ACTION: the
// browser can call it like a normal function, but it actually runs on the
// server (where the database is). Next.js sends the request for you.
//
// After changing data, `revalidatePath("/food", "layout")` tells Next.js the
// Food pages are out of date, so they re-render with fresh data.
//
// Inputs come from the browser, so we validate them with Zod first: never
// trust what arrives from the client.
// =============================================================================

"use server";

import { revalidatePath } from "next/cache";
import { z } from "zod";

import * as data from "@/lib/food/data";

const id = z.number().int().positive();
const name = z.string().trim().min(1).max(100);
const quantity = z.number().positive().max(100000).nullable();
const unit = z.string().trim().max(20).nullable();

function refresh() {
  revalidatePath("/food", "layout");
}

// ---- Shopping list ----------------------------------------------------------

export async function addShoppingItem(input: { name: string; quantity?: number | null; unit?: string | null }) {
  const item = z.object({ name, quantity: quantity.optional(), unit: unit.optional() }).parse(input);
  await data.addShoppingItems([item]);
  refresh();
}

export async function updateShoppingItem(
  itemId: number,
  changes: { name?: string; quantity?: number | null; unit?: string | null; checked?: boolean },
) {
  const parsed = z
    .object({ name: name.optional(), quantity: quantity.optional(), unit: unit.optional(), checked: z.boolean().optional() })
    .parse(changes);
  await data.updateShoppingItem(id.parse(itemId), parsed);
  refresh();
}

export async function deleteShoppingItem(itemId: number) {
  await data.deleteShoppingItems([id.parse(itemId)]);
  refresh();
}

export async function clearBoughtItems() {
  await data.clearCheckedShoppingItems();
  refresh();
}

// ---- Pantry -----------------------------------------------------------------

export async function addPantryItem(input: { name: string; quantity?: number | null; unit?: string | null }) {
  const item = z.object({ name, quantity: quantity.optional(), unit: unit.optional() }).parse(input);
  await data.addPantryItem(item);
  refresh();
}

export async function updatePantryItem(
  itemId: number,
  changes: { name?: string; quantity?: number | null; unit?: string | null },
) {
  const parsed = z
    .object({ name: name.optional(), quantity: quantity.optional(), unit: unit.optional() })
    .parse(changes);
  await data.updatePantryItem(id.parse(itemId), parsed);
  refresh();
}

export async function deletePantryItem(itemId: number) {
  await data.deletePantryItem(id.parse(itemId));
  refresh();
}

// ---- Preferences (memory) ---------------------------------------------------

export async function addPreference(text: string) {
  await data.addPreference(z.string().trim().min(3).max(300).parse(text));
  refresh();
}

export async function deletePreference(prefId: number) {
  await data.deletePreference(id.parse(prefId));
  refresh();
}

/** Called by the planner chat after the AI changed data, to refresh the pages. */
export async function refreshFood() {
  refresh();
}

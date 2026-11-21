// =============================================================================
// PLANNER TOOLS — the AI's access to your weekly meal plan and memory
// =============================================================================
// Used by the chat on the Plan page. They call the shared data layer
// (src/lib/food/data.ts), the same functions the pages use, so a meal the AI
// plans and a meal you edit by hand are stored exactly the same way.
// =============================================================================

import { tool } from "ai";
import { z } from "zod";

import {
  addPreference,
  addShoppingItems,
  getWeekPlan,
  removeMeal,
  setMeals,
} from "@/lib/food/data";
import { MEALS, weekStartOf } from "@/lib/food/week";

const isoDate = z.string().date().describe("A date as YYYY-MM-DD.");

async function safely<T>(run: () => Promise<T>) {
  try {
    return await run();
  } catch (error) {
    console.error("Planner tool failed:", error);
    return { error: error instanceof Error ? error.message : String(error) };
  }
}

export const plannerTools = {
  get_week_plan: tool({
    description:
      "Read the meal plan for a week (defaults to the current week). Use before " +
      "changing a plan, or when the user asks what's planned.",
    inputSchema: z.object({
      weekStart: isoDate.optional().describe("The Sunday the week starts on. Omit for this week."),
    }),
    execute: ({ weekStart }) =>
      safely(async () => {
        const start = weekStartOf(weekStart);
        return { weekStart: start, plan: await getWeekPlan(start) };
      }),
  }),

  plan_meals: tool({
    description:
      "Save meals into the week plan. Each meal replaces what was planned for the same " +
      "day and meal slot. Use after the user agrees on what to eat, or asks to change a meal.",
    inputSchema: z.object({
      weekStart: isoDate.optional().describe("The Sunday the week starts on. Omit for this week."),
      meals: z
        .array(
          z.object({
            day: isoDate,
            meal: z.enum(MEALS),
            title: z.string().trim().min(1).describe("Short dish name, e.g. 'Shakshuka with salad'."),
            notes: z.string().optional().describe("Optional: who cooks, leftovers, a link…"),
          }),
        )
        .min(1),
    }),
    execute: ({ weekStart, meals }) =>
      safely(async () => {
        const start = weekStartOf(weekStart ?? meals[0].day);
        return { plan: await setMeals(start, meals) };
      }),
  }),

  remove_planned_meal: tool({
    description: "Remove one planned meal by id (ids come from get_week_plan).",
    inputSchema: z.object({ id: z.number().int() }),
    execute: ({ id }) =>
      safely(async () => {
        await removeMeal(id);
        return { removed: id };
      }),
  }),

  build_shopping_list: tool({
    description:
      "Add the ingredients needed for the planned meals to the shopping list. Before " +
      "calling, check get_pantry and leave out what the user already has. Quantities " +
      "should cover all the meals together (combine duplicates).",
    inputSchema: z.object({
      weekStart: isoDate.optional().describe("The week these items are for. Omit for this week."),
      items: z
        .array(
          z.object({
            name: z.string().trim().min(1).describe("Singular and lowercase, e.g. 'tomato'."),
            quantity: z.number().positive().optional(),
            unit: z.string().trim().optional().describe("g, kg, ml, l, pcs, pack, bunch…"),
            category: z
              .string()
              .trim()
              .optional()
              .describe("produce, dairy, meat, fish, bakery, pantry, spices, frozen, drinks, household, other"),
          }),
        )
        .min(1),
    }),
    execute: ({ weekStart, items }) =>
      safely(async () => {
        const plan = await getWeekPlan(weekStartOf(weekStart));
        return { added: await addShoppingItems(items, { planId: plan?.id }) };
      }),
  }),

  remember_preference: tool({
    description:
      "Save a lasting food preference or fact to memory (e.g. 'Noa is vegetarian', " +
      "'We usually eat eggs and salad for dinner'). Only when the user asks you to " +
      "remember something, or states a clear lasting preference.",
    inputSchema: z.object({
      text: z.string().trim().min(3).describe("One short sentence, written as a fact."),
    }),
    execute: ({ text }) => safely(async () => ({ remembered: await addPreference(text) })),
  }),
} as const;

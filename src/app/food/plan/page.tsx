// =============================================================================
// PLAN PAGE — this week's meals + the shopping list, with the AI planner
// =============================================================================
// A SERVER component: it reads the database directly while rendering on the
// server, then sends finished HTML to the phone. The interactive parts
// (editable list, planner chat) are client components inside it.
//
// The week shown comes from the URL: /food/plan?week=2026-11-29 shows that
// week; no `week` means the current week.
// =============================================================================

import Link from "next/link";

import { clearBoughtItems, addShoppingItem, deleteShoppingItem, updateShoppingItem } from "@/app/food/actions";
import { ChevronLeftIcon, ChevronRightIcon } from "@/components/icons";
import { ItemList } from "@/components/food/item-list";
import { PlannerChat } from "@/components/food/planner-chat";
import { WeekPlan } from "@/components/food/week-plan";
import { getShoppingList, getWeekPlan } from "@/lib/food/data";
import { addDays, today, weekLabel, weekStartOf } from "@/lib/food/week";

// Always render with fresh data (never cache this page).
export const dynamic = "force-dynamic";

export default async function PlanPage({ searchParams }: { searchParams: Promise<{ week?: string }> }) {
  const { week } = await searchParams;
  const now = today();
  const thisWeek = weekStartOf(now);
  // No week in the URL: show this week, except on Friday and Saturday, when the
  // week is almost over and you're planning the next one.
  const isWeekend = new Date(`${now}T00:00:00Z`).getUTCDay() >= 5;
  const defaultWeek = isWeekend ? addDays(thisWeek, 7) : thisWeek;
  const weekStart = week && /^\d{4}-\d{2}-\d{2}$/.test(week) ? weekStartOf(week) : defaultWeek;

  // Both queries run at the same time.
  const [plan, shoppingList] = await Promise.all([getWeekPlan(weekStart), getShoppingList()]);
  const boughtCount = shoppingList.filter((item) => item.checked).length;

  const relative =
    weekStart === thisWeek ? "This week" : weekStart === addDays(thisWeek, 7) ? "Next week" : weekStart < thisWeek ? "Past week" : "Later";

  return (
    <div className="hm-stack">
      <section className="hm-card">
        <div className="hm-week-nav">
          <Link href={`/food/plan?week=${addDays(weekStart, -7)}`} className="hm-icon-btn" aria-label="Previous week">
            <ChevronLeftIcon />
          </Link>
          <div style={{ textAlign: "center" }}>
            <p className="hm-section-title">{relative}</p>
            <p className="hm-muted hm-small">{weekLabel(weekStart)}</p>
          </div>
          <Link href={`/food/plan?week=${addDays(weekStart, 7)}`} className="hm-icon-btn" aria-label="Next week">
            <ChevronRightIcon />
          </Link>
        </div>
        {plan?.meals.length ? (
          <WeekPlan weekStart={weekStart} meals={plan.meals} today={now} />
        ) : (
          <div className="hm-empty">
            <strong>No meals planned yet</strong>
            Tell the planner below what you feel like eating.
          </div>
        )}
      </section>

      <section className="hm-card">
        <div className="hm-card-header">
          <h2 className="hm-section-title">Shopping list</h2>
          {boughtCount > 0 && (
            // A plain form calling a server action: works even before the
            // page's JavaScript has loaded.
            <form action={clearBoughtItems}>
              <button type="submit" className="hm-link-btn">
                Clear {boughtCount} bought
              </button>
            </form>
          )}
        </div>
        <ItemList
          items={shoppingList}
          checkable
          onAdd={addShoppingItem}
          onUpdate={updateShoppingItem}
          onDelete={deleteShoppingItem}
          addPlaceholder="Add an item, e.g. 2 kg tomatoes"
          emptyTitle="Your list is empty"
          emptyText="Plan the week and the planner will fill it, or add items here."
        />
      </section>

      <PlannerChat weekStart={weekStart} weekLabel={weekLabel(weekStart)} />
    </div>
  );
}

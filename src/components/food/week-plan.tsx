// =============================================================================
// WEEK PLAN — the 7 days of a week and what's planned for each
// =============================================================================
// A server component (no "use client": it has no state or clicks), used by
// the Plan and History pages. It's `async` so it can read the language
// setting itself.
// =============================================================================

import { type ISODate, dayName, weekDays } from "@/lib/food/week";
import { getI18n } from "@/lib/settings";

type Meal = { id: number; day: string; meal: string; title: string };

export async function WeekPlan({
  weekStart,
  meals,
  today,
  compact = false,
}: {
  weekStart: ISODate;
  meals: Meal[];
  today?: ISODate;
  /** History: show only days that have meals. */
  compact?: boolean;
}) {
  const { t, locale } = await getI18n();
  const days = weekDays(weekStart).filter((day) => !compact || meals.some((m) => m.day === day));

  return (
    <div>
      {days.map((day) => {
        const dayMeals = meals.filter((m) => m.day === day);
        return (
          <div className="hm-day" key={day}>
            <div className={`hm-day-label${day === today ? " today" : ""}`}>
              <span className="hm-day-name">{dayName(day, "short", locale)}</span>
              <span className="hm-day-num">{Number(day.slice(8))}</span>
            </div>
            {dayMeals.length ? (
              <div>
                {dayMeals.map((meal) => (
                  <p className="hm-meal" key={meal.id}>
                    <span className="hm-meal-kind">{t.week.meals[meal.meal] ?? meal.meal}</span>
                    <span className="hm-meal-title">{meal.title}</span>
                  </p>
                ))}
              </div>
            ) : (
              <span className="hm-no-meal">{t.week.nothingPlanned}</span>
            )}
          </div>
        );
      })}
    </div>
  );
}

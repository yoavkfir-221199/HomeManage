// =============================================================================
// HISTORY PAGE — what you ate in past weeks
// =============================================================================
// Every week you plan stays in the database. Here you can look back for ideas
// ("what was that pasta we liked?"). Later the planner can use this too, e.g.
// to avoid repeating the same dinners every week.
// =============================================================================

import Link from "next/link";

import { WeekPlan } from "@/components/food/week-plan";
import { getPastPlans } from "@/lib/food/data";
import { weekLabel } from "@/lib/food/week";
import { localizeMeals } from "@/lib/i18n/translate";
import { getI18n } from "@/lib/settings";

export const dynamic = "force-dynamic";

export default async function HistoryPage() {
  const { t, locale, lang } = await getI18n();
  const pastWeeks = (await getPastPlans()).filter((week) => week.meals.length > 0);
  // Translate every week's dish titles in one go (one AI call at most).
  const allMeals = await localizeMeals(
    pastWeeks.flatMap((week) => week.meals),
    lang,
  );
  const weeks = pastWeeks.map((week) => ({ ...week, meals: allMeals.filter((m) => m.planId === week.id) }));

  if (!weeks.length) {
    return (
      <section className="hm-card">
        <div className="hm-empty">
          <strong>{t.history.emptyTitle}</strong>
          {t.history.emptyText}
        </div>
      </section>
    );
  }

  return (
    <div className="hm-stack">
      {weeks.map((week) => (
        <section className="hm-card" key={week.id}>
          <div className="hm-card-header">
            <h2 className="hm-section-title">{weekLabel(week.weekStart, locale)}</h2>
            <Link href={`/food/plan?week=${week.weekStart}`} className="hm-link-btn">
              {t.history.open}
            </Link>
          </div>
          <WeekPlan weekStart={week.weekStart} meals={week.meals} compact />
        </section>
      ))}
    </div>
  );
}

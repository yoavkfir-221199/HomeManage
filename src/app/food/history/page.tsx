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

export const dynamic = "force-dynamic";

export default async function HistoryPage() {
  const weeks = (await getPastPlans()).filter((week) => week.meals.length > 0);

  if (!weeks.length) {
    return (
      <section className="hm-card">
        <div className="hm-empty">
          <strong>No history yet</strong>
          Weeks you plan show up here once they&apos;re over.
        </div>
      </section>
    );
  }

  return (
    <div className="hm-stack">
      {weeks.map((week) => (
        <section className="hm-card" key={week.id}>
          <div className="hm-card-header">
            <h2 className="hm-section-title">{weekLabel(week.weekStart)}</h2>
            <Link href={`/food/plan?week=${week.weekStart}`} className="hm-link-btn">
              Open
            </Link>
          </div>
          <WeekPlan weekStart={week.weekStart} meals={week.meals} compact />
        </section>
      ))}
    </div>
  );
}

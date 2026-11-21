// =============================================================================
// FOOD SECTION LAYOUT
// =============================================================================
// In Next.js, a `layout.tsx` wraps every page in its folder. So all pages under
// src/app/food/ (plan, pantry, history, preferences) share this header, the
// tabs and the bottom navigation. Only the part in {children} changes per page.
// =============================================================================

import { BottomNav } from "@/components/shell/bottom-nav";
import { SectionTabs } from "@/components/shell/section-tabs";
import { getI18n } from "@/lib/settings";

export default async function FoodLayout({ children }: { children: React.ReactNode }) {
  const { t } = await getI18n();

  const tabs = [
    { href: "/food/plan", label: t.food.tabs.plan },
    { href: "/food/pantry", label: t.food.tabs.pantry },
    { href: "/food/history", label: t.food.tabs.history },
    { href: "/food/preferences", label: t.food.tabs.preferences },
  ];

  return (
    <>
      <main className="hm-app">
        <header className="hm-header">
          <p className="hm-eyebrow">{t.appName}</p>
          <h1 className="hm-title">{t.food.title}</h1>
        </header>
        <SectionTabs tabs={tabs} label={t.food.pagesLabel} />
        {children}
      </main>
      <BottomNav />
    </>
  );
}

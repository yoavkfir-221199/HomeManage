// =============================================================================
// FOOD SECTION LAYOUT
// =============================================================================
// In Next.js, a `layout.tsx` wraps every page in its folder. So all pages under
// src/app/food/ (plan, pantry, history, settings) share this header, the tabs
// and the bottom navigation. Only the part in {children} changes per page.
// =============================================================================

import { BottomNav } from "@/components/shell/bottom-nav";
import { SectionTabs } from "@/components/shell/section-tabs";

const FOOD_TABS = [
  { href: "/food/plan", label: "Plan" },
  { href: "/food/pantry", label: "Pantry" },
  { href: "/food/history", label: "History" },
  { href: "/food/settings", label: "Settings" },
];

export default function FoodLayout({ children }: { children: React.ReactNode }) {
  return (
    <>
      <main className="hm-app">
        <header className="hm-header">
          <p className="hm-eyebrow">HomeManage</p>
          <h1 className="hm-title">Food</h1>
        </header>
        <SectionTabs tabs={FOOD_TABS} />
        {children}
      </main>
      <BottomNav />
    </>
  );
}

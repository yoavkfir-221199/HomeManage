"use client";

// The bar at the bottom of the screen: one button per SECTION of the home,
// plus the app Settings. Only Food exists so far; Plants and Money are shown
// as "soon" so the app's structure is visible from day one. To add a section
// later: create src/app/<section>/, then set `href` and remove `soon` here.

import Link from "next/link";
import { usePathname } from "next/navigation";

import { FoodIcon, PlantIcon, SettingsIcon, WalletIcon } from "@/components/icons";
import { useSettings } from "@/components/settings-provider";

export function BottomNav() {
  // The current URL, e.g. "/food/pantry" — used to highlight the active section.
  const pathname = usePathname();
  const { t } = useSettings();

  const sections = [
    { href: "/food/plan", match: "/food", label: t.nav.food, Icon: FoodIcon },
    { href: null, match: "/plants", label: t.nav.plants, Icon: PlantIcon, soon: true },
    { href: null, match: "/money", label: t.nav.money, Icon: WalletIcon, soon: true },
    { href: "/settings", match: "/settings", label: t.nav.settings, Icon: SettingsIcon },
  ];

  return (
    <nav className="hm-nav" aria-label={t.nav.sections}>
      <div className="hm-nav-inner">
        {sections.map(({ href, match, label, Icon, soon }) =>
          href ? (
            <Link
              key={match}
              href={href}
              className="hm-nav-item"
              aria-current={pathname.startsWith(match) ? "page" : undefined}
            >
              <Icon />
              {label}
            </Link>
          ) : (
            <span key={match} className="hm-nav-item" aria-disabled="true">
              <Icon />
              <span className="hm-row" style={{ gap: 4 }}>
                {label}
                {soon && <span className="hm-soon">{t.nav.soon}</span>}
              </span>
            </span>
          ),
        )}
      </div>
    </nav>
  );
}

"use client";

// The bar at the bottom of the screen: one button per SECTION of the home.
// Only Food exists so far; Plants and Money are shown as "soon" so the app's
// structure is visible from day one. To add a section later: create
// src/app/<section>/, then set `href` and remove `soon` here.

import Link from "next/link";
import { usePathname } from "next/navigation";

import { FoodIcon, PlantIcon, WalletIcon } from "@/components/icons";

const SECTIONS = [
  { href: "/food/plan", match: "/food", label: "Food", Icon: FoodIcon },
  { href: null, match: "/plants", label: "Plants", Icon: PlantIcon, soon: true },
  { href: null, match: "/money", label: "Money", Icon: WalletIcon, soon: true },
];

export function BottomNav() {
  // The current URL, e.g. "/food/pantry" — used to highlight the active section.
  const pathname = usePathname();

  return (
    <nav className="hm-nav" aria-label="Sections">
      <div className="hm-nav-inner">
        {SECTIONS.map(({ href, match, label, Icon, soon }) =>
          href ? (
            <Link
              key={label}
              href={href}
              className="hm-nav-item"
              aria-current={pathname.startsWith(match) ? "page" : undefined}
            >
              <Icon />
              {label}
            </Link>
          ) : (
            <span key={label} className="hm-nav-item" aria-disabled="true">
              <Icon />
              <span className="hm-row" style={{ gap: 4 }}>
                {label}
                {soon && <span className="hm-soon">soon</span>}
              </span>
            </span>
          ),
        )}
      </div>
    </nav>
  );
}

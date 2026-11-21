"use client";

// The pill-shaped tabs at the top of a section (Plan / Pantry / History /
// Settings). Each tab is a real page with its own URL, so the browser's back
// button and links work as expected.

import Link from "next/link";
import { usePathname } from "next/navigation";

export function SectionTabs({ tabs }: { tabs: { href: string; label: string }[] }) {
  const pathname = usePathname();
  return (
    <nav className="hm-tabs" aria-label="Pages">
      {tabs.map((tab) => (
        <Link
          key={tab.href}
          href={tab.href}
          className="hm-tab"
          aria-current={pathname === tab.href ? "page" : undefined}
        >
          {tab.label}
        </Link>
      ))}
    </nav>
  );
}

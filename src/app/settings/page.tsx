// =============================================================================
// SETTINGS PAGE — app-wide settings (language, appearance)
// =============================================================================
// Reached from the gear in the bottom bar. Food-specific settings (what the
// planner remembers) stay in the Food section's "Preferences" tab.
// =============================================================================

import { BottomNav } from "@/components/shell/bottom-nav";
import { SettingsForm } from "@/components/settings-form";
import { getI18n, getSettings } from "@/lib/settings";

export const dynamic = "force-dynamic";

export default async function SettingsPage() {
  const [{ t }, { lang, theme }] = await Promise.all([getI18n(), getSettings()]);

  return (
    <>
      <main className="hm-app">
        <header className="hm-header">
          <p className="hm-eyebrow">{t.appName}</p>
          <h1 className="hm-title">{t.settings.title}</h1>
        </header>
        <SettingsForm lang={lang} theme={theme} />
      </main>
      <BottomNav />
    </>
  );
}

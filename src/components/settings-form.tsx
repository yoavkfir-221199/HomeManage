"use client";

// The choices on the Settings page. Each tap saves a cookie through a server
// action (src/app/settings/actions.ts); the server then re-renders the app in
// the new language / colors.

import { useOptimistic, useTransition } from "react";

import { setLanguage, setTheme } from "@/app/settings/actions";
import { AutoIcon, MoonIcon, SunIcon } from "@/components/icons";
import { useSettings } from "@/components/settings-provider";
import type { Lang } from "@/lib/i18n/dictionaries";

type Theme = "light" | "dark" | "system";

// Language names are always written in their own language, so you can find
// yours even if the app is in a language you can't read.
const LANGUAGE_OPTIONS: { value: Lang; label: string }[] = [
  { value: "he", label: "עברית" },
  { value: "en", label: "English" },
];

export function SettingsForm({ lang, theme }: { lang: Lang; theme: Theme }) {
  const { t } = useSettings();
  const [, startTransition] = useTransition();

  // Show the new choice immediately while the server saves it.
  const [shownLang, setShownLang] = useOptimistic(lang);
  const [shownTheme, setShownTheme] = useOptimistic(theme);

  function chooseLanguage(value: Lang) {
    startTransition(async () => {
      setShownLang(value);
      await setLanguage(value);
    });
  }

  function chooseTheme(value: Theme) {
    // Switch colors right away (no waiting for the server round trip).
    document.documentElement.setAttribute("data-theme", value);
    startTransition(async () => {
      setShownTheme(value);
      await setTheme(value);
    });
  }

  const themeOptions: { value: Theme; label: string; Icon: typeof SunIcon }[] = [
    { value: "light", label: t.settings.themes.light, Icon: SunIcon },
    { value: "dark", label: t.settings.themes.dark, Icon: MoonIcon },
    { value: "system", label: t.settings.themes.system, Icon: AutoIcon },
  ];

  return (
    <div className="hm-stack">
      <section className="hm-card">
        <h2 className="hm-section-title">{t.settings.language}</h2>
        <p className="hm-muted hm-small" style={{ margin: "2px 0 14px" }}>
          {t.settings.languageHint}
        </p>
        <div className="hm-choice-group" role="radiogroup" aria-label={t.settings.language}>
          {LANGUAGE_OPTIONS.map((option) => (
            <button
              key={option.value}
              type="button"
              role="radio"
              aria-checked={shownLang === option.value}
              className="hm-choice"
              lang={option.value}
              onClick={() => chooseLanguage(option.value)}
            >
              {option.label}
            </button>
          ))}
        </div>
      </section>

      <section className="hm-card">
        <h2 className="hm-section-title">{t.settings.appearance}</h2>
        <p className="hm-muted hm-small" style={{ margin: "2px 0 14px" }}>
          {t.settings.appearanceHint}
        </p>
        <div className="hm-choice-group" role="radiogroup" aria-label={t.settings.appearance}>
          {themeOptions.map(({ value, label, Icon }) => (
            <button
              key={value}
              type="button"
              role="radio"
              aria-checked={shownTheme === value}
              className="hm-choice"
              onClick={() => chooseTheme(value)}
            >
              <Icon />
              {label}
            </button>
          ))}
        </div>
      </section>

      <p className="hm-muted hm-small" style={{ textAlign: "center" }}>
        {t.settings.deviceNote}
      </p>
    </div>
  );
}

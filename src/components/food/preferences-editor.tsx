"use client";

// The list of saved food preferences, with a box to add a new one.

import { useOptimistic, useState, useTransition } from "react";

import { TrashIcon } from "@/components/icons";
import { useSettings } from "@/components/settings-provider";

type Preference = { id: number; text: string };

export function PreferencesEditor({
  preferences,
  onAdd,
  onDelete,
}: {
  preferences: Preference[];
  onAdd: (text: string) => Promise<void>;
  onDelete: (id: number) => Promise<void>;
}) {
  const { t } = useSettings();
  const [text, setText] = useState("");
  const [, startTransition] = useTransition();
  const [optimistic, removeOptimistic] = useOptimistic(preferences, (current, id: number) =>
    current.filter((p) => p.id !== id),
  );

  function save(value: string) {
    const trimmed = value.trim();
    if (trimmed.length < 3) return;
    setText("");
    startTransition(() => onAdd(trimmed));
  }

  return (
    <div className="hm-stack" style={{ gap: 10 }}>
      {optimistic.map((pref) => (
        <div className="hm-pref" key={pref.id}>
          <p>{pref.text}</p>
          <button
            type="button"
            className="hm-icon-btn"
            style={{ width: 28, height: 28 }}
            aria-label={t.preferences.forget(pref.text)}
            onClick={() =>
              startTransition(async () => {
                removeOptimistic(pref.id);
                await onDelete(pref.id);
              })
            }
          >
            <TrashIcon />
          </button>
        </div>
      ))}

      <form
        className="hm-stack"
        style={{ gap: 10, marginTop: optimistic.length ? 8 : 0 }}
        onSubmit={(e) => {
          e.preventDefault();
          save(text);
        }}
      >
        <textarea
          className="hm-textarea"
          value={text}
          onChange={(e) => setText(e.target.value)}
          placeholder={t.preferences.placeholder}
          aria-label={t.preferences.newLabel}
          rows={2}
        />
        <button type="submit" className="hm-btn" disabled={text.trim().length < 3}>
          {t.preferences.save}
        </button>
      </form>

      {optimistic.length === 0 && (
        <div>
          <p className="hm-muted hm-small" style={{ margin: "8px 0" }}>
            {t.preferences.ideas}
          </p>
          <div className="hm-suggestions">
            {t.preferences.examples.map((example) => (
              <button key={example} type="button" className="hm-suggestion" onClick={() => setText(example)}>
                {example}
              </button>
            ))}
          </div>
        </div>
      )}
    </div>
  );
}

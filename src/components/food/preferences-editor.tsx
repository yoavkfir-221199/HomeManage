"use client";

// The list of saved food preferences, with a box to add a new one.

import { useOptimistic, useState, useTransition } from "react";

import { TrashIcon } from "@/components/icons";

type Preference = { id: number; text: string };

const EXAMPLES = [
  "We usually eat eggs and salad for dinner",
  "Noa doesn't eat red meat",
  "Weekday dinners should take under 30 minutes",
];

export function PreferencesEditor({
  preferences,
  onAdd,
  onDelete,
}: {
  preferences: Preference[];
  onAdd: (text: string) => Promise<void>;
  onDelete: (id: number) => Promise<void>;
}) {
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
            aria-label={`Forget "${pref.text}"`}
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
          placeholder="e.g. We usually eat eggs and salad for dinner"
          aria-label="New preference"
          rows={2}
        />
        <button type="submit" className="hm-btn" disabled={text.trim().length < 3}>
          Remember this
        </button>
      </form>

      {optimistic.length === 0 && (
        <div>
          <p className="hm-muted hm-small" style={{ margin: "8px 0" }}>
            Ideas to start with:
          </p>
          <div className="hm-suggestions">
            {EXAMPLES.map((example) => (
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

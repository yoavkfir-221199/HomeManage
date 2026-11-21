"use client";

// =============================================================================
// ITEM LIST — the editable list used by the Shopping list and the Pantry
// =============================================================================
// Regular React (not AI-generated UI): the AI fills the database, and this
// component lets you fix things by hand. Every change calls a server action
// (src/app/food/actions.ts), which saves it and refreshes the page.
//
// `useOptimistic` shows your change immediately, before the server answers,
// so ticking an item feels instant even on a slow connection.
// =============================================================================

import { useOptimistic, useState, useTransition } from "react";

import { CheckIcon, PencilIcon, PlusIcon, TrashIcon } from "@/components/icons";
import { useSettings } from "@/components/settings-provider";

export type ListItem = {
  id: number;
  name: string;
  quantity: number | null;
  unit: string | null;
  category: string | null;
  checked?: boolean;
};

type Changes = { name?: string; quantity?: number | null; unit?: string | null; checked?: boolean };

type Props = {
  items: ListItem[];
  /** Shopping list items can be ticked off; pantry items can't. */
  checkable?: boolean;
  onAdd: (item: { name: string; quantity: number | null; unit: string | null }) => Promise<void>;
  onUpdate: (id: number, changes: Changes) => Promise<void>;
  onDelete: (id: number) => Promise<void>;
  addPlaceholder: string;
  emptyTitle: string;
  emptyText: string;
};

/** "500 g", "6 pcs", "1.5 l" — or nothing when there's no amount. */
export function formatQty(quantity: number | null, unit: string | null) {
  if (quantity == null) return unit ?? "";
  const n = Number.isInteger(quantity) ? quantity : Math.round(quantity * 100) / 100;
  return unit ? `${n} ${unit}` : String(n);
}

/** Read "2 kg tomatoes" / "tomatoes 2kg" / "2 ק״ג עגבניות" / "milk" into name + quantity + unit. */
export function parseQuickAdd(text: string) {
  const units =
    "kg|g|mg|l|ml|pcs|pc|pack|packs|bunch|can|cans|cup|cups|tbsp|tsp|dozen|" +
    // Hebrew: kg, gram, liter, ml, units, pack(s), bunch, can
    "ק[\"״]?ג|גרם|ג׳|ליטר|ל׳|מ[\"״]?ל|יח[׳']?|יחידות|חבילה|חבילות|צרור|קופסה|קופסאות";
  const lead = text.match(new RegExp(`^(\\d+(?:[.,]\\d+)?)\\s*(${units})?\\s+(.+)$`, "i"));
  const tail = text.match(new RegExp(`^(.+?)\\s+(\\d+(?:[.,]\\d+)?)\\s*(${units})?$`, "i"));
  const toNum = (s: string) => Number(s.replace(",", "."));
  if (lead) return { name: lead[3].trim(), quantity: toNum(lead[1]), unit: lead[2]?.toLowerCase() ?? null };
  if (tail) return { name: tail[1].trim(), quantity: toNum(tail[2]), unit: tail[3]?.toLowerCase() ?? null };
  return { name: text.trim(), quantity: null, unit: null };
}

export function ItemList(props: Props) {
  const { items, checkable } = props;
  const { t } = useSettings();
  const [, startTransition] = useTransition();

  // Optimistic copy of the list: changes show instantly, then the real data
  // from the server replaces it.
  const [optimisticItems, applyOptimistic] = useOptimistic(
    items,
    (current, action: { type: "update"; id: number; changes: Changes } | { type: "delete"; id: number }) =>
      action.type === "delete"
        ? current.filter((item) => item.id !== action.id)
        : current.map((item) => (item.id === action.id ? { ...item, ...action.changes } : item)),
  );

  const [editingId, setEditingId] = useState<number | null>(null);
  const [newItem, setNewItem] = useState("");

  function update(id: number, changes: Changes) {
    startTransition(async () => {
      applyOptimistic({ type: "update", id, changes });
      await props.onUpdate(id, changes);
    });
  }

  function remove(id: number) {
    startTransition(async () => {
      applyOptimistic({ type: "delete", id });
      await props.onDelete(id);
    });
  }

  function add(event: React.FormEvent) {
    event.preventDefault();
    const parsed = parseQuickAdd(newItem);
    if (!parsed.name) return;
    setNewItem("");
    startTransition(() => props.onAdd(parsed));
  }

  // Group by store section: unbought items by category, bought ones at the end.
  // Categories are stored as English keys ("produce"); the label is translated.
  const CART = "__cart";
  const groups = new Map<string, ListItem[]>();
  for (const item of optimisticItems) {
    const key = checkable && item.checked ? CART : (item.category || "other").toLowerCase();
    groups.set(key, [...(groups.get(key) ?? []), item]);
  }
  const sortedGroups = [...groups.entries()].sort(([a], [b]) =>
    a === CART ? 1 : b === CART ? -1 : a === "other" ? 1 : b === "other" ? -1 : a.localeCompare(b),
  );
  const groupLabel = (key: string) => (key === CART ? t.list.inCart : (t.list.categories[key] ?? key));

  return (
    <div>
      {optimisticItems.length === 0 ? (
        <div className="hm-empty">
          <strong>{props.emptyTitle}</strong>
          {props.emptyText}
        </div>
      ) : (
        sortedGroups.map(([group, groupItems]) => (
          <div className="hm-group" key={group}>
            <p className="hm-group-label">{groupLabel(group)}</p>
            {groupItems.map((item) =>
              editingId === item.id ? (
                <EditRow
                  key={item.id}
                  item={item}
                  onCancel={() => setEditingId(null)}
                  onSave={(changes) => {
                    setEditingId(null);
                    update(item.id, changes);
                  }}
                />
              ) : (
                <div key={item.id} className={`hm-item${item.checked ? " checked" : ""}`}>
                  {checkable && (
                    <button
                      type="button"
                      role="checkbox"
                      aria-checked={!!item.checked}
                      aria-label={t.list.bought(item.name)}
                      className="hm-check"
                      onClick={() => update(item.id, { checked: !item.checked })}
                    >
                      {item.checked && <CheckIcon />}
                    </button>
                  )}
                  <span className="hm-item-name">{item.name}</span>
                  {(item.quantity != null || item.unit) && (
                    <span className="hm-qty">{formatQty(item.quantity, item.unit)}</span>
                  )}
                  <button
                    type="button"
                    className="hm-icon-btn"
                    aria-label={t.list.edit(item.name)}
                    onClick={() => setEditingId(item.id)}
                  >
                    <PencilIcon />
                  </button>
                  <button
                    type="button"
                    className="hm-icon-btn"
                    aria-label={t.list.remove(item.name)}
                    onClick={() => remove(item.id)}
                  >
                    <TrashIcon />
                  </button>
                </div>
              ),
            )}
          </div>
        ))
      )}

      <form className="hm-add-row" onSubmit={add}>
        <input
          className="hm-input"
          value={newItem}
          onChange={(e) => setNewItem(e.target.value)}
          placeholder={props.addPlaceholder}
          aria-label={t.list.newItem}
        />
        <button type="submit" className="hm-send" disabled={!newItem.trim()} aria-label={t.list.addItem}>
          <PlusIcon />
        </button>
      </form>
    </div>
  );
}

// The row shown while editing an item: name, amount, unit.
function EditRow({
  item,
  onSave,
  onCancel,
}: {
  item: ListItem;
  onSave: (changes: Changes) => void;
  onCancel: () => void;
}) {
  const { t } = useSettings();
  const [name, setName] = useState(item.name);
  const [quantity, setQuantity] = useState(item.quantity?.toString() ?? "");
  const [unit, setUnit] = useState(item.unit ?? "");

  return (
    <form
      className="hm-edit-row"
      onSubmit={(e) => {
        e.preventDefault();
        const q = quantity.trim() === "" ? null : Number(quantity.replace(",", "."));
        onSave({
          name: name.trim() || item.name,
          quantity: q != null && Number.isFinite(q) && q > 0 ? q : null,
          unit: unit.trim() || null,
        });
      }}
    >
      <input className="hm-input" value={name} onChange={(e) => setName(e.target.value)} aria-label={t.list.name} autoFocus />
      <input
        className="hm-input"
        value={quantity}
        onChange={(e) => setQuantity(e.target.value)}
        inputMode="decimal"
        placeholder={t.list.qty}
        aria-label={t.list.quantity}
      />
      <input className="hm-input" value={unit} onChange={(e) => setUnit(e.target.value)} placeholder={t.list.unit} aria-label={t.list.unit} />
      <div className="hm-edit-actions">
        <button type="button" className="hm-btn hm-btn-quiet hm-btn-small" onClick={onCancel}>
          {t.list.cancel}
        </button>
        <button type="submit" className="hm-btn hm-btn-small">
          {t.list.save}
        </button>
      </div>
    </form>
  );
}

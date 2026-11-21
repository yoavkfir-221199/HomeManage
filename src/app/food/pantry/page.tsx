// =============================================================================
// PANTRY PAGE — what you have at home
// =============================================================================
// The planner reads this before planning, and skips what you already have when
// it builds the shopping list. Keep it roughly up to date by hand here, or ask
// the planner ("we finished the eggs").
// =============================================================================

import { addPantryItem, deletePantryItem, updatePantryItem } from "@/app/food/actions";
import { ItemList } from "@/components/food/item-list";
import { getPantry } from "@/lib/food/data";
import { localizeNames } from "@/lib/i18n/translate";
import { getI18n } from "@/lib/settings";

export const dynamic = "force-dynamic";

export default async function PantryPage() {
  const [rawPantry, { t, lang }] = await Promise.all([getPantry(), getI18n()]);
  const pantry = await localizeNames(rawPantry, lang);

  return (
    <section className="hm-card">
      <div className="hm-card-header">
        <h2 className="hm-section-title">{t.pantry.atHome}</h2>
        <span className="hm-muted hm-small">{t.pantry.items(pantry.length)}</span>
      </div>
      <ItemList
        items={pantry}
        onAdd={addPantryItem}
        onUpdate={updatePantryItem}
        onDelete={deletePantryItem}
        addPlaceholder={t.pantry.add}
        emptyTitle={t.pantry.emptyTitle}
        emptyText={t.pantry.emptyText}
      />
    </section>
  );
}

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

export const dynamic = "force-dynamic";

export default async function PantryPage() {
  const pantry = await getPantry();

  return (
    <section className="hm-card">
      <div className="hm-card-header">
        <h2 className="hm-section-title">At home</h2>
        <span className="hm-muted hm-small">{pantry.length} items</span>
      </div>
      <ItemList
        items={pantry}
        onAdd={addPantryItem}
        onUpdate={updatePantryItem}
        onDelete={deletePantryItem}
        addPlaceholder="Add to pantry, e.g. 6 pcs eggs"
        emptyTitle="Your pantry is empty"
        emptyText="Add what you have at home so the planner can use it."
      />
    </section>
  );
}

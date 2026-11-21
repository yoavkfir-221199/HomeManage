// =============================================================================
// SETTINGS PAGE — the planner's memory
// =============================================================================
// Each preference you save here is added to the AI's instructions on EVERY
// chat request (see buildPreamble in src/app/api/chat/route.ts). That's what
// makes it a memory: the planner always knows these facts about you.
// The planner can also add to this list when you tell it to remember something.
// =============================================================================

import { addPreference, deletePreference } from "@/app/food/actions";
import { PreferencesEditor } from "@/components/food/preferences-editor";
import { getPreferences } from "@/lib/food/data";

export const dynamic = "force-dynamic";

export default async function SettingsPage() {
  const preferences = await getPreferences();

  return (
    <section className="hm-card">
      <div className="hm-card-header">
        <h2 className="hm-section-title">What the planner remembers</h2>
      </div>
      <p className="hm-muted" style={{ fontSize: 15, marginBottom: 16 }}>
        Habits, likes and dislikes. The planner follows these every time it plans.
      </p>
      <PreferencesEditor preferences={preferences} onAdd={addPreference} onDelete={deletePreference} />
    </section>
  );
}

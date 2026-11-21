// =============================================================================
// STARTERS — the suggestion cards on the empty chat screen
// =============================================================================
// Used in src/components/cloud-chat.tsx (`starters={STARTERS}` and `logoUrl`).
// Clicking a starter sends its `prompt` as if you had typed it.
// =============================================================================

// One mark for both themes: the mascot reads on light and dark surfaces.
// The path points to public/openui-logo.svg (files in `public/` are served
// from the site root, so "/openui-logo.svg").
export const OPENUI_LOGO = "/openui-logo.svg";

// No icon: starters show the default lightbulb.
//
// Each starter has two texts:
//   displayText -> the short label you SEE on the card
//   prompt      -> the full message actually SENT to the AI
//
// Notice the prompts name specific components ("Use a Table…", "Use an
// interactive Chart…", "Start with a Form…"). That's a handy trick in OpenUI:
// you can steer which component from the library the AI uses just by asking.
// Each one here shows off a different kind of generated UI:
//   Table -> comparing data
//   Chart -> numbers over time, interactive
//   Form  -> the AI asking YOU questions, then continuing from your answers
//
// Later we'll replace these with HomeManage ones, e.g.
//   "What can I cook tonight?", "Plan this week's groceries".
export const STARTERS = [
  {
    displayText: "Compare breakfast nutrition",
    prompt:
      "Use a Table to compare the nutrition of common breakfast foods: oatmeal, eggs, Greek yogurt, avocado toast, and a banana.",
  },
  {
    displayText: "See how compound interest grows",
    prompt:
      "Use an interactive Chart to explain compound interest with $10,000 invested at 7% for 30 years.",
  },
  {
    displayText: "Help me pick a car",
    prompt:
      "Help me pick the right type of car for my lifestyle. Start with a Form to ask me a few questions.",
  },
];

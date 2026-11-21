// =============================================================================
// THE COMPONENT LIBRARY — "what the AI is allowed to draw"
// =============================================================================
// In OpenUI, the AI doesn't write HTML or React. It writes OpenUI Lang, which
// can only use components from a COMPONENT LIBRARY. The library is the
// contract between the AI and your app:
//
//   - On the SERVER, the library is turned into a system prompt
//     (see generateSystemPrompt in src/app/api/chat/route.ts), so the model
//     knows which components exist and what props they take.
//   - In the BROWSER, the SAME library is given to the renderer
//     (see componentLibrary={library} in src/components/cloud-chat.tsx),
//     so it knows how to draw each component.
//
// Both sides must use the same library, or the AI would write components
// the browser can't draw.
//
// HOW THIS FILE IS USED:
// It's the entry point for the `openui generate` command
// (`npm run generate`, which also runs before `npm run dev`). That command
// reads the two exports below and writes them to src/generated/spec.json —
// a plain JSON version the server route imports.
// => After changing the library, run `npm run generate` (or restart dev).
//
// RIGHT NOW we just re-export OpenUI's ready-made "intelligent UI" library,
// which includes general components like Table, Chart, Form, Card, etc.
//
// LATER (step 5 of the plan) we'll build our own HomeManage library here —
// e.g. RecipeCard, ShoppingList, PantryTable — using `defineComponent` and
// `createLibrary` from @openuidev/react-lang, possibly mixed with the built-in
// components. That's the core skill OpenUI is about.
// =============================================================================

/** Entry point for `openui generate src/lib/library.ts --spec`, which writes both exports to `src/generated/spec.json`. */
export {
  // `library`: the component definitions (names, props, descriptions).
  library,
  // `promptOptions`: extra instructions and example programs that come with
  // the library, added to the system prompt to help the AI use it well.
  promptOptions,
} from "@openuidev/intelligent-ui-library";

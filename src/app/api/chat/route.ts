// =============================================================================
// /api/chat — THE SERVER SIDE OF THE CHAT
// =============================================================================
// In Next.js (App Router), a file called `route.ts` inside `src/app/api/chat/`
// becomes an HTTP endpoint at the URL `/api/chat`. Every time you press "send"
// in the chat UI, the browser POSTs the whole conversation here.
//
// What this route does, step by step:
//   1. Reads the conversation the browser sent (messages, thread id, model).
//   2. Checks that the request makes sense (validation).
//   3. Builds a SYSTEM PROMPT that teaches the AI model how to write
//      "OpenUI Lang" using the components in our component library.
//   4. Calls the model (through OpenUI Gateway) and STREAMS the answer back
//      to the browser token by token, so the UI builds up while it's written.
//   5. When the answer is finished, saves the turn to OpenUI Cloud so the
//      thread is still there after a page reload.
//
// IMPORTANT: this file runs ONLY on the server. That's why it's safe to read
// THESYS_API_KEY here — the key never reaches the browser.
// =============================================================================

// The JSON "spec" of our component library. It's GENERATED from
// src/lib/library.ts by `npm run generate` (which also runs automatically
// before `npm run dev`). It describes every component the AI is allowed to use
// (name, props, descriptions) in a form we can turn into a prompt.
import librarySpec from "@/generated/spec.json";

// The Vercel AI SDK's OpenAI-compatible provider. OpenUI Gateway speaks the
// same "Chat Completions" API as OpenAI, so we reuse this client and just point
// it at Gateway's URL (see `baseURL` below). The actual model can still be
// Gemini, Claude, GPT, etc. — Gateway routes it.
import { createOpenAI } from "@ai-sdk/openai";

// Turns the library spec into a long system prompt: "here's the OpenUI Lang
// syntax, here are the components you may use, here are the rules/examples".
import { generateSystemPrompt } from "@openuidev/lang-core";

// Building blocks from the Vercel AI SDK ("ai" package):
import {
  convertToModelMessages, // UI-shaped messages (from the browser) -> model-shaped messages
  createUIMessageStreamResponse, // wraps a stream into an HTTP Response the browser can read
  stepCountIs, // a "stop condition": stop after N model steps
  streamText, // calls the model and streams its output (and runs tools)
  toUIMessageStream, // converts the model stream back into UI-shaped chunks
  type UIMessage, // TypeScript type of a chat message as the UI sees it
} from "ai";

// Small helpers that live in this project:
import { requiredEnv } from "@/lib/env"; // reads an env var or throws if it's missing
import { storeTurn } from "@/lib/history"; // saves a finished turn to OpenUI Cloud
import { resolveRequestedModel } from "@/lib/models"; // checks the model id against an allow-list
import { appTools } from "@/lib/tools"; // the functions the AI is allowed to call (see tools.ts)
import { getPreferences } from "@/lib/food/data"; // saved food preferences = the planner's memory
import { addDays, dayName, today, weekStartOf } from "@/lib/food/week"; // date helpers (weeks start Sunday)

// The generated spec carries the library and its prompt options; generateSystemPrompt takes them separately.
// `promptOptions` = extra instructions/examples shipped with the library.
// `library`       = everything else (the component definitions).
const { promptOptions, ...library } = librarySpec;

// Run this route on the Node.js runtime (full Node APIs, streaming works fine).
export const runtime = "nodejs";

// Read the secret key once, when the module loads. If it's missing, this
// throws — that's why `npm run build` failed before you ran generate-api-key.
const apiKey = requiredEnv("THESYS_API_KEY");

// An AI SDK "provider" that sends requests to OpenUI Gateway instead of OpenAI.
// The `/v1/embed` endpoint is the one that understands OpenUI Lang (it can
// validate and auto-fix the generated UI while it streams).
const openai = createOpenAI({ baseURL: "https://api.thesys.dev/v1/embed", apiKey });

// HomeManage's own instructions, placed at the top of the system prompt
// (`preamble`). This is where the AI learns WHO it is and WHEN to use your
// data instead of guessing. The library's own rules and examples follow it.
//
// It's a FUNCTION (not a fixed string) because part of it changes on every
// request: today's date and the preferences saved on the Settings page.
// Putting the preferences here is what makes them a "memory": the model reads
// them before every answer.
function buildPreamble(preferences: string[], viewedWeek: string | null) {
  const now = today();
  const memory = preferences.length
    ? preferences.map((p) => `- ${p}`).join("\n")
    : "- (nothing saved yet)";

  // The week the user has open on the Plan page. Without this, "change
  // Thursday" would be read as THIS week's Thursday even when they're
  // looking at next week.
  const focus = viewedWeek
    ? `The user is looking at the week of ${viewedWeek} to ${addDays(viewedWeek, 6)} on the Plan page. Unless they name another week, "the week", "this week" and day names (e.g. "Thursday") mean days in THAT week, so always pass weekStart: "${viewedWeek}" to get_week_plan, plan_meals and build_shopping_list.`
    : "";

  return `You are HomeManage's meal planner, a friendly assistant for a household of 2 people (the user and their partner).
You help plan the week's meals, keep the shopping list and pantry up to date, and suggest recipes.

Today is ${dayName(now, "long")} ${now}. Weeks start on Sunday; the current calendar week starts ${weekStartOf(now)}.
${focus}

What you know about how this household eats (their saved preferences — follow them):
${memory}

How to work:
- Real data lives in the database. Read it with the tools before answering about it; never invent pantry contents, list items, plans or saved recipes.
- Planning a week: suggest meals that fit their preferences and what's in the pantry, and ask before saving if anything is unclear. Once agreed, save them with plan_meals, then build the shopping list with build_shopping_list (check get_pantry first and skip what they have). Default to 2 servings.
- After changing data, show a short summary of the result. The app shows the full shopping list and week plan on their own tabs, so don't repeat long lists in full.
- Recipes from Instagram: when asked to pick recipes for the week (or "from Itai's page"), read posts with get_instagram_recipes. It defaults to the household's usual page; only pass a username if the user names a different page. Pick 2 recipes unless told otherwise, preferring main dishes that fit their preferences and that weren't planned in recent weeks. Build the shopping list from the ingredients in the captions (translate quantities to metric, merge duplicates, skip pantry items) and include each post's link.
- If the user states a lasting preference ("we don't eat pork", "remember I like…"), save it with remember_preference.
- Use metric units. Keep answers short and friendly.

The app is used on a PHONE (about 390px wide): use one-column layouts (Card/Stack), short lists and narrow tables; avoid grids, wide tables and dense charts.`;
}

// Next.js calls this function for every POST request to /api/chat.
export async function POST(req: Request) {
  // ---------------------------------------------------------------------------
  // 1. Read the request body.
  // ---------------------------------------------------------------------------
  // The browser (cloud-chat.tsx -> fetchLLM) sends:
  //   - messages: the whole conversation so far (the AI has no memory between
  //               requests, so we send the history every time)
  //   - threadId: which conversation this is (used to save it)
  //   - model:    which model the user picked in the model switcher
  //   - weekStart: (Plan page only) the week the user has open, YYYY-MM-DD
  // Everything is typed as optional/unknown because we can't trust the client:
  // we validate it below before using it.
  const {
    messages,
    threadId,
    model: requestedModel,
    weekStart,
  } = (await req.json()) as {
    messages?: UIMessage[];
    threadId?: string;
    model?: unknown;
    weekStart?: unknown;
  };

  // Accept the week only if it's a real date; snap it to its Sunday.
  const viewedWeek =
    typeof weekStart === "string" && /^\d{4}-\d{2}-\d{2}$/.test(weekStart) ? weekStartOf(weekStart) : null;

  // ---------------------------------------------------------------------------
  // 2. Validate. Each check returns a 400 Bad Request with a clear message.
  // ---------------------------------------------------------------------------
  if (!Array.isArray(messages) || messages.length === 0) {
    return badRequest("messages must be a non-empty UIMessage[]");
  }

  if (typeof threadId !== "string" || !threadId.trim()) {
    return badRequest("threadId is required");
  }

  // Only models listed in src/lib/models.tsx are accepted. This stops someone
  // from calling your endpoint with an expensive model you never offered.
  const model = resolveRequestedModel(requestedModel);
  if (!model) {
    return badRequest("model is not available in this agent");
  }

  // Convert from the UI message format (which has "parts": text, tool calls,
  // etc.) into the format the model API expects.
  const modelMessages = await convertToModelMessages(messages);

  // The last message must be the user's new question — that's what we answer.
  // We keep it in `question` so we can save it together with the reply later.
  const question = modelMessages.at(-1);
  if (question?.role !== "user") {
    return badRequest("messages must end with a user message");
  }

  // Load the saved food preferences (the planner's memory) for the prompt.
  // If the database is unreachable, the chat still works, just without them.
  const preferences = await getPreferences()
    .then((rows) => rows.map((row) => row.text))
    .catch((error) => {
      console.error("Could not load food preferences:", error);
      return [];
    });

  // ---------------------------------------------------------------------------
  // 3 + 4. Call the model and stream the answer.
  // ---------------------------------------------------------------------------
  const result = streamText({
    // Which model to use, sent through Gateway (e.g. "google/gemini-...").
    model: openai.chat(model),

    // THE KEY OPENUI PIECE: the system prompt that teaches the model to reply
    // in OpenUI Lang using ONLY our components. `cloud: true` tailors the
    // prompt for OpenUI Gateway. When you later add your own components
    // (RecipeCard, ShoppingList…), they show up here automatically after
    // `npm run generate`. To add HomeManage-specific instructions ("you are a
    // household assistant…"), you'd put them in promptOptions (e.g. `preamble`).
    system: generateSystemPrompt({
      cloud: true,
      library,
      promptOptions: { ...promptOptions, preamble: buildPreamble(preferences, viewedWeek) },
    }),

    // The conversation history + new question.
    messages: modelMessages,

    // Functions the model may decide to call (see src/lib/tools.ts). The AI
    // SDK runs them here on the server and feeds the result back to the model.
    // This is how the AI will later read your pantry or add to the shopping list.
    tools: appTools,

    // A "step" is one model call. If the model calls a tool, that's one step;
    // then it gets the tool result and answers (another step). Capping at 5
    // prevents endless tool-call loops.
    // (Raised to 8 for the planner: read pantry -> plan meals -> build the
    // shopping list -> answer can take several steps.)
    stopWhen: stepCountIs(8),

    // If the user closes the tab or presses stop, `req.signal` fires and we
    // stop generating (saves tokens/money).
    abortSignal: req.signal,

    // -------------------------------------------------------------------------
    // 5. Runs once the full answer is done.
    // -------------------------------------------------------------------------
    // Save the completed turn so OpenUI Cloud storage can reload the thread.
    // Only the new user message and this turn's replies; never the replayed history.
    // (The history is already saved from earlier turns — saving it again would
    // duplicate it.)
    onEnd: async ({ responseMessages }) => {
      try {
        await storeTurn({
          apiKey,
          conversationId: threadId,
          messages: [question, ...responseMessages],
        });
      } catch (error) {
        // Saving failing shouldn't break the chat — the user already got
        // their answer — so we just log it.
        console.error("Failed to save the turn to OpenUI Cloud:", error);
      }
    },
  });

  // Send the stream back to the browser as an HTTP response. The browser side
  // (vercelAIAdapter in cloud-chat.tsx) knows how to read this exact format,
  // and the OpenUI renderer draws the UI as the OpenUI Lang arrives.
  return createUIMessageStreamResponse({
    stream: toUIMessageStream({ stream: result.stream }),
  });
}

// Small helper: build a 400 response with a JSON error body.
function badRequest(message: string): Response {
  return Response.json({ error: { message } }, { status: 400 });
}

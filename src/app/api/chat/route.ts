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
const HOMEMANAGE_PREAMBLE = `You are HomeManage, a friendly assistant for running the user's home.
Right now you help with groceries and cooking: the pantry (what they have), the shopping list (what to buy) and their saved recipes.
- The user's real data lives in the database. Use the tools to read it before answering questions about it, and to change it when asked. Never make up pantry contents, list items or saved recipes.
- When suggesting what to cook, check the pantry first and prefer recipes that use what they have. Show what's missing and offer to add it to the shopping list.
- After changing data, show the updated result (for example the new shopping list as a checklist grouped by store section).
- Quantities: use metric units unless the user uses others.`;

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
  // Everything is typed as optional/unknown because we can't trust the client:
  // we validate it below before using it.
  const {
    messages,
    threadId,
    model: requestedModel,
  } = (await req.json()) as {
    messages?: UIMessage[];
    threadId?: string;
    model?: unknown;
  };

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
      promptOptions: { ...promptOptions, preamble: HOMEMANAGE_PREAMBLE },
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
    stopWhen: stepCountIs(5),

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

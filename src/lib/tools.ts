// =============================================================================
// TOOLS — functions the AI can decide to call
// =============================================================================
// A "tool" lets the AI do something it can't do with words alone: fetch live
// data, read your database, save something. Flow:
//
//   1. The model sees each tool's NAME, DESCRIPTION and INPUT SCHEMA
//      (sent automatically by the AI SDK in src/app/api/chat/route.ts).
//   2. If it decides a tool helps, it replies with a "tool call", e.g.
//      get_weather({ location: "Berlin" }).
//   3. The AI SDK runs `execute` below — on YOUR server, with your code.
//   4. The result goes back to the model, which then writes its answer
//      (in OpenUI Lang, so it can show the data as a card/table/chart).
//
// The model never runs code itself; it only ASKS. Your server decides what
// actually happens, which is why tools are safe places for database access.
//
// For HomeManage we'll add tools like:
//   get_pantry, add_to_shopping_list, save_recipe, search_recipes …
// =============================================================================

// The sample weather tool that came with the template (its real logic lives in
// src/lib/tools/get-weather.ts). Good to read as an example.
import { executeGetWeather, getWeatherTool } from "@/lib/tools/get-weather";

// HomeManage's own tools: pantry, shopping list and recipes, all backed by
// the Netlify database. See src/lib/tools/groceries.ts.
import { groceryTools } from "@/lib/tools/groceries";

// `tool()` from the Vercel AI SDK: defines a tool in the shape streamText expects.
import { tool } from "ai";

// Zod: a library to describe and validate data shapes. The AI SDK turns the
// Zod schema into JSON Schema for the model AND validates the model's
// arguments before `execute` runs, so `execute` always gets clean input.
import { z } from "zod";

// All tools the chat route passes to the model. The KEY of each entry
// ("get_weather") is the tool name the model sees and calls.
export const appTools = {
  // `...groceryTools` copies every grocery tool (get_pantry,
  // add_to_shopping_list, save_recipe, …) into this object.
  ...groceryTools,

  get_weather: tool({
    // Tells the model WHEN to use this tool. Good descriptions matter a lot:
    // the model picks tools mostly based on this text.
    description: getWeatherTool.description,

    // The arguments the model must provide. `.describe()` text is also shown
    // to the model, so it knows what to put in each field.
    // `.trim().min(1)` = must be a non-empty string after trimming spaces.
    inputSchema: z.object({
      location: z.string().trim().min(1).describe("City or place name, e.g. Berlin."),
    }),

    // The code that actually runs. It receives the validated input and
    // an `abortSignal` (fires if the user stops the chat), which we pass on
    // so the weather HTTP request is cancelled too.
    // Whatever this returns is sent back to the model as the tool result.
    execute: ({ location }, { abortSignal }) =>
      executeGetWeather(JSON.stringify({ location }), {
        signal: abortSignal,
      }),
  }),
} as const; // `as const` keeps the exact keys/types for TypeScript.

// A Set of the tool names (e.g. {"get_weather"}), handy for quick checks like
// "is this message part one of our tools?" elsewhere in the app.
export const appToolNames = new Set(Object.keys(appTools));

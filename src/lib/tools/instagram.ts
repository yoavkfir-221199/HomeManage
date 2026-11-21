// =============================================================================
// INSTAGRAM TOOLS — let the planner read recipes from an Instagram page
// =============================================================================
// The default page is @itaidagan (see src/lib/food/instagram.ts). The user can
// name another page in the chat, and the model passes it as `username`.
// =============================================================================

import { tool } from "ai";
import { z } from "zod";

import { defaultRecipeSource, getRecentPosts } from "@/lib/food/instagram";

export const instagramTools = {
  get_instagram_recipes: tool({
    description:
      "Read the latest posts of an Instagram recipe page, with their full captions " +
      "(ingredients and steps are usually in the caption). Defaults to the household's " +
      `usual recipe page (@${defaultRecipeSource()}); pass username only if the user names another page. ` +
      "Use when picking recipes for the week or when the user asks what's new on the page. " +
      "Skip posts where looksLikeRecipe is false (ads, trips, announcements).",
    inputSchema: z.object({
      username: z
        .string()
        .trim()
        .min(1)
        .optional()
        .describe("Instagram username without @. Omit to use the default recipe page."),
      limit: z.number().int().min(1).max(25).optional().describe("How many recent posts to read (default 12)."),
    }),
    execute: async ({ username, limit }, { abortSignal }) => {
      try {
        const result = await getRecentPosts(username ?? defaultRecipeSource(), { limit, signal: abortSignal });
        return { ...result, posts: result.posts.filter((p) => p.looksLikeRecipe), skipped: result.posts.filter((p) => !p.looksLikeRecipe).length };
      } catch (error) {
        console.error("get_instagram_recipes failed:", error);
        return { error: error instanceof Error ? error.message : String(error) };
      }
    },
  }),
} as const;

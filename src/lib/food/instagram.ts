// =============================================================================
// INSTAGRAM RECIPES — read a public recipe page's latest posts
// =============================================================================
// Uses Meta's Graph API "Business Discovery": our own Creator account
// (INSTAGRAM_BUSINESS_ACCOUNT_ID) looks up another PUBLIC Business/Creator
// account by username and returns its recent posts with captions.
//
// Recipe pages usually write the ingredients in the caption (e.g. a "מצרכים"
// section), so the caption text is enough to build a shopping list.
//
// The token in INSTAGRAM_ACCESS_TOKEN is long-lived but expires (see
// INSTAGRAM_TOKEN_EXPIRES in .env).
// =============================================================================

import "server-only";

import { envOr, requiredEnv } from "@/lib/env";

const GRAPH_VERSION = "v27.0";

/**
 * The page we take recipes from unless the user asks for another one.
 * It's a starting point, not a rule: set RECIPE_SOURCE_INSTAGRAM in .env to
 * change the default, or just name another page in the chat for one request.
 */
export const DEFAULT_RECIPE_SOURCE = "itaidagan";

export function defaultRecipeSource() {
  return normalizeUsername(envOr("RECIPE_SOURCE_INSTAGRAM", DEFAULT_RECIPE_SOURCE));
}

/** "@ItaiDagan" or "https://instagram.com/itaidagan/" -> "itaidagan". */
export function normalizeUsername(input: string) {
  return input
    .trim()
    .replace(/^https?:\/\/(www\.)?instagram\.com\//i, "")
    .replace(/^@/, "")
    .split(/[/?#]/)[0]
    .toLowerCase();
}

export type InstagramPost = {
  id: string;
  caption: string;
  permalink: string;
  postedAt: string;
  mediaType: string;
  /** True when the caption has an ingredients section we can shop from. */
  looksLikeRecipe: boolean;
};

// A line starting with "מצרכים" / "Ingredients" (also "מצרכים לרוטב", "מצרכים:").
// Not `\b`: JavaScript's word boundary doesn't recognize Hebrew letters.
const INGREDIENTS_HEADING = /(^|\n)\s*(מצרכים|רכיבים|ingredients)(?=[\s:]|$)/iu;

/** The latest posts of a public Business/Creator account, newest first. */
export async function getRecentPosts(
  username: string = defaultRecipeSource(),
  { limit = 12, signal }: { limit?: number; signal?: AbortSignal } = {},
): Promise<{ username: string; name?: string; posts: InstagramPost[] }> {
  const handle = normalizeUsername(username);
  if (!/^[a-z0-9._]{1,30}$/.test(handle)) throw new Error(`"${username}" is not a valid Instagram username`);

  const accountId = requiredEnv("INSTAGRAM_BUSINESS_ACCOUNT_ID");
  const token = requiredEnv("INSTAGRAM_ACCESS_TOKEN");
  const count = Math.min(Math.max(limit, 1), 25);

  const url = new URL(`https://graph.facebook.com/${GRAPH_VERSION}/${accountId}`);
  url.searchParams.set(
    "fields",
    `business_discovery.username(${handle}){username,name,media.limit(${count}){caption,media_type,permalink,timestamp}}`,
  );

  // The token goes in a header, never in the URL (URLs end up in logs).
  const res = await fetch(url, { headers: { Authorization: `Bearer ${token}` }, signal, cache: "no-store" });
  const body = (await res.json()) as {
    error?: { message: string; code?: number };
    business_discovery?: {
      username: string;
      name?: string;
      media?: { data: Array<{ id: string; caption?: string; media_type: string; permalink: string; timestamp: string }> };
    };
  };

  if (body.error) {
    const hint =
      body.error.code === 190
        ? " (the Instagram access token expired — create a new one in the Meta Graph API Explorer)"
        : body.error.code === 110 || /business_discovery|cannot be found/i.test(body.error.message)
          ? ` (@${handle} must be a public Business or Creator account)`
          : "";
    throw new Error(`Instagram: ${body.error.message}${hint}`);
  }

  const account = body.business_discovery;
  if (!account) throw new Error(`Instagram returned no data for @${handle}`);

  return {
    username: account.username,
    name: account.name,
    posts: (account.media?.data ?? []).map((m) => {
      const caption = m.caption ?? "";
      return {
        id: m.id,
        caption,
        permalink: m.permalink,
        postedAt: m.timestamp,
        mediaType: m.media_type,
        looksLikeRecipe: INGREDIENTS_HEADING.test(caption),
      };
    }),
  };
}

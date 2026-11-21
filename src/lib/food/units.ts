// =============================================================================
// UNITS — stored in one standard (English) form, shown translated
// =============================================================================
// "יח׳", "pc" and "pcs" are the same unit. Saving them all as "pcs" lets us
// spot duplicates, and the app shows the unit in the chosen language
// (dictionaries.ts -> list.units). Shared by the server (saving) and the
// browser (showing), so it has no server-only imports.
// =============================================================================

const UNIT_ALIASES: Record<string, string> = {
  pc: "pcs", pcs: "pcs", piece: "pcs", pieces: "pcs", unit: "pcs", units: "pcs",
  "יח׳": "pcs", "יח'": "pcs", "יח": "pcs", "יחידה": "pcs", "יחידות": "pcs",
  g: "g", gr: "g", gram: "g", grams: "g", "גרם": "g", "ג׳": "g", "ג": "g",
  kg: "kg", kilo: "kg", "ק״ג": "kg", 'ק"ג': "kg", "קג": "kg", "קילו": "kg",
  l: "l", liter: "l", litre: "l", liters: "l", "ליטר": "l", "ל׳": "l",
  ml: "ml", "מ״ל": "ml", 'מ"ל': "ml", "מל": "ml",
  pack: "pack", packs: "pack", package: "pack", "חבילה": "pack", "חבילות": "pack",
  bunch: "bunch", bunches: "bunch", "צרור": "bunch", "צרורות": "bunch",
  head: "head", heads: "head", "ראש": "head", "ראשים": "head",
  can: "can", cans: "can", "קופסה": "can", "קופסאות": "can", "פחית": "can",
  bottle: "bottle", bottles: "bottle", "בקבוק": "bottle", "בקבוקים": "bottle",
  tbsp: "tbsp", "כף": "tbsp", "כפות": "tbsp", tsp: "tsp", "כפית": "tsp", "כפיות": "tsp",
  cup: "cup", cups: "cup", "כוס": "cup", "כוסות": "cup",
};

export function normalizeUnit(unit: string | null | undefined): string | null {
  if (!unit?.trim()) return null;
  const key = unit.trim().toLowerCase();
  return UNIT_ALIASES[key] ?? key;
}

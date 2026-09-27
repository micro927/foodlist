// Everything specific to this trip lives here. For the next trip: edit this file,
// point .env at a fresh Supabase project, run supabase/schema.sql, and redeploy.

export const trip = {
  name: "Tokyo 2026",
  startDate: "2026-12-23", // inclusive, YYYY-MM-DD
  endDate: "2027-01-08", // inclusive

  primaryColor: "#E0452B", // torii vermilion

  couples: [
    {
      id: "micro_bua",
      name: "Micro Bua",
      emoji: "😈",
      color: "#7C4DDB",
      soft: "#F1EBFD",
    },
    {
      id: "fair_bee",
      name: "Fair Bee",
      emoji: "🐝",
      color: "#E39A0B",
      soft: "#FDF3DD",
    },
  ],

  slots: [
    { id: "breakfast", label: "Breakfast", emoji: "🍳" },
    { id: "lunch", label: "Lunch", emoji: "🍱" },
    { id: "snack", label: "Snack", emoji: "🍡" },
    { id: "dinner", label: "Dinner", emoji: "🍜" },
    { id: "late_night", label: "Late night", emoji: "🌙" },
  ],

  // Suggested in the Area field alongside areas already used.
  areas: [
    "Shinjuku",
    "Shibuya",
    "Harajuku",
    "Omotesando",
    "Ginza",
    "Asakusa",
    "Ueno",
    "Ikebukuro",
    "Akihabara",
    "Roppongi",
    "Tsukiji",
    "Ebisu",
    "Nakameguro",
    "Shimokitazawa",
    "Odaiba",
    "Tokyo Station",
    "Multiple branches",
  ],

  // Emoji for known categories; anything else falls back to 🍽️.
  categoryEmoji: {
    sushi: "🍣",
    ramen: "🍜",
    dessert: "🍩",
    shabu: "🍲",
    sukiyaki: "🍲",
    yakiniku: "🥩",
    beef: "🥩",
    izakaya: "🏮",
    tonkatsu: "🐷",
    curry: "🍛",
    tempura: "🍤",
    cafe: "☕",
    coffee: "☕",
    udon: "🍜",
    soba: "🍜",
    bakery: "🥐",
    seafood: "🦀",
    yakitori: "🍢",
    "afternoon tea": "🫖",
    bar: "🍸",
  } as Record<string, string>,
} as const;

export type CoupleId = (typeof trip.couples)[number]["id"];
export type SlotId = (typeof trip.slots)[number]["id"];
export type Couple = (typeof trip.couples)[number];

export const coupleIds = trip.couples.map((c) => c.id) as CoupleId[];
export const coupleById = (id: string) => trip.couples.find((c) => c.id === id);
export const slotById = (id: string) => trip.slots.find((s) => s.id === id);

/** "Together" when every couple is going, otherwise the couple names. */
export function goingLabel(going: readonly string[]) {
  if (trip.couples.every((c) => going.includes(c.id))) return "Together";
  return going.map((id) => coupleById(id)?.name ?? id).join(" + ");
}

export function categoryEmoji(category: string) {
  return trip.categoryEmoji[category.trim().toLowerCase()] ?? "🍽️";
}

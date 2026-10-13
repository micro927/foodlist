// Everything specific to this trip lives here. For the next trip: edit this file,
// point .env at a fresh Supabase project, run supabase db push, and redeploy.

export const trip = {
  name: "Tokyo 2027",
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

  // Meal slots for Eats in the plan.
  slots: [
    { id: "breakfast", label: "Breakfast", emoji: "🍳" },
    { id: "lunch", label: "Lunch", emoji: "🍱" },
    { id: "snack", label: "Snack", emoji: "🍡" },
    { id: "dinner", label: "Dinner", emoji: "🍜" },
    { id: "late_night", label: "Late night", emoji: "🌙" },
  ],

  // Time-of-day slots for Places in the plan.
  placeSlots: [
    { id: "morning", label: "Morning", emoji: "☀️" },
    { id: "afternoon", label: "Afternoon", emoji: "🌤️" },
    { id: "evening", label: "Evening", emoji: "🌆" },
    { id: "night", label: "Night", emoji: "🌙" },
  ],

  // A place has one of these (stored as the label).
  placeCategories: [
    { label: "Shopping", emoji: "🛍️" },
    { label: "Activity", emoji: "🎡" },
    { label: "Photo", emoji: "📸" },
    { label: "Chill", emoji: "🌿" },
  ],

  // What an area is good for; an area can have any number of these.
  goodFor: [
    { id: "food", label: "Food", emoji: "🍜" },
    { id: "drink", label: "Drink", emoji: "🍺" },
    { id: "coffee", label: "Coffee", emoji: "☕" },
    { id: "clothes", label: "Clothes", emoji: "👕" },
    { id: "groceries", label: "Groceries", emoji: "🛒" }, // supermarkets, drugstores, konbini, Don Quijote
    { id: "shopping", label: "Shopping", emoji: "🛍️" },
    { id: "activity", label: "Activity", emoji: "🎡" },
    { id: "photo", label: "Photo", emoji: "📸" },
    { id: "chill", label: "Chill", emoji: "🌿" },
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
export type SlotId =
  | (typeof trip.slots)[number]["id"]
  | (typeof trip.placeSlots)[number]["id"];
export type GoodForId = (typeof trip.goodFor)[number]["id"];
export type Couple = (typeof trip.couples)[number];

export const coupleIds = trip.couples.map((c) => c.id) as CoupleId[];
export const coupleById = (id: string) => trip.couples.find((c) => c.id === id);
export const slotById = (id: string) =>
  [...trip.slots, ...trip.placeSlots].find((s) => s.id === id);
export const goodForById = (id: string) => trip.goodFor.find((g) => g.id === id);

/** "Together" when every couple is going, otherwise the couple names. */
export function goingLabel(going: readonly string[]) {
  if (trip.couples.every((c) => going.includes(c.id))) return "Together";
  return going.map((id) => coupleById(id)?.name ?? id).join(" + ");
}

export function categoryEmoji(category: string) {
  return trip.categoryEmoji[category.trim().toLowerCase()] ?? "🍽️";
}

export function placeCategoryEmoji(category: string) {
  const key = category.trim().toLowerCase();
  return trip.placeCategories.find((c) => c.label.toLowerCase() === key)?.emoji ?? "📍";
}

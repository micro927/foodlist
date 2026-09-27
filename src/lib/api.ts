import { createClient } from "@supabase/supabase-js";
import type {
  PlanEntry,
  PlanEntryFields,
  Restaurant,
  RestaurantFields,
} from "./types";

/**
 * The only module that knows where data lives. Supabase when the env keys are set,
 * otherwise a localStorage "demo mode" so the app runs before any backend exists.
 */
export type Backend = {
  listRestaurants(): Promise<Restaurant[]>;
  createRestaurant(
    fields: RestaurantFields & Pick<Restaurant, "interested">
  ): Promise<Restaurant>;
  updateRestaurant(
    id: string,
    patch: Partial<Omit<Restaurant, "id" | "created_at" | "updated_at">>
  ): Promise<void>;
  deleteRestaurant(r: Restaurant): Promise<void>;
  /** Uploads a new cover (or removes it with null), deleting the previous file. Returns the new path. */
  setCover(
    r: Pick<Restaurant, "id" | "cover_path">,
    image: Blob | null
  ): Promise<string | null>;
  coverUrl(path: string): string;

  listPlan(): Promise<PlanEntry[]>;
  createEntry(fields: PlanEntryFields): Promise<void>;
  updateEntry(id: string, patch: Partial<PlanEntryFields>): Promise<void>;
  deleteEntry(id: string): Promise<void>;

  /** Calls back whenever anyone changes data. Returns an unsubscribe function. */
  subscribe(
    onChange: (table: "restaurants" | "plan_entries") => void
  ): () => void;
};

const url = import.meta.env.VITE_SUPABASE_URL as string | undefined;
const key = import.meta.env.VITE_SUPABASE_PUBLISHABLE_KEY as string | undefined;

export const isDemo = !url || !key;
export const api: Backend =
  !url || !key ? demoBackend() : supabaseBackend(url, key);

function supabaseBackend(url: string, key: string): Backend {
  const db = createClient(url, key, { auth: { persistSession: false } });
  const covers = db.storage.from("foodlist-covers");

  const must = <T>({ data, error }: { data: T; error: unknown }) => {
    if (error) throw error;
    return data;
  };

  return {
    async listRestaurants() {
      return must(
        await db
          .from("restaurants")
          .select("*")
          .order("created_at", { ascending: false })
      ) as Restaurant[];
    },
    async createRestaurant(fields) {
      return must(
        await db.from("restaurants").insert(fields).select().single()
      ) as Restaurant;
    },
    async updateRestaurant(id, patch) {
      must(await db.from("restaurants").update(patch).eq("id", id));
    },
    async deleteRestaurant(r) {
      must(await db.from("restaurants").delete().eq("id", r.id));
      if (r.cover_path) await covers.remove([r.cover_path]);
    },
    async setCover(r, image) {
      let path: string | null = null;
      if (image) {
        path = `${r.id}/${Date.now()}.webp`;
        must(
          await covers.upload(path, image, {
            contentType: image.type,
            cacheControl: "31536000",
          })
        );
      }
      must(
        await db.from("restaurants").update({ cover_path: path }).eq("id", r.id)
      );
      if (r.cover_path) await covers.remove([r.cover_path]);
      return path;
    },
    coverUrl(path) {
      return covers.getPublicUrl(path).data.publicUrl;
    },

    async listPlan() {
      return must(
        await db.from("plan_entries").select("*").order("position")
      ) as PlanEntry[];
    },
    async createEntry(fields) {
      must(
        await db
          .from("plan_entries")
          .insert({ ...fields, position: Date.now() % 2147483647 })
      );
    },
    async updateEntry(id, patch) {
      must(await db.from("plan_entries").update(patch).eq("id", id));
    },
    async deleteEntry(id) {
      must(await db.from("plan_entries").delete().eq("id", id));
    },

    subscribe(onChange) {
      const channel = db
        .channel("changes")
        .on(
          "postgres_changes",
          { event: "*", schema: "public", table: "restaurants" },
          () => onChange("restaurants")
        )
        .on(
          "postgres_changes",
          { event: "*", schema: "public", table: "plan_entries" },
          () => onChange("plan_entries")
        )
        .subscribe();
      return () => void db.removeChannel(channel);
    },
  };
}

function demoBackend(): Backend {
  const KEY = "foodlist:demo";
  type Store = { restaurants: Restaurant[]; plan: PlanEntry[] };
  const now = () => new Date().toISOString();

  const load = (): Store => {
    try {
      const raw = localStorage.getItem(KEY);
      if (raw) return JSON.parse(raw);
    } catch {}
    return demoSeed();
  };
  let store = load();
  const listeners = new Set<(t: "restaurants" | "plan_entries") => void>();
  const save = (table: "restaurants" | "plan_entries") => {
    try {
      localStorage.setItem(KEY, JSON.stringify(store));
    } catch {}
    listeners.forEach((l) => l(table));
  };
  const blobToDataUrl = (blob: Blob) =>
    new Promise<string>((resolve, reject) => {
      const reader = new FileReader();
      reader.onload = () => resolve(reader.result as string);
      reader.onerror = reject;
      reader.readAsDataURL(blob);
    });

  return {
    async listRestaurants() {
      return [...store.restaurants].sort((a, b) =>
        b.created_at.localeCompare(a.created_at)
      );
    },
    async createRestaurant(fields) {
      const r: Restaurant = {
        ...fields,
        id: crypto.randomUUID(),
        cover_path: null,
        created_at: now(),
        updated_at: now(),
      };
      store.restaurants.push(r);
      save("restaurants");
      return r;
    },
    async updateRestaurant(id, patch) {
      store.restaurants = store.restaurants.map((r) =>
        r.id === id ? { ...r, ...patch, updated_at: now() } : r
      );
      save("restaurants");
    },
    async deleteRestaurant(r) {
      store.restaurants = store.restaurants.filter((x) => x.id !== r.id);
      store.plan = store.plan.filter((e) => e.restaurant_id !== r.id);
      save("restaurants");
    },
    async setCover(r, image) {
      const path = image ? await blobToDataUrl(image) : null;
      store.restaurants = store.restaurants.map((x) =>
        x.id === r.id ? { ...x, cover_path: path, updated_at: now() } : x
      );
      save("restaurants");
      return path;
    },
    coverUrl(path) {
      return path;
    },

    async listPlan() {
      return [...store.plan].sort((a, b) => a.position - b.position);
    },
    async createEntry(fields) {
      store.plan.push({
        ...fields,
        id: crypto.randomUUID(),
        position: Date.now(),
        created_at: now(),
      });
      save("plan_entries");
    },
    async updateEntry(id, patch) {
      store.plan = store.plan.map((e) =>
        e.id === id ? { ...e, ...patch } : e
      );
      save("plan_entries");
    },
    async deleteEntry(id) {
      store.plan = store.plan.filter((e) => e.id !== id);
      save("plan_entries");
    },

    subscribe(onChange) {
      listeners.add(onChange);
      return () => void listeners.delete(onChange);
    },
  };
}

function demoSeed() {
  const at = (minutesAgo: number) =>
    new Date(Date.now() - minutesAgo * 60_000).toISOString();
  const r = (
    id: string,
    name: string,
    category: string,
    area: string,
    interested: Restaurant["interested"],
    notes: string | null,
    ago: number,
    links: Partial<Restaurant> = {}
  ): Restaurant => ({
    id,
    name,
    category,
    area,
    interested,
    notes,
    maps_url: null,
    inspo_url: null,
    cover_path: null,
    created_at: at(ago),
    updated_at: at(ago),
    ...links,
  });
  const restaurants = [
    r(
      "d1",
      "Hokuto Sukiyaki",
      "Shabu",
      "Ginza",
      ["micro_bua", "fair_bee"],
      "Sukiyaki set lunch",
      50,
      { maps_url: "https://maps.google.com/?q=Hokuto+Ginza" }
    ),
    r(
      "d2",
      "I'm Donut?",
      "Dessert",
      "Multiple branches",
      ["micro_bua", "fair_bee"],
      "Go early, queues",
      40,
      { inspo_url: "https://www.tiktok.com/" }
    ),
    r(
      "d3",
      "Kizuna Sushi",
      "Sushi",
      "Shinjuku",
      ["fair_bee"],
      "All you can eat ¥5000",
      30,
      { inspo_url: "https://www.youtube.com/" }
    ),
    r(
      "d4",
      "Harbs",
      "Dessert",
      "Multiple branches",
      ["micro_bua"],
      "Mille crêpe",
      20
    ),
    r("d5", "Ichiran", "Ramen", "Shibuya", [], null, 10, {
      maps_url: "https://maps.google.com/?q=Ichiran+Shibuya",
    }),
  ];
  const e = (
    id: string,
    restaurant_id: string,
    day: string,
    slot: PlanEntry["slot"],
    time: string | null,
    going: PlanEntry["going"]
  ): PlanEntry => ({
    id,
    restaurant_id,
    day,
    slot,
    time,
    going,
    position: 0,
    created_at: at(0),
  });
  const plan = [
    e("p1", "d1", "2026-12-23", "dinner", "19:00", ["micro_bua", "fair_bee"]),
    e("p2", "d3", "2026-12-24", "lunch", null, ["fair_bee"]),
    e("p3", "d4", "2026-12-24", "lunch", null, ["micro_bua"]),
  ];
  return { restaurants, plan };
}

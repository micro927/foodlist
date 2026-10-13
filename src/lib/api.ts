import { createClient } from "@supabase/supabase-js";
import type {
  Area,
  AreaFields,
  Item,
  ItemFields,
  PlanEntry,
  PlanEntryFields,
  Section,
} from "./types";

export type Table =
  | "restaurants"
  | "plan_entries"
  | "places"
  | "place_plan_entries"
  | "areas";

/** Anything with a cover photo. */
export type CoverOwner = Section | "areas";

/**
 * The only module that knows where data lives. Supabase when the env keys are set,
 * otherwise a localStorage "demo mode" so the app runs before any backend exists.
 */
export type Backend = {
  listItems(section: Section): Promise<Item[]>;
  createItem(
    section: Section,
    fields: ItemFields & Pick<Item, "interested">
  ): Promise<Item>;
  updateItem(
    section: Section,
    id: string,
    patch: Partial<Omit<Item, "id" | "created_at" | "updated_at">>
  ): Promise<void>;
  deleteItem(section: Section, item: Item): Promise<void>;

  listPlan(section: Section): Promise<PlanEntry[]>;
  createEntry(section: Section, fields: PlanEntryFields): Promise<void>;
  updateEntry(
    section: Section,
    id: string,
    patch: Partial<PlanEntryFields>
  ): Promise<void>;
  deleteEntry(section: Section, id: string): Promise<void>;

  listAreas(): Promise<Area[]>;
  createArea(fields: AreaFields): Promise<Area>;
  updateArea(id: string, patch: Partial<AreaFields>): Promise<void>;
  deleteArea(area: Area): Promise<void>;

  /** Uploads a new cover (or removes it with null), deleting the previous file. Returns the new path. */
  setCover(
    owner: CoverOwner,
    target: { id: string; cover_path: string | null },
    image: Blob | null
  ): Promise<string | null>;
  coverUrl(path: string): string;

  /** Calls back whenever anyone changes data. Returns an unsubscribe function. */
  subscribe(onChange: (table: Table) => void): () => void;
};

// The tables behind each section. Places got their own tables so the original ones stay untouched.
const tables = {
  eats: { items: "restaurants", plan: "plan_entries", fk: "restaurant_id" },
  places: { items: "places", plan: "place_plan_entries", fk: "place_id" },
} as const;

const coverTables = {
  eats: { table: "restaurants", prefix: "" },
  places: { table: "places", prefix: "places/" },
  areas: { table: "areas", prefix: "areas/" },
} as const;

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

  // Plan rows name their item column per table; the app always calls it item_id.
  const fromRow = (section: Section, row: Record<string, unknown>) => {
    const { [tables[section].fk]: item_id, ...rest } = row;
    return { ...rest, item_id } as PlanEntry;
  };
  const toRow = (section: Section, fields: Partial<PlanEntryFields>) => {
    const { item_id, ...rest } = fields;
    return item_id === undefined
      ? rest
      : { ...rest, [tables[section].fk]: item_id };
  };

  return {
    async listItems(section) {
      return must(
        await db
          .from(tables[section].items)
          .select("*")
          .order("created_at", { ascending: false })
      ) as Item[];
    },
    async createItem(section, fields) {
      return must(
        await db.from(tables[section].items).insert(fields).select().single()
      ) as Item;
    },
    async updateItem(section, id, patch) {
      must(await db.from(tables[section].items).update(patch).eq("id", id));
    },
    async deleteItem(section, item) {
      must(await db.from(tables[section].items).delete().eq("id", item.id));
      if (item.cover_path) await covers.remove([item.cover_path]);
    },

    async listPlan(section) {
      const rows = must(
        await db.from(tables[section].plan).select("*").order("position")
      ) as Record<string, unknown>[];
      return rows.map((row) => fromRow(section, row));
    },
    async createEntry(section, fields) {
      must(
        await db
          .from(tables[section].plan)
          .insert({ ...toRow(section, fields), position: Date.now() % 2147483647 })
      );
    },
    async updateEntry(section, id, patch) {
      must(
        await db
          .from(tables[section].plan)
          .update(toRow(section, patch))
          .eq("id", id)
      );
    },
    async deleteEntry(section, id) {
      must(await db.from(tables[section].plan).delete().eq("id", id));
    },

    async listAreas() {
      return must(
        await db
          .from("areas")
          .select("*")
          .order("created_at", { ascending: false })
      ) as Area[];
    },
    async createArea(fields) {
      return must(
        await db.from("areas").insert(fields).select().single()
      ) as Area;
    },
    async updateArea(id, patch) {
      must(await db.from("areas").update(patch).eq("id", id));
    },
    async deleteArea(area) {
      must(await db.from("areas").delete().eq("id", area.id));
      if (area.cover_path) await covers.remove([area.cover_path]);
    },

    async setCover(owner, target, image) {
      const { table, prefix } = coverTables[owner];
      let path: string | null = null;
      if (image) {
        path = `${prefix}${target.id}/${Date.now()}.webp`;
        must(
          await covers.upload(path, image, {
            contentType: image.type,
            cacheControl: "31536000",
          })
        );
      }
      must(
        await db.from(table).update({ cover_path: path }).eq("id", target.id)
      );
      if (target.cover_path) await covers.remove([target.cover_path]);
      return path;
    },
    coverUrl(path) {
      return covers.getPublicUrl(path).data.publicUrl;
    },

    subscribe(onChange) {
      const all: Table[] = [
        "restaurants",
        "plan_entries",
        "places",
        "place_plan_entries",
        "areas",
      ];
      const channel = all
        .reduce(
          (ch, table) =>
            ch.on(
              "postgres_changes",
              { event: "*", schema: "public", table },
              () => onChange(table)
            ),
          db.channel("changes")
        )
        .subscribe();
      return () => void db.removeChannel(channel);
    },
  };
}

function demoBackend(): Backend {
  const KEY = "foodlist:demo";
  type Store = {
    restaurants: Item[];
    plan: PlanEntry[];
    places: Item[];
    placePlan: PlanEntry[];
    areas: Area[];
  };
  const keys = {
    eats: { items: "restaurants", plan: "plan" },
    places: { items: "places", plan: "placePlan" },
  } as const;
  const now = () => new Date().toISOString();

  const load = (): Store => {
    try {
      const raw = localStorage.getItem(KEY);
      if (raw) {
        // Older demo data has only restaurants and plan (with restaurant_id).
        const saved = JSON.parse(raw);
        const seed = demoSeed();
        return {
          ...seed,
          ...saved,
          plan: (saved.plan ?? []).map(
            ({ restaurant_id, ...e }: PlanEntry & { restaurant_id?: string }) => ({
              ...e,
              item_id: e.item_id ?? restaurant_id,
            })
          ),
        };
      }
    } catch {}
    return demoSeed();
  };
  let store = load();
  const listeners = new Set<(t: Table) => void>();
  const save = (table: Table) => {
    try {
      localStorage.setItem(KEY, JSON.stringify(store));
    } catch {}
    listeners.forEach((l) => l(table));
  };
  const itemTable = (section: Section): Table =>
    section === "eats" ? "restaurants" : "places";
  const planTable = (section: Section): Table =>
    section === "eats" ? "plan_entries" : "place_plan_entries";
  const blobToDataUrl = (blob: Blob) =>
    new Promise<string>((resolve, reject) => {
      const reader = new FileReader();
      reader.onload = () => resolve(reader.result as string);
      reader.onerror = reject;
      reader.readAsDataURL(blob);
    });

  return {
    async listItems(section) {
      return [...store[keys[section].items]].sort((a, b) =>
        b.created_at.localeCompare(a.created_at)
      );
    },
    async createItem(section, fields) {
      const item: Item = {
        ...fields,
        id: crypto.randomUUID(),
        cover_path: null,
        created_at: now(),
        updated_at: now(),
      };
      store[keys[section].items].push(item);
      save(itemTable(section));
      return item;
    },
    async updateItem(section, id, patch) {
      const k = keys[section].items;
      store[k] = store[k].map((r) =>
        r.id === id ? { ...r, ...patch, updated_at: now() } : r
      );
      save(itemTable(section));
    },
    async deleteItem(section, item) {
      const { items, plan } = keys[section];
      store[items] = store[items].filter((x) => x.id !== item.id);
      store[plan] = store[plan].filter((e) => e.item_id !== item.id);
      save(itemTable(section));
    },

    async listPlan(section) {
      return [...store[keys[section].plan]].sort(
        (a, b) => a.position - b.position
      );
    },
    async createEntry(section, fields) {
      store[keys[section].plan].push({
        ...fields,
        id: crypto.randomUUID(),
        position: Date.now(),
        created_at: now(),
      });
      save(planTable(section));
    },
    async updateEntry(section, id, patch) {
      const k = keys[section].plan;
      store[k] = store[k].map((e) => (e.id === id ? { ...e, ...patch } : e));
      save(planTable(section));
    },
    async deleteEntry(section, id) {
      const k = keys[section].plan;
      store[k] = store[k].filter((e) => e.id !== id);
      save(planTable(section));
    },

    async listAreas() {
      return [...store.areas].sort((a, b) =>
        b.created_at.localeCompare(a.created_at)
      );
    },
    async createArea(fields) {
      const area: Area = {
        ...fields,
        id: crypto.randomUUID(),
        cover_path: null,
        created_at: now(),
        updated_at: now(),
      };
      store.areas.push(area);
      save("areas");
      return area;
    },
    async updateArea(id, patch) {
      store.areas = store.areas.map((a) =>
        a.id === id ? { ...a, ...patch, updated_at: now() } : a
      );
      save("areas");
    },
    async deleteArea(area) {
      store.areas = store.areas.filter((a) => a.id !== area.id);
      save("areas");
    },

    async setCover(owner, target, image) {
      const path = image ? await blobToDataUrl(image) : null;
      const patch = (x: { id: string }) =>
        x.id === target.id ? { ...x, cover_path: path, updated_at: now() } : x;
      if (owner === "areas") {
        store.areas = store.areas.map(patch) as Area[];
        save("areas");
      } else {
        const k = keys[owner].items;
        store[k] = store[k].map(patch) as Item[];
        save(itemTable(owner));
      }
      return path;
    },
    coverUrl(path) {
      return path;
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
    interested: Item["interested"],
    notes: string | null,
    ago: number,
    links: Partial<Item> = {}
  ): Item => ({
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
  const places = [
    r(
      "pl1",
      "teamLab Planets",
      "Activity",
      "Toyosu",
      ["micro_bua", "fair_bee"],
      "Book tickets ahead",
      45
    ),
    r("pl2", "Shibuya Sky", "Photo", "Shibuya", ["fair_bee"], "Sunset slot", 35, {
      maps_url: "https://maps.google.com/?q=Shibuya+Sky",
    }),
    r("pl3", "Don Quijote Shibuya", "Shopping", "Shibuya", ["micro_bua"], null, 25),
    r("pl4", "Yoyogi Park", "Chill", "Harajuku", [], null, 15),
  ];
  const e = (
    id: string,
    item_id: string,
    day: string,
    slot: PlanEntry["slot"],
    time: string | null,
    going: PlanEntry["going"]
  ): PlanEntry => ({
    id,
    item_id,
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
  const placePlan = [
    e("pp1", "pl1", "2026-12-23", "afternoon", "14:00", ["micro_bua", "fair_bee"]),
  ];
  const areas: Area[] = [
    {
      id: "a1",
      name: "Shibuya",
      maps_url: "https://maps.google.com/?q=Shibuya",
      good_for: ["food", "clothes", "shopping", "photo"],
      inspo_urls: ["https://www.tiktok.com/", "https://www.youtube.com/"],
      restaurant_ids: ["d5"],
      place_ids: ["pl2", "pl3"],
      notes: "Scramble crossing at night",
      cover_path: null,
      created_at: at(5),
      updated_at: at(5),
    },
  ];
  return { restaurants, plan, places, placePlan, areas };
}

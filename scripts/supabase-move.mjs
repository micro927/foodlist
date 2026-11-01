// Copy all trip data from one Supabase project to another (e.g. to change region).
//   node --env-file=.env scripts/supabase-move.mjs backup    → writes backup/
//   node --env-file=.env scripts/supabase-move.mjs restore   → loads backup/ into the project in .env
// Restore refuses to run against the project the backup came from, or one that already has data.
import { createClient } from "@supabase/supabase-js";
import { mkdir, readFile, writeFile } from "node:fs/promises";
import { dirname, join } from "node:path";

// Parents before children so foreign keys hold on restore.
const TABLES = ["restaurants", "places", "areas", "plan_entries", "place_plan_entries"];
const BUCKET = "foodlist-covers";
const DIR = "backup";

const url = process.env.VITE_SUPABASE_URL;
const key = process.env.VITE_SUPABASE_PUBLISHABLE_KEY;
if (!url || !key) throw new Error("VITE_SUPABASE_URL / VITE_SUPABASE_PUBLISHABLE_KEY not set");
const db = createClient(url, key, { auth: { persistSession: false } });
const covers = db.storage.from(BUCKET);

const must = ({ data, error }) => {
  if (error) throw error;
  return data;
};

async function rowCount(table) {
  const { count, error } = await db.from(table).select("*", { count: "exact", head: true });
  if (error) throw error;
  return count;
}

async function allRows(table) {
  const rows = [];
  for (let from = 0; ; from += 1000) {
    const page = must(await db.from(table).select("*").order("id").range(from, from + 999));
    rows.push(...page);
    if (page.length < 1000) return rows;
  }
}

// Storage lists one folder level at a time; folders come back with id null.
async function allFiles(prefix = "") {
  const files = [];
  for (let offset = 0; ; offset += 1000) {
    const page = must(await covers.list(prefix, { limit: 1000, offset }));
    for (const f of page) {
      const path = prefix ? `${prefix}/${f.name}` : f.name;
      if (f.id === null) files.push(...(await allFiles(path)));
      else files.push({ path, contentType: f.metadata?.mimetype });
    }
    if (page.length < 1000) return files;
  }
}

async function backup() {
  const counts = {};
  for (const table of TABLES) {
    const rows = await allRows(table);
    counts[table] = rows.length;
    await mkdir(join(DIR, "tables"), { recursive: true });
    await writeFile(join(DIR, "tables", `${table}.json`), JSON.stringify(rows, null, 2));
  }

  const files = await allFiles();
  for (const f of files) {
    const blob = must(await covers.download(f.path));
    const out = join(DIR, "covers", f.path);
    await mkdir(dirname(out), { recursive: true });
    await writeFile(out, Buffer.from(await blob.arrayBuffer()));
  }

  await writeFile(
    join(DIR, "manifest.json"),
    JSON.stringify({ source: url, at: new Date().toISOString(), counts, files }, null, 2)
  );
  console.log("Backed up", counts, `${files.length} cover files`);
}

async function restore() {
  const manifest = JSON.parse(await readFile(join(DIR, "manifest.json"), "utf8"));
  if (manifest.source === url) throw new Error("Target is the project this backup came from — update .env first");
  for (const table of TABLES) {
    const count = await rowCount(table);
    if (count) throw new Error(`Target table ${table} already has ${count} rows — expected an empty project`);
  }

  for (const f of manifest.files) {
    const body = await readFile(join(DIR, "covers", f.path));
    must(await covers.upload(f.path, body, { contentType: f.contentType, upsert: true }));
  }

  for (const table of TABLES) {
    const rows = JSON.parse(await readFile(join(DIR, "tables", `${table}.json`), "utf8"));
    for (let i = 0; i < rows.length; i += 500) must(await db.from(table).insert(rows.slice(i, i + 500)));
  }

  const counts = {};
  for (const table of TABLES) counts[table] = await rowCount(table);
  console.log("Restored", counts, `${manifest.files.length} cover files`, "— backup had", manifest.counts);
}

const mode = process.argv[2];
if (mode === "backup") await backup();
else if (mode === "restore") await restore();
else console.log("usage: node --env-file=.env scripts/supabase-move.mjs backup|restore");

import Anthropic from "@anthropic-ai/sdk";

// Bills → Scan: reads receipt photos into Lines with a rough English name for each.
// The API key stays on the server. The app password and a daily cap keep strangers from spending credit;
// both are soft (the password ships in the bundle), see README → Security trade-off.

const DAILY_LIMIT = Number(process.env.SCAN_DAILY_LIMIT || 30);
// Haiku is cheap enough to test with; set SCAN_MODEL=claude-opus-5-5 if receipts come back wrong.
const MODEL = process.env.SCAN_MODEL || "claude-haiku-5-5";
const MAX_PHOTOS = 3;

const instructions = `You read Japanese restaurant and shop receipts for a group of friends splitting the bill.

Return every purchased row as a line:
- name_ja: the item name as printed (Japanese or otherwise).
- name_en: a short, natural English name a tourist would recognise ("Draft beer", "Chicken skewers"). A rough meaning is fine.
- qty: the quantity (1 when none is printed).
- price: what the whole row costs in yen, as an integer (quantity × unit price). Negative for a discount or coupon.
- extra: true for rows that are not something eaten or bought — tax added on top (外税, 消費税), service charge (サービス料), and discounts/coupons. False for everything else. A table charge (お通し, チャージ) is NOT extra: it's a normal line, one per person.

Leave out rows that aren't charges: subtotal (小計), total (合計), tax already included in prices (内税, 内消費税, (内)… 対象), payment, cash received (お預り), change (お釣り), points.
The lines' prices must add up to the amount actually paid.

shop: the shop name in Latin letters if printed, otherwise romanised or a short English description.
total: the final amount paid as printed on the receipt, or 0 if you can't read it.
If several photos are given, they are parts of the same receipt; don't repeat rows that appear twice.`;

const schema = {
  type: "object",
  additionalProperties: false,
  required: ["shop", "total", "lines"],
  properties: {
    shop: { type: "string" },
    total: { type: "integer" },
    lines: {
      type: "array",
      items: {
        type: "object",
        additionalProperties: false,
        required: ["name_ja", "name_en", "qty", "price", "extra"],
        properties: {
          name_ja: { type: "string" },
          name_en: { type: "string" },
          qty: { type: "integer" },
          price: { type: "integer" },
          extra: { type: "boolean" },
        },
      },
    },
  },
};

type Photo = { data: string; media_type: "image/webp" | "image/jpeg" | "image/png" };

export async function POST(request: Request) {
  const password = process.env.VITE_APP_PASSWORD;
  if (password && request.headers.get("x-app-password") !== password)
    return fail(401, "Wrong app password");
  if (!process.env.ANTHROPIC_API_KEY)
    return fail(500, "Scan isn't set up: ANTHROPIC_API_KEY is missing");

  const { photos } = (await request.json()) as { photos?: Photo[] };
  if (!photos?.length || photos.length > MAX_PHOTOS)
    return fail(400, `Send 1–${MAX_PHOTOS} photos`);

  if (!(await underDailyLimit())) return fail(429, `Daily scan limit (${DAILY_LIMIT}) reached — add items by hand`);

  const client = new Anthropic();
  // Haiku has no server-side fallback; the bigger models retry a declined request on another model.
  const fallback = MODEL.startsWith("claude-haiku")
    ? {}
    : { betas: ["server-side-fallback-2026-07-01"], fallbacks: "default" as const };
  const response = await client.beta.messages.create({
    model: MODEL,
    max_tokens: 16000,
    ...fallback,
    output_config: { effort: "medium", format: { type: "json_schema", schema } },
    system: instructions,
    messages: [
      {
        role: "user",
        content: [
          ...photos.map((p) => ({
            type: "image" as const,
            source: { type: "base64" as const, media_type: p.media_type, data: p.data },
          })),
          { type: "text", text: "Read this receipt." },
        ],
      },
    ],
  });

  if (response.stop_reason === "refusal") return fail(422, "Couldn't read this receipt — add items by hand");
  const text = response.content.find((b) => b.type === "text")?.text;
  if (!text || response.stop_reason === "max_tokens") return fail(502, "Couldn't read this receipt — try a clearer photo");
  const result = JSON.parse(text) as { shop: string; total: number; lines: unknown[] };
  return Response.json({ ...result, total: result.total || null });
}

function fail(status: number, error: string) {
  return Response.json({ error }, { status });
}

/** Counts today's scans (Tokyo time) in Supabase and records this one. Without Supabase there's no cap. */
async function underDailyLimit() {
  const url = process.env.VITE_SUPABASE_URL;
  const key = process.env.VITE_SUPABASE_PUBLISHABLE_KEY;
  if (!url || !key) return true;
  const headers = { apikey: key, Authorization: `Bearer ${key}`, "Content-Type": "application/json" };

  const tokyoDay = new Date(Date.now() + 9 * 3_600_000).toISOString().slice(0, 10);
  const since = new Date(`${tokyoDay}T00:00:00+09:00`).toISOString();
  const res = await fetch(`${url}/rest/v1/bill_scans?select=id&created_at=gte.${since}`, {
    method: "HEAD",
    headers: { ...headers, Prefer: "count=exact" },
  });
  const used = Number(res.headers.get("content-range")?.split("/")[1] ?? 0);
  if (used >= DAILY_LIMIT) return false;

  await fetch(`${url}/rest/v1/bill_scans`, { method: "POST", headers, body: "{}" });
  return true;
}

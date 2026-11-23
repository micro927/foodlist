import { coordsFromUrl, isShortMapsLink, placeCoordsFromPage, placeQuery, type LatLng, type LocateResult } from "../src/lib/maplink.js";
import { fail, tripAccount } from "./_auth.js";

// Map tab: finds where each Google Maps link points.
// 1. Coordinates written in the link itself.
// 2. Short share links (maps.app.goo.gl): follow the redirects, which lead to a full URL with coordinates.
// 3. Otherwise, the place's name from the link (?q=Ichiran+Shibuya, or a share link that only leads to a name).
//    The map then finds that name with Google Places in the browser, with the map's own key.

const MAX_URLS = 10;
const MAX_HOPS = 5;
// Some redirects only carry coordinates when they look like they come from a browser.
const UA = "Mozilla/5.0 (iPhone; CPU iPhone OS 18_0 like Mac OS X) AppleWebKit/605.1.15 (KHTML, like Gecko) Version/18.0 Mobile/15E148 Safari/604.1";

export async function POST(request: Request) {
  const caller = await tripAccount(request);
  if (caller instanceof Response) return caller;

  const { urls } = (await request.json().catch(() => ({}))) as { urls?: unknown };
  if (!Array.isArray(urls) || !urls.length || urls.length > MAX_URLS || !urls.every((u) => typeof u === "string"))
    return fail(400, `Send 1–${MAX_URLS} links`);

  const results = await Promise.all(urls.map((url) => locate(url).catch(() => null)));
  return Response.json(Object.fromEntries(urls.map((url, i) => [url, results[i]])));
}

async function locate(url: string): Promise<LocateResult> {
  const direct = coordsFromUrl(url);
  if (direct) return direct;

  let current = url;
  if (isShortMapsLink(url)) {
    const followed = await followRedirects(url);
    if (followed.coords) return followed.coords;
    current = followed.finalUrl;
  }
  const query = placeQuery(current) ?? placeQuery(url);
  return query ? { query } : null;
}

async function followRedirects(start: string): Promise<{ coords: LatLng | null; finalUrl: string }> {
  let current = start;
  for (let hop = 0; hop < MAX_HOPS; hop++) {
    const res = await fetch(current, { redirect: "manual", headers: { "User-Agent": UA } });
    const next = res.headers.get("location");
    if (!next || res.status < 300 || res.status >= 400) {
      // The end of the chain: the page may carry the place's pin.
      const body = res.ok ? await res.text() : "";
      return { coords: placeCoordsFromPage(body), finalUrl: current };
    }
    current = new URL(next, current).toString();
    const coords = coordsFromUrl(current);
    if (coords) return { coords, finalUrl: current };
  }
  return { coords: null, finalUrl: current };
}

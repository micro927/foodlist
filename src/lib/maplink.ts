// Reads coordinates out of a Google Maps link. Pure (no DOM, no "@/" imports) so api/locate.ts can use it too.

export type LatLng = { lat: number; lng: number }
/** What /api/locate finds for a link: its coordinates, or only the place's name to search for, or nothing. */
export type LocateResult = LatLng | { query: string } | null

const num = String.raw`(-?\d{1,3}(?:\.\d+)?)`

// In priority order: the place's own pin beats the camera position.
const patterns = [
  new RegExp(String.raw`!3d${num}!4d${num}`),
  new RegExp(String.raw`@${num},${num}`),
  new RegExp(String.raw`[?&](?:q|query|ll|center|destination)=(?:loc:)?${num}(?:,|%2C)\s*(?:\+|%20)?${num}`, 'i'),
]

/** The coordinates written in a Maps link (or any text containing one), or null if there are none. */
export function coordsFromUrl(text: string): LatLng | null {
  for (const re of patterns) {
    const m = text.match(re)
    if (!m) continue
    const lat = Number(m[1])
    const lng = Number(m[2])
    if (Math.abs(lat) <= 90 && Math.abs(lng) <= 180 && !(lat === 0 && lng === 0)) return { lat, lng }
  }
  return null
}

/**
 * The place's own pin (!3d…!4d…) in a Maps web page. Other coordinates in a page, such as `center=` or `@lat,lng`,
 * can be the map's viewport, which Google sets from the requester's IP (the server's location, not the place's).
 */
export function placeCoordsFromPage(html: string): LatLng | null {
  const m = html.match(patterns[0])
  return m ? coordsFromUrl(m[0]) : null
}

/** A Google Maps link of any kind (full, short share link, or ?q= search). Other links can't be located. */
export function isGoogleMapsLink(url: string) {
  try {
    const { hostname, pathname } = new URL(url)
    if (isShortMapsLink(url)) return true
    if (/(^|\.)google\.[a-z.]+$/.test(hostname)) return hostname.startsWith('maps.') || pathname.startsWith('/maps')
    return false
  } catch {
    return false
  }
}

/** Short share links that redirect to the full Maps URL. */
export function isShortMapsLink(url: string) {
  try {
    const { hostname, pathname } = new URL(url)
    return hostname === 'maps.app.goo.gl' || hostname === 'g.co' || (hostname === 'goo.gl' && pathname.startsWith('/maps'))
  } catch {
    return false
  }
}

/** The place name in a Maps link (?q=Ichiran+Shibuya or /maps/place/Ichiran+Shibuya/…), which the map searches with Google Places. */
export function placeQuery(url: string): string | null {
  try {
    const u = new URL(url)
    const q = u.searchParams.get('q') ?? u.searchParams.get('query')
    if (q?.trim()) return q.trim()
    const place = u.pathname.match(/\/maps\/place\/([^/]+)/)
    if (place) return decodeURIComponent(place[1].replace(/\+/g, ' ')).trim() || null
  } catch {}
  return null
}

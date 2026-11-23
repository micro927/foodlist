import { Component, useEffect, useMemo, useRef, useState, type CSSProperties, type ReactNode } from 'react'
import {
  AdvancedMarker,
  APILoadingStatus,
  APIProvider,
  Circle,
  Map,
  useApiLoadingStatus,
  useMap,
  useMapsLibrary,
} from '@vis.gl/react-google-maps'
import { Loader2, LocateFixed, MapPinOff, TriangleAlert } from 'lucide-react'
import { toast } from 'sonner'
import { Button, Sheet } from '@/components/ui'
import { useLocations, useSaveLocations } from '@/lib/data'
import { isGoogleMapsLink, type LatLng } from '@/lib/maplink'
import { itemEmoji } from '@/lib/sections'
import type { Area, Item, ItemLocation, Section } from '@/lib/types'
import { trip } from '@/trip.config'
import { areaEmoji } from '../areas/areaItems'
import { AreaRow } from '../areas/AreasPage'
import { ItemRow } from '../items/ItemCard'
import { useOpenSheet } from '../sheets'

// The browser key ends up in the page, so it must be restricted to this site's addresses (see README).
const apiKey = (import.meta.env.VITE_GOOGLE_MAPS_BROWSER_KEY as string | undefined) ?? ''
// Custom HTML pins need a Map ID. Google's DEMO_MAP_ID works for trying it out; make a real one for the trip.
const mapId = (import.meta.env.VITE_GOOGLE_MAP_ID as string | undefined) || 'DEMO_MAP_ID'

/** A Restaurant or Place, with which list it's from. */
export type MapEntry = { section: Section; item: Item }
type Located = MapEntry & { lat: number; lng: number }
type LocatedArea = { area: Area; lat: number; lng: number }

// Area circles: a calm blue, apart from the pins' red, purple and amber.
const AREA_COLOR = '#3a7bd5'
// Zoomed out, an Area is just its icon; from this zoom in, its circle and name show.
const AREA_DETAIL_ZOOM = 14
// Stacking, bottom to top: Areas, then "you are here", then Restaurant and Place pins (circles are always below all).
const LAYER = { area: 1, here: 2, pin: 3 }

/** The location row an Area is matched against: its Maps link, or its name when it has no link. */
const areaKey = (area: Area) => area.maps_url || `name:${area.name}`

/** Why an item isn't on the map, and what to do about it. In the order they're listed. */
const reasons = {
  noLink: { title: 'No Google Maps link', hint: 'Add one in the edit form: Google Maps → Share → Copy link.' },
  otherLink: {
    title: 'Not a Google Maps link',
    hint: 'The link goes somewhere else (Facebook, Instagram…). Replace it with a Google Maps link.',
  },
  unreadable: {
    title: "Couldn't find the place",
    hint: 'Google found nothing for this link. Re-share it from Google Maps, or paste the full google.com/maps address from a browser.',
  },
} as const
type Reason = keyof typeof reasons

function reasonFor(item: Item): Reason {
  if (!item.maps_url) return 'noLink'
  if (!isGoogleMapsLink(item.maps_url)) return 'otherLink'
  return 'unreadable'
}

/** The ring around a pin: who wants to go there. */
function ringColor(item: Item) {
  if (trip.couples.every((c) => item.interested.includes(c.id))) return 'var(--color-primary)'
  if (item.interested.length === 1) return trip.couples.find((c) => c.id === item.interested[0])?.color ?? 'var(--color-muted)'
  return 'var(--color-muted)'
}

/**
 * Restaurants and Places as pins, Areas as circles, on a Google map. Tapping one opens its sheet.
 * An Area without a Maps link is found by its name (a neighbourhood name means one place, unlike a chain's).
 */
export default function ItemMap({
  entries,
  areas,
  planCounts,
  locating,
  onRetry,
}: {
  entries: MapEntry[]
  areas: Area[]
  /** Plan entries per item id (ids are unique across Restaurants and Places). */
  planCounts: Map<string, number>
  locating: boolean
  /** Looks up again the links that couldn't be located. */
  onRetry: () => void
}) {
  const openSheet = useOpenSheet()
  const { locations } = useLocations()
  const [missingOpen, setMissingOpen] = useState(false)
  const [here, setHere] = useState<LatLng | null>(null)
  const [zoom, setZoom] = useState<number>(trip.mapZoom)
  const areaDetail = zoom >= AREA_DETAIL_ZOOM
  const [searching, setSearching] = useState(false)
  // Bumped by "Look up again", so the place-name search also tries again.
  const [searchRound, setSearchRound] = useState(0)

  const { located, missing, toSearch, areasLocated, areasMissing } = useMemo(() => {
    const located: Located[] = []
    // Links that only gave the place's name: searched by name below.
    const toSearch: ItemLocation[] = []
    const missing: Record<Reason, MapEntry[]> = { noLink: [], otherLink: [], unreadable: [] }
    for (const entry of entries) {
      const { item } = entry
      const loc = locations.get(item.id)
      // A location read from an older link is stale.
      if (loc && loc.lat !== null && loc.lng !== null && loc.maps_url === item.maps_url)
        located.push({ ...entry, lat: loc.lat, lng: loc.lng })
      else {
        missing[reasonFor(item)].push(entry)
        if (loc && loc.query && loc.maps_url === item.maps_url) toSearch.push(loc)
      }
    }

    const areasLocated: LocatedArea[] = []
    const areasMissing: Area[] = []
    for (const area of areas) {
      const loc = locations.get(area.id)
      const key = areaKey(area)
      if (loc && loc.lat !== null && loc.lng !== null && loc.maps_url === key) areasLocated.push({ area, lat: loc.lat, lng: loc.lng })
      else {
        areasMissing.push(area)
        // With a link, the server looks it up first (and may give a name); without one, search the Area's name.
        if (loc?.query && loc.maps_url === key) toSearch.push(loc)
        else if (!area.maps_url) toSearch.push({ item_id: area.id, maps_url: key, lat: null, lng: null, query: area.name })
      }
    }
    return { located, missing, toSearch, areasLocated, areasMissing }
  }, [entries, areas, locations])
  const missingCount = Object.values(missing).reduce((n, list) => n + list.length, 0) + areasMissing.length
  // Only Google Maps links and Area names are worth looking up again.
  const retryable = missing.unreadable.length + areasMissing.length

  if (!apiKey)
    return <MapProblem title="The map isn't set up yet" body="Add VITE_GOOGLE_MAPS_BROWSER_KEY to .env (and Vercel), then restart." />

  return (
    <APIProvider apiKey={apiKey} language="en">
      <div className="relative isolate h-full w-full">
        <MapErrorBoundary>
          <Map
            mapId={mapId}
            defaultCenter={{ lat: trip.mapCenter[0], lng: trip.mapCenter[1] }}
            defaultZoom={trip.mapZoom}
            // The map fills the screen, so one finger pans it.
            gestureHandling="greedy"
            disableDefaultUI
            // Tapping Google's own places would open their pop-ups over ours.
            clickableIcons={false}
            className="h-full w-full bg-canvas"
            onZoomChanged={(e) => setZoom(e.detail.zoom)}
          >
            {areaDetail &&
              areasLocated.map(({ area, lat, lng }) => (
                <Circle
                  key={area.id}
                  center={{ lat, lng }}
                  radius={trip.areaRadius}
                  strokeColor={AREA_COLOR}
                  strokeOpacity={0.7}
                  strokeWeight={2}
                  fillColor={AREA_COLOR}
                  fillOpacity={0.12}
                  onClick={() => openSheet({ kind: 'area', id: area.id })}
                />
              ))}
            {areasLocated.map(({ area, lat, lng }) => (
              <AdvancedMarker
                key={`label-${area.id}`}
                position={{ lat, lng }}
                title={area.name}
                zIndex={LAYER.area}
                onClick={() => openSheet({ kind: 'area', id: area.id })}
              >
                <div className={areaDetail ? 'area-label' : 'area-icon'} style={{ '--area': AREA_COLOR } as CSSProperties}>
                  {areaDetail ? `${areaEmoji} ${area.name}` : areaEmoji}
                </div>
              </AdvancedMarker>
            ))}
            {located.map(({ section, item, lat, lng }) => (
              <AdvancedMarker
                key={item.id}
                position={{ lat, lng }}
                title={item.name}
                zIndex={LAYER.pin}
                onClick={() => openSheet({ kind: 'detail', section, id: item.id })}
              >
                <div className="item-pin" style={{ '--ring': ringColor(item) } as CSSProperties}>
                  <div className="item-pin-badge">
                    {itemEmoji(section, item)}
                    {(planCounts.get(item.id) ?? 0) > 0 && <i />}
                  </div>
                </div>
              </AdvancedMarker>
            ))}
            {here && (
              <AdvancedMarker position={here} zIndex={LAYER.here}>
                <div className="here-dot" />
              </AdvancedMarker>
            )}
            <FitToPins
              points={[
                ...located.map(({ item, lat, lng }) => ({ id: item.id, lat, lng })),
                ...areasLocated.map(({ area, lat, lng }) => ({ id: area.id, lat, lng })),
              ]}
            />
          </Map>
        </MapErrorBoundary>

        <MyLocation onFound={setHere} />
        <FindByName rows={toSearch} round={searchRound} onSearching={setSearching} />
        <AuthProblem />

        <div className="pointer-events-none absolute inset-x-0 top-3 z-10 flex justify-center gap-2 px-4">
          {locating || searching ? (
            <span className="inline-flex items-center gap-1.5 rounded-full bg-surface/95 px-3 py-1.5 text-xs font-semibold shadow-md">
              <Loader2 className="size-3.5 animate-spin text-primary" /> Finding locations…
            </span>
          ) : (
            missingCount > 0 && (
              <button
                type="button"
                onClick={() => setMissingOpen(true)}
                className="pointer-events-auto inline-flex items-center gap-1.5 rounded-full bg-surface/95 px-3 py-1.5 text-xs font-semibold shadow-md active:bg-canvas"
              >
                <MapPinOff className="size-3.5 text-muted" /> {missingCount} not on map
              </button>
            )
          )}
        </div>

        <Sheet
          open={missingOpen}
          onClose={() => setMissingOpen(false)}
          title="Not on the map"
          footer={
            retryable > 0 && (
              <Button
                variant="soft"
                className="w-full"
                onClick={() => {
                  onRetry()
                  setSearchRound((n) => n + 1)
                  setMissingOpen(false)
                }}
              >
                Look up {retryable === 1 ? 'the link' : `${retryable} links`} again
              </Button>
            )
          }
        >
          {/* Opening a detail sheet closes this one, so two sheets never stack. */}
          <div className="space-y-5" onClickCapture={() => setMissingOpen(false)}>
            {(Object.keys(reasons) as Reason[])
              .filter((reason) => missing[reason].length > 0)
              .map((reason) => (
                <section key={reason}>
                  <h3 className="text-sm font-bold">
                    {reasons[reason].title} <span className="font-medium text-muted">{missing[reason].length}</span>
                  </h3>
                  <p className="mt-0.5 mb-2 text-xs text-muted">{reasons[reason].hint}</p>
                  <div className="divide-y divide-line overflow-hidden rounded-3xl border border-line">
                    {missing[reason].map(({ section, item }) => (
                      <ItemRow key={item.id} section={section} item={item} planned={planCounts.get(item.id) ?? 0} />
                    ))}
                  </div>
                </section>
              ))}
            {areasMissing.length > 0 && (
              <section>
                <h3 className="text-sm font-bold">
                  Areas we couldn't find <span className="font-medium text-muted">{areasMissing.length}</span>
                </h3>
                <p className="mt-0.5 mb-2 text-xs text-muted">
                  Google found nothing for the name. Add a Google Maps link in the area's edit form.
                </p>
                <div className="divide-y divide-line overflow-hidden rounded-3xl border border-line">
                  {areasMissing.map((area) => (
                    <AreaRow key={area.id} area={area} />
                  ))}
                </div>
              </section>
            )}
          </div>
        </Sheet>
      </div>
    </APIProvider>
  )
}

/**
 * Finds places whose link only gave their name, with Google Places search (the map's key, Places API (New)),
 * and saves the pin for every phone. Each name is searched once per round; a name with no result stays off the map.
 */
function FindByName({ rows, round, onSearching }: { rows: ItemLocation[]; round: number; onSearching: (on: boolean) => void }) {
  const places = useMapsLibrary('places')
  const save = useSaveLocations()
  const tried = useRef(new Set<string>())
  const warned = useRef(false)

  useEffect(() => {
    if (!places) return
    const todo = rows.filter((row) => {
      const key = `${round} ${row.item_id} ${row.query}`
      if (tried.current.has(key)) return false
      tried.current.add(key)
      return true
    })
    if (!todo.length) return

    onSearching(true)
    ;(async () => {
      const found: ItemLocation[] = []
      for (const row of todo) {
        try {
          const { places: results } = await places.Place.searchByText({
            textQuery: row.query!,
            // Only the location: billed as Text Search Pro (5,000 free a month). Each name is saved once found.
            fields: ['location'],
            maxResultCount: 1,
            // Prefer the trip's area (50 km is the most allowed) without excluding day trips.
            locationBias: { center: { lat: trip.mapCenter[0], lng: trip.mapCenter[1] }, radius: 50_000 },
          })
          const location = results[0]?.location
          if (location) found.push({ ...row, lat: location.lat(), lng: location.lng() })
        } catch (err) {
          console.error('Places search failed for', row.query, err)
          if (!warned.current) {
            warned.current = true
            const reason = err instanceof Error ? err.message : String(err)
            toast.error(`Map: couldn't search places by name. Google says: ${reason}`, { duration: 15_000 })
          }
          break
        }
      }
      if (found.length) await save(found).catch(() => toast.error("Map: couldn't save the places it found"))
    })().finally(() => onSearching(false))
  }, [places, rows, round, onSearching, save])

  return null
}

// The map opens on what's within this distance of the trip's centre; day trips further out are a pan away.
const FIT_RADIUS_KM = 50

/** Rough distance in km, plenty for "is it near the trip's centre?". */
function kmFromCenter({ lat, lng }: LatLng) {
  const [cLat, cLng] = trip.mapCenter
  const x = (lng - cLng) * Math.cos(((lat + cLat) / 2) * (Math.PI / 180))
  return Math.hypot(lat - cLat, x) * 111
}

/**
 * Zooms to fit the pins and circles whenever they change (pills, new locations): the ones near the trip's centre,
 * so a day trip (Hakuba, Kawaguchiko) doesn't shrink Tokyo to a dot; all of them if none are near.
 */
function FitToPins({ points }: { points: { id: string; lat: number; lng: number }[] }) {
  const map = useMap()
  const key = points.map((p) => `${p.id}:${p.lat},${p.lng}`).join('|')
  useEffect(() => {
    if (!map || points.length === 0) return
    const near = points.filter((p) => kmFromCenter(p) <= FIT_RADIUS_KM)
    const fit = near.length ? near : points
    if (fit.length === 1) {
      map.setCenter(fit[0])
      map.setZoom(15)
      return
    }
    const lats = fit.map((p) => p.lat)
    const lngs = fit.map((p) => p.lng)
    map.fitBounds(
      { north: Math.max(...lats), south: Math.min(...lats), east: Math.max(...lngs), west: Math.min(...lngs) },
      // Room for the pins themselves and the "not on map" chip.
      { top: 64, bottom: 48, left: 32, right: 32 },
    )
    // Only when the pins change (key), not on every render.
  }, [key, map])
  return null
}

/** A "where am I" button, for "what's near us?". The blue dot is drawn by ItemMap. */
function MyLocation({ onFound }: { onFound: (position: LatLng) => void }) {
  const map = useMap()
  const [finding, setFinding] = useState(false)

  const locate = () => {
    if (!navigator.geolocation) return toast.error("This phone can't share its location")
    setFinding(true)
    navigator.geolocation.getCurrentPosition(
      ({ coords }) => {
        const position = { lat: coords.latitude, lng: coords.longitude }
        onFound(position)
        setFinding(false)
        map?.panTo(position)
        if ((map?.getZoom() ?? 0) < 15) map?.setZoom(16)
      },
      () => {
        setFinding(false)
        toast.error("Couldn't get your location")
      },
      { enableHighAccuracy: true, timeout: 15_000 },
    )
  }

  return (
    <button
      type="button"
      aria-label="Show where I am"
      onClick={locate}
      className="absolute right-3 bottom-4 z-10 grid size-11 place-items-center rounded-full bg-surface text-ink shadow-md active:bg-canvas"
    >
      {finding ? <Loader2 className="size-5 animate-spin text-primary" /> : <LocateFixed className="size-5" />}
    </button>
  )
}

/** Shown over the map when Google refuses the key (wrong key, API not enabled, or this site not allowed). */
function AuthProblem() {
  const status = useApiLoadingStatus()
  if (status !== APILoadingStatus.AUTH_FAILURE && status !== APILoadingStatus.FAILED) return null
  return (
    <div className="absolute inset-0 z-20">
      <MapProblem
        title="Google Maps refused to load"
        body="Check that Maps JavaScript API is enabled and the browser key allows this site's address."
      />
    </div>
  )
}

/**
 * When Google's map code throws (a refused key makes its pins throw), show the problem in place of the map
 * instead of letting the error take down the whole app.
 */
class MapErrorBoundary extends Component<{ children: ReactNode }, { failed: boolean }> {
  state = { failed: false }
  static getDerivedStateFromError() {
    return { failed: true }
  }
  render() {
    return this.state.failed ? (
      <MapProblem title="Google Maps refused to load" body="Check the browser key, and that Maps JavaScript API is enabled for it." />
    ) : (
      this.props.children
    )
  }
}

function MapProblem({ title, body }: { title: string; body: string }) {
  return (
    <div className="flex h-full flex-col items-center justify-center bg-canvas px-8 text-center">
      <TriangleAlert className="size-8 text-muted" />
      <h2 className="mt-3 font-bold">{title}</h2>
      <p className="mt-1 text-sm text-muted">{body}</p>
    </div>
  )
}

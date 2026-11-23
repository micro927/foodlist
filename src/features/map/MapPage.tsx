import { lazy, Suspense, useEffect, useMemo, useRef, useState, type RefObject } from 'react'
import { PageTitle } from '@/components/browse'
import { Chip } from '@/components/ui'
import { useAreas, useItems, useLocateMissing, usePlanCounts } from '@/lib/data'
import { sections } from '@/lib/sections'
import type { Section } from '@/lib/types'
import { local } from '@/lib/utils'
import { areaEmoji } from '../areas/areaItems'
import type { MapEntry } from './ItemMap'

// Google's map code only downloads the first time someone opens the Map tab.
const ItemMap = lazy(() => import('./ItemMap'))

/** What the map can show; the pills tick each in and out. */
type Kind = Section | 'areas'
const kinds: { value: Kind; label: string }[] = [
  { value: 'eats', label: `🍜 ${sections.eats.title}` },
  { value: 'places', label: `📍 ${sections.places.title}` },
  { value: 'areas', label: `${areaEmoji} Areas` },
]
const allKinds = kinds.map((k) => k.value)
const SHOWN_KEY = 'foodlist:map:shown'

/** Where an element's bottom edge is on screen, kept up to date. */
function useBottomEdge(ref: RefObject<HTMLElement | null>) {
  const [bottom, setBottom] = useState(0)
  useEffect(() => {
    const el = ref.current
    if (!el) return
    const measure = () => setBottom(el.getBoundingClientRect().bottom)
    measure()
    const observer = new ResizeObserver(measure)
    observer.observe(el)
    window.addEventListener('resize', measure)
    return () => {
      observer.disconnect()
      window.removeEventListener('resize', measure)
    }
  }, [ref])
  return bottom
}

/** The Map tab: Restaurants and Places as pins and Areas as circles; the pills tick each kind in and out. */
export function MapPage() {
  const { data: eats = [] } = useItems('eats')
  const { data: places = [] } = useItems('places')
  const { data: areas = [] } = useAreas()
  const eatsPlanned = usePlanCounts('eats')
  const placesPlanned = usePlanCounts('places')
  const [shown, setShownState] = useState<Kind[]>(() => {
    const saved = (local.get(SHOWN_KEY) ?? '').split(',').filter((k): k is Kind => allKinds.includes(k as Kind))
    return saved.length ? saved : allKinds
  })
  const setShown = (list: Kind[]) => (setShownState(list), local.set(SHOWN_KEY, list.join(',')))
  // Ticks a kind in or out, keeping at least one so the map is never empty.
  const toggle = (kind: Kind) =>
    shown.includes(kind) ? shown.length > 1 && setShown(shown.filter((k) => k !== kind)) : setShown([...shown, kind])
  const isAll = shown.length === allKinds.length

  const all = useMemo(() => [...eats, ...places, ...areas], [eats, places, areas])
  // Looks up every new or changed link, whichever pill is picked, so switching shows pins straight away.
  const { locating, retry } = useLocateMissing(all)

  const entries = useMemo<MapEntry[]>(
    () => [
      ...(shown.includes('eats') ? eats.map((item) => ({ section: 'eats' as const, item })) : []),
      ...(shown.includes('places') ? places.map((item) => ({ section: 'places' as const, item })) : []),
    ],
    [eats, places, shown],
  )
  const shownAreas = useMemo(() => (shown.includes('areas') ? areas : []), [areas, shown])
  // Item ids are unique across Restaurants and Places, so one map holds both.
  const planCounts = useMemo(() => new Map([...eatsPlanned, ...placesPlanned]), [eatsPlanned, placesPlanned])

  const header = useRef<HTMLElement>(null)
  const mapTop = useBottomEdge(header)

  return (
    <div>
      <header
        ref={header}
        className="sticky top-0 z-20 border-b border-line/70 bg-canvas/90 pt-[max(12px,env(safe-area-inset-top))] backdrop-blur-xl"
      >
        <div className="mx-auto max-w-5xl px-4">
          <PageTitle title="Map" count={entries.length + shownAreas.length} />
          <div className="no-scrollbar -mx-4 mt-2.5 flex gap-1.5 overflow-x-auto px-4 pb-3">
            <Chip active={isAll} onClick={() => setShown(allKinds)}>
              All
            </Chip>
            {kinds.map((k) => {
              const on = shown.includes(k.value)
              return (
                // Ticked: a soft tint, so only "All" is solid red when everything is on. Only the colour changes, so ticking never shifts the row.
                <Chip
                  key={k.value}
                  aria-pressed={on}
                  onClick={() => toggle(k.value)}
                  className={on ? 'border-primary/40 bg-primary-soft text-primary' : undefined}
                >
                  {k.label}
                </Chip>
              )
            })}
          </div>
        </div>
      </header>

      {/* Fills the screen between the header and the tab bar. */}
      <div className="fixed inset-x-0 bottom-[calc(4rem+env(safe-area-inset-bottom))]" style={{ top: mapTop }}>
        <Suspense fallback={<div className="h-full animate-pulse bg-line/60" />}>
          <ItemMap entries={entries} areas={shownAreas} planCounts={planCounts} locating={locating} onRetry={retry} />
        </Suspense>
      </div>
    </div>
  )
}

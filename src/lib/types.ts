import type { CoupleId, GoodForId, SlotId } from '@/trip.config'

/** Eats lists Restaurants, Places lists Places. Both work the same way and both can be planned. */
export type Section = 'eats' | 'places'

/** A Restaurant or a Place. */
export type Item = {
  id: string
  name: string
  category: string
  area: string
  maps_url: string | null
  inspo_url: string | null
  notes: string | null
  cover_path: string | null
  interested: CoupleId[]
  created_at: string
  updated_at: string
}

export type ItemFields = Pick<Item, 'name' | 'category' | 'area' | 'maps_url' | 'inspo_url' | 'notes'>

export type PlanEntry = {
  id: string
  item_id: string // the restaurant or place
  day: string // YYYY-MM-DD
  slot: SlotId
  time: string | null // HH:MM
  going: CoupleId[]
  position: number
  created_at: string
}

export type PlanEntryFields = Pick<PlanEntry, 'item_id' | 'day' | 'slot' | 'time' | 'going'>

export type Area = {
  id: string
  name: string
  maps_url: string | null
  good_for: GoodForId[]
  inspo_urls: string[]
  /** Hand-picked restaurants and places. Not foreign keys: ids of deleted items may linger and are ignored. */
  restaurant_ids: string[]
  place_ids: string[]
  notes: string | null
  cover_path: string | null
  created_at: string
  updated_at: string
}

export type AreaFields = Pick<Area, 'name' | 'maps_url' | 'good_for' | 'inspo_urls' | 'restaurant_ids' | 'place_ids' | 'notes'>

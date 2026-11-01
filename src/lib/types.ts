import type { CoupleId, GoodForId, PersonId, SlotId } from '@/trip.config'

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

/** One row of a receipt. Lives inside its Bill, not in a table of its own. */
export type BillLine = {
  id: string
  name_en: string
  name_ja: string
  qty: number
  /** What the whole row costs in yen (Beer ×6 → the price of all six). Negative for a discount. */
  price: number
  /** Tax, service charge or discount: spread over people by what they ate instead of being given out. */
  extra: boolean
  /** Who ate each Unit, one list per Unit (length = qty). Ignored when `custom` is set. */
  units: PersonId[][]
  /** Custom split: each person's yen for this line, adding up to `price`. */
  custom: Partial<Record<PersonId, number>> | null
}

export type Bill = {
  id: string
  shop: string
  day: string // YYYY-MM-DD
  time: string // HH:MM
  payer: PersonId
  sharing: PersonId[]
  lines: BillLine[]
  /** The total printed on the receipt, to check the lines against. */
  receipt_total: number | null
  /** Yen each person had paid back when they were marked paid. A Share is paid only while it still equals this. */
  paid: Partial<Record<PersonId, number>>
  photo_paths: string[]
  created_at: string
  updated_at: string
}

export type BillFields = Pick<Bill, 'shop' | 'day' | 'time' | 'payer' | 'sharing' | 'lines' | 'receipt_total' | 'paid' | 'photo_paths'>

/** What a Scan reads off a receipt photo. */
export type ScanResult = {
  shop: string
  lines: Pick<BillLine, 'name_en' | 'name_ja' | 'qty' | 'price' | 'extra'>[]
  total: number | null
}

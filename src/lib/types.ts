import type { CoupleId, SlotId } from '@/trip.config'

export type Restaurant = {
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

export type RestaurantFields = Pick<Restaurant, 'name' | 'category' | 'area' | 'maps_url' | 'inspo_url' | 'notes'>

export type PlanEntry = {
  id: string
  restaurant_id: string
  day: string // YYYY-MM-DD
  slot: SlotId
  time: string | null // HH:MM
  going: CoupleId[]
  position: number
  created_at: string
}

export type PlanEntryFields = Pick<PlanEntry, 'restaurant_id' | 'day' | 'slot' | 'time' | 'going'>

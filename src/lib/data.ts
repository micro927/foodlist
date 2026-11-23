import { useCallback, useEffect, useMemo, useRef, useState } from 'react'
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import type { CoupleId } from '@/trip.config'
import { toast } from 'sonner'
import { api, type Table } from './api'
import { useOnline } from './device'
import { isGoogleMapsLink } from './maplink'
import type { Area, AreaFields, Bill, BillFields, Item, ItemFields, ItemLocation, PlanEntryFields, Section } from './types'

const keys = {
  items: (section: Section) => ['items', section] as const,
  plan: (section: Section) => ['plan', section] as const,
  areas: ['areas'] as const,
  bills: ['bills'] as const,
  locations: ['locations'] as const,
}

const keyOf: Record<Table, readonly string[]> = {
  restaurants: keys.items('eats'),
  plan_entries: keys.plan('eats'),
  places: keys.items('places'),
  place_plan_entries: keys.plan('places'),
  areas: keys.areas,
  bills: keys.bills,
  item_locations: keys.locations,
}

export function useItems(section: Section) {
  return useQuery({ queryKey: keys.items(section), queryFn: () => api.listItems(section) })
}

export function usePlan(section: Section) {
  return useQuery({ queryKey: keys.plan(section), queryFn: () => api.listPlan(section) })
}

export function useAreas() {
  return useQuery({ queryKey: keys.areas, queryFn: api.listAreas })
}

export function useItemMap(section: Section) {
  const { data } = useItems(section)
  return useMemo(() => new Map((data ?? []).map((r) => [r.id, r])), [data])
}

export function useAreaMap() {
  const { data } = useAreas()
  return useMemo(() => new Map((data ?? []).map((a) => [a.id, a])), [data])
}

/** Where each Restaurant or Place is, by item id. `loaded` is false until the saved locations have been read. */
export function useLocations() {
  const { data, isSuccess } = useQuery({ queryKey: keys.locations, queryFn: api.listLocations })
  const locations = useMemo(() => new Map((data ?? []).map((l) => [l.item_id, l])), [data])
  return { locations, loaded: isSuccess }
}

const LOCATE_BATCH = 10

/**
 * Looks up items whose Maps link hasn't been looked up yet (new items, or a link that changed) and saves what's
 * found for every phone: coordinates, or only the place's name, which the map then searches with Google Places.
 * Each link is tried once per session; `retry` tries the ones that found nothing again.
 */
export function useLocateMissing(items: Pick<Item, 'id' | 'maps_url'>[]) {
  const qc = useQueryClient()
  const online = useOnline()
  const { locations, loaded } = useLocations()
  const tried = useRef(new Set<string>())
  const warned = useRef(false)
  const [working, setWorking] = useState(0)
  // Bumped by retry: also looks up links already saved as "couldn't locate".
  const [retries, setRetries] = useState(0)

  useEffect(() => {
    if (!online || !loaded) return
    const missing = items.filter((i) => {
      const saved = locations.get(i.id)
      // Only Google Maps links can be located (not Facebook, Instagram…).
      if (!i.maps_url || !isGoogleMapsLink(i.maps_url)) return false
      // Done once it has coordinates or a name to search; a link that found nothing is tried once a session.
      if (saved?.maps_url === i.maps_url && (saved.lat !== null || saved.query !== null)) return false
      const key = `${retries} ${i.id} ${i.maps_url}`
      if (tried.current.has(key)) return false
      tried.current.add(key)
      return true
    })
    if (!missing.length) return

    setWorking((n) => n + 1)
    ;(async () => {
      for (let i = 0; i < missing.length; i += LOCATE_BATCH) {
        const batch = missing.slice(i, i + LOCATE_BATCH)
        try {
          const found = await api.locate([...new Set(batch.map((item) => item.maps_url!))])
          const rows: ItemLocation[] = batch
            .filter((item) => item.maps_url! in found)
            .map((item) => {
              const result = found[item.maps_url!]
              return {
                item_id: item.id,
                maps_url: item.maps_url!,
                lat: result && 'lat' in result ? result.lat : null,
                lng: result && 'lng' in result ? result.lng : null,
                query: result && 'query' in result ? result.query : null,
              }
            })
          await api.saveLocations(rows)
          await qc.invalidateQueries({ queryKey: keys.locations })
        } catch (err) {
          // Once per session: these stay off the map until the next session or a retry.
          if (!warned.current) {
            warned.current = true
            toast.error(err instanceof Error && err.message ? `Map: ${err.message}` : "Couldn't look up map locations")
          }
        }
      }
    })().finally(() => setWorking((n) => n - 1))
  }, [items, locations, loaded, online, qc, retries])

  const retry = useCallback(() => {
    warned.current = false
    setRetries((n) => n + 1)
  }, [])

  return { locating: working > 0, retry }
}

/** Saves locations found on this phone (e.g. by the map's place-name search) for every phone. */
export function useSaveLocations() {
  const qc = useQueryClient()
  return useCallback(
    async (rows: ItemLocation[]) => {
      await api.saveLocations(rows)
      await qc.invalidateQueries({ queryKey: keys.locations })
    },
    [qc],
  )
}

/** How many plan entries each restaurant or place has. */
export function usePlanCounts(section: Section) {
  const { data } = usePlan(section)
  return useMemo(() => {
    const counts = new Map<string, number>()
    for (const e of data ?? []) counts.set(e.item_id, (counts.get(e.item_id) ?? 0) + 1)
    return counts
  }, [data])
}

/** Refetches whenever another phone changes something. */
export function useLiveUpdates() {
  const qc = useQueryClient()
  useEffect(() => api.subscribe((table) => qc.invalidateQueries({ queryKey: keyOf[table] })), [qc])
}

function useInvalidateSection(section: Section) {
  const qc = useQueryClient()
  return () =>
    Promise.all([qc.invalidateQueries({ queryKey: keys.items(section) }), qc.invalidateQueries({ queryKey: keys.plan(section) })])
}

export function useToggleInterest(section: Section) {
  const qc = useQueryClient()
  const key = keys.items(section)
  const flip = (list: CoupleId[], couple: CoupleId) => (list.includes(couple) ? list.filter((c) => c !== couple) : [...list, couple])
  return useMutation({
    mutationFn: ({ item, couple }: { item: Item; couple: CoupleId }) =>
      api.updateItem(section, item.id, { interested: flip(item.interested, couple) }),
    // Flip the heart instantly; roll back if the save fails.
    onMutate: async ({ item, couple }) => {
      await qc.cancelQueries({ queryKey: key })
      const previous = qc.getQueryData<Item[]>(key)
      qc.setQueryData<Item[]>(key, (list) =>
        list?.map((r) => (r.id !== item.id ? r : { ...r, interested: flip(r.interested, couple) })),
      )
      return { previous }
    },
    onError: (_err, _vars, ctx) => qc.setQueryData(key, ctx?.previous),
    onSettled: () => qc.invalidateQueries({ queryKey: key }),
  })
}

export type SaveItemInput = {
  existing?: Item
  fields: ItemFields & Pick<Item, 'interested'>
  /** undefined = leave cover as is, null = remove it, Blob = replace it */
  cover?: Blob | null
}

export function useSaveItem(section: Section) {
  const invalidate = useInvalidateSection(section)
  return useMutation({
    mutationFn: async ({ existing, fields, cover }: SaveItemInput) => {
      const target = existing ?? (await api.createItem(section, fields))
      if (existing) await api.updateItem(section, existing.id, fields)
      if (cover !== undefined) await api.setCover(section, target, cover)
      return target.id
    },
    onSuccess: invalidate,
  })
}

export function useDeleteItem(section: Section) {
  const invalidate = useInvalidateSection(section)
  return useMutation({ mutationFn: (item: Item) => api.deleteItem(section, item), onSuccess: invalidate })
}

export function useSaveEntry(section: Section) {
  const qc = useQueryClient()
  return useMutation({
    mutationFn: ({ id, fields }: { id?: string; fields: PlanEntryFields }) =>
      id ? api.updateEntry(section, id, fields) : api.createEntry(section, fields),
    onSuccess: () => qc.invalidateQueries({ queryKey: keys.plan(section) }),
  })
}

export function useDeleteEntry(section: Section) {
  const qc = useQueryClient()
  return useMutation({
    mutationFn: (id: string) => api.deleteEntry(section, id),
    onSuccess: () => qc.invalidateQueries({ queryKey: keys.plan(section) }),
  })
}

export type SaveAreaInput = {
  existing?: Area
  fields: AreaFields
  /** undefined = leave cover as is, null = remove it, Blob = replace it */
  cover?: Blob | null
}

export function useSaveArea() {
  const qc = useQueryClient()
  return useMutation({
    mutationFn: async ({ existing, fields, cover }: SaveAreaInput) => {
      const target = existing ?? (await api.createArea(fields))
      if (existing) await api.updateArea(existing.id, fields)
      if (cover !== undefined) await api.setCover('areas', target, cover)
      return target.id
    },
    onSuccess: () => qc.invalidateQueries({ queryKey: keys.areas }),
  })
}

export function useDeleteArea() {
  const qc = useQueryClient()
  return useMutation({
    mutationFn: (area: Area) => api.deleteArea(area),
    onSuccess: () => qc.invalidateQueries({ queryKey: keys.areas }),
  })
}

export function useBills() {
  return useQuery({ queryKey: keys.bills, queryFn: api.listBills })
}

export type SaveBillInput = {
  id: string
  existing?: Bill
  fields: Omit<BillFields, 'photo_paths'>
  /** Saved photos to keep, plus new ones to upload. */
  photos: { keep: string[]; add: Blob[] }
}

export function useSaveBill() {
  const qc = useQueryClient()
  return useMutation({
    mutationFn: async ({ id, existing, fields, photos }: SaveBillInput) => {
      const added = await Promise.all(photos.add.map((blob) => api.uploadBillPhoto(id, blob)))
      const all = { ...fields, photo_paths: [...photos.keep, ...added] }
      if (existing) await api.updateBill(id, all)
      else await api.createBill({ ...all, id })
      await api.removeBillPhotos((existing?.photo_paths ?? []).filter((p) => !photos.keep.includes(p)))
    },
    onSuccess: () => qc.invalidateQueries({ queryKey: keys.bills }),
  })
}

export function useDeleteBill() {
  const qc = useQueryClient()
  return useMutation({
    mutationFn: (bill: Bill) => api.deleteBill(bill),
    onSuccess: () => qc.invalidateQueries({ queryKey: keys.bills }),
  })
}

/** Writes new `paid` maps (marking Shares paid or unpaid, or settling up), updating the list instantly. */
export function useSetPaid() {
  const qc = useQueryClient()
  return useMutation({
    mutationFn: (changes: { bill: Bill; paid: Bill['paid'] }[]) =>
      Promise.all(changes.map(({ bill, paid }) => api.updateBill(bill.id, { paid }))),
    onMutate: async (changes) => {
      await qc.cancelQueries({ queryKey: keys.bills })
      const previous = qc.getQueryData<Bill[]>(keys.bills)
      const next = new Map(changes.map((c) => [c.bill.id, c.paid]))
      qc.setQueryData<Bill[]>(keys.bills, (list) => list?.map((b) => (next.has(b.id) ? { ...b, paid: next.get(b.id)! } : b)))
      return { previous }
    },
    onError: (_err, _vars, ctx) => qc.setQueryData(keys.bills, ctx?.previous),
    onSettled: () => qc.invalidateQueries({ queryKey: keys.bills }),
  })
}

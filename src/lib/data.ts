import { useEffect, useMemo } from 'react'
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import type { CoupleId } from '@/trip.config'
import { api, type Table } from './api'
import type { Area, AreaFields, Item, ItemFields, PlanEntryFields, Section } from './types'

const keys = {
  items: (section: Section) => ['items', section] as const,
  plan: (section: Section) => ['plan', section] as const,
  areas: ['areas'] as const,
}

const keyOf: Record<Table, readonly string[]> = {
  restaurants: keys.items('eats'),
  plan_entries: keys.plan('eats'),
  places: keys.items('places'),
  place_plan_entries: keys.plan('places'),
  areas: keys.areas,
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

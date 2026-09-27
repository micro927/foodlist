import { useEffect, useMemo } from 'react'
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import type { CoupleId } from '@/trip.config'
import { api } from './api'
import type { PlanEntryFields, Restaurant, RestaurantFields } from './types'

const keys = { restaurants: ['restaurants'], plan: ['plan'] } as const

export function useRestaurants() {
  return useQuery({ queryKey: keys.restaurants, queryFn: api.listRestaurants })
}

export function usePlan() {
  return useQuery({ queryKey: keys.plan, queryFn: api.listPlan })
}

export function useRestaurantMap() {
  const { data } = useRestaurants()
  return useMemo(() => new Map((data ?? []).map((r) => [r.id, r])), [data])
}

/** How many plan entries each restaurant has. */
export function usePlanCounts() {
  const { data } = usePlan()
  return useMemo(() => {
    const counts = new Map<string, number>()
    for (const e of data ?? []) counts.set(e.restaurant_id, (counts.get(e.restaurant_id) ?? 0) + 1)
    return counts
  }, [data])
}

/** Refetches whenever another phone changes something. */
export function useLiveUpdates() {
  const qc = useQueryClient()
  useEffect(
    () =>
      api.subscribe((table) =>
        qc.invalidateQueries({ queryKey: table === 'restaurants' ? keys.restaurants : keys.plan }),
      ),
    [qc],
  )
}

function useInvalidateAll() {
  const qc = useQueryClient()
  return () => Promise.all([qc.invalidateQueries({ queryKey: keys.restaurants }), qc.invalidateQueries({ queryKey: keys.plan })])
}

export function useToggleInterest() {
  const qc = useQueryClient()
  return useMutation({
    mutationFn: ({ restaurant, couple }: { restaurant: Restaurant; couple: CoupleId }) => {
      const interested = restaurant.interested.includes(couple)
        ? restaurant.interested.filter((c) => c !== couple)
        : [...restaurant.interested, couple]
      return api.updateRestaurant(restaurant.id, { interested })
    },
    // Flip the heart instantly; roll back if the save fails.
    onMutate: async ({ restaurant, couple }) => {
      await qc.cancelQueries({ queryKey: keys.restaurants })
      const previous = qc.getQueryData<Restaurant[]>(keys.restaurants)
      qc.setQueryData<Restaurant[]>(keys.restaurants, (list) =>
        list?.map((r) =>
          r.id !== restaurant.id
            ? r
            : { ...r, interested: r.interested.includes(couple) ? r.interested.filter((c) => c !== couple) : [...r.interested, couple] },
        ),
      )
      return { previous }
    },
    onError: (_err, _vars, ctx) => qc.setQueryData(keys.restaurants, ctx?.previous),
    onSettled: () => qc.invalidateQueries({ queryKey: keys.restaurants }),
  })
}

export type SaveRestaurantInput = {
  existing?: Restaurant
  fields: RestaurantFields & Pick<Restaurant, 'interested'>
  /** undefined = leave cover as is, null = remove it, Blob = replace it */
  cover?: Blob | null
}

export function useSaveRestaurant() {
  const invalidate = useInvalidateAll()
  return useMutation({
    mutationFn: async ({ existing, fields, cover }: SaveRestaurantInput) => {
      const target = existing ?? (await api.createRestaurant(fields))
      if (existing) await api.updateRestaurant(existing.id, fields)
      if (cover !== undefined) await api.setCover(target, cover)
      return target.id
    },
    onSuccess: invalidate,
  })
}

export function useDeleteRestaurant() {
  const invalidate = useInvalidateAll()
  return useMutation({ mutationFn: (r: Restaurant) => api.deleteRestaurant(r), onSuccess: invalidate })
}

export function useSaveEntry() {
  const qc = useQueryClient()
  return useMutation({
    mutationFn: ({ id, fields }: { id?: string; fields: PlanEntryFields }) =>
      id ? api.updateEntry(id, fields) : api.createEntry(fields),
    onSuccess: () => qc.invalidateQueries({ queryKey: keys.plan }),
  })
}

export function useDeleteEntry() {
  const qc = useQueryClient()
  return useMutation({
    mutationFn: (id: string) => api.deleteEntry(id),
    onSuccess: () => qc.invalidateQueries({ queryKey: keys.plan }),
  })
}

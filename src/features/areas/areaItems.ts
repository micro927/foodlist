import { useMemo } from 'react'
import { useItemMap } from '@/lib/data'
import type { Area, Item } from '@/lib/types'

export const areaEmoji = '🗺️'

/** The area's restaurants and places that still exist (ids of deleted ones are skipped). */
export function useAreaItems(area: Pick<Area, 'restaurant_ids' | 'place_ids'> | undefined) {
  const restaurants = useItemMap('eats')
  const places = useItemMap('places')
  return useMemo(() => {
    const pick = (ids: string[] | undefined, map: Map<string, Item>) =>
      (ids ?? []).flatMap((id) => map.get(id) ?? []).sort((a, b) => a.name.localeCompare(b.name))
    return { eats: pick(area?.restaurant_ids, restaurants), places: pick(area?.place_ids, places) }
  }, [area?.restaurant_ids, area?.place_ids, restaurants, places])
}

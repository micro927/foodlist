import { api } from '@/lib/api'
import type { Restaurant } from '@/lib/types'
import { cn } from '@/lib/utils'
import { categoryEmoji } from '@/trip.config'

/** The restaurant's cover photo, or a soft aurora with its category emoji. */
export function Cover({ restaurant, className, emojiClass }: { restaurant: Pick<Restaurant, 'cover_path' | 'category' | 'name'>; className?: string; emojiClass?: string }) {
  if (restaurant.cover_path) {
    return (
      <img
        src={api.coverUrl(restaurant.cover_path)}
        alt={restaurant.name}
        loading="lazy"
        decoding="async"
        className={cn('bg-line object-cover', className)}
      />
    )
  }
  return (
    <div className={cn('aurora flex items-center justify-center', className)}>
      <span className={cn('text-4xl drop-shadow-sm', emojiClass)}>{categoryEmoji(restaurant.category)}</span>
    </div>
  )
}

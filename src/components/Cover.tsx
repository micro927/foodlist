import { api } from '@/lib/api'
import { cn } from '@/lib/utils'

/** The cover photo, or a soft aurora with an emoji (the category's, for restaurants and places). */
export function Cover({
  of,
  emoji,
  className,
  emojiClass,
}: {
  of: { cover_path: string | null; name: string }
  emoji: string
  className?: string
  emojiClass?: string
}) {
  if (of.cover_path) {
    return (
      <img
        src={api.coverUrl(of.cover_path)}
        alt={of.name}
        loading="lazy"
        decoding="async"
        className={cn('bg-line object-cover', className)}
      />
    )
  }
  return (
    <div className={cn('aurora flex items-center justify-center', className)}>
      <span className={cn('text-4xl drop-shadow-sm', emojiClass)}>{emoji}</span>
    </div>
  )
}

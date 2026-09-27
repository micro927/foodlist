import type { Couple } from '@/trip.config'
import { cn } from '@/lib/utils'

/** Heart-style toggle for one couple's interest. `labeled` shows the couple's name next to the emoji. */
export function CoupleToggle({
  couple,
  active,
  onToggle,
  labeled,
  isMe,
}: {
  couple: Couple
  active: boolean
  onToggle: () => void
  labeled?: boolean
  isMe?: boolean
}) {
  return (
    <button
      type="button"
      aria-pressed={active}
      aria-label={`${couple.name} ${active ? 'interested' : 'not interested'}`}
      onClick={(e) => {
        e.stopPropagation()
        onToggle()
      }}
      style={active ? { backgroundColor: couple.soft, borderColor: couple.color, color: couple.color } : undefined}
      className={cn(
        'inline-flex items-center justify-center gap-1.5 rounded-full border transition active:scale-90',
        labeled ? 'h-11 flex-1 px-4 text-sm font-semibold' : 'size-9',
        active ? 'border-2' : 'border-line bg-surface text-muted',
        isMe && !labeled && 'size-10',
      )}
    >
      <span className={cn('text-base leading-none transition', !active && 'opacity-35 grayscale')}>{couple.emoji}</span>
      {labeled && (
        <span>
          {couple.name}
          {isMe && <span className="ml-1 text-xs font-medium opacity-70">(you)</span>}
        </span>
      )}
    </button>
  )
}

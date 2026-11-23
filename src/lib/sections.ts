import { categoryEmoji, placeCategoryEmoji, trip, type SlotId } from '@/trip.config'
import type { Item, Section } from './types'

/** Everything that differs between Eats and Places; the screens themselves are shared. */
export const sections = {
  eats: {
    title: 'Eats',
    noun: 'restaurant',
    nouns: 'restaurants',
    emoji: categoryEmoji,
    /** null = free text with suggestions */
    categories: null,
    slots: trip.slots,
    slotHeading: 'Meal',
    defaultSlot: 'dinner',
    /** Keeps the keys Eats already used so saved preferences survive. */
    storagePrefix: 'foodlist:',
    empty: { emoji: '🍣', body: "Add the first restaurant you're dreaming about." },
    placeholders: { name: 'e.g. Sushi Zanmai', category: 'Sushi', notes: 'All you can eat ¥5000, book 1 month ahead…' },
  },
  places: {
    title: 'Places',
    noun: 'place',
    nouns: 'places',
    emoji: placeCategoryEmoji,
    categories: trip.placeCategories,
    slots: trip.placeSlots,
    slotHeading: 'Time of day',
    defaultSlot: 'afternoon',
    storagePrefix: 'foodlist:places:',
    empty: { emoji: '🎡', body: 'Add the first place you want to see.' },
    placeholders: { name: 'e.g. teamLab Planets', category: '', notes: 'Book tickets ahead, closes 8pm…' },
  },
} satisfies Record<
  Section,
  {
    title: string
    noun: string
    nouns: string
    emoji: (category: string) => string
    categories: readonly { label: string; emoji: string }[] | null
    slots: readonly { id: SlotId; label: string; emoji: string }[]
    slotHeading: string
    defaultSlot: SlotId
    storagePrefix: string
    empty: { emoji: string; body: string }
    placeholders: { name: string; category: string; notes: string }
  }
>

export const itemEmoji = (section: Section, item: Pick<Item, 'category'>) => sections[section].emoji(item.category)

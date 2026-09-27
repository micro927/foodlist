import { Loader2 } from 'lucide-react'
import { toast } from 'sonner'
import { Button, Sheet, useSticky } from '@/components/ui'
import { useDeleteRestaurant, usePlanCounts, useRestaurantMap } from '@/lib/data'

export function DeleteRestaurantSheet({ state, onClose }: { state: { id: string } | null; onClose: () => void }) {
  const last = useSticky(state)
  const restaurant = useRestaurantMap().get(last?.id ?? '')
  const planned = usePlanCounts().get(last?.id ?? '') ?? 0
  const remove = useDeleteRestaurant()

  return (
    <Sheet open={state !== null && !!restaurant} onClose={onClose} title={`Delete ${restaurant?.name ?? ''}?`}>
      <p className="text-[15px] text-muted">
        {planned > 0
          ? `It's in ${planned} plan ${planned === 1 ? 'entry' : 'entries'} — ${planned === 1 ? 'it' : 'they'} will be removed too.`
          : 'This removes it for everyone.'}
      </p>
      <div className="mt-5 flex gap-2">
        <Button variant="outline" className="flex-1" onClick={onClose}>
          Cancel
        </Button>
        <Button
          className="flex-1 bg-red-600 shadow-red-600/30"
          disabled={remove.isPending}
          onClick={() =>
            restaurant &&
            remove.mutate(restaurant, {
              onSuccess: () => {
                toast.success(`${restaurant.name} deleted`)
                onClose()
              },
            })
          }
        >
          {remove.isPending && <Loader2 className="size-5 animate-spin" />}
          Delete
        </Button>
      </div>
    </Sheet>
  )
}

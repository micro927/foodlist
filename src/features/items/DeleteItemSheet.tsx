import { Loader2 } from 'lucide-react'
import { toast } from 'sonner'
import { Button, Sheet, useSticky } from '@/components/ui'
import { useDeleteItem, useItemMap, usePlanCounts } from '@/lib/data'
import type { Section } from '@/lib/types'

export function DeleteItemSheet({ state, onClose }: { state: { section: Section; id: string } | null; onClose: () => void }) {
  const last = useSticky(state)
  const section = last?.section ?? 'eats'
  const item = useItemMap(section).get(last?.id ?? '')
  const planned = usePlanCounts(section).get(last?.id ?? '') ?? 0
  const remove = useDeleteItem(section)

  return (
    <Sheet open={state !== null && !!item} onClose={onClose} title={`Delete ${item?.name ?? ''}?`}>
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
            item &&
            remove.mutate(item, {
              onSuccess: () => {
                toast.success(`${item.name} deleted`)
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

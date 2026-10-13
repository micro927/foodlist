import { Loader2 } from 'lucide-react'
import { toast } from 'sonner'
import { Button, Sheet, useSticky } from '@/components/ui'
import { useAreaMap, useDeleteArea } from '@/lib/data'

export function DeleteAreaSheet({ state, onClose }: { state: { id: string } | null; onClose: () => void }) {
  const last = useSticky(state)
  const area = useAreaMap().get(last?.id ?? '')
  const remove = useDeleteArea()

  return (
    <Sheet open={state !== null && !!area} onClose={onClose} title={`Delete ${area?.name ?? ''}?`}>
      <p className="text-[15px] text-muted">This removes the area for everyone. Its restaurants and places stay as they are.</p>
      <div className="mt-5 flex gap-2">
        <Button variant="outline" className="flex-1" onClick={onClose}>
          Cancel
        </Button>
        <Button
          className="flex-1 bg-red-600 shadow-red-600/30"
          disabled={remove.isPending}
          onClick={() =>
            area &&
            remove.mutate(area, {
              onSuccess: () => {
                toast.success(`${area.name} deleted`)
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

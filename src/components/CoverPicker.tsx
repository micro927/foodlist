import { useEffect, useMemo, useRef } from 'react'
import { ClipboardPaste, ImagePlus, Loader2, X } from 'lucide-react'
import { toast } from 'sonner'
import { Button } from '@/components/ui'
import { api } from '@/lib/api'
import { compressImage, imageFromClipboard, imageFromPaste } from '@/lib/image'

/**
 * Photo slot at the top of a form. `cover` is undefined = keep `existingPath`, null = remove it, Blob = new photo.
 * While `active`, pasting a screenshot anywhere sets it as the cover.
 */
export function CoverPicker({
  cover,
  existingPath,
  onChange,
  processing,
  setProcessing,
  active,
}: {
  cover: Blob | null | undefined
  existingPath: string | null | undefined
  onChange: (cover: Blob | null) => void
  processing: boolean
  setProcessing: (v: boolean) => void
  active: boolean
}) {
  const fileInput = useRef<HTMLInputElement>(null)

  const preview = useMemo(() => {
    if (cover) return URL.createObjectURL(cover)
    if (cover === undefined && existingPath) return api.coverUrl(existingPath)
    return null
  }, [cover, existingPath])
  useEffect(() => () => void (preview?.startsWith('blob:') && URL.revokeObjectURL(preview)), [preview])

  async function takeImage(file: Blob | null) {
    if (!file) return
    setProcessing(true)
    try {
      onChange(await compressImage(file))
    } catch {
      toast.error("Couldn't read that image")
    } finally {
      setProcessing(false)
    }
  }

  useEffect(() => {
    if (!active) return
    const onPaste = (e: ClipboardEvent) => {
      const image = imageFromPaste(e)
      if (image) {
        e.preventDefault()
        void takeImage(image)
      }
    }
    window.addEventListener('paste', onPaste)
    return () => window.removeEventListener('paste', onPaste)
  }, [active])

  async function pasteFromClipboard() {
    try {
      const image = await imageFromClipboard()
      if (image) await takeImage(image)
      else toast('No image on the clipboard')
    } catch {
      toast("Can't read the clipboard here — use Choose photo instead")
    }
  }

  return (
    <div className="relative overflow-hidden rounded-3xl border border-dashed border-line">
      {preview ? (
        <>
          <img src={preview} alt="" className="aspect-[4/3] w-full object-cover" />
          <div className="absolute right-3 bottom-3 flex gap-2">
            <Button size="sm" variant="outline" onClick={() => fileInput.current?.click()}>
              <ImagePlus className="size-4" /> Change
            </Button>
            <Button size="sm" variant="outline" aria-label="Remove photo" onClick={() => onChange(null)}>
              <X className="size-4" />
            </Button>
          </div>
        </>
      ) : (
        <div className="aurora flex aspect-[5/3] flex-col items-center justify-center gap-3 px-4 text-center">
          <div className="flex gap-2">
            <Button size="sm" variant="outline" onClick={() => fileInput.current?.click()}>
              <ImagePlus className="size-4" /> Choose photo
            </Button>
            <Button size="sm" variant="outline" onClick={pasteFromClipboard}>
              <ClipboardPaste className="size-4" /> Paste
            </Button>
          </div>
          <p className="text-xs text-ink/60">Tip: copy a screenshot, then tap Paste</p>
        </div>
      )}
      {processing && (
        <div className="absolute inset-0 grid place-items-center bg-white/60">
          <Loader2 className="size-6 animate-spin text-primary" />
        </div>
      )}
      <input
        ref={fileInput}
        type="file"
        accept="image/*"
        hidden
        onChange={(e) => {
          void takeImage(e.target.files?.[0] ?? null)
          e.target.value = ''
        }}
      />
    </div>
  )
}

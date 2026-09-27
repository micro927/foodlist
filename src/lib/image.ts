import type { ClipboardEvent as ReactClipboardEvent } from 'react'

/** Shrinks a photo to fit within `maxSide` px and re-encodes it as WebP (JPEG where WebP encoding is unsupported). */
export async function compressImage(file: Blob, maxSide = 1600, quality = 0.82): Promise<Blob> {
  const bitmap = await createImageBitmap(file, { imageOrientation: 'from-image' })
  const scale = Math.min(1, maxSide / Math.max(bitmap.width, bitmap.height))
  const canvas = document.createElement('canvas')
  canvas.width = Math.round(bitmap.width * scale)
  canvas.height = Math.round(bitmap.height * scale)
  canvas.getContext('2d')!.drawImage(bitmap, 0, 0, canvas.width, canvas.height)
  bitmap.close()

  const encode = (type: string) => new Promise<Blob | null>((resolve) => canvas.toBlob(resolve, type, quality))
  const webp = await encode('image/webp')
  if (webp?.type === 'image/webp') return webp
  const jpeg = await encode('image/jpeg')
  if (!jpeg) throw new Error('Could not process this image')
  return jpeg
}

/** First image in a paste event or the async clipboard, if any. */
export function imageFromPaste(e: ClipboardEvent | ReactClipboardEvent): File | null {
  for (const item of e.clipboardData?.items ?? []) {
    if (item.type.startsWith('image/')) return item.getAsFile()
  }
  return null
}

export async function imageFromClipboard(): Promise<Blob | null> {
  const items = await navigator.clipboard.read()
  for (const item of items) {
    const type = item.types.find((t) => t.startsWith('image/'))
    if (type) return item.getType(type)
  }
  return null
}

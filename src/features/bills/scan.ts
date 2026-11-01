import type { ScanResult } from '@/lib/types'
import { local } from '@/lib/utils'

const toBase64 = (blob: Blob) =>
  new Promise<string>((resolve, reject) => {
    const reader = new FileReader()
    reader.onload = () => resolve((reader.result as string).split(',')[1])
    reader.onerror = reject
    reader.readAsDataURL(blob)
  })

/** Sends receipt photos to /api/scan (Claude reads and translates them on the server). */
export async function scanReceipt(photos: Blob[]): Promise<ScanResult> {
  let res: Response
  try {
    res = await fetch('/api/scan', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', 'x-app-password': local.get('foodlist:unlocked') ?? '' },
      body: JSON.stringify({
        photos: await Promise.all(photos.map(async (p) => ({ media_type: p.type, data: await toBase64(p) }))),
      }),
    })
  } catch {
    throw new Error('No connection — add items by hand')
  }
  const body = await res.json().catch(() => null)
  if (!res.ok) throw new Error(body?.error ?? "Scan isn't available here — add items by hand")
  return body as ScanResult
}

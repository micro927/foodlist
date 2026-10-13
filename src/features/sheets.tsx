import { createContext, useCallback, useContext, useState, type ReactNode } from 'react'
import type { Section } from '@/lib/types'
import { ItemDetailSheet } from './items/ItemDetailSheet'
import { ItemFormSheet } from './items/ItemFormSheet'
import { DeleteItemSheet } from './items/DeleteItemSheet'
import { EntrySheet, type EntryDraft } from './plan/EntrySheet'
import { AreaDetailSheet } from './areas/AreaDetailSheet'
import { AreaFormSheet } from './areas/AreaFormSheet'
import { DeleteAreaSheet } from './areas/DeleteAreaSheet'

/** Every bottom sheet in the app. Opening one closes whichever was open. */
export type SheetRequest =
  | { kind: 'detail'; section: Section; id: string }
  | { kind: 'form'; section: Section; id?: string }
  | { kind: 'delete'; section: Section; id: string }
  | { kind: 'entry'; section: Section; draft: EntryDraft }
  | { kind: 'area'; id: string }
  | { kind: 'areaForm'; id?: string }
  | { kind: 'areaDelete'; id: string }

type SheetState = SheetRequest & { nonce: number }

const OpenSheetContext = createContext<(request: SheetRequest) => void>(() => {})
export const useOpenSheet = () => useContext(OpenSheetContext)

export function SheetsProvider({ children }: { children: ReactNode }) {
  const [sheet, setSheet] = useState<SheetState | null>(null)
  const open = useCallback((request: SheetRequest) => setSheet({ ...request, nonce: Date.now() }), [])
  const close = useCallback(() => setSheet(null), [])
  const of = <K extends SheetState['kind']>(kind: K) => (sheet?.kind === kind ? (sheet as Extract<SheetState, { kind: K }>) : null)

  return (
    <OpenSheetContext.Provider value={open}>
      {children}
      <ItemDetailSheet state={of('detail')} onClose={close} />
      <ItemFormSheet state={of('form')} onClose={close} />
      <DeleteItemSheet state={of('delete')} onClose={close} />
      <EntrySheet state={of('entry')} onClose={close} />
      <AreaDetailSheet state={of('area')} onClose={close} />
      <AreaFormSheet state={of('areaForm')} onClose={close} />
      <DeleteAreaSheet state={of('areaDelete')} onClose={close} />
    </OpenSheetContext.Provider>
  )
}

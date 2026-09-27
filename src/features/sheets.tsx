import { createContext, useCallback, useContext, useState, type ReactNode } from 'react'
import { RestaurantDetailSheet } from './eats/RestaurantDetailSheet'
import { RestaurantFormSheet } from './eats/RestaurantFormSheet'
import { DeleteRestaurantSheet } from './eats/DeleteRestaurantSheet'
import { EntrySheet, type EntryDraft } from './plan/EntrySheet'

/** Every bottom sheet in the app. Opening one closes whichever was open. */
export type SheetRequest =
  | { kind: 'detail'; id: string }
  | { kind: 'form'; id?: string }
  | { kind: 'delete'; id: string }
  | { kind: 'entry'; draft: EntryDraft }

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
      <RestaurantDetailSheet state={of('detail')} onClose={close} />
      <RestaurantFormSheet state={of('form')} onClose={close} />
      <DeleteRestaurantSheet state={of('delete')} onClose={close} />
      <EntrySheet state={of('entry')} onClose={close} />
    </OpenSheetContext.Provider>
  )
}

import { useEffect, useRef } from 'react'
import { toast } from 'sonner'

// Browser/phone back never leaves the app by accident. One extra "trap" history entry sits on
// top of the page, so a back press lands on our own entry (popstate) instead of the previous site.
// We close the topmost thing that registered with useBackHandler (photo, sheet, Plan tab) and
// re-arm the trap. With nothing left to close, the first press only warns; the next one leaves.

const TRAP = 'foodlist:back-trap'
const handlers: { current: () => void }[] = []
let armed = false
let url = location.href

const onTrap = () => history.state?.[TRAP] === true

function arm() {
  if (armed) return
  history.pushState({ [TRAP]: true }, '', url)
  armed = true
}

/** Changes the address bar without adding a history entry (use instead of history.replaceState). */
export function replaceUrl(next: string) {
  url = next
  history.replaceState(history.state, '', next)
}

/** While `active`, a back press calls `onBack` instead of navigating. Latest registration wins. */
export function useBackHandler(active: boolean, onBack: () => void) {
  const ref = useRef(onBack)
  useEffect(() => {
    ref.current = onBack
  })
  useEffect(() => {
    if (!active) return
    handlers.push(ref)
    return () => {
      handlers.splice(handlers.lastIndexOf(ref), 1)
    }
  }, [active])
}

/** Mount once at the app root. */
export function useBackTrap() {
  useEffect(() => {
    armed = onTrap()
    url = location.href

    const onPop = () => {
      armed = onTrap()
      if (armed) return // "forward" back onto the trap
      history.replaceState(null, '', url)
      const top = handlers.at(-1)
      if (top) {
        top.current()
        arm()
      } else {
        // Stay disarmed: the next back press exits. Touching the page re-arms.
        toast('Press back again to exit', { duration: 2000 })
      }
    }

    // Browsers ignore history entries pushed without a user gesture, so arm on a real tap/key.
    window.addEventListener('popstate', onPop)
    window.addEventListener('pointerup', arm, true)
    window.addEventListener('keydown', arm, true)
    return () => {
      window.removeEventListener('popstate', onPop)
      window.removeEventListener('pointerup', arm, true)
      window.removeEventListener('keydown', arm, true)
    }
  }, [])
}

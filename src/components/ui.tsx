import { useRef, type ButtonHTMLAttributes, type ReactNode } from 'react'
import { createPortal } from 'react-dom'
import { AnimatePresence, motion } from 'motion/react'
import { X } from 'lucide-react'
import { Drawer } from 'vaul'
import { useBackHandler } from '@/lib/back'
import { cn } from '@/lib/utils'

type ButtonProps = ButtonHTMLAttributes<HTMLButtonElement> & {
  variant?: 'primary' | 'soft' | 'outline' | 'ghost' | 'danger'
  size?: 'md' | 'sm' | 'icon'
}

export function Button({ variant = 'primary', size = 'md', className, type = 'button', ...props }: ButtonProps) {
  return (
    <button
      type={type}
      className={cn(
        'inline-flex shrink-0 items-center justify-center gap-2 rounded-full font-semibold transition active:scale-[0.97] disabled:pointer-events-none disabled:opacity-50',
        size === 'md' && 'h-12 px-5 text-[15px]',
        size === 'sm' && 'h-9 px-3.5 text-sm',
        size === 'icon' && 'size-10',
        variant === 'primary' && 'bg-primary text-white shadow-sm shadow-primary/30',
        variant === 'soft' && 'bg-primary-soft text-primary',
        variant === 'outline' && 'border border-line bg-surface text-ink',
        variant === 'ghost' && 'text-muted hover:bg-black/5',
        variant === 'danger' && 'bg-red-50 text-red-600',
        className,
      )}
      {...props}
    />
  )
}

export const inputClass =
  'h-12 w-full rounded-2xl border border-line bg-surface px-4 text-base outline-none transition placeholder:text-muted/60 focus:border-primary focus:ring-4 focus:ring-primary/10'

export function Field({ label, hint, children }: { label: string; hint?: string; children: ReactNode }) {
  return (
    <label className="block">
      <span className="mb-1.5 flex items-baseline justify-between text-sm font-semibold">
        {label}
        {hint && <span className="text-xs font-normal text-muted">{hint}</span>}
      </span>
      {children}
    </label>
  )
}

export function Chip({ active, className, ...props }: ButtonHTMLAttributes<HTMLButtonElement> & { active?: boolean }) {
  return (
    <button
      type="button"
      className={cn(
        'inline-flex h-9 shrink-0 items-center gap-1.5 rounded-full border px-3.5 text-sm font-medium whitespace-nowrap transition active:scale-[0.97]',
        active ? 'border-primary bg-primary text-white' : 'border-line bg-surface text-ink',
        className,
      )}
      {...props}
    />
  )
}

/** Keeps showing the last non-null value, so sheet content doesn't vanish during the close animation. */
export function useSticky<T>(value: T | null): T | null {
  const ref = useRef(value)
  if (value !== null) ref.current = value
  return ref.current
}

export function Sheet({
  open,
  onClose,
  title,
  children,
  footer,
}: {
  open: boolean
  onClose: () => void
  title: ReactNode
  children: ReactNode
  footer?: ReactNode
}) {
  useBackHandler(open, onClose)
  return (
    <Drawer.Root open={open} onOpenChange={(o) => !o && onClose()}>
      <Drawer.Portal>
        <Drawer.Overlay className="fixed inset-0 z-40 bg-black/35" />
        <Drawer.Content
          // Overlays like the photo viewer live outside the sheet; tapping them must not dismiss it.
          onPointerDownOutside={(e) => {
            if ((e.target as Element | null)?.closest?.('[data-keep-sheet]')) e.preventDefault()
          }}
          className="fixed inset-x-0 bottom-0 z-50 mx-auto flex max-h-[92dvh] max-w-lg flex-col rounded-t-[28px] bg-surface outline-none">
          <div className="mx-auto mt-2.5 h-1.5 w-10 shrink-0 rounded-full bg-line" />
          <Drawer.Title className="px-5 pt-3 pb-3 text-lg font-bold">{title}</Drawer.Title>
          <Drawer.Description className="sr-only">{typeof title === 'string' ? title : 'Details'}</Drawer.Description>
          <div className="overflow-y-auto overscroll-contain px-5 pb-5">{children}</div>
          {footer && <div className="border-t border-line px-5 pt-3 pb-[max(12px,env(safe-area-inset-bottom))]">{footer}</div>}
        </Drawer.Content>
      </Drawer.Portal>
    </Drawer.Root>
  )
}

/** A full-screen page for long forms. Unlike a Sheet it can't be swiped or tapped away: only its close button and phone back call `onClose`. */
export function Screen({ open, onClose, title, children }: { open: boolean; onClose: () => void; title: string; children: ReactNode }) {
  useBackHandler(open, onClose)
  return createPortal(
    <AnimatePresence>
      {open && (
        <motion.div
          role="dialog"
          aria-modal="true"
          aria-label={title}
          className="fixed inset-0 z-50 flex flex-col bg-surface"
          initial={{ y: '100%' }}
          animate={{ y: 0 }}
          exit={{ y: '100%' }}
          transition={{ type: 'tween', duration: 0.25, ease: 'easeOut' }}
        >
          <div className="mx-auto flex w-full max-w-lg shrink-0 items-center gap-1 px-2 pt-[max(8px,env(safe-area-inset-top))] pb-2">
            <button type="button" aria-label="Close" onClick={onClose} className="grid size-11 place-items-center rounded-full text-muted active:bg-black/5">
              <X className="size-5" />
            </button>
            <h2 className="text-lg font-bold">{title}</h2>
          </div>
          <div className="mx-auto w-full max-w-lg flex-1 overflow-y-auto overscroll-contain px-5 pb-5">{children}</div>
        </motion.div>
      )}
    </AnimatePresence>,
    document.body,
  )
}

/** An in-app "are you sure?" above everything else (never the browser's confirm). Back or tapping outside cancels. */
export function ConfirmDialog({
  open,
  title,
  message,
  confirmLabel,
  cancelLabel = 'Cancel',
  onConfirm,
  onCancel,
}: {
  open: boolean
  title: string
  message?: ReactNode
  confirmLabel: string
  cancelLabel?: string
  onConfirm: () => void
  onCancel: () => void
}) {
  useBackHandler(open, onCancel)
  return createPortal(
    <AnimatePresence>
      {open && (
        <motion.div
          className="fixed inset-0 z-60 flex items-center justify-center bg-black/40 p-6"
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          exit={{ opacity: 0 }}
          onClick={onCancel}
        >
          <motion.div
            role="alertdialog"
            aria-modal="true"
            aria-label={title}
            className="w-full max-w-sm rounded-[28px] bg-surface p-5 shadow-xl"
            initial={{ scale: 0.94, y: 8 }}
            animate={{ scale: 1, y: 0 }}
            exit={{ scale: 0.94, y: 8 }}
            transition={{ type: 'tween', duration: 0.18, ease: 'easeOut' }}
            onClick={(e) => e.stopPropagation()}
          >
            <h2 className="text-lg font-bold">{title}</h2>
            {message && <p className="mt-1 text-[15px] text-muted">{message}</p>}
            <div className="mt-5 flex gap-2">
              <Button variant="outline" className="flex-1" onClick={onCancel}>
                {cancelLabel}
              </Button>
              <Button className="flex-1 bg-red-600 shadow-red-600/30" onClick={onConfirm}>
                {confirmLabel}
              </Button>
            </div>
          </motion.div>
        </motion.div>
      )}
    </AnimatePresence>,
    document.body,
  )
}

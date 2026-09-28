import { AnimatePresence, motion } from 'motion/react'
import { X } from 'lucide-react'
import { createPortal } from 'react-dom'
import { useBackHandler } from '@/lib/back'

export function PhotoViewer({ src, alt, onClose }: { src: string | null; alt: string; onClose: () => void }) {
  useBackHandler(src !== null, onClose)
  return createPortal(
    <AnimatePresence>
      {src && (
        <motion.div
          data-keep-sheet
          className="pointer-events-auto fixed inset-0 z-60 flex items-center justify-center bg-black/95"
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          exit={{ opacity: 0 }}
          onClick={onClose}
        >
          <motion.img
            src={src}
            alt={alt}
            className="max-h-full max-w-full object-contain"
            initial={{ scale: 0.92 }}
            animate={{ scale: 1 }}
            exit={{ scale: 0.92 }}
          />
          <button
            type="button"
            aria-label="Close photo"
            className="absolute top-[max(16px,env(safe-area-inset-top))] right-4 grid size-10 place-items-center rounded-full bg-white/15 text-white"
          >
            <X className="size-5" />
          </button>
        </motion.div>
      )}
    </AnimatePresence>,
    document.body,
  )
}

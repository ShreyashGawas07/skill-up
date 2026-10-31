import { useEffect, useRef } from 'react'
import type { ReactNode } from 'react'
import { motion } from 'framer-motion'

interface Props {
  title: string
  children?: ReactNode
  /** Visual shown above the title. */
  art?: ReactNode
  confirmLabel: string
  danger?: boolean
  busy?: boolean
  onConfirm(): void
  onCancel(): void
  reducedMotion?: boolean
}

/** Bottom-sheet confirmation. Tapping the backdrop or pressing Escape cancels. */
export function ConfirmSheet({ title, children, art, confirmLabel, danger, busy, onConfirm, onCancel, reducedMotion }: Props) {
  const cancelRef = useRef<HTMLButtonElement>(null)
  useEffect(() => {
    cancelRef.current?.focus()
    const onKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape') onCancel()
    }
    window.addEventListener('keydown', onKey)
    return () => window.removeEventListener('keydown', onKey)
  }, [onCancel])

  return (
    <motion.div
      className="fixed inset-0 z-40 flex items-end justify-center bg-black/60"
      initial={{ opacity: 0 }}
      animate={{ opacity: 1 }}
      exit={{ opacity: 0 }}
      onClick={onCancel}
    >
      <motion.div
        role="dialog"
        aria-modal="true"
        aria-label={title}
        className="mb-4 w-[calc(100%-32px)] max-w-sm rounded-3xl border border-white/10 bg-[#15151f] p-6 text-center"
        initial={reducedMotion ? { opacity: 0 } : { y: 80, opacity: 0 }}
        animate={{ y: 0, opacity: 1 }}
        exit={reducedMotion ? { opacity: 0 } : { y: 80, opacity: 0 }}
        transition={{ type: 'spring', stiffness: 260, damping: 24 }}
        onClick={(e) => e.stopPropagation()}
      >
        {art && <div className="mb-3 flex justify-center">{art}</div>}
        <p className="font-display text-lg font-semibold">{title}</p>
        {children && <div className="mt-1 text-sm text-white/60">{children}</div>}
        <div className="mt-5 flex gap-3">
          <button
            ref={cancelRef}
            type="button"
            onClick={onCancel}
            className="min-h-[48px] flex-1 rounded-2xl bg-white/10 font-semibold active:scale-95"
          >
            Cancel
          </button>
          <button
            type="button"
            disabled={busy}
            onClick={onConfirm}
            className={`min-h-[48px] flex-1 rounded-2xl font-semibold active:scale-95 disabled:opacity-50 ${
              danger ? 'bg-gradient-to-br from-[#ff6b6b] to-[#e03131]' : 'bg-gradient-to-br from-[#9775fa] to-[#4dabf7]'
            }`}
          >
            {confirmLabel}
          </button>
        </div>
      </motion.div>
    </motion.div>
  )
}

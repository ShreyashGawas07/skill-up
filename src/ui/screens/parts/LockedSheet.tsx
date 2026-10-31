import { motion } from 'framer-motion'
import { EmptyState } from '@/ui/art/EmptyState'

/** Bottom sheet shown when "+" is tapped with 2 active habits. Tap anywhere to close. */
export function LockedSheet({ onClose, reducedMotion }: { onClose(): void; reducedMotion?: boolean }) {
  return (
    <motion.div
      className="fixed inset-0 z-40 flex items-end justify-center bg-black/60"
      initial={{ opacity: 0 }}
      animate={{ opacity: 1 }}
      onClick={onClose}
    >
      <motion.div
        role="dialog"
        aria-modal="true"
        aria-label="Habit slots full"
        className="mb-4 w-[calc(100%-32px)] max-w-sm rounded-3xl border border-white/10 bg-[#15151f] p-6 text-center"
        initial={reducedMotion ? { opacity: 0 } : { y: 80, opacity: 0 }}
        animate={{ y: 0, opacity: 1 }}
        transition={{ type: 'spring', stiffness: 260, damping: 24 }}
      >
        <EmptyState variant="locked" size={160} reducedMotion={reducedMotion} className="mx-auto" />
        <p className="mt-3 font-display text-lg font-semibold">2 habits max — master or delete one to unlock</p>
      </motion.div>
    </motion.div>
  )
}

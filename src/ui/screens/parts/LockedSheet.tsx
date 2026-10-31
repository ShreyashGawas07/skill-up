import { EmptyState } from '@/ui/art/EmptyState'
import { Sheet } from '@/ui/kit'

/** Bottom sheet shown when "+" is tapped with 2 active habits. Tap anywhere to close. */
export function LockedSheet({ onClose, reducedMotion }: { onClose(): void; reducedMotion?: boolean }) {
  return (
    <Sheet label="Habit slots full" onClose={onClose} reducedMotion={reducedMotion}>
      <div onClick={onClose}>
        <EmptyState variant="locked" size={150} reducedMotion={reducedMotion} className="mx-auto" />
        <p className="mt-3 font-display text-lg font-bold">2 habits max</p>
        <p className="mt-1 text-sm text-muted">Master or delete one to unlock a slot.</p>
      </div>
    </Sheet>
  )
}

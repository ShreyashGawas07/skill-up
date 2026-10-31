import { useState } from 'react'
import { AnimatePresence } from 'framer-motion'
import type { Habit } from '@/domain/types'
import { useApp } from '@/store/useApp'
import { Emblem } from '@/ui/art/Emblem'
import { ConfirmSheet } from './ConfirmSheet'

interface Props {
  /** The habit being deleted; undefined = closed. */
  habit?: Habit
  /** Emblem tier shown on the sheets. */
  tier: number
  /** Eternal habits (trophies) need a second "can't be undone" confirmation. */
  twoStep: boolean
  onCancel(): void
  onDeleted(): void
  reducedMotion?: boolean
}

/** Delete confirmation: one sheet, or two for trophies. Failures stay in the sheet as an alert. */
export function DeleteSheets({ habit, tier, twoStep, onCancel, onDeleted, reducedMotion }: Props) {
  const deleteHabit = useApp((s) => s.deleteHabit)
  const [step, setStep] = useState<1 | 2>(1)
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState<string>()

  const close = () => {
    setStep(1)
    setError(undefined)
    onCancel()
  }

  const run = async (h: Habit) => {
    setBusy(true)
    setError(undefined)
    try {
      await deleteHabit(h.id)
      setStep(1)
      onDeleted()
    } catch (e) {
      setError(`Delete failed: ${(e as Error)?.message ?? String(e)}`)
    } finally {
      setBusy(false)
    }
  }

  const common = { danger: true, busy, error, onCancel: close, reducedMotion }

  return (
    <AnimatePresence>
      {habit && step === 1 && (
        <ConfirmSheet
          key="d1"
          {...common}
          title={`Delete ${habit.name}?`}
          art={<Emblem tier={tier} size={72} cracked={!twoStep} animate={false} />}
          confirmLabel="Delete"
          onConfirm={() => (twoStep ? setStep(2) : void run(habit))}
        >
          {twoStep ? 'This trophy and its history leave the Hall.' : 'All hours, sessions and badges are erased.'}
        </ConfirmSheet>
      )}
      {habit && step === 2 && (
        <ConfirmSheet
          key="d2"
          {...common}
          title="Are you sure?"
          art={<Emblem tier={tier} size={72} cracked animate={false} />}
          confirmLabel="Delete forever"
          onConfirm={() => void run(habit)}
        >
          Deleting {habit.name} can't be undone.
        </ConfirmSheet>
      )}
    </AnimatePresence>
  )
}

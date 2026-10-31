import { useCallback, useState } from 'react'
import { AnimatePresence, motion } from 'framer-motion'
import { format, parse } from 'date-fns'
import type { Habit, HabitState } from '@/domain/types'
import { useApp } from '@/store/useApp'
import { Emblem } from '@/ui/art/Emblem'
import { iconGlyph } from '@/ui/icons'
import type { Navigate } from '@/ui/route'
import { ConfirmSheet } from './parts/ConfirmSheet'
import { fmtInt, motionPref } from './parts/format'
import { Glyph } from './parts/Glyphs'
import { ScreenHeader } from './parts/ScreenHeader'

/** Day the habit went Eternal, from its ETERNAL event, as "1 Feb 2026". */
function reachedOn(st: HabitState): string | undefined {
  const day = st.events.find((e) => e.type === 'ETERNAL')?.day
  return day ? format(parse(day, 'yyyy-MM-dd', new Date()), 'd MMM yyyy') : undefined
}

function Shelf() {
  return <div aria-hidden className="h-3 rounded-full bg-gradient-to-b from-[#6b4a2b] to-[#2e1d10] shadow-[0_8px_16px_rgba(0,0,0,0.5)]" />
}

function Trophy({ habit, st, onOpen, onDelete, rm }: { habit: Habit; st: HabitState; onOpen(): void; onDelete(): void; rm?: boolean }) {
  const date = reachedOn(st)
  return (
    <li className="relative flex flex-col items-center">
      <button type="button" aria-label={`Open ${habit.name}`} onClick={onOpen} className="flex flex-col items-center gap-1 pb-2 active:scale-95">
        <Emblem tier={10} size={104} reducedMotion={rm} />
      </button>
      <div className="flex items-center gap-1 font-display font-bold">
        <span aria-hidden>{iconGlyph(habit.icon)}</span>
        <span className="truncate">{habit.name}</span>
      </div>
      <span className="font-display text-sm font-semibold text-[#ffe27a]">{fmtInt(st.totalMinutes / 60)}h</span>
      {date && <span className="text-xs text-white/40">{date}</span>}
      <button
        type="button"
        aria-label={`Delete ${habit.name}`}
        onClick={onDelete}
        className="absolute right-0 top-0 grid h-11 w-11 place-items-center rounded-full text-white/30 active:scale-90"
      >
        <Glyph name="trash" size={16} />
      </button>
    </li>
  )
}

export function HallOfFame({ onNavigate }: { onNavigate: Navigate }) {
  const habits = useApp((s) => s.habits)
  const states = useApp((s) => s.states)
  const deleteHabit = useApp((s) => s.deleteHabit)
  const rm = motionPref(useApp((s) => s.settings.reduceMotion))
  const eternal = habits.filter((h) => states[h.id]?.eternal)

  // Two-step delete: 1 = first confirm, 2 = "can't be undone".
  const [del, setDel] = useState<{ habit: Habit; step: 1 | 2 } | null>(null)
  const [busy, setBusy] = useState(false)
  const cancel = useCallback(() => setDel(null), [])

  const finalDelete = async (h: Habit) => {
    setBusy(true)
    try {
      await deleteHabit(h.id)
    } finally {
      setBusy(false)
      setDel(null)
    }
  }

  return (
    <div className="mx-auto flex min-h-screen w-full max-w-md flex-col px-4 pb-10 pt-4">
      <ScreenHeader title="Hall of Fame" onBack={() => onNavigate('home')} />

      {eternal.length === 0 ? (
        <motion.div className="mt-16 flex flex-col items-center gap-4" initial={{ opacity: 0 }} animate={{ opacity: 1 }}>
          <div className="opacity-60">
            <Emblem tier={10} size={120} locked animate={false} />
          </div>
          <div className="w-56">
            <Shelf />
          </div>
          <p className="text-center text-sm text-white/40">Reach Eternal to place a trophy here</p>
        </motion.div>
      ) : (
        <div className="relative mt-2 rounded-[28px] bg-gradient-to-b from-[#ffe27a]/[0.06] to-transparent p-4">
          <ul aria-label="Trophies" className="grid grid-cols-2 gap-x-4 gap-y-8">
            {eternal.map((h) => (
              <Trophy
                key={h.id}
                habit={h}
                st={states[h.id]}
                rm={rm}
                onOpen={() => onNavigate(`detail:${h.id}`)}
                onDelete={() => setDel({ habit: h, step: 1 })}
              />
            ))}
          </ul>
          <div className="mt-3">
            <Shelf />
          </div>
        </div>
      )}

      <AnimatePresence>
        {del?.step === 1 && (
          <ConfirmSheet
            key="d1"
            title={`Delete ${del.habit.name}?`}
            art={<Emblem tier={10} size={72} animate={false} />}
            confirmLabel="Delete"
            danger
            onConfirm={() => setDel({ habit: del.habit, step: 2 })}
            onCancel={cancel}
            reducedMotion={rm}
          >
            This trophy and its history leave the Hall.
          </ConfirmSheet>
        )}
        {del?.step === 2 && (
          <ConfirmSheet
            key="d2"
            title="Are you sure?"
            art={<Emblem tier={10} size={72} cracked animate={false} />}
            confirmLabel="Delete forever"
            danger
            busy={busy}
            onConfirm={() => void finalDelete(del.habit)}
            onCancel={cancel}
            reducedMotion={rm}
          >
            Deleting {del.habit.name} can't be undone.
          </ConfirmSheet>
        )}
      </AnimatePresence>
    </div>
  )
}

import { useCallback, useState } from 'react'
import { motion } from 'framer-motion'
import { format, parse } from 'date-fns'
import type { Habit, HabitState } from '@/domain/types'
import { useApp } from '@/store/useApp'
import { Emblem } from '@/ui/art/Emblem'
import { iconGlyph } from '@/ui/icons'
import type { Navigate } from '@/ui/route'
import { DeleteSheets } from './parts/DeleteSheets'
import { fmtInt, motionPref } from './parts/format'
import { Glyph } from './parts/Glyphs'
import { BigStat, BottomNav, TopBar } from '@/ui/kit'
import { MAX_HABITS } from './Home'

/** Day the habit went Eternal, from its ETERNAL event, as "1 Feb 2026". */
function reachedOn(st: HabitState): string | undefined {
  const day = st.events.find((e) => e.type === 'ETERNAL')?.day
  return day ? format(parse(day, 'yyyy-MM-dd', new Date()), 'd MMM yyyy') : undefined
}

function Shelf() {
  return <div aria-hidden className="h-3 rounded-full border-[1.5px] border-line bg-[#e0b07a]" />
}

function Trophy({ habit, st, onOpen, onDelete, rm }: { habit: Habit; st: HabitState; onOpen(): void; onDelete(): void; rm?: boolean }) {
  const date = reachedOn(st)
  return (
    <li className="card relative flex flex-col items-center px-2 pb-3 pt-4">
      <button type="button" aria-label={`Open ${habit.name}`} onClick={onOpen} className="flex flex-col items-center gap-1 pb-2 active:scale-95">
        <Emblem tier={10} size={104} reducedMotion={rm} />
      </button>
      <div className="flex items-center gap-1 font-display font-bold">
        <span aria-hidden>{iconGlyph(habit.icon)}</span>
        <span className="truncate">{habit.name}</span>
      </div>
      <span className="mt-1 rounded-full border-[1.5px] border-line px-2.5 py-0.5 font-display text-sm font-bold" style={{ background: habit.color }}>
        {fmtInt(st.totalMinutes / 60)}h
      </span>
      {date && <span className="mt-1 text-xs text-muted">{date}</span>}
      <button
        type="button"
        aria-label={`Delete ${habit.name}`}
        onClick={onDelete}
        className="absolute right-0 top-0 grid h-11 w-11 place-items-center rounded-full text-muted active:scale-90"
      >
        <Glyph name="trash" size={16} />
      </button>
    </li>
  )
}

export function HallOfFame({ onNavigate }: { onNavigate: Navigate }) {
  const habits = useApp((s) => s.habits)
  const states = useApp((s) => s.states)
  const rm = motionPref(useApp((s) => s.settings.reduceMotion))
  const eternal = habits.filter((h) => states[h.id]?.eternal)
  const full = habits.filter((h) => h.archivedAt === undefined && states[h.id] && !states[h.id].eternal).length >= MAX_HABITS

  const [del, setDel] = useState<Habit>()
  const cancel = useCallback(() => setDel(undefined), [])

  return (
    <div className="mx-auto flex min-h-screen w-full max-w-md flex-col pb-28">
      <div className="px-4 pb-10 pt-[max(8px,env(safe-area-inset-top))] text-on-tint" style={{ background: '#f8d77c' }}>
        <TopBar title="Hall of Fame" onBack={() => onNavigate('home')} />
        <div className="mt-3 px-1">
          <BigStat value={eternal.length} caption={['Eternal', eternal.length === 1 ? 'habit' : 'habits']} />
          <p className="mt-2 text-sm opacity-75">Habits taken all the way to their mastery goal.</p>
        </div>
      </div>

      <main className="-mt-6 flex flex-1 flex-col rounded-t-[28px] border-t-[1.5px] border-line bg-bg px-4 pt-5">
        {eternal.length === 0 ? (
          <motion.div className="card mt-2 flex flex-col items-center gap-4 px-6 py-10" initial={{ opacity: 0 }} animate={{ opacity: 1 }}>
            <div className="opacity-70">
              <Emblem tier={10} size={120} locked animate={false} />
            </div>
            <div className="w-56">
              <Shelf />
            </div>
            <p className="font-display text-lg font-bold">Your trophy shelf</p>
            <p className="-mt-3 text-center text-sm text-muted">Reach Eternal to place a trophy here</p>
          </motion.div>
        ) : (
          <>
            <ul aria-label="Trophies" className="grid grid-cols-2 gap-3">
              {eternal.map((h) => (
                <Trophy
                  key={h.id}
                  habit={h}
                  st={states[h.id]}
                  rm={rm}
                  onOpen={() => onNavigate(`detail:${h.id}`)}
                  onDelete={() => setDel(h)}
                />
              ))}
            </ul>
            <div className="mt-3">
              <Shelf />
            </div>
          </>
        )}
      </main>

      <BottomNav current="hall" onTab={(t) => t !== 'hall' && onNavigate(t)} onAdd={() => onNavigate('add')} addLocked={full} reducedMotion={rm} />
      <DeleteSheets habit={del} tier={10} twoStep onCancel={cancel} onDeleted={cancel} reducedMotion={rm} />
    </div>
  )
}

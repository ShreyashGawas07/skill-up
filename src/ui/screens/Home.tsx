import { useState } from 'react'
import { AnimatePresence, motion } from 'framer-motion'
import { useApp } from '@/store/useApp'
import { haptic } from '@/feedback/haptics'
import { EmptyState } from '@/ui/art/EmptyState'
import type { Navigate } from '@/ui/route'
import { HabitCard } from './HabitCard'
import { Glyph } from './parts/Glyphs'
import { LockedSheet } from './parts/LockedSheet'
import { motionPref } from './parts/format'

export const MAX_HABITS = 2

export function Home({ onNavigate }: { onNavigate: Navigate }) {
  const habits = useApp((s) => s.habits)
  const states = useApp((s) => s.states)
  const running = useApp((s) => s.running)
  const now = useApp((s) => s.now)
  const reduceSetting = useApp((s) => s.settings.reduceMotion)
  const start = useApp((s) => s.start)
  const stop = useApp((s) => s.stop)
  const [locked, setLocked] = useState(false)
  const rm = motionPref(reduceSetting)

  // Eternal/archived habits live in the Hall of Fame, not on Home.
  const active = habits.filter((h) => h.archivedAt === undefined && states[h.id] && !states[h.id].eternal)
  const full = active.length >= MAX_HABITS
  const free = Math.max(0, MAX_HABITS - active.length)

  const onPlus = () => {
    if (full) {
      haptic.warn()
      setLocked(true)
    } else onNavigate('add')
  }

  const iconBtn = 'grid h-11 w-11 place-items-center rounded-full bg-white/5 text-white/80 active:scale-90'

  return (
    <div className="mx-auto flex min-h-screen w-full max-w-md flex-col px-4 pb-6 pt-4">
      <header className="mb-4 flex items-center justify-between">
        <h1 className="font-display text-2xl font-bold tracking-tight">
          Skill<span className="bg-gradient-to-r from-[#9775fa] to-[#4dabf7] bg-clip-text text-transparent">Up</span>
        </h1>
        <div className="flex gap-2">
          <button type="button" aria-label="Hall of Fame" className={iconBtn} onClick={() => onNavigate('hall')}>
            <Glyph name="trophy" />
          </button>
          <button type="button" aria-label="Settings" className={iconBtn} onClick={() => onNavigate('settings')}>
            <Glyph name="gear" />
          </button>
          <button
            type="button"
            aria-label={full ? 'Add habit (locked)' : 'Add habit'}
            className={`${iconBtn} ${full ? 'text-white/40' : 'bg-gradient-to-br from-[#9775fa] to-[#4dabf7] text-white'}`}
            onClick={onPlus}
          >
            <Glyph name={full ? 'lock' : 'plus'} />
          </button>
        </div>
      </header>

      <main className="flex flex-1 flex-col gap-4">
        {active.map((h) => (
          <HabitCard
            key={h.id}
            habit={h}
            state={states[h.id]}
            running={running}
            now={now}
            reducedMotion={rm}
            onStart={() => void start(h.id)}
            onStop={() => void stop()}
            onOpen={() => onNavigate(`detail:${h.id}`)}
            onEdit={() => onNavigate(`edit:${h.id}`)}
          />
        ))}
        {Array.from({ length: free }, (_, i) => (
          <motion.button
            key={`slot${i}`}
            type="button"
            onClick={() => onNavigate('add')}
            className="flex min-h-[200px] flex-1 items-center justify-center rounded-[28px] border-2 border-dashed border-white/10 bg-white/[0.02] active:scale-[0.98]"
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
          >
            <EmptyState variant="add" size={190} reducedMotion={rm} />
          </motion.button>
        ))}
      </main>

      <AnimatePresence>{locked && <LockedSheet onClose={() => setLocked(false)} reducedMotion={rm} />}</AnimatePresence>
    </div>
  )
}

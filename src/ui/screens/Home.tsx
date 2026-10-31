import { motion } from 'framer-motion'
import { format, parse } from 'date-fns'
import { useApp } from '@/store/useApp'
import { dayKey } from '@/domain/days'
import { EmptyState } from '@/ui/art/EmptyState'
import { BigStat, BottomNav, TopBar, WeekStrip } from '@/ui/kit'
import { PermissionBanner } from '@/ui/overlay/PermissionBanner'
import type { Navigate } from '@/ui/route'
import { HABIT_COLORS } from '@/ui/theme'
import { HabitCard } from './HabitCard'
import { fmtDur, motionPref } from './parts/format'
import { weekDays } from './weekStrip'

export const MAX_HABITS = 2

export function Home({ onNavigate }: { onNavigate: Navigate }) {
  const habits = useApp((s) => s.habits)
  const states = useApp((s) => s.states)
  const running = useApp((s) => s.running)
  const now = useApp((s) => s.now)
  const reduceSetting = useApp((s) => s.settings.reduceMotion)
  const ready = useApp((s) => s.ready)
  const start = useApp((s) => s.start)
  const stop = useApp((s) => s.stop)
  const rm = motionPref(reduceSetting)

  // Eternal/archived habits live in the Hall of Fame, not on Home.
  const active = habits
    .filter((h) => h.archivedAt === undefined && states[h.id] && !states[h.id].eternal)
    .sort((a, b) => a.createdAt - b.createdAt)
  const full = active.length >= MAX_HABITS
  const free = Math.max(0, MAX_HABITS - active.length)

  const today = active[0] ? states[active[0].id].today : dayKey(now)
  const tint = active[0]?.color ?? HABIT_COLORS[3]
  const withGoal = active.filter((h) => states[h.id].commitment > 0)
  const doneCount = withGoal.filter((h) => states[h.id].todayMinutes >= states[h.id].commitment).length
  const minutesToday = active.reduce((m, h) => m + states[h.id].todayMinutes, 0)

  return (
    <div className="mx-auto flex min-h-screen w-full max-w-md flex-col pb-28">
      <div className="px-4 pb-10 pt-[max(8px,env(safe-area-inset-top))] text-on-tint" style={{ background: tint }}>
        <TopBar title="SkillUp" right={<span className="font-display text-xs font-bold uppercase tracking-wider">{format(parse(today, 'yyyy-MM-dd', new Date()), 'd MMM')}</span>} />
        <WeekStrip days={weekDays(today, active, states)} selected={today} />
      </div>

      <main className="-mt-6 flex flex-1 flex-col gap-4 rounded-t-[28px] border-t-[1.5px] border-line bg-bg px-4 pt-5">
        <div className="flex items-center justify-between gap-3">
          {withGoal.length > 0 ? (
            <BigStat value={`${doneCount}/${withGoal.length}`} caption={['Goals', 'done today']} />
          ) : (
            <BigStat value="SkillUp" caption={['Build', 'mastery']} />
          )}
          <span className="shrink-0 rounded-full border-[1.5px] border-line px-3 py-1.5 font-display text-xs font-bold uppercase tracking-wider tabular-nums">
            {`${fmtDur(minutesToday)} today`}
          </span>
        </div>

        <PermissionBanner />

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
        {ready && Array.from({ length: free }, (_, i) => (
          <motion.button
            key={`slot${i}`}
            type="button"
            onClick={() => onNavigate('add')}
            className="flex min-h-[200px] flex-col items-center justify-center gap-1 rounded-[22px] border-[1.5px] border-dashed border-line bg-surface/60 p-4 active:scale-[0.98]"
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
          >
            <EmptyState variant="add" size={150} reducedMotion={rm} />
            <span className="font-display font-bold">{active.length ? 'Add a second habit' : 'Start your first habit'}</span>
            <span className="text-xs text-muted">30 days to form it · 10,000 hours to master it</span>
          </motion.button>
        ))}
      </main>

      <BottomNav current="home" onTab={(t) => t !== 'home' && onNavigate(t)} onAdd={() => onNavigate('add')} addLocked={full} reducedMotion={rm} />
    </div>
  )
}

import { useCallback, useMemo, useState } from 'react'
import type { ReactNode } from 'react'
import { addMonths, format, parse, startOfMonth } from 'date-fns'
import { useApp } from '@/store/useApp'
import { MAX_TIER, TIERS, tierThresholdHours } from '@/domain/tiers'
import { Bars } from '@/ui/art/Bars'
import { Emblem } from '@/ui/art/Emblem'
import { Flame } from '@/ui/art/Flame'
import { Heatmap } from '@/ui/art/Heatmap'
import { Ladder, formatHours } from '@/ui/art/Ladder'
import { iconGlyph } from '@/ui/icons'
import { BigStat, IconButton, ProgressPill, Segmented, StatTile, TopBar, WeekStrip } from '@/ui/kit'
import type { Navigate } from '@/ui/route'
import { BadgeCabinet } from './parts/BadgeCabinet'
import { DeleteSheets } from './parts/DeleteSheets'
import { fmtDur, fmtHM, fmtInt, motionPref } from './parts/format'
import { Glyph } from './parts/Glyphs'
import { SessionList } from './parts/SessionList'
import { todayOvertime } from './parts/useCardMoments'
import { periodBars, type Period } from './chartData'
import { weekDays } from './weekStrip'

const FMT = 'yyyy-MM-dd'
const monthKey = (d: Date) => format(startOfMonth(d), FMT)

const PERIODS: { value: Period; label: string }[] = [
  { value: 'daily', label: 'Daily' },
  { value: 'weekly', label: 'Weekly' },
  { value: 'monthly', label: 'Monthly' },
]

function Section({ title, children, right }: { title: string; children: ReactNode; right?: ReactNode }) {
  return (
    <section className="card flex flex-col gap-3 p-4">
      <div className="flex min-h-[28px] items-center justify-between">
        <h2 className="label">{title}</h2>
        {right}
      </div>
      {children}
    </section>
  )
}

export function HabitDetail({ habitId, onNavigate }: { habitId: string; onNavigate: Navigate }) {
  const habit = useApp((s) => s.habits.find((h) => h.id === habitId))
  const st = useApp((s) => s.states[habitId])
  const allSessions = useApp((s) => s.sessions)
  const now = useApp((s) => s.now)
  const rm = motionPref(useApp((s) => s.settings.reduceMotion))
  const sessions = useMemo(() => allSessions.filter((s) => s.habitId === habitId), [allSessions, habitId])

  const [month, setMonth] = useState<string | null>(null)
  const [period, setPeriod] = useState<Period>('daily')
  const [confirm, setConfirm] = useState(false)
  const cancel = useCallback(() => setConfirm(false), [])

  const back = () => onNavigate(st?.eternal ? 'hall' : 'home')

  if (!habit || !st) {
    return (
      <div className="mx-auto min-h-screen w-full max-w-md px-4 pt-4">
        <TopBar title="" onBack={() => onNavigate('home')} />
      </div>
    )
  }

  const minMonth = monthKey(new Date(habit.createdAt))
  const maxMonth = monthKey(parse(st.today, FMT, new Date()))
  const shown = month ?? maxMonth
  const step = (n: number) => setMonth(monthKey(addMonths(parse(shown, FMT, new Date()), n)))
  const editable = habit.archivedAt === undefined && !st.eternal
  const c = st.commitment
  const target = habit.targetHours
  const nextTier = Math.min(st.earnedTier + 1, MAX_TIER)
  const bars = periodBars(st.days, st.today, period)

  return (
    <div className="mx-auto flex min-h-screen w-full max-w-md flex-col pb-10">
      <div className="px-4 pb-10 pt-[max(8px,env(safe-area-inset-top))] text-on-tint" style={{ background: habit.color }}>
        <TopBar
          title={habit.name}
          onBack={back}
          right={editable ? <IconButton icon="pencil" label={`Edit ${habit.name}`} onClick={() => onNavigate(`edit:${habit.id}`)} /> : undefined}
        />
        <WeekStrip days={weekDays(st.today, [habit], { [habit.id]: st })} selected={st.today} />
      </div>

      <main className="-mt-6 flex flex-1 flex-col gap-3 rounded-t-[28px] border-t-[1.5px] border-line bg-bg px-4 pt-5">
        <div className="flex items-center justify-between gap-3">
          <BigStat
            icon={<span className="text-2xl" aria-hidden>{iconGlyph(habit.icon)}</span>}
            value={fmtDur(st.todayMinutes)}
            caption={['Time', 'today']}
          />
          <span className="shrink-0 rounded-full border-[1.5px] border-line px-3 py-1.5 font-display text-xs font-bold uppercase tracking-wider">
            {c > 0 ? `${fmtHM(c)} goal` : 'Rest day'}
          </span>
        </div>
        <ProgressPill
          value={c > 0 ? st.todayMinutes / c : 0}
          over={c > 0 ? todayOvertime(st) / c : 0}
          color={habit.color}
          label="Today's progress"
        />

        <div className="grid grid-cols-3 gap-2">
          <StatTile label="Total hours" icon={<Glyph name="clock" size={16} />}>
            {fmtInt(st.totalMinutes / 60)}h
          </StatTile>
          <StatTile label="Longest streak" icon={<Flame streak={st.longestStreak} size={16} reducedMotion />}>
            {st.longestStreak}
          </StatTile>
          <StatTile label="Overtime" icon={<Glyph name="bolt" size={16} />} tint="#e0a21a">
            {fmtDur(st.overtimeMinutes)}
          </StatTile>
        </div>

        <section className="card flex flex-col gap-4 p-4">
          <Segmented<Period> options={PERIODS} value={period} onChange={setPeriod} label="Chart period" accent={habit.color} />
          <Bars bars={bars} color={habit.color} line={period === 'daily' && c > 0 ? c : undefined} reducedMotion={rm} />
        </section>

        <Section
          title="Rank"
          right={
            <span className="flex items-center gap-1.5 font-display text-sm font-bold">
              <Flame streak={st.streak} size={18} reducedMotion={rm} />
              {`${st.streak} day streak`}
            </span>
          }
        >
          <div className="flex items-center gap-4 rounded-[18px] p-3" style={{ background: habit.color }}>
            <Emblem tier={st.rank} size={72} cracked={st.rank < st.earnedTier} reducedMotion={rm} />
            <div className="min-w-0 flex-1 text-on-tint">
              <p className="font-display text-xl font-bold">{TIERS[st.rank - 1]?.name}</p>
              <p className="text-xs font-medium opacity-70">
                {st.earnedTier >= MAX_TIER
                  ? 'Top of the ladder'
                  : `Next: ${TIERS[nextTier - 1].name} at ${formatHours(tierThresholdHours(nextTier, target))}`}
              </p>
              {st.lostTiers > 0 && (
                <p className="mt-1 text-xs font-semibold">{`Recovering · ${st.recoveryProgress}/7 days`}</p>
              )}
            </div>
          </div>
          <Ladder state={st} targetHours={target} reducedMotion={rm} />
        </Section>

        <Section
          title="Calendar"
          right={
            <div className="flex items-center gap-2">
              <IconButton icon="back" label="Previous month" size={34} disabled={shown <= minMonth} onClick={() => step(-1)} />
              <IconButton icon="next" label="Next month" size={34} disabled={shown >= maxMonth} onClick={() => step(1)} />
            </div>
          }
        >
          <p className="-mt-1 font-display text-lg font-bold">{format(parse(shown, FMT, new Date()), 'MMMM yyyy')}</p>
          <Heatmap days={st.days} month={shown} color={habit.color} today={st.today} />
        </Section>

        <Section title="Badges">
          <BadgeCabinet state={st} reducedMotion={rm} />
        </Section>

        <Section title="Sessions">
          <SessionList sessions={sessions} color={habit.color} now={now} />
        </Section>

        <button
          type="button"
          onClick={() => setConfirm(true)}
          className="pill-btn mt-2 border-danger/50 text-danger"
        >
          <Glyph name="trash" size={18} />
          Delete habit
        </button>
      </main>

      <DeleteSheets
        habit={confirm ? habit : undefined}
        tier={st.rank}
        twoStep={st.eternal}
        onCancel={cancel}
        onDeleted={() => onNavigate('home')}
        reducedMotion={rm}
      />
    </div>
  )
}

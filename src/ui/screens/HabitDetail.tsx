import { useCallback, useMemo, useState } from 'react'
import type { ReactNode } from 'react'
import { AnimatePresence } from 'framer-motion'
import { addMonths, format, parse, startOfMonth } from 'date-fns'
import { useApp } from '@/store/useApp'
import { Emblem } from '@/ui/art/Emblem'
import { Flame } from '@/ui/art/Flame'
import { Heatmap } from '@/ui/art/Heatmap'
import { Ladder } from '@/ui/art/Ladder'
import { iconGlyph } from '@/ui/icons'
import type { Navigate } from '@/ui/route'
import { BadgeCabinet } from './parts/BadgeCabinet'
import { ConfirmSheet } from './parts/ConfirmSheet'
import { fmtHM, fmtInt, motionPref } from './parts/format'
import { Glyph } from './parts/Glyphs'
import { ScreenHeader, iconBtn } from './parts/ScreenHeader'
import { SessionList } from './parts/SessionList'

const FMT = 'yyyy-MM-dd'
const monthKey = (d: Date) => format(startOfMonth(d), FMT)

function Stat({ label, children }: { label: string; children: ReactNode }) {
  return (
    <div role="group" aria-label={label} className="flex flex-col items-center gap-1 rounded-3xl bg-white/[0.04] px-2 py-3">
      {children}
      <span className="text-[11px] font-semibold uppercase tracking-wider text-white/40">{label}</span>
    </div>
  )
}

function Section({ title, children }: { title: string; children: ReactNode }) {
  return (
    <section className="flex flex-col gap-3">
      <h2 className="font-display text-xs font-bold uppercase tracking-[0.2em] text-white/40">{title}</h2>
      {children}
    </section>
  )
}

export function HabitDetail({ habitId, onNavigate }: { habitId: string; onNavigate: Navigate }) {
  const habit = useApp((s) => s.habits.find((h) => h.id === habitId))
  const st = useApp((s) => s.states[habitId])
  const allSessions = useApp((s) => s.sessions)
  const now = useApp((s) => s.now)
  const deleteHabit = useApp((s) => s.deleteHabit)
  const rm = motionPref(useApp((s) => s.settings.reduceMotion))
  const sessions = useMemo(() => allSessions.filter((s) => s.habitId === habitId), [allSessions, habitId])

  const [month, setMonth] = useState<string | null>(null)
  const [confirm, setConfirm] = useState(false)
  const [busy, setBusy] = useState(false)
  const cancel = useCallback(() => setConfirm(false), [])

  const back = () => onNavigate(st?.eternal ? 'hall' : 'home')

  if (!habit || !st) {
    return (
      <div className="mx-auto min-h-screen w-full max-w-md px-4 pt-4">
        <ScreenHeader title="" onBack={() => onNavigate('home')} />
      </div>
    )
  }

  const minMonth = monthKey(new Date(habit.createdAt))
  const maxMonth = monthKey(parse(st.today, FMT, new Date()))
  const shown = month ?? maxMonth
  const step = (n: number) => setMonth(monthKey(addMonths(parse(shown, FMT, new Date()), n)))
  const editable = habit.archivedAt === undefined && !st.eternal

  const onDelete = async () => {
    setBusy(true)
    try {
      await deleteHabit(habit.id)
      onNavigate('home')
    } finally {
      setBusy(false)
    }
  }

  return (
    <div className="mx-auto flex min-h-screen w-full max-w-md flex-col gap-6 px-4 pb-10 pt-4">
      <ScreenHeader title={habit.name} onBack={back}>
        {editable && (
          <button type="button" aria-label={`Edit ${habit.name}`} className={iconBtn} onClick={() => onNavigate(`edit:${habit.id}`)}>
            <Glyph name="pencil" />
          </button>
        )}
      </ScreenHeader>

      <div className="flex items-center gap-4 rounded-[28px] p-4" style={{ background: `linear-gradient(135deg, ${habit.color}22, transparent)` }}>
        <Emblem tier={st.rank} size={88} reducedMotion={rm} />
        <div className="flex flex-col items-start gap-1">
          <span className="text-3xl" aria-hidden>{iconGlyph(habit.icon)}</span>
          <div className="flex items-center gap-1" role="img" aria-label={`${st.streak} day streak`}>
            <Flame streak={st.streak} size={28} reducedMotion={rm} />
            <span className="font-display text-xl font-bold">{st.streak}</span>
          </div>
        </div>
      </div>

      <div className="grid grid-cols-3 gap-2">
        <Stat label="Total hours">
          <span className="font-display text-xl font-bold">{fmtInt(st.totalMinutes / 60)}h</span>
        </Stat>
        <Stat label="Longest streak">
          <span className="flex items-center font-display text-xl font-bold">
            <Flame streak={st.longestStreak} size={20} reducedMotion />
            {st.longestStreak}
          </span>
        </Stat>
        <Stat label="Overtime">
          <span className="font-display text-xl font-bold text-[#ffcf3f]">{fmtHM(st.overtimeMinutes)}</span>
        </Stat>
      </div>

      <Section title="Rank">
        <Ladder state={st} targetHours={habit.targetHours} reducedMotion={rm} />
      </Section>

      <Section title="Calendar">
        <div className="rounded-3xl bg-white/[0.03] p-4">
          <div className="mb-3 flex items-center justify-between">
            <button type="button" aria-label="Previous month" className={`${iconBtn} disabled:opacity-25`} disabled={shown <= minMonth} onClick={() => step(-1)}>
              <Glyph name="back" />
            </button>
            <span className="font-display font-semibold">{format(parse(shown, FMT, new Date()), 'MMMM yyyy')}</span>
            <button type="button" aria-label="Next month" className={`${iconBtn} disabled:opacity-25`} disabled={shown >= maxMonth} onClick={() => step(1)}>
              <Glyph name="next" />
            </button>
          </div>
          <Heatmap days={st.days} month={shown} color={habit.color} today={st.today} />
        </div>
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
        className="mt-4 flex min-h-[48px] items-center justify-center gap-2 rounded-2xl border border-red-400/30 font-semibold text-red-300 active:scale-95"
      >
        <Glyph name="trash" size={18} />
        Delete habit
      </button>

      <AnimatePresence>
        {confirm && (
          <ConfirmSheet
            title={`Delete ${habit.name}?`}
            art={<Emblem tier={st.rank} size={72} cracked animate={false} />}
            confirmLabel="Delete"
            danger
            busy={busy}
            onConfirm={() => void onDelete()}
            onCancel={cancel}
            reducedMotion={rm}
          >
            All hours, sessions and badges are erased.
          </ConfirmSheet>
        )}
      </AnimatePresence>
    </div>
  )
}

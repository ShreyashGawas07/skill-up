import { useEffect, useId, useRef } from 'react'
import { AnimatePresence, motion } from 'framer-motion'
import type { Habit, HabitState, Session } from '@/domain/types'
import { tierThresholdHours, MAX_TIER, TIERS } from '@/domain/tiers'
import { haptic } from '@/feedback/haptics'
import { Emblem } from '@/ui/art/Emblem'
import { Ring } from '@/ui/art/Ring'
import { Flame } from '@/ui/art/Flame'
import { useReduce } from '@/ui/art/useReduce'
import { iconGlyph } from '@/ui/icons'
import { ProgressPill, StatTile } from '@/ui/kit'
import { ON_TINT } from '@/ui/theme'
import { fmtClock, fmtDur, fmtHM, fmtInt } from './parts/format'
import { Glyph } from './parts/Glyphs'
import { todayOvertime, useCardMoments } from './parts/useCardMoments'

interface Props {
  habit: Habit
  state: HabitState
  running?: Session
  now: number
  reducedMotion?: boolean
  onStart(): void
  onStop(): void
  onOpen(): void
  onEdit(): void
}

const LONG_PRESS_MS = 550

export function HabitCard({ habit, state, running, now, reducedMotion, onStart, onStop, onOpen, onEdit }: Props) {
  const reduce = useReduce(reducedMotion)
  const live = running?.habitId === habit.id
  const { todayMinutes: today, commitment: c } = state
  const color = habit.color
  const cardRef = useRef<HTMLElement>(null)

  const { pop, spark } = useCardMoments({ habitId: habit.id, state, live, color, reduce, cardRef })

  // Long-press the header opens edit; a plain tap opens detail.
  const press = useRef<ReturnType<typeof setTimeout>>()
  const longFired = useRef(false)
  const startPress = () => {
    longFired.current = false
    press.current = setTimeout(() => {
      longFired.current = true
      haptic.tick()
      onEdit()
    }, LONG_PRESS_MS)
  }
  const endPress = () => clearTimeout(press.current)
  useEffect(() => () => clearTimeout(press.current), [])
  const clockId = useId()

  const toggle = () => {
    haptic.tick()
    if (live) onStop()
    else onStart()
  }

  const totalH = Math.floor(state.totalMinutes / 60)
  const target = habit.targetHours
  // The marker shows the next tier to earn; a cracked (lowered) rank doesn't move it back.
  const nextTier = Math.min(state.earnedTier + 1, MAX_TIER)
  const nextAt = tierThresholdHours(nextTier, target) / target
  const met = c > 0 && today >= c
  const clock = live ? fmtClock(now - running!.start) : fmtHM(today)
  const left = Math.max(0, c - today)

  return (
    <motion.article
      ref={cardRef}
      layout={!reduce}
      aria-label={habit.name}
      className="card relative overflow-hidden p-3"
      initial={reduce ? { opacity: 0 } : { opacity: 0, y: 24 }}
      animate={reduce ? { opacity: 1 } : { opacity: 1, y: 0 }}
    >
      {/* Header: tap → detail, long-press → edit. */}
      <div className="flex items-center gap-3 px-1 pb-3 pt-1">
        <div
          role="button"
          tabIndex={0}
          aria-label={`Open ${habit.name}`}
          onClick={() => !longFired.current && onOpen()}
          onPointerDown={startPress}
          onPointerUp={endPress}
          onPointerLeave={endPress}
          onPointerCancel={endPress}
          onContextMenu={(e) => e.preventDefault()}
          onKeyDown={(e) => {
            if (e.key !== 'Enter' && e.key !== ' ') return
            e.preventDefault()
            onOpen()
          }}
          className="flex min-w-0 flex-1 items-center gap-3 rounded-2xl active:opacity-70"
        >
          <span
            className="grid h-12 w-12 shrink-0 place-items-center rounded-2xl border-[1.5px] border-line text-2xl"
            style={{ background: color }}
            aria-hidden
          >
            {iconGlyph(habit.icon)}
          </span>
          <span className="flex min-w-0 flex-col items-start">
            <span className="w-full truncate font-display text-lg font-bold leading-tight">{habit.name}</span>
            <span className="text-xs font-medium text-muted" aria-hidden>
              {`${TIERS[state.rank - 1]?.name ?? ''} · ${fmtHM(c)} a day`}
            </span>
          </span>
          <span className="ml-auto shrink-0">
            <Emblem tier={state.rank} size={46} cracked={state.rank < state.earnedTier} reducedMotion={reducedMotion} />
          </span>
        </div>
        <button
          type="button"
          aria-label={`Edit ${habit.name}`}
          onClick={onEdit}
          className="grid h-10 w-10 shrink-0 place-items-center rounded-full border-[1.5px] border-line bg-surface text-ink active:scale-90"
        >
          <Glyph name="pencil" size={16} />
        </button>
      </div>

      {/* Timer widget: ink clock panel + pastel ring tile. */}
      <div className="grid grid-cols-[1fr_auto] gap-2">
        <div className="relative flex min-w-0 flex-col justify-between rounded-[22px] border-[1.5px] border-line bg-panel p-4 text-[#f4ede2]">
          <span className="font-display text-xs font-semibold uppercase tracking-[0.14em] opacity-60">
            {live ? 'Timer' : met ? 'Done today' : 'Today'}
          </span>
          <span
            id={clockId}
            className={`font-display font-semibold leading-none tracking-tight tabular-nums ${
              clock.length >= 8 ? 'text-[27px]' : clock.length === 7 ? 'text-[31px]' : 'text-[40px]'
            }`}
          >
            {clock}
          </span>
          <span className="mt-1 text-xs opacity-60">
            {c === 0 ? 'Rest day' : met ? `${fmtHM(c)} goal met` : `${fmtHM(left)} to go · ${fmtHM(c)} goal`}
          </span>
          <button
            type="button"
            aria-label={`${live ? 'Stop' : 'Start'} ${habit.name}`}
            aria-describedby={live ? clockId : undefined}
            onClick={toggle}
            className={`mt-3 inline-flex min-h-[40px] w-fit items-center gap-2 rounded-full px-5 font-display text-sm font-bold transition-transform active:scale-95 ${
              live ? 'bg-white/15 text-[#f4ede2]' : 'bg-accent text-on-tint'
            }`}
          >
            <Glyph name={live ? 'stop' : 'play'} size={14} />
            {live ? 'Stop' : 'Start'}
          </button>
        </div>

        <div
          className="relative grid h-[148px] w-[148px] place-items-center rounded-[22px] border-[1.5px] border-line"
          style={{ background: color }}
        >
          <motion.div
            animate={live && !reduce ? { scale: [1, 1.04, 1] } : { scale: 1 }}
            transition={live ? { duration: 1.6, repeat: Infinity, ease: 'easeInOut' } : undefined}
          >
            <Ring
              progress={c > 0 ? today / c : 0}
              overtime={c > 0 ? todayOvertime(state) / c : 0}
              color={ON_TINT}
              track={ON_TINT}
              flat
              size={128}
              reducedMotion={reducedMotion}
            >
              {/* Mirror of the Start/Stop button for a bigger target; the labelled button is the accessible one. */}
              <div
                aria-hidden
                onClick={toggle}
                className="grid h-[58px] w-[58px] cursor-pointer place-items-center rounded-full text-white active:scale-90"
                style={{ background: ON_TINT }}
              >
                {live ? (
                  <svg viewBox="0 0 24 24" width={22} height={22}>
                    <rect x="6.5" y="5" width="4" height="14" rx="1.5" fill={color} />
                    <rect x="13.5" y="5" width="4" height="14" rx="1.5" fill={color} />
                  </svg>
                ) : (
                  <svg viewBox="0 0 24 24" width={24} height={24}>
                    <path d="M8.5 5.5v13l10-6.5z" fill={color} />
                  </svg>
                )}
              </div>
            </Ring>
          </motion.div>
          <AnimatePresence>
            {pop > 0 && (
              <motion.div
                key={`pop${pop}`}
                className="pointer-events-none absolute inset-x-0 top-3 text-center font-display text-2xl font-bold text-on-tint"
                initial={reduce ? { opacity: 0 } : { opacity: 0, y: 10, scale: 0.6 }}
                animate={reduce ? { opacity: 1 } : { opacity: 1, y: -20, scale: 1.15 }}
                exit={{ opacity: 0 }}
                transition={{ type: 'spring', stiffness: 300, damping: 14 }}
              >
                +1 🔥
              </motion.div>
            )}
            {spark > 0 && (
              <motion.div
                key={`spark${spark}`}
                className="pointer-events-none absolute right-2 top-2 rounded-full border-[1.5px] border-line bg-accent px-2 font-display text-sm font-bold text-on-tint"
                initial={reduce ? { opacity: 0 } : { opacity: 0, scale: 0.5 }}
                animate={reduce ? { opacity: 1 } : { opacity: 1, scale: 1, y: -6 }}
                exit={{ opacity: 0 }}
              >
                ✦ +15m
              </motion.div>
            )}
          </AnimatePresence>
        </div>
      </div>

      {/* Stat tiles */}
      <div className="mt-2 grid grid-cols-3 gap-2">
        <StatTile label="Streak" icon={<Flame streak={state.streak} size={18} reducedMotion={reducedMotion} />}>
          <span>{state.streak}</span>
        </StatTile>
        {state.formed ? (
          <StatTile label="Habit" icon={<Glyph name="check" size={16} />}>
            <span className="inline-flex items-center gap-1">
              <span aria-hidden className="text-[#e0a21a]">★</span>
              <span>Formed</span>
            </span>
          </StatTile>
        ) : (
          <StatTile label="Forming" icon={<Glyph name="target" size={16} />}>
            <span className="whitespace-nowrap text-base">{`Day ${state.formingDone}/30`}</span>
          </StatTile>
        )}
        <StatTile label="Overtime" icon={<Glyph name="bolt" size={16} />} tint="#e0a21a">
          {fmtDur(state.overtimeMinutes)}
        </StatTile>
      </div>

      {/* Lifetime progress toward the target, with the next tier marked. */}
      <div className="mt-3 px-1 pb-1">
        <div className="mb-1.5 flex items-baseline justify-between">
          <span className="label">Road to {fmtInt(target)}h</span>
          <span className="font-display text-xs font-bold tabular-nums">{`${fmtInt(totalH)} / ${fmtInt(target)}h`}</span>
        </div>
        <ProgressPill
          value={totalH / target}
          color={color}
          height={18}
          marker={state.earnedTier < MAX_TIER ? nextAt : undefined}
        />
      </div>
    </motion.article>
  )
}

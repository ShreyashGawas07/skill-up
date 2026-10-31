import { useRef } from 'react'
import { AnimatePresence, motion } from 'framer-motion'
import type { Habit, HabitState, Session } from '@/domain/types'
import { tierThresholdHours, MAX_TIER } from '@/domain/tiers'
import { haptic } from '@/feedback/haptics'
import { Emblem } from '@/ui/art/Emblem'
import { Ring } from '@/ui/art/Ring'
import { Flame } from '@/ui/art/Flame'
import { BeadTrack } from '@/ui/art/BeadTrack'
import { useReduce } from '@/ui/art/useReduce'
import { iconGlyph } from '@/ui/icons'
import { fmtClock, fmtHM, fmtInt } from './parts/format'
import { Glyph } from './parts/Glyphs'
import { useCardMoments } from './parts/useCardMoments'

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
  const { todayMinutes: today, commitment: c, overtimeMinutes } = state
  const color = habit.color
  const cardRef = useRef<HTMLDivElement>(null)

  const { pop, spark } = useCardMoments({ habitId: habit.id, state, live, color, reduce, cardRef })

  // Long-press anywhere on the card opens edit; a plain tap opens detail.
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

  const totalH = Math.floor(state.totalMinutes / 60)
  const target = habit.targetHours
  const nextTier = Math.min(state.rank + 1, MAX_TIER)
  const nextAt = tierThresholdHours(nextTier, target) / target

  return (
    <motion.div
      ref={cardRef}
      layout
      className="relative rounded-[28px] p-[2px]"
      style={{ background: `linear-gradient(140deg, ${color}, ${color}22 45%, ${color}10 60%, ${color}aa)` }}
      initial={reduce ? { opacity: 0 } : { opacity: 0, y: 24 }}
      animate={{ opacity: 1, y: 0 }}
    >
      <div
        className="relative overflow-hidden rounded-[26px] bg-[#12121b] p-4"
        style={{ backgroundImage: `radial-gradient(120% 80% at 0% 0%, ${color}26, transparent 60%)` }}
        onClick={() => !longFired.current && onOpen()}
        onPointerDown={startPress}
        onPointerUp={endPress}
        onPointerLeave={endPress}
        onPointerCancel={endPress}
        onContextMenu={(e) => e.preventDefault()}
      >
        <button
          type="button"
          aria-label="Edit"
          onClick={(e) => {
            e.stopPropagation()
            onEdit()
          }}
          onPointerDown={(e) => e.stopPropagation()}
          className="absolute right-3 top-3 z-10 grid h-9 w-9 place-items-center rounded-full bg-white/5 text-white/60 active:scale-90"
        >
          <Glyph name="pencil" size={18} />
        </button>

        <div className="flex items-center gap-3">
          <div className="relative shrink-0">
            <motion.div
              animate={live && !reduce ? { scale: [1, 1.035, 1] } : { scale: 1 }}
              transition={live ? { duration: 1.6, repeat: Infinity, ease: 'easeInOut' } : undefined}
            >
              <Ring
                progress={c > 0 ? today / c : 0}
                overtime={c > 0 ? overtimeMinutes / c : 0}
                color={color}
                size={164}
                reducedMotion={reducedMotion}
              >
                <button
                  type="button"
                  aria-label={live ? 'Stop' : 'Start'}
                  onClick={(e) => {
                    e.stopPropagation()
                    haptic.tick()
                    if (live) onStop()
                    else onStart()
                  }}
                  onPointerDown={(e) => e.stopPropagation()}
                  className="flex h-[96px] w-[96px] flex-col items-center justify-center rounded-full active:scale-95"
                  style={{
                    background: live ? `${color}26` : `radial-gradient(circle at 35% 30%, #ffffff55, ${color})`,
                    boxShadow: live ? `inset 0 0 0 2px ${color}` : `0 6px 24px ${color}66`,
                  }}
                >
                  {live ? (
                    <>
                      <span className="font-display text-lg font-bold tabular-nums">{fmtClock(now - running!.start)}</span>
                      <span className="mt-1 h-4 w-4 rounded-[4px] bg-white" aria-hidden />
                    </>
                  ) : (
                    <svg viewBox="0 0 24 24" width={38} height={38} aria-hidden>
                      <path d="M8 5.5v13l11-6.5z" fill="#fff" />
                    </svg>
                  )}
                </button>
              </Ring>
            </motion.div>
            <div className="mt-1 text-center text-xs tabular-nums text-white/50">
              {`${fmtHM(today)} / ${fmtHM(c)}`}
            </div>
            <AnimatePresence>
              {pop > 0 && (
                <motion.div
                  key={`pop${pop}`}
                  className="pointer-events-none absolute inset-x-0 top-6 text-center font-display text-3xl font-bold drop-shadow-[0_0_12px_rgba(255,170,60,.9)]"
                  initial={{ opacity: 0, y: 10, scale: 0.6 }}
                  animate={{ opacity: 1, y: reduce ? 0 : -36, scale: 1.15 }}
                  exit={{ opacity: 0 }}
                  transition={{ type: 'spring', stiffness: 300, damping: 14 }}
                >
                  +1 🔥
                </motion.div>
              )}
              {spark > 0 && (
                <motion.div
                  key={`spark${spark}`}
                  className="pointer-events-none absolute right-0 top-2 font-display text-lg font-bold text-[#ffcf3f] drop-shadow-[0_0_8px_#ff9f1c]"
                  initial={{ opacity: 0, scale: 0.5 }}
                  animate={{ opacity: 1, scale: 1, y: reduce ? 0 : -18 }}
                  exit={{ opacity: 0 }}
                >
                  ✦ +15m
                </motion.div>
              )}
            </AnimatePresence>
          </div>

          <div className="flex min-w-0 flex-1 flex-col items-start gap-2 pr-6">
            <div className="flex items-center gap-2">
              <Emblem
                tier={state.rank}
                size={52}
                cracked={state.rank < state.earnedTier}
                reducedMotion={reducedMotion}
              />
              <Flame streak={state.streak} size={30} reducedMotion={reducedMotion} />
              <span className="font-display text-2xl font-bold tabular-nums">{state.streak}</span>
            </div>
            <div className="flex w-full min-w-0 items-center gap-1.5">
              <span className="text-xl" aria-hidden>{iconGlyph(habit.icon)}</span>
              <span className="truncate font-display text-lg font-semibold">{habit.name}</span>
            </div>
            {state.formed ? (
              <span className="inline-flex items-center gap-1 rounded-full bg-gradient-to-r from-[#ffe27a] to-[#ff9f1c] px-2.5 py-0.5 text-xs font-bold text-black">
                <span aria-hidden>★</span>
                <span>Formed</span>
              </span>
            ) : (
              <div className="w-full">
                <BeadTrack done={state.formingDone} formed={false} color={color} reducedMotion={reducedMotion} />
                <div className="text-[11px] font-semibold text-white/50">{`Day ${state.formingDone}/30`}</div>
              </div>
            )}
          </div>
        </div>

        <div className="mt-3">
          <div className="relative h-2 w-full overflow-hidden rounded-full bg-white/10">
            <motion.div
              className="h-full rounded-full"
              style={{ background: `linear-gradient(90deg, ${color}, #ffffff)`, minWidth: 6 }}
              initial={{ width: 0 }}
              animate={{ width: `${Math.min(100, (totalH / target) * 100)}%` }}
            />
            {state.rank < MAX_TIER && (
              <div className="absolute top-0 h-full w-[2px] bg-white/70" style={{ left: `${Math.min(99.5, nextAt * 100)}%` }} aria-hidden />
            )}
          </div>
          <div className="mt-1 text-right text-xs tabular-nums text-white/60">
            {`${fmtInt(totalH)} / ${fmtInt(target)}h`}
          </div>
        </div>
      </div>
    </motion.div>
  )
}

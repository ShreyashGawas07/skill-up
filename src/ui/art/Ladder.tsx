import { motion } from 'framer-motion'
import { MAX_TIER, TIERS, tierThresholdHours } from '@/domain/tiers'
import type { HabitState } from '@/domain/types'
import { TIER_STYLE } from '@/ui/theme'
import { Emblem } from './Emblem'
import { useReduce } from './useReduce'

export type RungState = 'current' | 'reached' | 'lost' | 'locked' | 'future'

export function rungState(t: number, rank: number, earnedTier: number): RungState {
  if (t === rank) return 'current'
  if (t < rank) return 'reached'
  if (t <= earnedTier) return 'lost'
  if (t === earnedTier + 1) return 'locked'
  return 'future'
}

export function formatHours(h: number): string {
  if (h <= 0) return '0h'
  return h >= 10 ? `${Math.ceil(h)}h` : `${Math.ceil(h * 10) / 10}h`
}

interface Props {
  state: HabitState
  targetHours: number
  reducedMotion?: boolean
  className?: string
}

export function Ladder({ state, targetHours, reducedMotion, className }: Props) {
  const reduce = useReduce(reducedMotion)
  const hoursDone = state.totalMinutes / 60
  const tiers = Array.from({ length: MAX_TIER }, (_, i) => MAX_TIER - i) // top = 10

  return (
    <div className={`relative ${className ?? ''}`}>
      <div aria-hidden className="absolute bottom-6 left-[27px] top-6 w-[3px] rounded-full bg-line/25" />
      <ol className="relative flex flex-col gap-2" aria-label="Rank ladder">
      {tiers.map((t) => {
        const s = rungState(t, state.rank, state.earnedTier)
        const style = TIER_STYLE[t]
        const name = TIERS[t - 1].name
        const remaining = tierThresholdHours(t, targetHours) - hoursDone
        const current = s === 'current'
        return (
          <li
            key={t}
            data-tier={t}
            data-state={s}
            className={`relative flex items-center gap-3 rounded-2xl px-1 py-1 ${
              current ? 'border-[1.5px] border-line bg-sunk' : ''
            } ${s === 'future' ? 'opacity-40' : ''} ${s === 'lost' ? 'opacity-75' : ''}`}
          >
            <div className="relative">
              {current && (
                <motion.div
                  aria-hidden
                  className="absolute inset-[-25%] rounded-full"
                  style={{ background: `radial-gradient(circle, ${style.glow}66, transparent 65%)` }}
                  animate={reduce ? { opacity: [0.6, 1, 0.6] } : { opacity: [0.6, 1, 0.6], scale: [0.95, 1.08, 0.95] }}
                  transition={{ duration: 2.4, repeat: Infinity }}
                />
              )}
              <Emblem
                tier={t}
                size={current ? 60 : 52}
                cracked={s === 'lost'}
                locked={s === 'locked' || s === 'future'}
                animate={current}
                reducedMotion={reducedMotion}
              />
            </div>
            <span
              className={`font-display text-sm font-bold uppercase tracking-wider ${
                current ? 'text-ink' : s === 'lost' ? 'text-danger line-through decoration-danger/60' : 'text-muted'
              }`}
            >
              {name}
            </span>
            {s === 'locked' && (
              <span className="ml-auto flex items-center gap-1 rounded-full border-[1.5px] border-line bg-surface px-2.5 py-1 font-display text-sm font-semibold text-ink">
                <svg viewBox="0 0 12 12" className="h-3 w-3" aria-hidden>
                  <path d="M3.5 5.5 V4 a2.5 2.5 0 0 1 5 0 V5.5" fill="none" stroke="currentColor" strokeWidth="1.4" />
                  <rect x="2.5" y="5.5" width="7" height="5" rx="1.2" fill="currentColor" />
                </svg>
                {formatHours(remaining)}
              </span>
            )}
            {s === 'lost' && (
              <span className="ml-auto text-xs font-semibold text-danger" aria-hidden>
                ↓
              </span>
            )}
          </li>
        )
      })}
      </ol>
    </div>
  )
}

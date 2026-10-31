import { useId } from 'react'
import { motion } from 'framer-motion'
import { useReduce } from './useReduce'

export type FlameBand = 'orange' | 'blue' | 'violet'

const BANDS: Record<FlameBand, { outer: [string, string]; mid: [string, string]; core: string; glow: string }> = {
  orange: { outer: ['#ffb020', '#ff3d1f'], mid: ['#ffe066', '#ff8a1f'], core: '#fff6c8', glow: '#ff7a1f' },
  blue: { outer: ['#7ae1ff', '#1f5bff'], mid: ['#c4f3ff', '#45a8ff'], core: '#f2fdff', glow: '#3a8cff' },
  violet: { outer: ['#e09bff', '#6a1fff'], mid: ['#f6d4ff', '#b06bff'], core: '#fff2ff', glow: '#9a4dff' },
}

export function flameBand(streak: number): FlameBand {
  return streak >= 100 ? 'violet' : streak >= 30 ? 'blue' : 'orange'
}

/** 0.6 at streak 0 → 1 at streak 365 (log growth). */
export function flameScale(streak: number): number {
  const s = Math.max(0, streak)
  return 0.6 + 0.4 * Math.min(1, Math.log(1 + s) / Math.log(366))
}

const OUTER = 'M32 4 C38 18 54 28 54 48 C54 64 44 76 32 76 C20 76 10 64 10 48 C10 36 18 30 22 20 C24 30 28 32 30 30 C28 20 28 12 32 4 Z'
const MID = 'M33 22 C38 34 46 40 46 52 C46 64 40 72 32 72 C24 72 18 64 18 54 C18 46 24 42 26 36 C28 42 31 42 32 40 C30 34 30 28 33 22 Z'
const CORE = 'M32 42 C36 50 40 54 40 60 C40 67 36 71 32 71 C28 71 24 67 24 61 C24 55 29 51 32 42 Z'

interface Props {
  streak: number
  size?: number
  reducedMotion?: boolean
}

export function Flame({ streak, size = 48, reducedMotion }: Props) {
  const reduce = useReduce(reducedMotion)
  const uid = useId().replace(/[^A-Za-z0-9]/g, '')
  const band = flameBand(streak)
  const b = BANDS[band]
  const k = flameScale(streak)
  const lit = streak > 0
  const sway = (amp: number, dur: number) =>
    reduce
      ? { animate: { opacity: [0.85, 1, 0.85] }, transition: { duration: dur * 1.5, repeat: Infinity } }
      : {
          animate: { scaleY: [1, 1 + amp, 1 - amp / 2, 1], scaleX: [1, 1 - amp / 2, 1 + amp / 3, 1], skewX: [0, amp * 40, -amp * 30, 0] },
          transition: { duration: dur, repeat: Infinity, ease: 'easeInOut' as const },
        }

  return (
    <div
      data-band={band}
      aria-label={`${streak} day streak`}
      role="img"
      className="relative inline-flex items-end justify-center"
      style={{ width: size, height: size * 1.25 }}
    >
      <svg
        viewBox="0 0 64 80"
        width={size * k}
        height={size * 1.25 * k}
        style={{ overflow: 'visible', opacity: lit ? 1 : 0.35, filter: lit ? undefined : 'grayscale(1)' }}
        aria-hidden
      >
        <defs>
          <linearGradient id={`${uid}-o`} x1="0" y1="0" x2="0" y2="1">
            <stop offset="0" stopColor={b.outer[0]} />
            <stop offset="1" stopColor={b.outer[1]} />
          </linearGradient>
          <linearGradient id={`${uid}-m`} x1="0" y1="0" x2="0" y2="1">
            <stop offset="0" stopColor={b.mid[0]} />
            <stop offset="1" stopColor={b.mid[1]} />
          </linearGradient>
          <radialGradient id={`${uid}-g`} cx="0.5" cy="0.7" r="0.5">
            <stop offset="0" stopColor={b.glow} stopOpacity="0.7" />
            <stop offset="1" stopColor={b.glow} stopOpacity="0" />
          </radialGradient>
        </defs>
        <ellipse cx="32" cy="58" rx="34" ry="28" fill={`url(#${uid}-g)`} />
        <motion.path d={OUTER} fill={`url(#${uid}-o)`} style={{ transformOrigin: '32px 76px' }} {...sway(0.06, 1.6)} />
        <motion.path d={MID} fill={`url(#${uid}-m)`} style={{ transformOrigin: '32px 72px' }} {...sway(0.08, 1.15)} />
        <motion.path d={CORE} fill={b.core} style={{ transformOrigin: '32px 71px' }} {...sway(0.1, 0.8)} />
        <ellipse cx="28" cy="58" rx="3" ry="6" fill="#ffffff" fillOpacity="0.55" />
        {lit && !reduce &&
          [0, 1, 2].map((i) => (
            <motion.circle
              key={i}
              cx={24 + i * 8}
              r={1.4}
              fill={b.mid[0]}
              initial={{ cy: 40, opacity: 0 }}
              animate={{ cy: [40, 6], opacity: [0, 1, 0] }}
              transition={{ duration: 1.8, repeat: Infinity, delay: i * 0.6, ease: 'easeOut' }}
            />
          ))}
      </svg>
    </div>
  )
}

import { useEffect, useId, useRef } from 'react'
import { motion } from 'framer-motion'
import { FORMING_DAYS } from '@/domain/evaluate'
import { useReduce } from './useReduce'

interface Props {
  /** Forming days done, 0..30. */
  done: number
  formed: boolean
  /** Accent colour for filled beads (formed beads are gold). */
  color?: string
  reducedMotion?: boolean
  className?: string
}

const W = 320
const H = 64
const N = FORMING_DAYS

function beadPos(i: number): [number, number] {
  const x = 12 + (i * (W - 24)) / (N - 1)
  const y = H / 2 + Math.sin((i / (N - 1)) * Math.PI * 3) * 13
  return [Math.round(x * 100) / 100, Math.round(y * 100) / 100]
}

const PATH = (() => {
  let d = ''
  for (let i = 0; i < N; i++) {
    const [x, y] = beadPos(i)
    d += `${i === 0 ? 'M' : 'L'}${x} ${y} `
  }
  return d.trim()
})()

export function BeadTrack({ done, formed, color = '#ffa94d', reducedMotion, className }: Props) {
  const reduce = useReduce(reducedMotion)
  const uid = useId().replace(/[^A-Za-z0-9]/g, '')
  const filledCount = formed ? N : Math.min(N, Math.max(0, Math.floor(done)))
  const prev = useRef(filledCount)
  const draining = filledCount < prev.current
  useEffect(() => {
    prev.current = filledCount
  }, [filledCount])
  const fill = formed ? `url(#${uid}-gold)` : `url(#${uid}-bead)`

  return (
    <svg
      viewBox={`0 0 ${W} ${H}`}
      className={className}
      width="100%"
      role="img"
      aria-label={formed ? 'Formed' : `${filledCount} of ${N} days`}
      style={{ overflow: 'visible' }}
    >
      <defs>
        <radialGradient id={`${uid}-bead`} cx="0.35" cy="0.3" r="0.75">
          <stop offset="0" stopColor="#ffffff" />
          <stop offset="0.35" stopColor={color} />
          <stop offset="1" stopColor={color} stopOpacity="0.75" />
        </radialGradient>
        <radialGradient id={`${uid}-gold`} cx="0.35" cy="0.3" r="0.75">
          <stop offset="0" stopColor="#fffbe6" />
          <stop offset="0.4" stopColor="#ffcf3f" />
          <stop offset="1" stopColor="#c47a0a" />
        </radialGradient>
      </defs>
      <path d={PATH} fill="none" stroke="#ffffff" strokeOpacity={0.08} strokeWidth={3} strokeLinejoin="round" />
      {filledCount > 1 && (
        <motion.path
          d={PATH}
          fill="none"
          stroke={formed ? '#ffcf3f' : color}
          strokeOpacity={0.5}
          strokeWidth={2}
          strokeLinejoin="round"
          initial={false}
          animate={{ pathLength: (filledCount - 1) / (N - 1) }}
          transition={{ duration: reduce ? 0 : 0.6 }}
        />
      )}
      {Array.from({ length: N }, (_, i) => {
        const [x, y] = beadPos(i)
        const filled = i < filledCount
        const big = (i + 1) % 10 === 0
        const r = big ? 6.5 : 4.6
        const delay = reduce ? 0 : draining ? (N - 1 - i) * 0.025 : i * 0.02
        return (
          <g key={i} data-bead={filled ? 'filled' : 'empty'}>
            <circle cx={x} cy={y} r={r} fill="#000000" fillOpacity={0.45} stroke="#ffffff" strokeOpacity={0.14} strokeWidth={1} />
            <motion.g
              initial={false}
              animate={reduce ? { opacity: filled ? 1 : 0 } : { opacity: filled ? 1 : 0, scale: filled ? 1 : 0.2 }}
              transition={{ delay, type: reduce ? 'tween' : 'spring', stiffness: 380, damping: 20 }}
              style={{ transformOrigin: `${x}px ${y}px` }}
            >
              <circle cx={x} cy={y} r={r + 3} fill={formed ? '#ffcf3f' : color} fillOpacity={0.22} />
              <circle cx={x} cy={y} r={r} fill={fill} />
              <circle cx={x - r * 0.3} cy={y - r * 0.35} r={r * 0.28} fill="#ffffff" fillOpacity={0.85} />
            </motion.g>
          </g>
        )
      })}
    </svg>
  )
}

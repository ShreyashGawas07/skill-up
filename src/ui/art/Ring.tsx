import { useId, type ReactNode } from 'react'
import { motion } from 'framer-motion'
import { OVERDRIVE } from '@/ui/theme'
import { mix } from './emblems/parts'
import { useReduce } from './useReduce'

interface Props {
  /** Today's progress toward the commitment, 0..1. */
  progress: number
  /** Overtime as a fraction of one extra commitment (0..1, clamped). */
  overtime: number
  color: string
  size?: number
  reducedMotion?: boolean
  /** Track colour (default white for dark tiles; ink for pastel tiles). */
  track?: string
  /** Flat style: no glows, solid arc. For the pastel timer tile. */
  flat?: boolean
  children?: ReactNode
}

const clamp01 = (n: number) => Math.min(1, Math.max(0, Number.isFinite(n) ? n : 0))

export function Ring({ progress, overtime, color, size = 200, reducedMotion, track = '#ffffff', flat, children }: Props) {
  const reduce = useReduce(reducedMotion)
  const uid = useId().replace(/[^A-Za-z0-9]/g, '')
  const p = clamp01(progress)
  const o = clamp01(overtime)
  const closed = p >= 1

  const c = size / 2
  const stroke = size * 0.075
  const od = size * 0.035
  const rO = c - od / 2 - size * 0.02
  const r = rO - od / 2 - size * 0.035 - stroke / 2
  const light = mix(color.length === 7 ? color : '#4dabf7', '#ffffff', 0.45)

  // head sparkle position for the overdrive arc
  const ha = o * 2 * Math.PI - Math.PI / 2
  const hx = c + rO * Math.cos(ha)
  const hy = c + rO * Math.sin(ha)

  const arc = (val: number) =>
    reduce
      ? { initial: { pathLength: val, opacity: 0 }, animate: { pathLength: val, opacity: 1 }, transition: { duration: 0.4 } }
      : { initial: { pathLength: 0 }, animate: { pathLength: val }, transition: { type: 'spring' as const, stiffness: 60, damping: 18 } }

  return (
    <div className="relative" style={{ width: size, height: size }} data-closed={closed || undefined}>
      <svg viewBox={`0 0 ${size} ${size}`} width={size} height={size} className="absolute inset-0 overflow-visible" aria-hidden>
        <defs>
          <linearGradient id={`${uid}-main`} x1="0" y1="0" x2="1" y2="1">
            <stop offset="0" stopColor={light} />
            <stop offset="1" stopColor={color} />
          </linearGradient>
          <linearGradient id={`${uid}-gold`} x1="0" y1="0" x2="1" y2="1">
            <stop offset="0" stopColor={OVERDRIVE.from} />
            <stop offset="0.5" stopColor={OVERDRIVE.mid} />
            <stop offset="1" stopColor={OVERDRIVE.to} />
          </linearGradient>
          <radialGradient id={`${uid}-core`}>
            <stop offset="0.6" stopColor={color} stopOpacity="0" />
            <stop offset="0.9" stopColor={color} stopOpacity={closed ? 0.28 : 0.1} />
            <stop offset="1" stopColor={color} stopOpacity="0" />
          </radialGradient>
        </defs>

        {/* inner glow disc */}
        {!flat && <circle cx={c} cy={c} r={r + stroke} fill={`url(#${uid}-core)`} />}
        {/* track with tick marks */}
        <circle cx={c} cy={c} r={r} fill="none" stroke={track} strokeOpacity={flat ? 0.14 : 0.07} strokeWidth={stroke} />
        <circle
          cx={c}
          cy={c}
          r={r}
          fill="none"
          stroke={track}
          strokeOpacity={flat ? 0.22 : 0.12}
          strokeWidth={stroke * 0.35}
          strokeDasharray={`1 ${((2 * Math.PI * r) / 24 - 1).toFixed(2)}`}
        />

        {/* progress glow + arc */}
        <g transform={`rotate(-90 ${c} ${c})`}>
          {p > 0 && !flat && (
            <motion.circle
              cx={c}
              cy={c}
              r={r}
              fill="none"
              stroke={color}
              strokeOpacity={0.45}
              strokeWidth={stroke * 1.6}
              strokeLinecap="round"
              style={{ filter: `blur(${size * 0.03}px)` }}
              {...arc(p)}
            />
          )}
          {p > 0 && (
            <motion.circle
              data-testid="progress"
              cx={c}
              cy={c}
              r={r}
              fill="none"
              stroke={flat ? color : `url(#${uid}-main)`}
              strokeWidth={stroke}
              strokeLinecap="round"
              {...arc(p)}
            />
          )}
        </g>

        {/* burst when the commitment is met */}
        {closed && (
          <motion.circle
            key="burst"
            cx={c}
            cy={c}
            r={r}
            fill="none"
            stroke={light}
            strokeWidth={stroke * 0.6}
            initial={{ opacity: 0.9, scale: 1 }}
            animate={reduce ? { opacity: 0 } : { opacity: 0, scale: 1.25 }}
            transition={{ duration: 0.9, ease: 'easeOut' }}
            style={{ transformOrigin: `${c}px ${c}px` }}
          />
        )}

        {/* golden overdrive ring */}
        {o > 0 && (
          <g data-testid="overdrive">
            <circle cx={c} cy={c} r={rO} fill="none" stroke={OVERDRIVE.mid} strokeOpacity={0.12} strokeWidth={od} />
            <g transform={`rotate(-90 ${c} ${c})`}>
              {!flat && <motion.circle
                cx={c}
                cy={c}
                r={rO}
                fill="none"
                stroke={OVERDRIVE.mid}
                strokeOpacity={0.6}
                strokeWidth={od * 2.4}
                strokeLinecap="round"
                style={{ filter: `blur(${size * 0.02}px)` }}
                {...arc(o)}
              />}
              <motion.circle
                cx={c}
                cy={c}
                r={rO}
                fill="none"
                stroke={flat ? OVERDRIVE.to : `url(#${uid}-gold)`}
                strokeWidth={flat ? od * 1.3 : od}
                strokeLinecap="round"
                {...arc(o)}
              />
            </g>
            <motion.circle
              cx={hx}
              cy={hy}
              r={od * 0.9}
              fill="#ffffff"
              animate={{ opacity: [0.5, 1, 0.5] }}
              transition={{ duration: 1.4, repeat: Infinity }}
            />
          </g>
        )}
      </svg>
      <div className="absolute inset-0 flex items-center justify-center">{children}</div>
    </div>
  )
}

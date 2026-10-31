import { useId } from 'react'
import { motion } from 'framer-motion'
import { useReduce } from './useReduce'

interface Props {
  variant: 'add' | 'locked'
  size?: number
  reducedMotion?: boolean
  className?: string
}

const SPARKS: [number, number, number][] = [
  [30, 40, 3],
  [168, 34, 2.4],
  [176, 120, 3.2],
  [24, 128, 2],
  [100, 18, 2.2],
]

function spark(x: number, y: number, r: number): string {
  return `M${x} ${y - r * 2} L${x + r * 0.5} ${y - r * 0.5} L${x + r * 2} ${y} L${x + r * 0.5} ${y + r * 0.5} L${x} ${y + r * 2} L${x - r * 0.5} ${y + r * 0.5} L${x - r * 2} ${y} L${x - r * 0.5} ${y - r * 0.5} Z`
}

export function EmptyState({ variant, size = 200, reducedMotion, className }: Props) {
  const reduce = useReduce(reducedMotion)
  const uid = useId().replace(/[^A-Za-z0-9]/g, '')
  const add = variant === 'add'
  const accent = add ? '#7c6cff' : '#6b717d'
  const float = (i: number) =>
    reduce
      ? { animate: { opacity: [0.3, 1, 0.3] }, transition: { duration: 3, repeat: Infinity, delay: i * 0.5 } }
      : { animate: { y: [0, -6, 0], opacity: [0.4, 1, 0.4] }, transition: { duration: 3 + i * 0.4, repeat: Infinity, delay: i * 0.3 } }

  return (
    <div data-variant={variant} className={className} style={{ width: size, height: size * 0.8 }}>
      <svg viewBox="0 0 200 160" width="100%" height="100%" role="img" aria-label={add ? 'Add a habit' : 'Locked slot'}>
        <defs>
          <radialGradient id={`${uid}-halo`} cx="0.5" cy="0.5" r="0.5">
            <stop offset="0" stopColor={accent} stopOpacity="0.45" />
            <stop offset="1" stopColor={accent} stopOpacity="0" />
          </radialGradient>
          <linearGradient id={`${uid}-portal`} x1="0" y1="0" x2="1" y2="1">
            <stop offset="0" stopColor={add ? '#9d8cff' : '#7d838f'} />
            <stop offset="1" stopColor={add ? '#38d9a9' : '#3a3e47'} />
          </linearGradient>
          <linearGradient id={`${uid}-metal`} x1="0" y1="0" x2="0" y2="1">
            <stop offset="0" stopColor="#c9ced6" />
            <stop offset="1" stopColor="#4a4f58" />
          </linearGradient>
        </defs>
        <ellipse cx="100" cy="80" rx="90" ry="72" fill={`url(#${uid}-halo)`} />
        {/* pedestal */}
        <ellipse cx="100" cy="142" rx="54" ry="9" fill="#000000" fillOpacity="0.45" />
        <ellipse cx="100" cy="138" rx="46" ry="7" fill={`url(#${uid}-portal)`} fillOpacity="0.35" />
        {/* ghost shield silhouette */}
        <path
          d="M100 22 L140 34 C140 34 141 58 138 72 C133 96 118 110 100 120 C82 110 67 96 62 72 C59 58 60 34 60 34 Z"
          fill="#ffffff"
          fillOpacity="0.035"
          stroke={`url(#${uid}-portal)`}
          strokeWidth="2.5"
          strokeDasharray={add ? '7 6' : undefined}
          strokeLinejoin="round"
        />
        {add ? (
          <motion.g
            style={{ transformOrigin: '100px 72px' }}
            animate={reduce ? { opacity: [0.75, 1, 0.75] } : { scale: [1, 1.08, 1] }}
            transition={{ duration: 2.2, repeat: Infinity, ease: 'easeInOut' }}
          >
            <circle cx="100" cy="72" r="24" fill={`url(#${uid}-portal)`} />
            <circle cx="100" cy="72" r="24" fill="none" stroke="#ffffff" strokeOpacity="0.5" strokeWidth="1.5" />
            <path d="M100 60 V84 M88 72 H112" stroke="#ffffff" strokeWidth="6" strokeLinecap="round" />
            <ellipse cx="92" cy="62" rx="8" ry="4" fill="#ffffff" fillOpacity="0.35" />
          </motion.g>
        ) : (
          <g>
            <path d="M88 70 V60 a12 12 0 0 1 24 0 V70" fill="none" stroke={`url(#${uid}-metal)`} strokeWidth="6" strokeLinecap="round" />
            <rect x="80" y="68" width="40" height="32" rx="7" fill={`url(#${uid}-metal)`} stroke="#ffffff" strokeOpacity="0.35" strokeWidth="1.2" />
            <rect x="83" y="71" width="34" height="9" rx="4" fill="#ffffff" fillOpacity="0.25" />
            <circle cx="100" cy="84" r="4" fill="#1a1c22" />
            <rect x="98.2" y="85" width="3.6" height="8" rx="1.8" fill="#1a1c22" />
            {/* chains */}
            <path d="M44 48 Q70 66 80 78 M156 48 Q130 66 120 78" fill="none" stroke="#6b717d" strokeWidth="2.5" strokeDasharray="5 3" />
          </g>
        )}
        {SPARKS.map(([x, y, r], i) => (
          <motion.path key={i} d={spark(x, y, r)} fill={add ? '#ffffff' : '#9aa0aa'} {...float(i)} />
        ))}
      </svg>
    </div>
  )
}

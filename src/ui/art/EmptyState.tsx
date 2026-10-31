import { motion } from 'framer-motion'
import { useReduce } from './useReduce'

interface Props {
  variant: 'add' | 'locked'
  size?: number
  reducedMotion?: boolean
  className?: string
}

const INK = 'rgb(var(--ink))'
const SPARKS: [number, number, number][] = [
  [34, 44, 3],
  [166, 36, 2.6],
  [172, 118, 3],
  [28, 124, 2.2],
]

function spark(x: number, y: number, r: number): string {
  return `M${x} ${y - r * 2} L${x + r * 0.5} ${y - r * 0.5} L${x + r * 2} ${y} L${x + r * 0.5} ${y + r * 0.5} L${x} ${y + r * 2} L${x - r * 0.5} ${y + r * 0.5} L${x - r * 2} ${y} L${x - r * 0.5} ${y - r * 0.5} Z`
}

/** Flat, ink-outlined illustration for an empty habit slot or a locked one. */
export function EmptyState({ variant, size = 200, reducedMotion, className }: Props) {
  const reduce = useReduce(reducedMotion)
  const add = variant === 'add'
  const float = (i: number) =>
    reduce
      ? { animate: { opacity: [0.3, 1, 0.3] }, transition: { duration: 3, repeat: Infinity, delay: i * 0.5 } }
      : { animate: { y: [0, -5, 0], opacity: [0.5, 1, 0.5] }, transition: { duration: 3 + i * 0.4, repeat: Infinity, delay: i * 0.3 } }

  return (
    <div data-variant={variant} className={className} style={{ width: size, height: size * 0.8 }}>
      <svg viewBox="0 0 200 160" width="100%" height="100%" role="img" aria-label={add ? 'Add a habit' : 'Locked slot'}>
        <ellipse cx="100" cy="142" rx="50" ry="7" fill={INK} fillOpacity="0.1" />
        <path
          d="M100 22 L140 34 C140 34 141 58 138 72 C133 96 118 110 100 120 C82 110 67 96 62 72 C59 58 60 34 60 34 Z"
          fill="rgb(var(--sunk))"
          stroke={INK}
          strokeWidth="2"
          strokeDasharray={add ? '6 5' : undefined}
          strokeLinejoin="round"
        />
        {add ? (
          <motion.g
            style={{ transformOrigin: '100px 72px' }}
            animate={reduce ? { opacity: [0.75, 1, 0.75] } : { scale: [1, 1.08, 1] }}
            transition={{ duration: 2.2, repeat: Infinity, ease: 'easeInOut' }}
          >
            <circle cx="100" cy="72" r="22" fill="rgb(var(--accent))" stroke={INK} strokeWidth="2" />
            <path d="M100 61 V83 M89 72 H111" stroke="#28221e" strokeWidth="4.5" strokeLinecap="round" />
          </motion.g>
        ) : (
          <g>
            <path d="M88 70 V60 a12 12 0 0 1 24 0 V70" fill="none" stroke={INK} strokeWidth="5" strokeLinecap="round" />
            <rect x="80" y="68" width="40" height="32" rx="8" fill="#c9b6ec" stroke={INK} strokeWidth="2" />
            <circle cx="100" cy="82" r="4" fill="#28221e" />
            <rect x="98.2" y="83" width="3.6" height="8" rx="1.8" fill="#28221e" />
          </g>
        )}
        {SPARKS.map(([x, y, r], i) => (
          <motion.path key={i} d={spark(x, y, r)} fill={add ? 'rgb(var(--accent))' : INK} stroke={INK} strokeWidth="1" {...float(i)} />
        ))}
      </svg>
    </div>
  )
}

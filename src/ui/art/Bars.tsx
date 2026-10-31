import { motion } from 'framer-motion'
import { useReduce } from './useReduce'

export interface Bar {
  key: string
  label: string
  minutes: number
  /** Drawn solid (goal met); otherwise a lighter tint. */
  strong?: boolean
  /** The current (partial) period, outlined thicker. */
  current?: boolean
}

interface Props {
  bars: Bar[]
  color: string
  /** Minutes at which to draw the dashed reference line. */
  line?: number
  height?: number
  reducedMotion?: boolean
}

/** Short duration for a bar label: 45m, 1.5h, 12h. */
export function shortDuration(m: number): string {
  if (m <= 0) return '0'
  if (m < 60) return `${Math.round(m)}m`
  const h = m / 60
  return h >= 10 ? `${Math.round(h)}h` : `${Math.round(h * 10) / 10}h`
}

/** Rounded pill bars with the value written inside the top of each bar. */
export function Bars({ bars, color, line, height = 190, reducedMotion }: Props) {
  const reduce = useReduce(reducedMotion)
  const max = Math.max(1, line ?? 0, ...bars.map((b) => b.minutes)) * 1.08
  const lineY = line ? (1 - line / max) * height : undefined

  return (
    <figure className="m-0">
      <div className="relative" style={{ height }}>
        {lineY !== undefined && (
          <div
            aria-hidden
            className="absolute inset-x-0 border-t-[1.5px] border-dashed border-ink/40"
            style={{ top: lineY }}
          />
        )}
        {bars.every((b) => b.minutes === 0) && (
          <p className="absolute inset-x-0 top-1/3 text-center text-sm font-medium text-muted">No time logged yet</p>
        )}
        <ol className="absolute inset-0 flex items-end justify-between gap-1.5" aria-label="Time per period">
          {bars.map((b, i) => {
            const h = Math.max(b.minutes > 0 ? 34 : 14, (b.minutes / max) * height)
            return (
              <li
                key={b.key}
                aria-label={`${b.label}: ${shortDuration(b.minutes)}`}
                className="flex h-full flex-1 items-end justify-center"
              >
                <motion.div
                  className={`flex w-full max-w-[40px] justify-center rounded-full border-line pt-2 ${b.current ? 'border-2' : 'border-[1.5px]'}`}
                  style={{
                    background: b.minutes > 0 ? color : 'transparent',
                    opacity: b.minutes > 0 && !b.strong ? 0.55 : 1,
                    borderStyle: b.minutes > 0 ? 'solid' : 'dashed',
                  }}
                  initial={reduce ? false : { height: 14 }}
                  animate={{ height: h }}
                  transition={{ type: 'spring', stiffness: 140, damping: 18, delay: reduce ? 0 : i * 0.035 }}
                >
                  {b.minutes > 0 && (
                    <span className="font-display text-[10px] font-bold text-on-tint" aria-hidden>
                      {shortDuration(b.minutes)}
                    </span>
                  )}
                </motion.div>
              </li>
            )
          })}
        </ol>
      </div>
      <div className="mt-2 flex justify-between gap-1.5" aria-hidden>
        {bars.map((b) => (
          <span key={b.key} className={`flex-1 text-center font-display text-[11px] font-semibold ${b.current ? 'text-ink' : 'text-muted'}`}>
            {b.label}
          </span>
        ))}
      </div>
    </figure>
  )
}

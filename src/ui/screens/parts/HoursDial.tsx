import { useRef, type KeyboardEvent, type PointerEvent } from 'react'
import { fmtHM } from './format'
import { Glyph } from './Glyphs'

export const DIAL_MIN = 15
export const DIAL_MAX = 720
export const DIAL_STEP = 15

interface Props {
  value: number
  onChange(minutes: number): void
  color: string
  disabled?: boolean
  size?: number
}

const clamp = (m: number) => Math.min(DIAL_MAX, Math.max(DIAL_MIN, m))
const snap = (m: number) => clamp(Math.round(m / DIAL_STEP) * DIAL_STEP)

/** Circular drag dial: one full turn = 12 h, snapping to 15 min; ±15 m buttons as an alternative. */
export function HoursDial({ value, onChange, color, disabled, size = 260 }: Props) {
  const ref = useRef<SVGSVGElement>(null)
  const dragging = useRef(false)
  const c = size / 2
  const r = c - 22
  const frac = value / DIAL_MAX
  const angle = frac * 2 * Math.PI - Math.PI / 2
  const kx = c + r * Math.cos(angle)
  const ky = c + r * Math.sin(angle)
  const circ = 2 * Math.PI * r

  const set = (m: number) => {
    const v = snap(m)
    if (v !== value) onChange(v)
  }

  const fromPointer = (e: PointerEvent) => {
    const box = ref.current?.getBoundingClientRect()
    if (!box) return
    const a = Math.atan2(e.clientY - (box.top + box.height / 2), e.clientX - (box.left + box.width / 2))
    let f = (a + Math.PI / 2) / (2 * Math.PI)
    if (f < 0) f += 1
    let m = f * DIAL_MAX
    // No wrapping across 12 o'clock: stick to whichever end we came from.
    if (value > DIAL_MAX * 0.75 && m < DIAL_MAX * 0.25) m = DIAL_MAX
    else if (value < DIAL_MAX * 0.25 && m > DIAL_MAX * 0.75) m = DIAL_MIN
    set(m)
  }

  const onKey = (e: KeyboardEvent) => {
    if (disabled) return
    if (e.key === 'ArrowRight' || e.key === 'ArrowUp') set(value + DIAL_STEP)
    else if (e.key === 'ArrowLeft' || e.key === 'ArrowDown') set(value - DIAL_STEP)
    else return
    e.preventDefault()
  }

  const stepBtn = (d: number, name: 'plus' | 'minus') => (
    <button
      type="button"
      aria-label={`${d > 0 ? '+' : '-'}15 minutes`}
      disabled={disabled || (d > 0 ? value >= DIAL_MAX : value <= DIAL_MIN)}
      onClick={() => set(value + d)}
      className="grid h-16 w-16 place-items-center rounded-full bg-white/10 text-white active:scale-90 disabled:opacity-30"
    >
      <Glyph name={name} size={28} />
    </button>
  )

  return (
    <div className="flex flex-col items-center gap-6">
      <div
        role="slider"
        tabIndex={disabled ? -1 : 0}
        aria-label="Daily time"
        aria-valuemin={DIAL_MIN}
        aria-valuemax={DIAL_MAX}
        aria-valuenow={value}
        aria-valuetext={`${fmtHM(value)} per day`}
        aria-disabled={disabled || undefined}
        onKeyDown={onKey}
        className={`relative touch-none select-none rounded-full outline-none focus-visible:ring-2 focus-visible:ring-white/60 ${disabled ? 'opacity-50' : ''}`}
        style={{ width: size, height: size }}
      >
        <svg
          ref={ref}
          viewBox={`0 0 ${size} ${size}`}
          width={size}
          height={size}
          aria-hidden
          onPointerDown={(e) => {
            if (disabled) return
            dragging.current = true
            ;(e.target as Element).setPointerCapture?.(e.pointerId)
            fromPointer(e)
          }}
          onPointerMove={(e) => dragging.current && fromPointer(e)}
          onPointerUp={() => (dragging.current = false)}
          onPointerCancel={() => (dragging.current = false)}
        >
          <circle cx={c} cy={c} r={r} fill="none" stroke="#fff" strokeOpacity={0.08} strokeWidth={22} />
          {Array.from({ length: 12 }, (_, i) => {
            const a = (i / 12) * 2 * Math.PI - Math.PI / 2
            return (
              <circle key={i} cx={c + r * Math.cos(a)} cy={c + r * Math.sin(a)} r={2} fill="#fff" fillOpacity={0.35} />
            )
          })}
          <circle
            cx={c}
            cy={c}
            r={r}
            fill="none"
            stroke={color}
            strokeWidth={22}
            strokeLinecap="round"
            strokeDasharray={`${frac * circ} ${circ}`}
            transform={`rotate(-90 ${c} ${c})`}
            style={{ filter: `drop-shadow(0 0 8px ${color})` }}
          />
          <circle cx={kx} cy={ky} r={20} fill="#fff" stroke={color} strokeWidth={6} />
        </svg>
        <div className="pointer-events-none absolute inset-0 flex flex-col items-center justify-center">
          {disabled && (
            <span className="mb-1 text-white/70">
              <Glyph name="lock" size={22} label="Locked until formed" />
            </span>
          )}
          <span className="font-display text-6xl font-bold tabular-nums">{fmtHM(value)}</span>
          <span className="text-sm text-white/50">/ day</span>
        </div>
      </div>
      <div className="flex gap-10">
        {stepBtn(-DIAL_STEP, 'minus')}
        {stepBtn(DIAL_STEP, 'plus')}
      </div>
    </div>
  )
}

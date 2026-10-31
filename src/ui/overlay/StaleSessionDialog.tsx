import { useEffect, useRef, useState, type KeyboardEvent } from 'react'
import { motion } from 'framer-motion'
import { format } from 'date-fns'
import { STALE_MS } from '@/domain/evaluate'
import { useApp } from '@/store/useApp'
import { iconGlyph } from '@/ui/icons'
import { useReduce } from '@/ui/art/useReduce'
import { motionPref } from '@/ui/screens/parts/format'

const MIN = 60_000
const MAX_MIN = STALE_MS / MIN

const fmtDur = (m: number) => `${Math.floor(m / 60)}h ${String(m % 60).padStart(2, '0')}m`.replace(/ 00m$/, '')

/**
 * A timer left running > 16h. The user keeps 16h or trims to an earlier stop time with a
 * slider bounded to [start, min(start + 16h, now)]. No typing hours, no extending.
 */
export function StaleSessionDialog() {
  const stale = useApp((s) => Object.values(s.states).find((x) => x.staleSession)?.staleSession)
  const habit = useApp((s) => s.habits.find((h) => h.id === stale?.habitId))
  const now = useApp((s) => s.now)
  const resolveStale = useApp((s) => s.resolveStale)
  const refresh = useApp((s) => s.refresh)
  const reduce = useReduce(motionPref(useApp((s) => s.settings.reduceMotion)))
  const [mins, setMins] = useState<number>()
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState(false)
  const keepRef = useRef<HTMLButtonElement>(null)

  // On open: focus "Keep 16h"; on close: hand focus back to whatever had it before.
  const staleId = stale?.id
  useEffect(() => {
    if (!staleId) return
    const prev = document.activeElement instanceof HTMLElement ? document.activeElement : null
    keepRef.current?.focus()
    return () => prev?.focus?.()
  }, [staleId])

  if (!stale) return null
  const max = Math.max(0, Math.min(MAX_MIN, Math.floor((now - stale.start) / MIN)))
  const picked = Math.min(mins ?? max, max)
  const stopAt = stale.start + picked * MIN
  const stopLabel = format(stopAt, 'h:mm a')

  const resolve = async (endAt: number) => {
    if (busy) return
    setBusy(true)
    try {
      await resolveStale(endAt)
      setMins(undefined)
      setError(false)
    } catch {
      // E.g. the session was already closed elsewhere: say so and reload the real state.
      setError(true)
      await refresh().catch(() => {})
    } finally {
      setBusy(false)
    }
  }

  // Keep Tab inside the dialog.
  const trap = (e: KeyboardEvent<HTMLDivElement>) => {
    if (e.key !== 'Tab') return
    const items = [...e.currentTarget.querySelectorAll<HTMLElement>('button:not([disabled]), input:not([disabled])')]
    if (!items.length) return
    const first = items[0]
    const last = items[items.length - 1]
    if (e.shiftKey && document.activeElement === first) {
      e.preventDefault()
      last.focus()
    } else if (!e.shiftKey && document.activeElement === last) {
      e.preventDefault()
      first.focus()
    }
  }

  const btn = 'w-full rounded-2xl py-3.5 font-display text-base font-bold active:scale-[0.98] disabled:opacity-50'

  return (
    <motion.div className="fixed inset-0 z-[60] flex items-end justify-center bg-black/70 backdrop-blur-sm" initial={{ opacity: 0 }} animate={{ opacity: 1 }}>
      <motion.div
        role="dialog"
        aria-modal="true"
        aria-labelledby="stale-title"
        onKeyDown={trap}
        className="mb-4 w-[calc(100%-32px)] max-w-sm rounded-3xl border border-white/10 bg-[#15151f] p-6"
        initial={reduce ? { opacity: 0 } : { y: 80, opacity: 0 }}
        animate={{ y: 0, opacity: 1 }}
        transition={{ type: 'spring', stiffness: 260, damping: 24 }}
      >
        <div className="mb-4 flex items-center gap-3">
          <span aria-hidden className="grid h-12 w-12 shrink-0 place-items-center rounded-2xl text-2xl" style={{ background: `${habit?.color ?? '#ffffff'}26` }}>
            {iconGlyph(habit?.icon ?? '')}
          </span>
          <div>
            <h2 id="stale-title" className="font-display text-xl font-bold">Did you forget to stop?</h2>
            <p className="text-sm text-white/60">
              {habit?.name ?? 'Timer'} · started {format(stale.start, 'EEE h:mm a')}
            </p>
          </div>
        </div>

        <button ref={keepRef} type="button" disabled={busy} className={`${btn} bg-gradient-to-r from-[#9775fa] to-[#4dabf7] text-white`} onClick={() => void resolve(stale.start + MAX_MIN * MIN)}>
          Keep 16h
        </button>

        <div className="mt-5 rounded-2xl bg-white/5 p-4">
          <div className="mb-2 flex items-baseline justify-between">
            <span className="text-sm text-white/60">Stopped at</span>
            <span className="font-display text-lg font-bold tabular-nums">
              {stopLabel} <span className="text-sm font-medium text-white/50">({fmtDur(picked)})</span>
            </span>
          </div>
          <input
            type="range"
            aria-label="Stop time"
            aria-valuetext={`${stopLabel}, ${fmtDur(picked)}`}
            min={0}
            max={max}
            step={5}
            value={picked}
            onChange={(e) => setMins(Number(e.target.value))}
            className="h-11 w-full cursor-pointer"
            style={{ accentColor: habit?.color ?? '#9775fa' }}
          />
          <button type="button" disabled={busy} className={`${btn} mt-2 bg-white/10 text-white`} onClick={() => void resolve(stopAt)}>
            Stop at {stopLabel}
          </button>
        </div>
        {error && (
          <p role="alert" className="mt-3 text-center text-sm text-[#ff8787]">
            Couldn't save the stop time. Please try again.
          </p>
        )}
      </motion.div>
    </motion.div>
  )
}

import { useState } from 'react'
import { format } from 'date-fns'
import type { Session } from '@/domain/types'
import { fmtHM } from './format'

const PAGE = 20

/** A habit's sessions, newest first: day, time range and duration bar. */
export function SessionList({ sessions, color, now }: { sessions: Session[]; color: string; now: number }) {
  const [shown, setShown] = useState(PAGE)
  const sorted = [...sessions].sort((a, b) => b.start - a.start)
  if (!sorted.length) {
    return <p className="rounded-3xl bg-white/[0.03] p-4 text-center text-sm text-white/40">No sessions yet</p>
  }
  const mins = (s: Session) => ((s.end ?? now) - s.start) / 60_000
  const longest = Math.max(...sorted.map(mins), 1)

  return (
    <>
      <ul aria-label="Sessions" className="flex flex-col gap-2">
        {sorted.slice(0, shown).map((s) => {
          const m = mins(s)
          return (
            <li key={s.id} className="flex items-center gap-3 rounded-2xl bg-white/[0.04] px-4 py-3">
              <div className="w-24 shrink-0">
                <div className="font-display text-sm font-semibold">{format(s.start, 'EEE d MMM')}</div>
                <div className="text-xs text-white/40">
                  {format(s.start, 'HH:mm')}–{s.end === undefined ? '…' : format(s.end, 'HH:mm')}
                </div>
              </div>
              <div className="h-2 flex-1 overflow-hidden rounded-full bg-white/5" aria-hidden>
                <div className="h-full rounded-full" style={{ width: `${Math.max(4, (m / longest) * 100)}%`, background: color }} />
              </div>
              <span className="w-12 text-right font-display text-sm font-bold tabular-nums">{fmtHM(m)}</span>
            </li>
          )
        })}
      </ul>
      {shown < sorted.length && (
        <button
          type="button"
          onClick={() => setShown((n) => n + PAGE)}
          className="mt-2 min-h-[44px] w-full rounded-2xl bg-white/5 text-sm font-semibold text-white/70"
        >
          More
        </button>
      )}
    </>
  )
}

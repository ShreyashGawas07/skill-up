import { addDays, format, getDaysInMonth, parse, startOfMonth } from 'date-fns'
import type { CSSProperties, ReactNode } from 'react'
import type { DayKey, DayRecord, HabitState } from '@/domain/types'

interface Props {
  days: HabitState['days']
  /** Any day in the month to show. */
  month: DayKey
  color: string
  /** Days after this are "future" (outline). Defaults to the latest day in `days`. */
  today?: DayKey
  className?: string
}

const FMT = 'yyyy-MM-dd'
const WEEKDAYS = ['M', 'T', 'W', 'T', 'F', 'S', 'S']

type CellStatus = DayRecord['status'] | 'future' | 'none'

function describe(rec: DayRecord | undefined, status: CellStatus): string {
  switch (status) {
    case 'done':
      return rec && rec.minutes > rec.commitment ? 'done, overtime' : 'done'
    case 'missed':
      return 'missed'
    case 'pending':
      return rec && rec.minutes > 0 ? 'partial' : 'pending'
    case 'grace':
      return 'first day'
    case 'future':
      return 'upcoming'
    default:
      return 'no data'
  }
}

export function Heatmap({ days, month, color, today, className }: Props) {
  const first = startOfMonth(parse(month, FMT, new Date()))
  const count = getDaysInMonth(first)
  const lead = (first.getDay() + 6) % 7 // Monday-first
  const byKey = new Map(days.map((d) => [d.key, d]))
  const last = today ?? days.reduce<DayKey>((m, d) => (d.key > m ? d.key : m), '')

  const cells: (null | { key: DayKey; label: string; status: CellStatus; rec?: DayRecord })[] = []
  for (let i = 0; i < lead; i++) cells.push(null)
  for (let i = 0; i < count; i++) {
    const date = addDays(first, i)
    const key = format(date, FMT)
    const rec = byKey.get(key)
    const status: CellStatus = rec ? rec.status : last && key > last ? 'future' : 'none'
    cells.push({ key, rec, status, label: `${format(date, 'MMM d')}: ${describe(rec, status)}` })
  }
  while (cells.length % 7) cells.push(null)
  const weeks: (typeof cells)[] = []
  for (let i = 0; i < cells.length; i += 7) weeks.push(cells.slice(i, i + 7))

  return (
    <div role="grid" aria-label={format(first, 'MMMM yyyy')} className={`select-none ${className ?? ''}`}>
      <div className="mb-1 grid grid-cols-7 gap-1.5" aria-hidden>
        {WEEKDAYS.map((w, i) => (
          <div key={i} className="text-center font-display text-[10px] font-semibold text-white/30">
            {w}
          </div>
        ))}
      </div>
      <div className="flex flex-col gap-1.5">
        {weeks.map((week, wi) => (
          <div role="row" key={wi} className="grid grid-cols-7 gap-1.5">
            {week.map((cell, ci) =>
              cell ? (
                <Cell key={cell.key} label={cell.label} status={cell.status} rec={cell.rec} color={color} isToday={cell.key === today} />
              ) : <div key={`b${ci}`} />,
            )}
          </div>
        ))}
      </div>
    </div>
  )
}

function Cell({
  label,
  status,
  rec,
  color,
  isToday,
}: {
  label: string
  status: CellStatus
  rec?: DayRecord
  color: string
  isToday: boolean
}) {
  const overtime = status === 'done' && !!rec && rec.minutes > rec.commitment
  let style: CSSProperties = {}
  let inner: ReactNode = null

  if (status === 'done') {
    style = overtime
      ? {
          background: `radial-gradient(circle at 35% 30%, #ffffff 0%, ${color} 45%, ${color} 100%)`,
          boxShadow: `0 0 10px ${color}cc, inset 0 0 0 1.5px #ffe27a`,
        }
      : { background: `linear-gradient(145deg, ${color}, ${color}cc)`, boxShadow: `0 0 6px ${color}55` }
  } else if (status === 'missed') {
    style = { background: 'rgba(255, 60, 80, 0.12)', boxShadow: 'inset 0 0 0 1px rgba(255,80,96,0.35)' }
    inner = (
      <svg viewBox="0 0 10 10" className="h-1/2 w-1/2" aria-hidden>
        <path d="M2 2 L8 8 M8 2 L2 8" stroke="#ff4d5e" strokeWidth="2" strokeLinecap="round" />
      </svg>
    )
  } else if (status === 'pending' || status === 'grace') {
    const partial = !!rec && rec.minutes > 0
    style = { background: color, opacity: partial ? 0.35 : 0.14 }
  } else if (status === 'future') {
    style = { boxShadow: 'inset 0 0 0 1px rgba(255,255,255,0.12)' }
  } else {
    style = { background: 'rgba(255,255,255,0.03)' }
  }

  return (
    <div
      role="gridcell"
      aria-label={label}
      data-status={status}
      data-overtime={overtime || undefined}
      className={`relative flex aspect-square items-center justify-center rounded-md ${isToday ? 'outline outline-2 outline-offset-1 outline-white/70' : ''}`}
      style={style}
    >
      {inner}
    </div>
  )
}

import { addDays, differenceInCalendarDays, format, parse, startOfDay } from 'date-fns'
import type { DayKey, Habit, Session } from './types'

const FMT = 'yyyy-MM-dd'

export function dayKey(ts: number): DayKey {
  return format(ts, FMT)
}

export function dayStart(key: DayKey): number {
  return startOfDay(parse(key, FMT, new Date())).getTime()
}

export function nextDay(key: DayKey): DayKey {
  return format(addDays(parse(key, FMT, new Date()), 1), FMT)
}

/** Inclusive list of day keys from fromKey to toKey. */
export function daysBetween(fromKey: DayKey, toKey: DayKey): DayKey[] {
  const from = parse(fromKey, FMT, new Date())
  const n = differenceInCalendarDays(parse(toKey, FMT, new Date()), from)
  const out: DayKey[] = []
  for (let i = 0; i <= n; i++) out.push(format(addDays(from, i), FMT))
  return out
}

/**
 * Whole minutes per local day; sessions split at midnight, open sessions end at `now`.
 * Milliseconds are summed per day across all sessions and floored to minutes once per day.
 */
export function minutesByDay(sessions: Session[], now: number): Map<DayKey, number> {
  const ms = new Map<DayKey, number>()
  for (const s of sessions) {
    const end = s.end ?? now
    if (end <= s.start) continue
    let key = dayKey(s.start)
    let segStart = s.start
    while (segStart < end) {
      const boundary = dayStart(nextDay(key))
      const segEnd = Math.min(end, boundary)
      ms.set(key, (ms.get(key) ?? 0) + (segEnd - segStart))
      segStart = segEnd
      key = nextDay(key)
    }
  }
  const result = new Map<DayKey, number>()
  for (const [key, total] of ms) {
    const mins = Math.floor(total / 60000)
    if (mins > 0) result.set(key, mins)
  }
  return result
}

/** Daily commitment from the last change with fromDate <= key (0 if none). */
export function commitmentOn(habit: Habit, key: DayKey): number {
  let best: { fromDate: DayKey; dailyMinutes: number } | undefined
  for (const c of habit.commitmentHistory) {
    if (c.fromDate <= key && (!best || c.fromDate >= best.fromDate)) best = c
  }
  return best?.dailyMinutes ?? 0
}

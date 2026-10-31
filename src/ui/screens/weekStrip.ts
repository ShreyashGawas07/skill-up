import { addDays, format, parse, startOfWeek } from 'date-fns'
import type { DayKey, Habit, HabitState } from '@/domain/types'
import type { StripDay } from '@/ui/kit'

const FMT = 'yyyy-MM-dd'

/** Monday-first week containing `today`, with a dot per habit whose commitment was met that day. */
export function weekDays(today: DayKey, habits: Habit[], states: Record<string, HabitState>): StripDay[] {
  const monday = startOfWeek(parse(today, FMT, new Date()), { weekStartsOn: 1 })
  const records = habits.map((h) => ({ color: h.color, byKey: new Map((states[h.id]?.days ?? []).map((d) => [d.key, d])) }))
  return Array.from({ length: 7 }, (_, i) => {
    const date = addDays(monday, i)
    const key = format(date, FMT)
    const dots: string[] = []
    let missed = false
    for (const r of records) {
      const rec = r.byKey.get(key)
      if (rec?.status === 'done') dots.push(r.color)
      else if (rec?.status === 'missed') missed = true
    }
    return { key, weekday: format(date, 'EEE'), date: date.getDate(), dots, missed, future: key > today }
  })
}

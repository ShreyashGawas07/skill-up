import { addDays, addMonths, format, parse, startOfMonth, startOfWeek } from 'date-fns'
import type { DayKey, DayRecord } from '@/domain/types'
import type { Bar } from '@/ui/art/Bars'

export type Period = 'daily' | 'weekly' | 'monthly'

const FMT = 'yyyy-MM-dd'
const N = 7

/** The last 7 days, weeks (Mon-first) or months ending at `today`, summed from day records. */
export function periodBars(days: DayRecord[], today: DayKey, period: Period): Bar[] {
  const t = parse(today, FMT, new Date())
  const byKey = new Map(days.map((d) => [d.key, d]))
  const sum = (from: Date, to: Date) => {
    let m = 0
    let met = 0
    let n = 0
    for (let d = from; d <= to; d = addDays(d, 1)) {
      const rec = byKey.get(format(d, FMT))
      if (!rec) continue
      m += rec.minutes
      n++
      if (rec.status === 'done') met++
    }
    return { m, strong: n > 0 && met === n }
  }

  if (period === 'daily') {
    return Array.from({ length: N }, (_, i) => {
      const d = addDays(t, i - (N - 1))
      const rec = byKey.get(format(d, FMT))
      return {
        key: format(d, FMT),
        label: format(d, 'EEEEE'),
        minutes: rec?.minutes ?? 0,
        strong: rec?.status === 'done',
        current: i === N - 1,
      }
    })
  }
  if (period === 'weekly') {
    const thisWeek = startOfWeek(t, { weekStartsOn: 1 })
    return Array.from({ length: N }, (_, i) => {
      const from = addDays(thisWeek, (i - (N - 1)) * 7)
      const { m, strong } = sum(from, i === N - 1 ? t : addDays(from, 6))
      return { key: format(from, FMT), label: format(from, 'd/M'), minutes: m, strong, current: i === N - 1 }
    })
  }
  const thisMonth = startOfMonth(t)
  return Array.from({ length: N }, (_, i) => {
    const from = addMonths(thisMonth, i - (N - 1))
    const { m, strong } = sum(from, i === N - 1 ? t : addDays(addMonths(from, 1), -1))
    return { key: format(from, FMT), label: format(from, 'MMM'), minutes: m, strong, current: i === N - 1 }
  })
}

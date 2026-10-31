import { describe, expect, it } from 'vitest'
import { render } from '@testing-library/react'
import type { DayRecord, Habit, HabitState } from '@/domain/types'
import { periodBars } from '@/ui/screens/chartData'
import { weekDays } from '@/ui/screens/weekStrip'
import { fmtDur } from '@/ui/screens/parts/format'
import { pastel, HABIT_COLORS } from '@/ui/theme'
import { useTheme } from '@/ui/useTheme'
import { shortDuration } from '@/ui/art/Bars'

const rec = (key: string, minutes: number, status: DayRecord['status'] = 'done'): DayRecord => ({ key, minutes, commitment: 60, status })

function Themed({ theme }: { theme: 'light' | 'dark' | 'system' }) {
  useTheme(theme)
  return null
}

describe('theme', () => {
  it('writes the chosen theme onto <html data-theme> and follows the OS for system', () => {
    const { rerender } = render(<Themed theme="dark" />)
    expect(document.documentElement.dataset.theme).toBe('dark')
    rerender(<Themed theme="light" />)
    expect(document.documentElement.dataset.theme).toBe('light')
    rerender(<Themed theme="system" />)
    expect(['light', 'dark']).toContain(document.documentElement.dataset.theme)
  })

  it('maps v1 saturated colours onto the pastel palette and leaves others alone', () => {
    expect(pastel('#ff6b6b')).toBe('#f4a99c')
    expect(pastel('#9775FA')).toBe('#c9b6ec')
    for (const c of HABIT_COLORS) expect(pastel(c)).toBe(c)
  })
})

describe('periodBars', () => {
  const days = [rec('2026-02-09', 30, 'missed'), rec('2026-02-10', 90), rec('2026-02-14', 60), rec('2026-02-15', 20, 'pending')]

  it('daily: last 7 days ending today, today marked current', () => {
    const bars = periodBars(days, '2026-02-15', 'daily')
    expect(bars.map((b) => b.key)).toEqual(['2026-02-09', '2026-02-10', '2026-02-11', '2026-02-12', '2026-02-13', '2026-02-14', '2026-02-15'])
    expect(bars.map((b) => b.minutes)).toEqual([30, 90, 0, 0, 0, 60, 20])
    expect(bars[1].strong).toBe(true)
    expect(bars[0].strong).toBe(false)
    expect(bars[6].current).toBe(true)
  })

  it('weekly: Monday-first sums, the current week partial', () => {
    const bars = periodBars(days, '2026-02-15', 'weekly')
    expect(bars).toHaveLength(7)
    expect(bars[6].key).toBe('2026-02-09') // Monday
    expect(bars[6].minutes).toBe(200)
    expect(bars[6].strong).toBe(false) // a missed day in the week
  })

  it('monthly: sums per calendar month', () => {
    const bars = periodBars([...days, rec('2026-01-31', 45)], '2026-02-15', 'monthly')
    expect(bars[6].label).toBe('Feb')
    expect(bars[6].minutes).toBe(200)
    expect(bars[5].minutes).toBe(45)
  })
})

describe('weekDays', () => {
  it('marks done days with the habit colour and flags misses and future days', () => {
    const habit = { id: 'a', color: '#a9d9b8' } as Habit
    const st = { days: [rec('2026-02-09', 60), rec('2026-02-10', 0, 'missed')] } as HabitState
    const week = weekDays('2026-02-11', [habit], { a: st })
    expect(week.map((d) => d.weekday)).toEqual(['Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat', 'Sun'])
    expect(week[0].dots).toEqual(['#a9d9b8'])
    expect(week[1].missed).toBe(true)
    expect(week[2].future).toBe(false)
    expect(week[3].future).toBe(true)
  })
})

describe('duration labels', () => {
  it('formats durations compactly', () => {
    expect(fmtDur(0)).toBe('0m')
    expect(fmtDur(45)).toBe('45m')
    expect(fmtDur(135)).toBe('2h 15m')
    expect(fmtDur(22 * 60 + 6)).toBe('22h')
    expect(shortDuration(0)).toBe('0')
    expect(shortDuration(90)).toBe('1.5h')
    expect(shortDuration(725)).toBe('12h')
  })
})

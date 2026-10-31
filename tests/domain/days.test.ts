import { describe, it, expect } from 'vitest'
import { dayKey, dayStart, nextDay, daysBetween, minutesByDay, commitmentOn } from '@/domain/days'
import type { Habit } from '@/domain/types'

const at = (y: number, m: number, d: number, h = 0, min = 0) => new Date(y, m - 1, d, h, min).getTime()

describe('days', () => {
  it('dayKey of 2026-10-31 23:59 local', () => {
    expect(dayKey(at(2026, 10, 31, 23, 59))).toBe('2026-10-31')
  })

  it('dayStart/nextDay round trip', () => {
    expect(dayStart('2026-10-31')).toBe(at(2026, 10, 31))
    expect(nextDay('2026-10-31')).toBe('2026-11-01')
  })

  it('splits a session at midnight', () => {
    const m = minutesByDay([{ id: 's', habitId: 'h', start: at(2026, 10, 31, 23), end: at(2026, 11, 1, 1, 30) }], 0)
    expect(Object.fromEntries(m)).toEqual({ '2026-10-31': 60, '2026-11-01': 90 })
  })

  it('splits correctly across DST change', () => {
    expect(process.env.TZ).toBe('Europe/London')
    const start = at(2026, 10, 24, 23)
    const end = at(2026, 10, 26, 1)
    expect((dayStart('2026-10-26') - dayStart('2026-10-25')) / 60000).toBe(1500)
    const m = minutesByDay([{ id: 's', habitId: 'h', start, end }], 0)
    expect(Object.fromEntries(m)).toEqual({ '2026-10-24': 60, '2026-10-25': 1500, '2026-10-26': 60 })
  })

  it('open session counts up to now', () => {
    const m = minutesByDay([{ id: 's', habitId: 'h', start: at(2026, 10, 31, 10) }], at(2026, 10, 31, 10, 45))
    expect(Object.fromEntries(m)).toEqual({ '2026-10-31': 45 })
  })

  it('floors minutes once per day, not per session', () => {
    const s1 = at(2026, 10, 31, 9)
    const s2 = at(2026, 10, 31, 14)
    const len = 60 * 60000 + 30000
    const m = minutesByDay(
      [
        { id: 'a', habitId: 'h', start: s1, end: s1 + len },
        { id: 'b', habitId: 'h', start: s2, end: s2 + len },
      ],
      0,
    )
    expect(Object.fromEntries(m)).toEqual({ '2026-10-31': 121 })
  })

  it('daysBetween is inclusive', () => {
    expect(daysBetween('2026-10-30', '2026-11-02')).toEqual(['2026-10-30', '2026-10-31', '2026-11-01', '2026-11-02'])
  })

  it('commitmentOn picks last change with fromDate <= key', () => {
    const habit: Habit = {
      id: 'h', name: 'n', icon: 'i', color: 'c', targetHours: 100, reminderTime: '09:00', createdAt: 0,
      commitmentHistory: [{ fromDate: '2026-10-01', dailyMinutes: 120 }, { fromDate: '2026-11-05', dailyMinutes: 90 }],
    }
    expect(commitmentOn(habit, '2026-11-04')).toBe(120)
    expect(commitmentOn(habit, '2026-11-05')).toBe(90)
  })
})

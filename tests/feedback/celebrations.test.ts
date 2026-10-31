import { describe, expect, it } from 'vitest'
import { toCelebrations } from '@/feedback/celebrations'
import type { AppEvent, EventType } from '@/domain/types'

const ev = (type: EventType, day = '2026-10-31', value?: number, habitId = 'h1'): AppEvent => {
  const key = value === undefined || type === 'OVERTIME' ? `${type}:${day}` : `${type}:${day}:${value}`
  return value === undefined ? { key, type, habitId, day } : { key, type, habitId, day, value }
}

describe('toCelebrations', () => {
  it('maps events to composite keys, kinds and values', () => {
    const [c] = toCelebrations([ev('RANK_UP', '2026-10-31', 3)], new Set())
    expect(c).toEqual({ key: 'h1:RANK_UP:2026-10-31:3', kind: 'rankUp', habitId: 'h1', value: 3, fullScreen: true })
  })

  it('filters seen composite keys', () => {
    const events = [ev('DAY_COMPLETE'), ev('DAY_COMPLETE', '2026-10-31', undefined, 'h2')]
    const out = toCelebrations(events, new Set(['h1:DAY_COMPLETE:2026-10-31']))
    expect(out.map((c) => c.key)).toEqual(['h2:DAY_COMPLETE:2026-10-31'])
  })

  it('does not treat a bare event key as seen', () => {
    expect(toCelebrations([ev('DAY_COMPLETE')], new Set(['DAY_COMPLETE:2026-10-31']))).toHaveLength(1)
  })

  it('ignores the __seeded__ sentinel in the seen set', () => {
    expect(toCelebrations([ev('DAY_COMPLETE')], new Set(['__seeded__']))).toHaveLength(1)
  })

  it('orders by kind priority', () => {
    const events = [
      ev('ETERNAL'), ev('HABIT_FORMED'), ev('RANK_UP', undefined, 2), ev('STREAK_MILESTONE', undefined, 7),
      ev('OVERTIME', undefined, 10), ev('DAY_COMPLETE'), ev('RANK_RECOVERED', undefined, 2),
      ev('STREAK_RESET'), ev('RANK_LOST', undefined, 1),
    ]
    expect(toCelebrations(events, new Set()).map((c) => c.kind)).toEqual([
      'rankLost', 'streakReset', 'rankRecovered', 'dayComplete', 'overtime', 'streak', 'rankUp', 'formed', 'eternal',
    ])
  })

  it('fullScreen for all except dayComplete and overtime', () => {
    const out = toCelebrations([ev('DAY_COMPLETE'), ev('OVERTIME', undefined, 5), ev('HABIT_FORMED')], new Set())
    expect(Object.fromEntries(out.map((c) => [c.kind, c.fullScreen]))).toEqual({
      dayComplete: false, overtime: false, formed: true,
    })
  })

  it('keeps only the latest OVERTIME per day', () => {
    const out = toCelebrations(
      [ev('OVERTIME', '2026-10-31', 5), ev('OVERTIME', '2026-10-30', 9), ev('OVERTIME', '2026-10-31', 12)],
      new Set(),
    )
    expect(out.map((c) => [c.key, c.value])).toEqual([
      ['h1:OVERTIME:2026-10-31', 12],
      ['h1:OVERTIME:2026-10-30', 9],
    ])
  })
})

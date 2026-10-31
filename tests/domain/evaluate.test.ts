import { describe, it, expect } from 'vitest'
import { addDays, setHours } from 'date-fns'
import { evaluate, STALE_MS } from '@/domain/evaluate'
import { dayKey } from '@/domain/days'
import type { CommitmentChange, Habit, Session } from '@/domain/types'

// Mid-winter base: fixtures never cross a DST change.
const BASE = new Date(2026, 0, 5)
const at = (n: number, h = 12) => setHours(addDays(BASE, n), h).getTime()
const k = (n: number) => dayKey(at(n))

/** A session of `minutes` on creation day + n, starting 02:00 local. */
const day = (n: number, minutes: number): Session => ({
  id: `s${n}`,
  habitId: 'h',
  start: at(n, 2),
  end: at(n, 2) + minutes * 60000,
})
const doneDays = (from: number, to: number, minutes = 120) => {
  const out: Session[] = []
  for (let n = from; n <= to; n++) out.push(day(n, minutes))
  return out
}

const makeHabit = (targetHours = 10000, history?: CommitmentChange[]): Habit => ({
  id: 'h',
  name: 'Guitar',
  icon: 'guitar',
  color: '#fff',
  targetHours,
  reminderTime: '19:00',
  createdAt: at(0, 1),
  commitmentHistory: history ?? [{ fromDate: k(0), dailyMinutes: 120 }],
})

/** Evaluate with "today" = creation day + todayN at 23:00. */
const run = (sessions: Session[], todayN: number, targetHours = 10000, history?: CommitmentChange[]) =>
  evaluate(makeHabit(targetHours, history), sessions, at(todayN, 23))

const ofType = (s: ReturnType<typeof evaluate>, type: string) => s.events.filter((e) => e.type === type)

describe('evaluate: day status', () => {
  it('done day', () => {
    const s = run([day(0, 120)], 1)
    expect(s.days[0].status).toBe('done')
    expect(s.streak).toBe(1)
    expect(s.formingDone).toBe(1)
    expect(ofType(s, 'DAY_COMPLETE').map((e) => e.key)).toEqual([`DAY_COMPLETE:${k(0)}`])
  })

  it('partial day (119 min) is missed; unfinished creation day is grace', () => {
    const s = run([day(1, 119)], 2)
    expect(s.days[0].status).toBe('grace')
    expect(s.days[1].status).toBe('missed')
    expect(s.days[1].minutes).toBe(119)
    expect(s.streak).toBe(0)
  })

  it('creation day that is today and not done is pending', () => {
    const s = run([day(0, 30)], 0)
    expect(s.days).toHaveLength(1)
    expect(s.days[0].status).toBe('pending')
    expect(s.todayMinutes).toBe(30)
  })

  it('overtime counts toward total but is not banked', () => {
    const s = run([day(0, 180)], 2)
    expect(s.overtimeMinutes).toBe(60)
    expect(s.totalMinutes).toBe(180)
    expect(s.days[1].status).toBe('missed')
    expect(ofType(s, 'OVERTIME').map((e) => e.key)).toEqual([`OVERTIME:${k(0)}:60`])
  })
})

describe('evaluate: forming', () => {
  it('30 done days form the habit with HABIT_FORMED on day 29', () => {
    const s = run(doneDays(0, 29), 30)
    expect(s.formed).toBe(true)
    expect(s.formingDone).toBe(30)
    expect(s.badges.formed).toBe(true)
    expect(ofType(s, 'HABIT_FORMED').map((e) => e.day)).toEqual([k(29)])
  })

  it('a miss on day 10 resets forming and emits STREAK_RESET', () => {
    const s = run(doneDays(0, 9), 11)
    expect(s.days[10].status).toBe('missed')
    expect(s.formingDone).toBe(0)
    expect(ofType(s, 'STREAK_RESET').map((e) => e.day)).toEqual([k(10)])
  })

  it('after formed, a miss does not unset formed', () => {
    const s = run(doneDays(0, 29), 31)
    expect(s.days[30].status).toBe('missed')
    expect(s.formed).toBe(true)
    expect(s.streak).toBe(0)
    expect(s.longestStreak).toBe(30)
  })
})

describe('evaluate: penalty', () => {
  it('earnedTier 5 then one miss → lostTiers 2, rank 3, RANK_LOST', () => {
    // target 100 h: tier 5 = 10 h = 600 min
    const s = run([day(0, 600)], 2, 100)
    expect(s.earnedTier).toBe(5)
    expect(s.lostTiers).toBe(2)
    expect(s.rank).toBe(3)
    expect(ofType(s, 'RANK_LOST').map((e) => e.key)).toEqual([`RANK_LOST:${k(1)}:3`])
  })

  it('at earnedTier 2 a miss caps lostTiers at 1, rank 1', () => {
    // target 100 h: tier 2 = 30 min
    const s = run([day(0, 60)], 2, 100)
    expect(s.earnedTier).toBe(2)
    expect(s.lostTiers).toBe(1)
    expect(s.rank).toBe(1)
    expect(ofType(s, 'RANK_LOST')).toHaveLength(1)
  })

  it('two misses at tier 1 → rank 1, no RANK_LOST', () => {
    const s = run([day(0, 120)], 3)
    expect(s.days[1].status).toBe('missed')
    expect(s.days[2].status).toBe('missed')
    expect(s.earnedTier).toBe(1)
    expect(s.lostTiers).toBe(0)
    expect(s.rank).toBe(1)
    expect(ofType(s, 'RANK_LOST')).toHaveLength(0)
  })

  it('multi-day absence: earnedTier 6, 5 days no sessions → lostTiers 5, rank 1', () => {
    // target 100 h: tier 6 = 20 h = 1200 min
    const s = run([day(0, 1200)], 6, 100)
    expect(s.earnedTier).toBe(6)
    expect(s.days.slice(1, 6).every((d) => d.status === 'missed')).toBe(true)
    expect(s.days[6].status).toBe('pending')
    expect(s.lostTiers).toBe(5)
    expect(s.rank).toBe(1)
  })
})

describe('evaluate: recovery', () => {
  // target 200 h: tier 5 = 20 h = 1200 min, tier 6 = 40 h = 2400 min
  it('lostTiers 2 then 7 done days → lostTiers 1 + RANK_RECOVERED', () => {
    const s = run([day(0, 1200), ...doneDays(2, 8)], 9, 200)
    expect(s.earnedTier).toBe(5)
    expect(s.lostTiers).toBe(1)
    expect(s.rank).toBe(4)
    expect(s.recoveryProgress).toBe(0)
    expect(ofType(s, 'RANK_RECOVERED').map((e) => e.key)).toEqual([`RANK_RECOVERED:${k(8)}:4`])
  })

  it('6 done days then a miss → recoveryProgress 0, lostTiers capped at 4', () => {
    const before = run([day(0, 1200), ...doneDays(2, 7)], 8, 200)
    expect(before.lostTiers).toBe(2)
    expect(before.recoveryProgress).toBe(6)
    const s = run([day(0, 1200), ...doneDays(2, 7)], 9, 200)
    expect(s.days[8].status).toBe('missed')
    expect(s.recoveryProgress).toBe(0)
    expect(s.lostTiers).toBe(4)
    expect(s.rank).toBe(1)
  })

  it('recovery counter does not run while lostTiers is 0', () => {
    const s = run(doneDays(0, 9), 10)
    expect(s.recoveryProgress).toBe(0)
  })
})

describe('evaluate: rank up, milestones, eternal', () => {
  it('RANK_UP when total crosses a threshold, value = new rank', () => {
    // target 100 h: tier 2 = 30 min, tier 3 = 120 min
    const s = run([day(0, 30), day(1, 120)], 2, 100)
    expect(ofType(s, 'RANK_UP').map((e) => [e.day, e.value])).toEqual([
      [k(0), 2],
      [k(1), 3],
    ])
    expect(s.badges.tiersReached).toEqual([1, 2, 3])
  })

  it('streak milestones at 7 and 14; event keys unique and stable', () => {
    const sessions = doneDays(0, 14)
    const s = run(sessions, 15)
    expect(ofType(s, 'STREAK_MILESTONE').map((e) => [e.day, e.value])).toEqual([
      [k(6), 7],
      [k(13), 14],
    ])
    const keys = s.events.map((e) => e.key)
    expect(new Set(keys).size).toBe(keys.length)
    expect(run(sessions, 15).events.map((e) => e.key)).toEqual(keys)
  })

  it('eternal: total reaches target → eternal, lostTiers cleared, later days not evaluated', () => {
    // target 10 h = 600 min; 300 min = 50% → tier 7; a miss then adds lostTiers 2
    const s = run([day(0, 300), day(2, 300)], 5, 10)
    expect(s.eternal).toBe(true)
    expect(s.earnedTier).toBe(10)
    expect(s.lostTiers).toBe(0)
    expect(s.rank).toBe(10)
    expect(s.days).toHaveLength(3)
    expect(ofType(s, 'ETERNAL').map((e) => e.key)).toEqual([`ETERNAL:${k(2)}`])
    expect(ofType(s, 'RANK_LOST')).toHaveLength(1)
  })
})

describe('evaluate: today and history', () => {
  it('today with 0 minutes is pending, no penalty', () => {
    const s = run([day(0, 600)], 1, 100)
    expect(s.days[1].status).toBe('pending')
    expect(s.lostTiers).toBe(0)
    expect(s.rank).toBe(5)
    expect(s.missedYesterday).toBe(false)
  })

  it('missedYesterday true when yesterday was missed', () => {
    const s = run([day(0, 120)], 2)
    expect(s.days[1].status).toBe('missed')
    expect(s.days[2].status).toBe('pending')
    expect(s.missedYesterday).toBe(true)
  })

  it('commitment history applies per day', () => {
    const history = [
      { fromDate: k(0), dailyMinutes: 120 },
      { fromDate: k(40), dailyMinutes: 60 },
    ]
    const s = run([...doneDays(0, 38), day(39, 60), day(40, 60)], 41, 10000, history)
    expect(s.days[39].commitment).toBe(120)
    expect(s.days[39].status).toBe('missed')
    expect(s.days[40].commitment).toBe(60)
    expect(s.days[40].status).toBe('done')
    expect(s.commitment).toBe(60)
  })

  it('stale running session is excluded', () => {
    const now = at(1, 23)
    const open: Session = { id: 'open', habitId: 'h', start: now - 20 * 3600_000 }
    const s = evaluate(makeHabit(), [day(0, 120), open], now)
    expect(STALE_MS).toBe(16 * 3600_000)
    expect(s.staleSession?.id).toBe('open')
    expect(s.todayMinutes).toBe(0)
    expect(s.totalMinutes).toBe(120)
    expect(s.days[1].status).toBe('pending')
  })

  it('a fresh running session counts toward today', () => {
    const now = at(1, 23)
    const open: Session = { id: 'open', habitId: 'h', start: now - 2 * 3600_000 }
    const s = evaluate(makeHabit(), [day(0, 120), open], now)
    expect(s.staleSession).toBeUndefined()
    expect(s.todayMinutes).toBe(120)
    expect(s.days[1].status).toBe('done')
  })

  it('before the habit has any days: rank 1, earnedTier 1', () => {
    const s = evaluate(makeHabit(), [], at(-1, 12))
    expect(s.days).toEqual([])
    expect(s.rank).toBe(1)
    expect(s.earnedTier).toBe(1)
    expect(s.events).toEqual([])
  })
})

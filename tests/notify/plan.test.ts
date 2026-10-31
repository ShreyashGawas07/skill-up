import { describe, it, expect } from 'vitest'
import { addDays, addMinutes, format, set } from 'date-fns'
import { buildSchedule, notifId } from '@/notify/plan'
import type { NotifSpec } from '@/notify/plan'
import { dayKey } from '@/domain/days'
import type { Habit, HabitState, Session } from '@/domain/types'

const NOW = new Date(2026, 10, 1, 12, 0).getTime() // 2026-11-01 12:00 local
const atTime = (base: number, offset: number, h: number, m = 0) =>
  set(addDays(base, offset), { hours: h, minutes: m, seconds: 0, milliseconds: 0 }).getTime()

const makeHabit = (id: string, createdAt = 1000, extra: Partial<Habit> = {}): Habit => ({
  id,
  name: id === 'a' ? 'Japanese' : 'Guitar',
  icon: 'x',
  color: '#fff',
  targetHours: 10000,
  reminderTime: '19:00',
  createdAt,
  commitmentHistory: [{ fromDate: '2026-01-01', dailyMinutes: 120 }],
  ...extra,
})

const makeState = (habitId: string, now = NOW, extra: Partial<HabitState> = {}): HabitState => ({
  habitId,
  today: dayKey(now),
  todayMinutes: 30,
  commitment: 120,
  days: [],
  formingDone: 11,
  formed: false,
  streak: 11,
  longestStreak: 11,
  totalMinutes: 5000,
  overtimeMinutes: 0,
  earnedTier: 5,
  lostTiers: 0,
  recoveryProgress: 0,
  rank: 5,
  eternal: false,
  badges: { formed: false, tiersReached: [1, 2, 3, 4, 5] },
  missedYesterday: false,
  events: [],
  ...extra,
})

const one = (state: Partial<HabitState> = {}, now = NOW, running?: Session, habit = makeHabit('a')) =>
  buildSchedule({ habits: [habit], states: { a: makeState('a', now, state) }, running, now })

const ofKind = (specs: NotifSpec[], kind: string) => specs.filter((s) => s.kind === kind)
const onDay = (specs: NotifSpec[], base: number, offset: number) =>
  specs.filter((s) => s.at !== null && dayKey(s.at) === dayKey(addDays(base, offset).getTime()))
const text = (s: NotifSpec) => s.title + ' ' + s.body
const placeholder = /\{\w+\}/
const DAYS = [0, 1, 2, 3, 4, 5, 6, 7]

describe('notifId', () => {
  it('encodes slot, kind and day offset', () => {
    expect(notifId(0, 'reminder', 0)).toBe(0)
    expect(notifId(1, 'lastChance', 3)).toBe(1103)
    expect(notifId(0, 'running', 0)).toBe(200)
    expect(notifId(1, 'dayComplete', 0)).toBe(1300)
    expect(notifId(0, 'missed', 0)).toBe(400)
  })
})

describe('buildSchedule', () => {
  it('today not done: reminder 19:00 and lastChance 22:30 today plus days +1..+7', () => {
    const specs = one()
    const rem = ofKind(specs, 'reminder')
    const last = ofKind(specs, 'lastChance')
    expect(rem.map((s) => s.at)).toEqual(DAYS.map((d) => atTime(NOW, d, 19)))
    expect(last.map((s) => s.at)).toEqual(DAYS.map((d) => atTime(NOW, d, 22, 30)))
    expect(rem.map((s) => s.id)).toEqual(DAYS.map((d) => notifId(0, 'reminder', d)))
    expect(last.map((s) => s.id)).toEqual(DAYS.map((d) => notifId(0, 'lastChance', d)))
    for (const s of specs) {
      expect(s.habitId).toBe('a')
      expect(s.largeIconTier).toBe(5)
      expect(s.title).not.toMatch(placeholder)
      expect(s.body).not.toMatch(placeholder)
      expect(s.title.length).toBeGreaterThan(0)
      expect(s.body.length).toBeGreaterThan(0)
    }
  })

  it('today done: nothing for today, future days still scheduled', () => {
    const specs = one({ todayMinutes: 120 })
    expect(ofKind(specs, 'reminder').map((s) => s.at)).toEqual(DAYS.slice(1).map((d) => atTime(NOW, d, 19)))
    expect(ofKind(specs, 'lastChance').map((s) => s.at)).toEqual(DAYS.slice(1).map((d) => atTime(NOW, d, 22, 30)))
  })

  it('now 23:00: nothing for today', () => {
    const late = atTime(NOW, 0, 23)
    const specs = one({}, late)
    expect(specs.every((s) => s.at !== null && s.at > late)).toBe(true)
    expect(specs.some((s) => dayKey(s.at!) === dayKey(late))).toBe(false)
    expect(ofKind(specs, 'reminder')).toHaveLength(7)
  })

  it('reminder already past but lastChance still ahead today', () => {
    const specs = one({}, atTime(NOW, 0, 20))
    expect(ofKind(specs, 'reminder')).toHaveLength(7)
    expect(ofKind(specs, 'lastChance')[0].at).toBe(atTime(NOW, 0, 22, 30))
  })

  it('missedYesterday before 08:00 schedules missed at 08:00 today; at/after 08:00 none today', () => {
    const early = atTime(NOW, 0, 6)
    const missed = onDay(ofKind(one({ missedYesterday: true, rank: 3 }, early), 'missed'), early, 0)
    expect(missed).toHaveLength(1)
    expect(missed[0].at).toBe(atTime(NOW, 0, 8))
    expect(missed[0].id).toBe(notifId(0, 'missed', 0))
    expect(missed[0].largeIconTier).toBe(3)
    const today = (st: Partial<HabitState>, now: number) => onDay(ofKind(one(st, now), 'missed'), now, 0)
    expect(today({ missedYesterday: true }, atTime(NOW, 0, 8))).toHaveLength(0)
    expect(today({ missedYesterday: true }, NOW)).toHaveLength(0)
    expect(today({ missedYesterday: false }, early)).toHaveLength(0)
  })

  it('running session: ongoing running spec and dayComplete at now + remaining', () => {
    const start = atTime(NOW, 0, 11, 30)
    const running: Session = { id: 's1', habitId: 'a', start }
    const specs = one({ todayMinutes: 30 }, NOW, running)
    const run = ofKind(specs, 'running')
    expect(run).toHaveLength(1)
    expect(run[0]).toMatchObject({ at: null, ongoing: true, actionTypeId: 'SESSION', largeIconTier: 5 })
    expect(run[0].id).toBe(notifId(0, 'running', 0))
    expect(run[0].title + run[0].body).toContain('11:30')
    const done = ofKind(specs, 'dayComplete')
    expect(done).toHaveLength(1)
    expect(done[0].at).toBe(addMinutes(NOW, 90).getTime())
    expect(done[0].id).toBe(notifId(0, 'dayComplete', 0))
    expect(done[0].ongoing).toBeFalsy()
    expect(done[0].largeIconTier).toBe(5)
  })

  it('running session with commitment already met: no dayComplete', () => {
    const running: Session = { id: 's1', habitId: 'a', start: atTime(NOW, 0, 9) }
    const specs = one({ todayMinutes: 180 }, NOW, running)
    expect(ofKind(specs, 'running')).toHaveLength(1)
    expect(ofKind(specs, 'dayComplete')).toHaveLength(0)
  })

  it('stale or foreign running session is ignored', () => {
    const stale: Session = { id: 's1', habitId: 'a', start: atTime(NOW, -2, 9) }
    const specs = one({ staleSession: stale }, NOW, stale)
    expect(ofKind(specs, 'running')).toHaveLength(0)
    expect(ofKind(specs, 'dayComplete')).toHaveLength(0)
    const foreign: Session = { id: 's2', habitId: 'zzz', start: atTime(NOW, 0, 11) }
    expect(ofKind(one({}, NOW, foreign), 'running')).toHaveLength(0)
    const ended: Session = { id: 's3', habitId: 'a', start: atTime(NOW, 0, 11), end: atTime(NOW, 0, 11, 30) }
    expect(ofKind(one({}, NOW, ended), 'running')).toHaveLength(0)
  })

  it('a running session for the habit suppresses today reminder/lastChance (replanned on stop)', () => {
    const running: Session = { id: 's1', habitId: 'a', start: atTime(NOW, 0, 11) }
    const specs = one({ todayMinutes: 60 }, atTime(NOW, 0, 18, 30), running) // completes 19:30
    expect(ofKind(specs, 'reminder').some((s) => dayKey(s.at!) === dayKey(NOW))).toBe(false)
    expect(ofKind(specs, 'lastChance').some((s) => dayKey(s.at!) === dayKey(NOW))).toBe(false)
    expect(ofKind(specs, 'reminder')).toHaveLength(7)
  })

  it('no dayComplete when the commitment would only be met after midnight', () => {
    const late = atTime(NOW, 0, 23)
    const running: Session = { id: 's1', habitId: 'a', start: atTime(NOW, 0, 22, 50) }
    const specs = one({ todayMinutes: 10 }, late, running) // 110 min left -> 00:50 tomorrow
    expect(ofKind(specs, 'running')).toHaveLength(1)
    expect(ofKind(specs, 'dayComplete')).toHaveLength(0)
  })

  it('eternal and archived habits produce nothing', () => {
    expect(one({ eternal: true, rank: 10 })).toEqual([])
    expect(one({}, NOW, undefined, makeHabit('a', 1000, { archivedAt: 5 }))).toEqual([])
  })

  it('two habits get slots by createdAt and unique ids', () => {
    const early = atTime(NOW, 0, 6)
    const habits = [makeHabit('b', 2000, { reminderTime: '07:15' }), makeHabit('a', 1000)]
    const running: Session = { id: 's1', habitId: 'b', start: atTime(NOW, 0, 5) }
    const specs = buildSchedule({
      habits,
      states: {
        a: makeState('a', early, { missedYesterday: true }),
        b: makeState('b', early, { missedYesterday: true }),
      },
      running,
      now: early,
    })
    const ids = specs.map((s) => s.id)
    expect(new Set(ids).size).toBe(ids.length)
    expect(specs.filter((s) => s.habitId === 'a').every((s) => s.id < 1000)).toBe(true)
    expect(specs.filter((s) => s.habitId === 'b').every((s) => s.id >= 1000)).toBe(true)
    expect(ofKind(specs, 'running')[0].habitId).toBe('b')
    expect(onDay(ofKind(specs, 'missed'), early, 0)).toHaveLength(2)
    // b is running, so its first reminder is tomorrow at its own 07:15
    expect(ofKind(specs, 'reminder').find((s) => s.habitId === 'b')!).toMatchObject({
      id: notifId(1, 'reminder', 1),
      at: atTime(NOW, 1, 7, 15),
    })
    expect(ofKind(specs, 'reminder').find((s) => s.habitId === 'a')!.at).toBe(atTime(NOW, 0, 19))
  })

  it('archived/eternal habits do not take a slot', () => {
    const habits = [makeHabit('x', 500, { archivedAt: 1 }), makeHabit('y', 600), makeHabit('a', 1000)]
    const states = { a: makeState('a'), x: makeState('x'), y: makeState('y', NOW, { eternal: true }) }
    const specs = buildSchedule({ habits, states, now: NOW })
    expect(specs.length).toBeGreaterThan(0)
    expect(specs.every((s) => s.habitId === 'a' && s.id < 1000)).toBe(true)
  })

  it('lastChance names dropToName = tier max(1, rank-2)', () => {
    // today's lastChance (future days use a projected rank, tested separately); many seeds via habit ids
    const texts = (rank: number) =>
      Array.from({ length: 30 }, (_, i) => {
        const id = `h${i}`
        const specs = buildSchedule({
          habits: [{ ...makeHabit('a'), id }],
          states: { [id]: makeState(id, NOW, { rank, earnedTier: rank }) },
          now: NOW,
        })
        return text(ofKind(onDay(specs, NOW, 0), 'lastChance')[0])
      })
    const r5 = texts(5) // Expert -> Adept
    expect(r5.some((t) => t.includes('Adept'))).toBe(true)
    expect(r5.some((t) => /Novice|Apprentice|Skilled/.test(t))).toBe(false)
    const r3 = texts(3) // Adept -> Novice
    expect(r3.some((t) => t.includes('Novice'))).toBe(true)
  })

  it('future-day copy does not cite today minutes', () => {
    // 30 of 120 done today -> "1h 30m" left today; future days must say the full "2h".
    const specs = one({ todayMinutes: 30 })
    const future = specs.filter((s) => s.at !== null && dayKey(s.at) !== dayKey(NOW))
    expect(future).toHaveLength(21) // reminder + lastChance + missed for each of 7 days
    for (const s of future) expect(s.title + s.body).not.toContain('1h 30m')
  })

  it('future days use the projected rank (each missed day costs 2 tiers)', () => {
    // Expert (earned 5, lost 0), today not done. Day +1: 1 miss -> Adept (drop Novice). Day +2: 2 misses -> Novice.
    const specs = one({ rank: 5, earnedTier: 5, lostTiers: 0, todayMinutes: 0 })
    const d1 = ofKind(onDay(specs, NOW, 1), 'lastChance')[0]
    const d2 = ofKind(onDay(specs, NOW, 2), 'lastChance')[0]
    expect(text(d1)).not.toMatch(/Expert|Skilled|Apprentice/)
    expect(text(d2)).not.toMatch(/Expert|Adept|Skilled|Apprentice/)
    expect(d1.largeIconTier).toBe(5)
    expect(d2.largeIconTier).toBe(5)
  })

  it('projected rank names appear across seeds (day +2 Expert today-not-done -> Novice)', () => {
    const seen = new Set<string>()
    for (let i = 0; i < 40; i++) {
      const id = `h${i}`
      const specs = buildSchedule({
        habits: [{ ...makeHabit('a'), id }],
        states: { [id]: makeState(id, NOW, { rank: 7, earnedTier: 7, lostTiers: 0, todayMinutes: 0 }) },
        now: NOW,
      })
      // day +1: 1 miss -> Expert (5), drop Adept (3); day +2: 2 misses -> Adept (3), drop Novice (1)
      const d1 = text(ofKind(onDay(specs, NOW, 1), 'lastChance')[0])
      const d2 = text(ofKind(onDay(specs, NOW, 2), 'lastChance')[0])
      expect(d1).not.toMatch(/Master|Skilled|Novice/)
      expect(d2).not.toMatch(/Master|Expert|Skilled/)
      for (const n of ['Expert', 'Adept', 'Novice']) if ((d1 + d2).includes(n)) seen.add(n)
    }
    expect(seen.has('Adept')).toBe(true)
  })

  it('projection: today done means one fewer miss before each future day', () => {
    // Master (7), today done, day +2: only day +1 missed -> Expert (5), drop Adept (3)
    const done = text(ofKind(onDay(one({ rank: 7, earnedTier: 7, lostTiers: 0, todayMinutes: 120 }), NOW, 2), 'lastChance')[0])
    expect(done).not.toMatch(/Master|Skilled|Novice/)
  })

  it('schedules a morning-after-miss at 08:00 on each future day', () => {
    const specs = one({ rank: 5, earnedTier: 5, lostTiers: 0, todayMinutes: 0 })
    const missed = ofKind(specs, 'missed')
    expect(missed.map((s) => s.at)).toEqual([1, 2, 3, 4, 5, 6, 7].map((d) => atTime(NOW, d, 8)))
    expect(missed.map((s) => s.id)).toEqual([1, 2, 3, 4, 5, 6, 7].map((d) => notifId(0, 'missed', d)))
    // day +1 follows today's miss: Expert -> Adept. Never names Expert as current.
    expect(text(missed[0])).not.toMatch(/Expert|Novice/)
    // day +3 onward: already Novice before the miss -> no rank lost -> no drop claim
    for (const s of missed.slice(2)) expect(text(s)).not.toMatch(/dropped|tier back|climb back/)
    for (const s of missed) expect(s.largeIconTier).toBe(5)
  })

  it('skips the day +1 morning-after-miss when today is done', () => {
    const missed = ofKind(one({ todayMinutes: 120 }), 'missed')
    expect(missed.map((s) => s.at)).toEqual([2, 3, 4, 5, 6, 7].map((d) => atTime(NOW, d, 8)))
  })

  it('morning-after-miss for a Novice never claims a drop', () => {
    for (let i = 0; i < 40; i++) {
      const id = `h${i}`
      const specs = buildSchedule({
        habits: [{ ...makeHabit('a'), id }],
        states: { [id]: makeState(id, atTime(NOW, 0, 6), { rank: 1, earnedTier: 1, todayMinutes: 0, missedYesterday: true }) },
        now: atTime(NOW, 0, 6),
      })
      const missed = ofKind(specs, 'missed')
      expect(missed).toHaveLength(8)
      for (const s of missed) expect(text(s)).not.toMatch(/dropped|tier back|climb back/)
    }
  })

  it('no reminder when reminderTime is at or after 22:30 (lastChance covers it)', () => {
    const at = (t: string) => one({}, NOW, undefined, makeHabit('a', 1000, { reminderTime: t }))
    expect(ofKind(at('22:45'), 'reminder')).toHaveLength(0)
    expect(ofKind(at('22:45'), 'lastChance')).toHaveLength(8)
    expect(ofKind(at('22:30'), 'reminder')).toHaveLength(0)
    expect(ofKind(at('22:29'), 'reminder')).toHaveLength(8)
  })

  it('clamps horizonDays to 99 so ids never collide', () => {
    const specs = buildSchedule({ habits: [makeHabit('a')], states: { a: makeState('a') }, now: NOW, horizonDays: 500 })
    expect(ofKind(specs, 'reminder')).toHaveLength(100)
    const ids = specs.map((s) => s.id)
    expect(new Set(ids).size).toBe(ids.length)
    expect(Math.max(...ids)).toBeLessThan(1000)
  })

  it('honours horizonDays', () => {
    const specs = buildSchedule({ habits: [makeHabit('a')], states: { a: makeState('a') }, now: NOW, horizonDays: 2 })
    expect(ofKind(specs, 'reminder')).toHaveLength(3)
  })

  it('keeps wall-clock times across a DST change', () => {
    const now = new Date(2027, 2, 27, 12, 0).getTime() // BST starts 2027-03-28
    const specs = one({}, now)
    expect(ofKind(specs, 'reminder')).toHaveLength(8)
    for (const s of ofKind(specs, 'reminder')) expect(format(s.at!, 'HH:mm')).toBe('19:00')
    for (const s of ofKind(specs, 'lastChance')) expect(format(s.at!, 'HH:mm')).toBe('22:30')
  })
})

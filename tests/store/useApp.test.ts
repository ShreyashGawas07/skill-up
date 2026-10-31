import { beforeEach, describe, expect, it, vi } from 'vitest'
import { addDays, setHours } from 'date-fns'

const sched = vi.hoisted(() => ({
  applySchedule: vi.fn(async (_specs: unknown[]) => {}),
  registerNotificationActions: vi.fn(async () => {}),
}))
vi.mock('@/notify/scheduler', () => sched)
vi.mock('@capacitor/app', () => ({ App: { addListener: vi.fn(async () => ({ remove: async () => {} })) } }))

import { db } from '@/data/db'
import { repo } from '@/data/repo'
import { dayKey, nextDay } from '@/domain/days'
import { STALE_MS } from '@/domain/evaluate'
import type { Habit, Session } from '@/domain/types'
import type { NotifSpec } from '@/notify/plan'
import { setClock, useApp } from '@/store/useApp'

// Mid-winter base: fixtures never cross a DST change.
const BASE = new Date(2026, 0, 5)
const at = (n: number, h = 12) => setHours(addDays(BASE, n), h).getTime()
const k = (n: number) => dayKey(at(n))
let now = at(0)
const S = () => useApp.getState()
const scheduled = (i: number) => sched.applySchedule.mock.calls[i][0] as NotifSpec[]

const habit = (id: string, over: Partial<Habit> = {}): Habit => ({
  id, name: id, icon: 'book', color: '#fff', targetHours: 10000, reminderTime: '19:00',
  createdAt: at(0, 1), commitmentHistory: [{ fromDate: k(0), dailyMinutes: 60 }], ...over,
})
const sess = (habitId: string, n: number, minutes: number): Session => ({
  id: `${habitId}-${n}`, habitId, start: at(n, 2), end: at(n, 2) + minutes * 60000,
})
const input = { name: 'Read', icon: 'book', color: '#0f0', dailyMinutes: 30, targetHours: 100, reminderTime: '20:00' }

beforeEach(async () => {
  await Promise.all(db.tables.map((t) => t.clear()))
  now = at(0)
  setClock(() => now)
  sched.applySchedule.mockClear()
})

describe('useApp', () => {
  it('load() computes states from the seeded DB', async () => {
    await repo.putHabit(habit('a'))
    await repo.putSession(sess('a', 0, 45))
    await repo.putSettings({ theme: 'dark', sound: true, reduceMotion: 'on' })
    await S().load()
    expect(S().habits.map((h) => h.id)).toEqual(['a'])
    expect(S().states.a.todayMinutes).toBe(45)
    expect(S().settings.theme).toBe('dark')
    expect(S().now).toBe(now)
    expect(sched.applySchedule).toHaveBeenCalled()
  })

  it('first load marks events before today as seen; later loads do not', async () => {
    await repo.putHabit(habit('a'))
    await repo.putSession(sess('a', 0, 60))
    await repo.putSession(sess('a', 1, 60))
    now = at(1)
    await S().load()
    const seen = await repo.seenKeys()
    expect(seen.has(`a:DAY_COMPLETE:${k(0)}`)).toBe(true)
    expect(seen.has(`a:DAY_COMPLETE:${k(1)}`)).toBe(false)
    expect(S().queue.map((c) => c.key)).toEqual([`a:DAY_COMPLETE:${k(1)}`])

    // Seen table non-empty: yesterday's unseen events are kept on the next load.
    now = at(2)
    await S().load()
    expect(S().queue.map((c) => c.key)).toEqual([`a:DAY_COMPLETE:${k(1)}`])
  })

  it('start then stop updates sessions, running, and reschedules', async () => {
    await repo.putHabit(habit('a'))
    await S().load()
    sched.applySchedule.mockClear()
    await S().start('a')
    expect(S().running).toMatchObject({ habitId: 'a', start: now })
    expect(S().sessions).toHaveLength(1)
    expect(sched.applySchedule).toHaveBeenCalledTimes(1)
    expect(scheduled(0).some((s) => s.kind === 'running')).toBe(true)

    now += 30 * 60000
    await S().stop()
    expect(S().running).toBeUndefined()
    expect(S().sessions[0].end).toBe(now)
    expect(S().states.a.todayMinutes).toBe(30)
    expect(sched.applySchedule).toHaveBeenCalledTimes(2)
    expect(scheduled(1).some((s) => s.kind === 'running')).toBe(false)
  })

  it('start on an archived or eternal habit is a no-op', async () => {
    await repo.putHabit(habit('a', { archivedAt: at(0) }))
    await repo.putHabit(habit('e', { targetHours: 1 }))
    await repo.putSession(sess('e', 0, 120))
    await S().load()
    expect(S().states.e.eternal).toBe(true)
    await S().start('a')
    await S().start('e')
    expect(await repo.openSession()).toBeUndefined()
  })

  it('start/stop swallow StaleSessionError and expose staleSession; resolveStale closes it', async () => {
    await repo.putHabit(habit('a'))
    await repo.putHabit(habit('b'))
    const open: Session = { id: 'open', habitId: 'a', start: at(0, 2) }
    await repo.putSession(open)
    now = at(0, 2) + STALE_MS + 60000
    await S().load()
    await expect(S().start('b')).resolves.toBeUndefined()
    await expect(S().stop()).resolves.toBeUndefined()
    expect(S().states.a.staleSession).toEqual(open)
    expect(await repo.openSession()).toEqual(open)

    await S().resolveStale(at(0, 3))
    expect((await repo.listSessions('a'))[0].end).toBe(at(0, 3))
    expect(S().states.a.staleSession).toBeUndefined()
    // Nothing stale any more: no-op.
    await S().resolveStale(at(0, 4))
    expect((await repo.listSessions('a'))[0].end).toBe(at(0, 3))
  })

  it('resolveStale clamps endAt to now', async () => {
    await repo.putHabit(habit('a'))
    await repo.putSession({ id: 'open', habitId: 'a', start: at(0, 2) })
    now = at(0, 2) + STALE_MS + 1
    await S().load()
    now = at(0, 2) + STALE_MS - 1000 // clock moved back; an endAt later than now is clamped
    await S().resolveStale(at(0, 2) + STALE_MS)
    expect((await repo.listSessions('a'))[0].end).toBe(now)
  })

  it('dismiss removes from queue and persists via markSeen', async () => {
    await repo.putHabit(habit('a'))
    await repo.putSession(sess('a', 0, 60))
    await S().load()
    const key = `a:DAY_COMPLETE:${k(0)}`
    expect(S().queue.map((c) => c.key)).toContain(key)
    await S().dismiss(key)
    expect(S().queue.map((c) => c.key)).not.toContain(key)
    expect((await repo.seenKeys()).has(key)).toBe(true)
    S().tick(now + 1000)
    expect(S().queue.map((c) => c.key)).not.toContain(key)
  })

  it('tick recomputes states with the new now', async () => {
    await repo.putHabit(habit('a'))
    await S().load()
    await S().start('a')
    S().tick(now + 10 * 60000)
    expect(S().now).toBe(now + 10 * 60000)
    expect(S().states.a.todayMinutes).toBe(10)
  })

  it('addHabit builds the habit and throws when 2 are active', async () => {
    await S().load()
    const h = await S().addHabit(input)
    expect(h).toMatchObject({
      name: 'Read', createdAt: now, targetHours: 100, reminderTime: '20:00',
      commitmentHistory: [{ fromDate: k(0), dailyMinutes: 30 }],
    })
    expect(h).not.toHaveProperty('dailyMinutes')
    expect(h.id).toMatch(/^[0-9a-f-]{36}$/)
    expect(await repo.listHabits()).toHaveLength(1)
    expect(S().states[h.id]).toBeDefined()
    await S().addHabit({ ...input, name: 'Run' })
    await expect(S().addHabit({ ...input, name: 'Third' })).rejects.toThrow('2 habits max')
    expect(await repo.listHabits()).toHaveLength(2)
  })

  it('archived and eternal habits do not count toward the limit', async () => {
    await repo.putHabit(habit('arch', { archivedAt: at(0) }))
    await repo.putHabit(habit('e', { targetHours: 1 }))
    await repo.putSession(sess('e', 0, 120))
    await S().load()
    await S().addHabit(input)
    await S().addHabit(input)
    await expect(S().addHabit(input)).rejects.toThrow('2 habits max')
  })

  it('updateHabit locks daily minutes while forming, patches other fields', async () => {
    await repo.putHabit(habit('a'))
    await S().load()
    await expect(S().updateHabit('a', { dailyMinutes: 90 })).rejects.toThrow(
      'Daily hours are locked during the 30-day forming phase',
    )
    await S().updateHabit('a', { name: 'Guitar', dailyMinutes: 60 })
    expect(S().habits[0].name).toBe('Guitar')
    expect((await repo.listHabits())[0].commitmentHistory).toHaveLength(1)
    expect((await repo.listHabits())[0]).not.toHaveProperty('dailyMinutes')
  })

  it('updateHabit on a formed habit schedules the change from tomorrow, replacing a same-day entry', async () => {
    await repo.putHabit(habit('a'))
    for (let n = 0; n < 30; n++) await repo.putSession(sess('a', n, 60))
    now = at(30)
    await S().load()
    expect(S().states.a.formed).toBe(true)
    await S().updateHabit('a', { dailyMinutes: 90 })
    await S().updateHabit('a', { dailyMinutes: 120 })
    expect((await repo.listHabits())[0].commitmentHistory).toEqual([
      { fromDate: k(0), dailyMinutes: 60 },
      { fromDate: nextDay(k(30)), dailyMinutes: 120 },
    ])
    expect(S().states.a.commitment).toBe(60)
  })

  it('deleteHabit stops its running timer and removes it', async () => {
    await repo.putHabit(habit('a'))
    await repo.putHabit(habit('b'))
    await S().load()
    await S().start('a')
    await S().deleteHabit('a')
    expect(S().running).toBeUndefined()
    expect(S().habits.map((h) => h.id)).toEqual(['b'])
    expect(await repo.listSessions()).toEqual([])
    expect(S().states.a).toBeUndefined()
  })

  it('deleteHabit leaves another habit timer running', async () => {
    await repo.putHabit(habit('a'))
    await repo.putHabit(habit('b'))
    await S().load()
    await S().start('b')
    await S().deleteHabit('a')
    expect(S().running?.habitId).toBe('b')
  })

  it('saveSettings persists', async () => {
    await S().load()
    await S().saveSettings({ theme: 'light', sound: true, reduceMotion: 'off' })
    expect(S().settings.theme).toBe('light')
    expect(await repo.getSettings()).toEqual({ theme: 'light', sound: true, reduceMotion: 'off' })
  })
})

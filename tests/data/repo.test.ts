import { beforeEach, describe, expect, it } from 'vitest'
import { db } from '@/data/db'
import { repo, DEFAULT_SETTINGS } from '@/data/repo'
import type { Habit } from '@/domain/types'

const habit = (id: string, over: Partial<Habit> = {}): Habit => ({
  id, name: 'Guitar', icon: 'g', color: '#fff', targetHours: 66, reminderTime: '19:00',
  createdAt: 1000, commitmentHistory: [{ fromDate: '2026-01-01', dailyMinutes: 30 }], ...over,
})

beforeEach(async () => {
  await Promise.all(db.tables.map((t) => t.clear()))
})

describe('repo', () => {
  it('round-trips habits', async () => {
    await repo.putHabit(habit('a'))
    await repo.putHabit(habit('a', { name: 'Piano' }))
    await repo.putHabit(habit('b'))
    const hs = await repo.listHabits()
    expect(hs).toHaveLength(2)
    expect(hs.find((h) => h.id === 'a')?.name).toBe('Piano')
  })

  it('deleteHabit removes its sessions and seen events', async () => {
    await repo.putHabit(habit('a'))
    await repo.putHabit(habit('b'))
    await repo.putSession({ id: 's1', habitId: 'a', start: 1, end: 2 })
    await repo.putSession({ id: 's2', habitId: 'b', start: 1, end: 2 })
    await repo.markSeen(['RANK_UP:2026-01-01:a', 'DAY_COMPLETE:2026-01-01'])
    await repo.deleteHabit('a')
    expect((await repo.listHabits()).map((h) => h.id)).toEqual(['b'])
    expect((await repo.listSessions()).map((s) => s.id)).toEqual(['s2'])
    expect((await repo.listSessions('a'))).toEqual([])
  })

  it('openSession returns the session with no end', async () => {
    expect(await repo.openSession()).toBeUndefined()
    await repo.putSession({ id: 's1', habitId: 'a', start: 1, end: 2 })
    await repo.putSession({ id: 's2', habitId: 'a', start: 5 })
    expect((await repo.openSession())?.id).toBe('s2')
  })

  it('seen keys', async () => {
    await repo.markSeen(['x', 'y'])
    await repo.markSeen(['y', 'z'])
    expect(await repo.seenKeys()).toEqual(new Set(['x', 'y', 'z']))
  })

  it('settings default and persist', async () => {
    expect(await repo.getSettings()).toEqual(DEFAULT_SETTINGS)
    expect(DEFAULT_SETTINGS).toEqual({ theme: 'system', sound: false, reduceMotion: 'system' })
    await repo.putSettings({ theme: 'dark', sound: true, reduceMotion: 'on' })
    expect(await repo.getSettings()).toEqual({ theme: 'dark', sound: true, reduceMotion: 'on' })
  })
})

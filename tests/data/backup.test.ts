import { beforeEach, describe, expect, it } from 'vitest'
import { db } from '@/data/db'
import { repo } from '@/data/repo'
import { exportBackup, importBackup, parseBackup } from '@/data/backup'
import type { Habit, Session } from '@/domain/types'

const habit = (id: string, over: Partial<Habit> = {}): Habit => ({
  id, name: 'Guitar', icon: 'g', color: '#fff', targetHours: 66, reminderTime: '19:00',
  createdAt: 1000, commitmentHistory: [{ fromDate: '2026-01-01', dailyMinutes: 30 }], ...over,
})
const session = (id: string, habitId: string, over: Partial<Session> = {}): Session => ({
  id, habitId, start: 100, end: 200, ...over,
})
const mk = (over: Record<string, unknown> = {}) => ({
  app: 'skillup', version: 1, exportedAt: 5,
  habits: [habit('a')], sessions: [session('s1', 'a')], seen: ['k'],
  settings: { theme: 'system', sound: false, reduceMotion: 'system' }, ...over,
})
const parse = (o: unknown) => parseBackup(JSON.stringify(o))
const err = (o: unknown) => {
  const r = parse(o)
  expect(r.ok).toBe(false)
  return r.ok ? '' : r.error
}

beforeEach(async () => {
  await Promise.all(db.tables.map((t) => t.clear()))
})

describe('backup', () => {
  it('export -> parse -> import round-trips', async () => {
    await repo.putHabit(habit('a'))
    await repo.putHabit(habit('b', { archivedAt: 9 }))
    await repo.putSession(session('s1', 'a'))
    await repo.putSession(session('s2', 'b', { end: undefined }))
    await repo.markSeen(['k1', 'k2'])
    await repo.putSettings({ theme: 'dark', sound: true, reduceMotion: 'off' })
    const exported = await exportBackup()
    const parsed = parseBackup(JSON.stringify(exported))
    expect(parsed.ok).toBe(true)
    if (!parsed.ok) return
    await Promise.all(db.tables.map((t) => t.clear()))
    await importBackup(parsed.backup)
    const again = await exportBackup()
    const norm = (b: typeof exported) => ({
      ...b, exportedAt: 0, habits: [...b.habits].sort((x, y) => x.id.localeCompare(y.id)),
      sessions: [...b.sessions].sort((x, y) => x.id.localeCompare(y.id)), seen: [...b.seen].sort(),
    })
    expect(norm(again)).toEqual(norm(parsed.backup))
    expect(again.habits).toHaveLength(2)
  })

  it('import replaces existing data', async () => {
    await repo.putHabit(habit('old'))
    const r = parse(mk())
    if (!r.ok) throw new Error(r.error)
    await importBackup(r.backup)
    expect((await repo.listHabits()).map((h) => h.id)).toEqual(['a'])
  })

  it('accepts a valid backup', () => {
    expect(parse(mk()).ok).toBe(true)
  })

  it('rejects bad input with messages', () => {
    expect(parseBackup('not json{').ok).toBe(false)
    expect(err(mk({ app: 'other' }))).toMatch(/app/i)
    expect(err(mk({ version: 2 }))).toMatch(/version/i)
    expect(err(null)).toBeTruthy()
    const { commitmentHistory: _c, ...noCh } = habit('a')
    expect(err(mk({ habits: [noCh] }))).toMatch(/commitmentHistory/)
    expect(err(mk({ sessions: [session('s1', 'a', { start: 200, end: 100 })] }))).toMatch(/end/)
  })

  it('rejects engine-unsafe habits and orphan sessions', () => {
    expect(err(mk({ habits: [habit('a', { targetHours: 0 })] }))).toMatch(/targetHours/)
    expect(err(mk({ habits: [habit('a', { targetHours: 1.5 })] }))).toMatch(/targetHours/)
    expect(err(mk({ habits: [habit('a', { commitmentHistory: [] })] }))).toMatch(/commitmentHistory/)
    for (const m of [10, 735, 20, 0]) {
      expect(err(mk({ habits: [habit('a', { commitmentHistory: [{ fromDate: '2026-01-01', dailyMinutes: m }] })] }))).toMatch(/dailyMinutes/)
    }
    expect(err(mk({ habits: [habit('a'), habit('a')] }))).toMatch(/duplicate/i)
    expect(err(mk({ sessions: [session('s1', 'zzz')] }))).toMatch(/habit/i)
  })

  it('invalid backup leaves db unchanged', async () => {
    await repo.putHabit(habit('keep'))
    const r = parse(mk({ version: 99 }))
    if (r.ok) await importBackup(r.backup)
    expect((await repo.listHabits()).map((h) => h.id)).toEqual(['keep'])
  })
})

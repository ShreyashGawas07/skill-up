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
    await repo.putSession(session('s1', 'a', { end: undefined }))
    await repo.putSession(session('s2', 'b'))
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

  it('rejects an open session (no end) on an archived habit; allows it on an active one', () => {
    const open = session('s1', 'a', { end: undefined })
    expect(err(mk({ habits: [habit('a', { archivedAt: 900 })], sessions: [open] }))).toMatch(/archived/)
    expect(parse(mk({ habits: [habit('a')], sessions: [open] })).ok).toBe(true)
    expect(parse(mk({ habits: [habit('a', { archivedAt: 900 })], sessions: [session('s1', 'a')] })).ok).toBe(true)
  })

  it('failed import rolls back and leaves db unchanged', async () => {
    await repo.putHabit(habit('keep'))
    await repo.putSession(session('k1', 'keep'))
    const bad = {
      app: 'skillup', version: 1, exportedAt: 1, habits: [habit('x')],
      sessions: [session('dup', 'x'), session('dup', 'x')], seen: [],
      settings: { theme: 'system', sound: false, reduceMotion: 'system' },
    } as Parameters<typeof importBackup>[0]
    await expect(importBackup(bad)).rejects.toBeDefined()
    expect((await repo.listHabits()).map((h) => h.id)).toEqual(['keep'])
    expect((await repo.listSessions()).map((x) => x.id)).toEqual(['k1'])
  })

  it('rejects bad habit ids, impossible dates and unsorted history', () => {
    expect(err(mk({ habits: [habit('')], sessions: [] }))).toMatch(/id/)
    expect(err(mk({ habits: [habit('a:b')], sessions: [] }))).toMatch(/id/)
    const ch = (...d: string[]) => d.map((fromDate) => ({ fromDate, dailyMinutes: 30 }))
    expect(err(mk({ habits: [habit('a', { commitmentHistory: ch('2026-02-30') })] }))).toMatch(/fromDate/)
    expect(err(mk({ habits: [habit('a', { commitmentHistory: ch('2026-13-01') })] }))).toMatch(/fromDate/)
    expect(err(mk({ habits: [habit('a', { commitmentHistory: ch('2026-03-01', '2026-02-01') })] }))).toMatch(/sorted/)
    expect(parse(mk({ habits: [habit('a', { commitmentHistory: ch('2026-01-01', '2026-02-01') })] })).ok).toBe(true)
  })

  it('invalid backup leaves db unchanged', async () => {
    await repo.putHabit(habit('keep'))
    const r = parse(mk({ version: 99 }))
    expect(r.ok).toBe(false)
    if (r.ok) await importBackup(r.backup)
    expect((await repo.listHabits()).map((h) => h.id)).toEqual(['keep'])
  })
})

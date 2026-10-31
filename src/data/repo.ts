import { db } from './db'
import type { Habit, Session } from '@/domain/types'

export interface Settings {
  theme: 'system' | 'dark' | 'light'
  sound: boolean
  reduceMotion: 'system' | 'on' | 'off'
}

export const DEFAULT_SETTINGS: Settings = { theme: 'system', sound: false, reduceMotion: 'system' }

export const repo = {
  listHabits: (): Promise<Habit[]> => db.habits.toArray(),
  async putHabit(h: Habit): Promise<void> {
    await db.habits.put(h)
  },
  async deleteHabit(id: string): Promise<void> {
    await db.transaction('rw', db.habits, db.sessions, db.seen, async () => {
      await db.sessions.where('habitId').equals(id).delete()
      await db.seen.where('key').startsWith(`${id}:`).delete()
      await db.habits.delete(id)
    })
  },
  listSessions: (habitId?: string): Promise<Session[]> =>
    habitId === undefined ? db.sessions.toArray() : db.sessions.where('habitId').equals(habitId).toArray(),
  async putSession(s: Session): Promise<void> {
    await db.sessions.put(s)
  },
  async openSession(): Promise<Session | undefined> {
    return (await db.sessions.toArray()).find((s) => s.end === undefined)
  },
  /** Keys are composite `${habitId}:${eventKey}` (habit ids are UUIDs, no ':'). */
  async seenKeys(): Promise<Set<string>> {
    return new Set((await db.seen.toArray()).map((r) => r.key))
  },
  /** Keys must be composite `${habitId}:${eventKey}`; deleteHabit prunes by the `${habitId}:` prefix. */
  async markSeen(keys: string[]): Promise<void> {
    await db.seen.bulkPut(keys.map((key) => ({ key })))
  },
  async getSettings(): Promise<Settings> {
    const row = await db.settings.get('app')
    if (!row) return { ...DEFAULT_SETTINGS }
    return { theme: row.theme, sound: row.sound, reduceMotion: row.reduceMotion }
  },
  async putSettings(s: Settings): Promise<void> {
    await db.settings.put({ id: 'app', theme: s.theme, sound: s.sound, reduceMotion: s.reduceMotion })
  },
}

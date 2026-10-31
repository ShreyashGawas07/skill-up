import Dexie, { type EntityTable } from 'dexie'
import type { Habit, Session } from '@/domain/types'

export interface SeenRow {
  key: string
}
export interface SettingsRow {
  id: 'app'
  theme: 'system' | 'dark' | 'light'
  sound: boolean
  reduceMotion: 'system' | 'on' | 'off'
}

class SkillUpDB extends Dexie {
  habits!: EntityTable<Habit, 'id'>
  sessions!: EntityTable<Session, 'id'>
  seen!: EntityTable<SeenRow, 'key'>
  settings!: EntityTable<SettingsRow, 'id'>
  constructor() {
    super('skillup')
    this.version(1).stores({
      habits: 'id',
      sessions: 'id, habitId, start',
      seen: 'key',
      settings: 'id',
    })
  }
}

export const db = new SkillUpDB()

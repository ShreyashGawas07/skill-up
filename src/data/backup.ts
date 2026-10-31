import { db } from './db'
import { repo, type Settings } from './repo'
import type { Habit, Session } from '@/domain/types'

export interface Backup {
  app: 'skillup'
  version: 1
  exportedAt: number
  habits: Habit[]
  sessions: Session[]
  seen: string[]
  settings: Settings
}

export async function exportBackup(): Promise<Backup> {
  const [habits, sessions, seen, settings] = await Promise.all([
    repo.listHabits(),
    repo.listSessions(),
    repo.seenKeys(),
    repo.getSettings(),
  ])
  return { app: 'skillup', version: 1, exportedAt: Date.now(), habits, sessions, seen: [...seen], settings }
}

type ParseResult = { ok: true; backup: Backup } | { ok: false; error: string }

const isObj = (v: unknown): v is Record<string, unknown> => typeof v === 'object' && v !== null && !Array.isArray(v)
const isStr = (v: unknown): v is string => typeof v === 'string'
const isNum = (v: unknown): v is number => typeof v === 'number' && Number.isFinite(v)
const DAY = /^\d{4}-\d{2}-\d{2}$/

function habitError(h: unknown, i: number): string | null {
  const p = `habits[${i}]`
  if (!isObj(h)) return `${p} is not an object`
  for (const k of ['id', 'name', 'icon', 'color', 'reminderTime'] as const) {
    if (!isStr(h[k])) return `${p}.${k} must be a string`
  }
  if (!isNum(h.createdAt)) return `${p}.createdAt must be a number`
  if (!Number.isInteger(h.targetHours) || (h.targetHours as number) <= 0) {
    return `${p}.targetHours must be a positive integer`
  }
  if (h.archivedAt !== undefined && !isNum(h.archivedAt)) return `${p}.archivedAt must be a number`
  if (!Array.isArray(h.commitmentHistory) || h.commitmentHistory.length === 0) {
    return `${p}.commitmentHistory must be a non-empty array`
  }
  for (const [j, c] of h.commitmentHistory.entries()) {
    if (!isObj(c) || !isStr(c.fromDate) || !DAY.test(c.fromDate)) {
      return `${p}.commitmentHistory[${j}].fromDate must be YYYY-MM-DD`
    }
    const m = c.dailyMinutes
    if (!Number.isInteger(m) || (m as number) < 15 || (m as number) > 720 || (m as number) % 15 !== 0) {
      return `${p}.commitmentHistory[${j}].dailyMinutes must be a multiple of 15 between 15 and 720`
    }
  }
  return null
}

function sessionError(s: unknown, i: number, habitIds: Set<string>): string | null {
  const p = `sessions[${i}]`
  if (!isObj(s)) return `${p} is not an object`
  if (!isStr(s.id) || !isStr(s.habitId)) return `${p}.id and habitId must be strings`
  if (!isNum(s.start)) return `${p}.start must be a number`
  if (s.end !== undefined) {
    if (!isNum(s.end)) return `${p}.end must be a number`
    if (s.end < s.start) return `${p}.end must not be before start`
  }
  if (!habitIds.has(s.habitId)) return `${p} references unknown habit ${s.habitId}`
  return null
}

export function parseBackup(json: string): ParseResult {
  let raw: unknown
  try {
    raw = JSON.parse(json)
  } catch {
    return { ok: false, error: 'File is not valid JSON' }
  }
  const fail = (error: string): ParseResult => ({ ok: false, error })
  if (!isObj(raw)) return fail('Backup must be a JSON object')
  if (raw.app !== 'skillup') return fail('Not a SkillUp backup (app mismatch)')
  if (raw.version !== 1) return fail(`Unsupported backup version ${String(raw.version)}`)
  if (!isNum(raw.exportedAt)) return fail('exportedAt must be a number')
  if (!Array.isArray(raw.habits)) return fail('habits must be an array')
  if (!Array.isArray(raw.sessions)) return fail('sessions must be an array')
  if (!Array.isArray(raw.seen) || !raw.seen.every(isStr)) return fail('seen must be an array of strings')
  const st = raw.settings
  if (
    !isObj(st) ||
    !['system', 'dark', 'light'].includes(st.theme as string) ||
    typeof st.sound !== 'boolean' ||
    !['system', 'on', 'off'].includes(st.reduceMotion as string)
  ) {
    return fail('settings are invalid')
  }

  const ids = new Set<string>()
  for (const [i, h] of raw.habits.entries()) {
    const e = habitError(h, i)
    if (e) return fail(e)
    const id = (h as Habit).id
    if (ids.has(id)) return fail(`duplicate habit id ${id}`)
    ids.add(id)
  }
  const sids = new Set<string>()
  for (const [i, s] of raw.sessions.entries()) {
    const e = sessionError(s, i, ids)
    if (e) return fail(e)
    const id = (s as Session).id
    if (sids.has(id)) return fail(`duplicate session id ${id}`)
    sids.add(id)
  }
  return {
    ok: true,
    backup: {
      app: 'skillup',
      version: 1,
      exportedAt: raw.exportedAt,
      habits: raw.habits as Habit[],
      sessions: raw.sessions as Session[],
      seen: [...new Set(raw.seen as string[])],
      settings: { theme: st.theme, sound: st.sound, reduceMotion: st.reduceMotion } as Settings,
    },
  }
}

export async function importBackup(b: Backup): Promise<void> {
  await db.transaction('rw', db.habits, db.sessions, db.seen, db.settings, async () => {
    await Promise.all([db.habits.clear(), db.sessions.clear(), db.seen.clear(), db.settings.clear()])
    await db.habits.bulkAdd(b.habits)
    await db.sessions.bulkAdd(b.sessions)
    await db.seen.bulkAdd(b.seen.map((key) => ({ key })))
    await db.settings.add({ id: 'app', ...b.settings })
  })
}

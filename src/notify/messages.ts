import type { NotifKind } from './plan'

export interface MsgCtx {
  habit: string
  minutesLeft: number
  streak: number
  formingDay?: number
  rankName: string
  dropToName: string
  startedAt?: string
}

interface Variant {
  title: string
  body: string
}

/**
 * Message pools. Placeholders: {habit} {left} {streak} {day} {rank} {drop} {start}.
 * A variant is only eligible when the context it cites is meaningful:
 * {streak} needs streak > 0, {day} needs formingDay, {start} needs startedAt,
 * {drop} needs dropToName !== rankName, and so do "{rank} rank on the line" / "{rank} is slipping"
 * (a Novice can't drop). The first variant of each kind is the spec §4 copy.
 * Every kind keeps at least one variant with no optional placeholders so a pick always exists.
 */
export const POOLS: Record<NotifKind, Variant[]> = {
  reminder: [
    { title: '🔥 Day {day} of 30', body: 'Your {habit} flame is waiting — {left} to go.' },
    { title: '🛡️ {rank} rank on the line', body: '{left} of {habit}. You’ve got this.' },
    { title: '⚔️ {habit} time', body: '{left} today keeps the grind alive. Start the clock.' },
    { title: '🎯 {left} of {habit}', body: 'Small quest, big XP. Tap in and start.' },
    { title: '🔥 {streak}-day streak', body: 'Feed it. {left} of {habit} and it lives another day.' },
    { title: '🚀 Level up window open', body: '{habit} is calling — {left} to clear today.' },
  ],
  lastChance: [
    { title: '⏳ Last call', body: '{left} left or {habit} drops to {drop}.' },
    { title: '🕛 Your {streak}-day streak ends at midnight', body: '{left} of {habit} saves it. Save it?' },
    { title: '🚨 {rank} is slipping', body: 'Miss today and you fall to {drop}. {left} of {habit} stops it.' },
    { title: '⏳ Clock’s almost out', body: '{left} of {habit} before midnight. Go go go.' },
    { title: '🌙 One more push', body: '{habit} still needs {left}. Finish strong.' },
  ],
  running: [
    { title: '🎧 {habit}', body: '{habit} — session running since {start}' },
    { title: '⏱️ {habit} in progress', body: 'Locked in since {start}. Keep going.' },
    { title: '🔥 {habit} live', body: 'Grinding since {start}. Every minute counts.' },
    { title: '🎧 {habit}', body: 'Session running. Stay in the zone.' },
  ],
  dayComplete: [
    { title: '✅ {left} done', body: 'Streak {streak} 🔥 — anything more is overtime glory.' },
    { title: '🏆 {habit} cleared for today', body: '{left} in the bag. Keep going for bonus XP.' },
    { title: '✅ Quest complete', body: '{habit} done for today. Streak {streak} 🔥' },
    { title: '💪 {left} of {habit} — done', body: 'Day secured. Overtime counts toward your rank.' },
  ],
  missed: [
    { title: '💔 You dropped to {rank}', body: '7 clean days wins a tier back.' },
    { title: '💔 {habit} missed yesterday', body: 'Comeback arc starts today. {left} to get back on track.' },
    { title: '🩹 Shake it off', body: 'You’re {rank} now. Stack 7 clean days of {habit} to climb back.' },
    { title: '🔄 New day, new run', body: '{left} of {habit} today starts the climb back.' },
  ],
}

export function formatLeft(minutes: number): string {
  const m = Math.max(0, Math.round(minutes))
  const h = Math.floor(m / 60)
  const r = m % 60
  if (h === 0) return `${r}m`
  return r === 0 ? `${h}h` : `${h}h ${r}m`
}

/** FNV-1a 32-bit, unsigned. */
export function hashSeed(seed: string): number {
  let h = 0x811c9dc5
  for (let i = 0; i < seed.length; i++) {
    h ^= seed.charCodeAt(i)
    h = Math.imul(h, 0x01000193)
  }
  return h >>> 0
}

function eligible(v: Variant, ctx: MsgCtx): boolean {
  const t = v.title + v.body
  if (t.includes('{streak}') && !(ctx.streak > 0)) return false
  if (t.includes('{day}') && ctx.formingDay === undefined) return false
  if (t.includes('{start}') && !ctx.startedAt) return false
  if (t.includes('{drop}') && ctx.dropToName === ctx.rankName) return false
  // "{rank} on the line / slipping" only means something if a drop is possible.
  if (/\{rank\} (rank on the line|is slipping)/.test(t) && ctx.dropToName === ctx.rankName) return false
  return true
}

function fill(s: string, ctx: MsgCtx): string {
  const values: Record<string, string> = {
    habit: ctx.habit,
    left: formatLeft(ctx.minutesLeft),
    streak: String(ctx.streak),
    day: String(ctx.formingDay ?? ''),
    rank: ctx.rankName,
    drop: ctx.dropToName,
    start: ctx.startedAt ?? '',
  }
  return s.replace(/\{(\w+)\}/g, (_, k: string) => values[k] ?? '')
}

export function pickMessage(kind: NotifKind, ctx: MsgCtx, seed: string): { title: string; body: string } {
  const pool = POOLS[kind].filter((v) => eligible(v, ctx))
  const v = pool[hashSeed(seed) % pool.length]
  return { title: fill(v.title, ctx), body: fill(v.body, ctx) }
}

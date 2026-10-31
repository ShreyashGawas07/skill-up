import type { AppEvent, EventType } from '@/domain/types'

export type CelebrationKind =
  | 'dayComplete'
  | 'overtime'
  | 'streak'
  | 'rankUp'
  | 'rankLost'
  | 'rankRecovered'
  | 'streakReset'
  | 'formed'
  | 'eternal'

export interface Celebration {
  /** Composite `${habitId}:${event.key}`; the same key is persisted as seen on dismiss. */
  key: string
  kind: CelebrationKind
  habitId: string
  value?: number
  fullScreen: boolean
}

const KIND: Record<EventType, CelebrationKind> = {
  DAY_COMPLETE: 'dayComplete',
  OVERTIME: 'overtime',
  STREAK_MILESTONE: 'streak',
  RANK_UP: 'rankUp',
  RANK_LOST: 'rankLost',
  RANK_RECOVERED: 'rankRecovered',
  STREAK_RESET: 'streakReset',
  HABIT_FORMED: 'formed',
  ETERNAL: 'eternal',
}

const ORDER: CelebrationKind[] = [
  'rankLost', 'streakReset', 'rankRecovered', 'dayComplete', 'overtime', 'streak', 'rankUp', 'formed', 'eternal',
]

/** Inline card effects; everything else gets a full-screen moment. */
const INLINE = new Set<CelebrationKind>(['dayComplete', 'overtime'])

export const celebrationKey = (e: AppEvent) => `${e.habitId}:${e.key}`

/**
 * Unseen events as an ordered celebration queue. Duplicate keys keep the latest event (so a
 * running session's growing OVERTIME collapses to one entry per day, with the newest value).
 */
export function toCelebrations(events: AppEvent[], seen: Set<string>): Celebration[] {
  const latest = new Map<string, AppEvent>()
  for (const e of events) {
    const key = celebrationKey(e)
    if (seen.has(key)) continue
    latest.set(key, e) // Map keeps the first-appearance position; the value becomes the newest event
  }
  const out: Celebration[] = []
  for (const [key, e] of latest) {
    const kind = KIND[e.type]
    const c: Celebration = { key, kind, habitId: e.habitId, fullScreen: !INLINE.has(kind) }
    if (e.value !== undefined) c.value = e.value
    out.push(c)
  }
  return out.sort((a, b) => ORDER.indexOf(a.kind) - ORDER.indexOf(b.kind))
}

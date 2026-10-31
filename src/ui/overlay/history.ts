import { FORMING_DAYS } from '@/domain/evaluate'
import { MAX_TIER } from '@/domain/tiers'
import type { AppEvent, HabitState } from '@/domain/types'

const RANK_EVENTS = new Set(['RANK_UP', 'RANK_LOST', 'RANK_RECOVERED'])

/** Index of the event behind a celebration (key `${habitId}:${event.key}`), or -1. */
function indexOf(events: AppEvent[], celebrationKey: string): number {
  return events.findIndex((e) => `${e.habitId}:${e.key}` === celebrationKey)
}

/**
 * Rank shown just before a rank event. Every rank change emits a rank event, so the last one
 * before this event holds the previous rank (1 if none). Undefined when the event isn't in the
 * habit's replayed history.
 */
export function rankBefore(state: HabitState | undefined, celebrationKey: string): number | undefined {
  const events = state?.events ?? []
  const i = indexOf(events, celebrationKey)
  if (i < 0) return undefined
  for (let j = i - 1; j >= 0; j--) {
    const e = events[j]
    if (RANK_EVENTS.has(e.type) && e.value !== undefined) return e.value
  }
  return 1
}

/** Rank before a RANK_LOST; falls back to two tiers above (the miss penalty), capped at the earned tier. */
export function rankBeforeLoss(state: HabitState | undefined, celebrationKey: string, value: number): number {
  const known = rankBefore(state, celebrationKey)
  if (known !== undefined) return known
  return Math.max(value, Math.min(MAX_TIER, value + 2, state?.earnedTier ?? MAX_TIER))
}

/** Forming beads filled just before a STREAK_RESET drained them (done days since the last reset). */
export function beadsBefore(state: HabitState | undefined, celebrationKey: string): number {
  const events = state?.events ?? []
  const i = indexOf(events, celebrationKey)
  if (i < 0) return 0
  let n = 0
  for (let j = i - 1; j >= 0; j--) {
    const e = events[j]
    if (e.type === 'STREAK_RESET' || e.type === 'HABIT_FORMED') break
    if (e.type === 'DAY_COMPLETE') n++
  }
  return Math.min(FORMING_DAYS - 1, n)
}

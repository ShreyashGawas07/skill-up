import { repo } from '@/data/repo'
import { STALE_MS } from '@/domain/evaluate'
import type { Session } from '@/domain/types'

/** An open session (no end) that has run longer than STALE_MS — likely a forgotten timer. */
export function isStale(s: Session, now: number): boolean {
  return s.end === undefined && now - s.start > STALE_MS
}

/**
 * Starts a timer for `habitId`. Only one timer runs at a time: a timer running for another
 * habit is stopped at `now` and returned as `stopped`. Starting the running habit again is a
 * no-op that returns the existing session.
 */
export async function startTimer(
  habitId: string,
  now: number,
): Promise<{ started: Session; stopped?: Session }> {
  const open = await repo.openSession()
  if (open?.habitId === habitId) return { started: open }
  const stopped = open ? await stopTimer(now) : undefined
  const started: Session = { id: crypto.randomUUID(), habitId, start: now }
  await repo.putSession(started)
  return stopped ? { started, stopped } : { started }
}

/** Stops the running timer at `now`; returns the closed session, or undefined if none ran. */
export async function stopTimer(now: number): Promise<Session | undefined> {
  const open = await repo.openSession()
  if (!open) return undefined
  const closed: Session = { ...open, end: now }
  await repo.putSession(closed)
  return closed
}

/** Closes a forgotten session at `endAt`, which must lie in [start, start + STALE_MS]. */
export async function resolveStale(session: Session, endAt: number): Promise<void> {
  if (endAt < session.start || endAt > session.start + STALE_MS) {
    throw new RangeError(`endAt must be within [start, start + ${STALE_MS}ms]`)
  }
  await repo.putSession({ ...session, end: endAt })
}

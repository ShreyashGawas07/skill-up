import { db } from '@/data/db'
import { repo } from '@/data/repo'
import { isStale, STALE_MS } from '@/domain/evaluate'
import type { Session } from '@/domain/types'

export { isStale }

/** Thrown when a forgotten (stale) session is open; resolve it with resolveStale first. */
export class StaleSessionError extends Error {
  constructor(readonly session: Session) {
    super('A stale session is open; resolve it before starting or stopping a timer')
    this.name = 'StaleSessionError'
  }
}

/** Reads the open session inside the current transaction; throws (writing nothing) if it is stale. */
async function freshOpenSession(now: number): Promise<Session | undefined> {
  const open = await repo.openSession()
  if (open && isStale(open, now)) throw new StaleSessionError(open)
  return open
}

/**
 * Starts a timer for `habitId`. Only one timer runs at a time: a timer running for another
 * habit is stopped at `now` and returned as `stopped`. Starting the running habit again is a
 * no-op that returns the existing session. Throws StaleSessionError if the open session is stale.
 */
export function startTimer(habitId: string, now: number): Promise<{ started: Session; stopped?: Session }> {
  return db.transaction('rw', db.sessions, async () => {
    const open = await freshOpenSession(now)
    if (open?.habitId === habitId) return { started: open }
    let stopped: Session | undefined
    if (open) {
      stopped = { ...open, end: now }
      await repo.putSession(stopped)
    }
    const started: Session = { id: crypto.randomUUID(), habitId, start: now }
    await repo.putSession(started)
    return stopped ? { started, stopped } : { started }
  })
}

/**
 * Stops the running timer at `now`; returns the closed session, or undefined if none ran.
 * Throws StaleSessionError if the open session is stale.
 */
export function stopTimer(now: number): Promise<Session | undefined> {
  return db.transaction('rw', db.sessions, async () => {
    const open = await freshOpenSession(now)
    if (!open) return undefined
    const closed: Session = { ...open, end: now }
    await repo.putSession(closed)
    return closed
  })
}

/**
 * Closes a forgotten session at `endAt`, which must lie in [start, start + STALE_MS].
 * Throws if `endAt` is out of range or the stored session is missing or already ended.
 */
export async function resolveStale(session: Session, endAt: number): Promise<void> {
  await db.transaction('rw', db.sessions, async () => {
    const stored = await db.sessions.get(session.id)
    if (!stored || stored.end !== undefined) throw new Error(`Session ${session.id} is not open`)
    if (endAt < stored.start || endAt > stored.start + STALE_MS) {
      throw new RangeError(`endAt must be within [start, start + ${STALE_MS}ms]`)
    }
    await repo.putSession({ ...stored, end: endAt })
  })
}

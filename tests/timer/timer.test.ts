import { beforeEach, describe, expect, it } from 'vitest'
import { db } from '@/data/db'
import { repo } from '@/data/repo'
import { STALE_MS } from '@/domain/evaluate'
import { isStale as domainIsStale } from '@/domain/evaluate'
import { isStale, resolveStale, StaleSessionError, startTimer, stopTimer } from '@/timer/timer'

beforeEach(async () => {
  await Promise.all(db.tables.map((t) => t.clear()))
})

describe('timer', () => {
  it('start creates an open session', async () => {
    const { started, stopped } = await startTimer('a', 1000)
    expect(stopped).toBeUndefined()
    expect(started).toMatchObject({ habitId: 'a', start: 1000 })
    expect(started.end).toBeUndefined()
    expect(typeof started.id).toBe('string')
    expect(await repo.openSession()).toEqual(started)
  })

  it('starting habit B while A runs stops A at now', async () => {
    const { started: a } = await startTimer('a', 1000)
    const { started: b, stopped } = await startTimer('b', 5000)
    expect(stopped).toEqual({ ...a, end: 5000 })
    expect(b).toMatchObject({ habitId: 'b', start: 5000 })
    expect(b.id).not.toBe(a.id)
    expect((await repo.listSessions('a'))[0]).toEqual({ ...a, end: 5000 })
    expect((await repo.openSession())?.id).toBe(b.id)
    expect(await repo.listSessions()).toHaveLength(2)
  })

  it('starting the same habit again is a no-op returning the existing session', async () => {
    const { started: first } = await startTimer('a', 1000)
    const again = await startTimer('a', 9000)
    expect(again).toEqual({ started: first })
    expect(await repo.listSessions()).toEqual([first])
  })

  it('stop closes the open session', async () => {
    const { started } = await startTimer('a', 1000)
    const stopped = await stopTimer(4000)
    expect(stopped).toEqual({ ...started, end: 4000 })
    expect(await repo.openSession()).toBeUndefined()
    expect(await repo.listSessions()).toEqual([{ ...started, end: 4000 }])
  })

  it('stop with nothing running returns undefined', async () => {
    expect(await stopTimer(1000)).toBeUndefined()
  })

  it('isStale only for open sessions older than STALE_MS', () => {
    const s = { id: 's', habitId: 'a', start: 0 }
    expect(isStale(s, STALE_MS)).toBe(false)
    expect(isStale(s, STALE_MS + 1)).toBe(true)
    expect(isStale({ ...s, end: 10 }, STALE_MS * 10)).toBe(false)
  })

  it('isStale is the domain rule', () => {
    expect(isStale).toBe(domainIsStale)
  })

  describe('stale open session', () => {
    const stale = { id: 'old', habitId: 'a', start: 0 }
    const now = STALE_MS + 1
    beforeEach(async () => {
      await repo.putSession(stale)
    })

    it('startTimer throws StaleSessionError carrying the session and writes nothing', async () => {
      for (const habitId of ['a', 'b']) {
        const err = await startTimer(habitId, now).catch((e: unknown) => e)
        expect(err).toBeInstanceOf(StaleSessionError)
        expect((err as StaleSessionError).session).toEqual(stale)
      }
      expect(await repo.listSessions()).toEqual([stale])
    })

    it('stopTimer throws StaleSessionError and writes nothing', async () => {
      const err = await stopTimer(now).catch((e: unknown) => e)
      expect(err).toBeInstanceOf(StaleSessionError)
      expect((err as StaleSessionError).session).toEqual(stale)
      expect(await repo.listSessions()).toEqual([stale])
    })

    it('after resolveStale a new timer can start', async () => {
      await resolveStale(stale, 3600_000)
      const { started, stopped } = await startTimer('b', now)
      expect(stopped).toBeUndefined()
      expect(started.habitId).toBe('b')
      expect((await repo.listSessions('a'))[0].end).toBe(3600_000)
    })
  })

  describe('resolveStale', () => {
    const start = 1_000_000
    const s = { id: 's', habitId: 'a', start }
    beforeEach(async () => {
      await repo.putSession(s)
    })

    it('rejects endAt beyond start+16h', async () => {
      await expect(resolveStale(s, start + STALE_MS + 1)).rejects.toThrow()
      expect(await repo.openSession()).toEqual(s)
    })

    it('rejects endAt before start', async () => {
      await expect(resolveStale(s, start - 1)).rejects.toThrow()
      expect(await repo.openSession()).toEqual(s)
    })

    it('accepts a valid trim', async () => {
      await resolveStale(s, start + 2 * 3600_000)
      expect(await repo.openSession()).toBeUndefined()
      expect(await repo.listSessions()).toEqual([{ ...s, end: start + 2 * 3600_000 }])
    })

    it('accepts the lower bound', async () => {
      await resolveStale(s, start)
      expect((await repo.listSessions())[0].end).toBe(start)
    })

    it('accepts the upper bound', async () => {
      await resolveStale(s, start + STALE_MS)
      expect((await repo.listSessions())[0].end).toBe(start + STALE_MS)
    })

    it('rejects a session that was already ended', async () => {
      await repo.putSession({ ...s, end: start + 10 })
      await expect(resolveStale(s, start + 20)).rejects.toThrow()
      expect((await repo.listSessions())[0].end).toBe(start + 10)
    })

    it('rejects a session that is missing', async () => {
      await expect(resolveStale({ ...s, id: 'gone' }, start + 20)).rejects.toThrow()
      expect(await repo.listSessions()).toEqual([s])
    })
  })
})

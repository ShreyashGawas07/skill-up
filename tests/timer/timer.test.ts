import { beforeEach, describe, expect, it } from 'vitest'
import { db } from '@/data/db'
import { repo } from '@/data/repo'
import { STALE_MS } from '@/domain/evaluate'
import { isStale, resolveStale, startTimer, stopTimer } from '@/timer/timer'

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

    it('accepts both bounds', async () => {
      await resolveStale(s, start)
      expect((await repo.listSessions())[0].end).toBe(start)
      await resolveStale(s, start + STALE_MS)
      expect((await repo.listSessions())[0].end).toBe(start + STALE_MS)
    })
  })
})

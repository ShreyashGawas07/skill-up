import { describe, it, expect } from 'vitest'
import { formatLeft, hashSeed, pickMessage, POOLS } from '@/notify/messages'
import type { MsgCtx } from '@/notify/messages'
import type { NotifKind } from '@/notify/plan'

const KINDS: NotifKind[] = ['reminder', 'lastChance', 'running', 'dayComplete', 'missed']
const placeholder = /\{\w+\}/

const full: MsgCtx = {
  habit: 'Japanese',
  minutesLeft: 90,
  streak: 23,
  formingDay: 12,
  rankName: 'Expert',
  dropToName: 'Adept',
  startedAt: '18:12',
}
const sparse: MsgCtx = { habit: 'Japanese', minutesLeft: 120, streak: 0, rankName: 'Novice', dropToName: 'Novice' }

describe('formatLeft', () => {
  it('formats minutes as h/m', () => {
    expect(formatLeft(90)).toBe('1h 30m')
    expect(formatLeft(120)).toBe('2h')
    expect(formatLeft(45)).toBe('45m')
    expect(formatLeft(0)).toBe('0m')
  })
})

describe('pickMessage', () => {
  it('each kind has at least 4 variants', () => {
    for (const k of KINDS) expect(POOLS[k].length).toBeGreaterThanOrEqual(4)
  })

  it('first variants carry the spec example copy', () => {
    const first = (k: NotifKind) => POOLS[k][0].title + ' ' + POOLS[k][0].body
    expect(first('reminder')).toContain('flame is waiting')
    expect(first('lastChance')).toContain('⏳')
    expect(first('running')).toContain('session running since {start}')
    expect(first('dayComplete')).toContain('overtime glory')
    expect(first('missed')).toContain('You dropped to {rank}')
  })

  it('same seed gives the same variant', () => {
    for (const k of KINDS) expect(pickMessage(k, full, 'a2026-11-01' + k)).toEqual(pickMessage(k, full, 'a2026-11-01' + k))
  })

  it('different day seeds rotate', () => {
    for (const k of KINDS) {
      const seen = new Set<string>()
      for (let d = 1; d <= 7; d++) {
        const m = pickMessage(k, full, `a2026-11-0${d}${k}`)
        seen.add(m.title + m.body)
      }
      expect(seen.size).toBeGreaterThan(1)
    }
  })

  it('never leaves an unfilled placeholder, with full or sparse context', () => {
    for (const k of KINDS)
      for (const ctx of [full, sparse])
        for (let i = 0; i < 200; i++) {
          const m = pickMessage(k, ctx, `seed${i}`)
          expect(m.title).not.toMatch(placeholder)
          expect(m.body).not.toMatch(placeholder)
          expect(m.title + m.body).not.toContain('undefined')
        }
  })

  it('fills context values', () => {
    const texts = Array.from({ length: 50 }, (_, i) => pickMessage('lastChance', full, `s${i}`)).map(
      (m) => m.title + ' ' + m.body,
    )
    expect(texts.some((t) => t.includes('1h 30m'))).toBe(true)
    expect(texts.some((t) => t.includes('Adept'))).toBe(true)
    expect(texts.some((t) => t.includes('23-day'))).toBe(true)
  })

  it('skips variants whose context is missing or meaningless', () => {
    for (let i = 0; i < 100; i++) {
      const m = pickMessage('lastChance', sparse, `s${i}`)
      expect(m.title + m.body).not.toMatch(/Novice|0-day/)
      const r = pickMessage('reminder', sparse, `s${i}`)
      expect(r.title + r.body).not.toMatch(/Day \d+ of/)
    }
  })

  it('hashSeed is deterministic and unsigned', () => {
    expect(hashSeed('abc')).toBe(hashSeed('abc'))
    expect(hashSeed('abc')).not.toBe(hashSeed('abd'))
    expect(hashSeed('anything')).toBeGreaterThanOrEqual(0)
  })
})

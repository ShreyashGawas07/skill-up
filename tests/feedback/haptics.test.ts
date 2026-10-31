import { describe, expect, it, vi } from 'vitest'

const H = vi.hoisted(() => ({
  impact: vi.fn(async (_o: unknown) => {}),
  notification: vi.fn(async (_o: unknown) => {}),
}))
vi.mock('@capacitor/haptics', () => ({
  Haptics: H,
  ImpactStyle: { Light: 'LIGHT', Heavy: 'HEAVY' },
  NotificationType: { Success: 'SUCCESS', Warning: 'WARNING' },
}))

import { haptic } from '@/feedback/haptics'

describe('haptic', () => {
  it('maps to Capacitor haptics', () => {
    haptic.tick()
    haptic.heavy()
    haptic.success()
    haptic.warn()
    expect(H.impact.mock.calls.map((c) => c[0])).toEqual([{ style: 'LIGHT' }, { style: 'HEAVY' }])
    expect(H.notification.mock.calls.map((c) => c[0])).toEqual([{ type: 'SUCCESS' }, { type: 'WARNING' }])
  })

  it('swallows sync and async errors', async () => {
    H.impact.mockRejectedValueOnce(new Error('no vibrate'))
    H.notification.mockImplementationOnce(() => {
      throw new Error('unimplemented')
    })
    expect(() => haptic.tick()).not.toThrow()
    expect(() => haptic.success()).not.toThrow()
    await new Promise((r) => setTimeout(r, 0))
  })
})

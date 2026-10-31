import { beforeEach, describe, expect, it, vi } from 'vitest'

const native = vi.hoisted(() => ({ value: true }))
const LN = vi.hoisted(() => ({
  getPending: vi.fn(),
  cancel: vi.fn(async () => {}),
  schedule: vi.fn(async () => ({ notifications: [] })),
  registerActionTypes: vi.fn(async () => {}),
  addListener: vi.fn(async () => ({ remove: async () => {} })),
  checkPermissions: vi.fn(),
  requestPermissions: vi.fn(),
}))
vi.mock('@capacitor/core', () => ({ Capacitor: { isNativePlatform: () => native.value } }))
vi.mock('@capacitor/local-notifications', () => ({ LocalNotifications: LN }))

import {
  applySchedule, notificationPermission, registerNotificationActions, requestNotificationPermission,
} from '@/notify/scheduler'
import type { NotifSpec } from '@/notify/plan'

beforeEach(() => {
  native.value = true
  Object.values(LN).forEach((f) => f.mockClear())
  LN.getPending.mockResolvedValue({ notifications: [{ id: 7 }, { id: 1003 }] })
})

const spec = (over: Partial<NotifSpec> = {}): NotifSpec => ({
  id: 1, habitId: 'h', kind: 'reminder', at: 5000, title: 'T', body: 'B', largeIconTier: 3, ...over,
})

describe('scheduler', () => {
  it('cancels all pending before scheduling', async () => {
    await applySchedule([spec()])
    expect(LN.cancel).toHaveBeenCalledWith({ notifications: [{ id: 7 }, { id: 1003 }] })
    expect(LN.cancel.mock.invocationCallOrder[0]).toBeLessThan(LN.schedule.mock.invocationCallOrder[0])
  })

  it('maps specs to Capacitor notifications', async () => {
    await applySchedule([
      spec(),
      spec({ id: 2, kind: 'running', at: null, ongoing: true, actionTypeId: 'SESSION', largeIconTier: 5 }),
    ])
    const [{ notifications }] = LN.schedule.mock.calls[0] as unknown as [{ notifications: Record<string, unknown>[] }]
    expect(notifications[0]).toEqual({
      id: 1, title: 'T', body: 'B', smallIcon: 'ic_stat_flame', largeIcon: 'rank_3',
      schedule: { at: new Date(5000), allowWhileIdle: true }, extra: { habitId: 'h', kind: 'reminder' },
    })
    expect(notifications[1]).toMatchObject({ id: 2, ongoing: true, autoCancel: false, actionTypeId: 'SESSION', largeIcon: 'rank_5' })
    expect(notifications[1].schedule).toBeUndefined()
  })

  it('with no specs only cancels', async () => {
    await applySchedule([])
    expect(LN.cancel).toHaveBeenCalled()
    expect(LN.schedule).not.toHaveBeenCalled()
  })

  it('is a no-op on web', async () => {
    native.value = false
    await applySchedule([spec()])
    await registerNotificationActions(() => {})
    expect(LN.getPending).not.toHaveBeenCalled()
    expect(LN.schedule).not.toHaveBeenCalled()
    expect(LN.registerActionTypes).not.toHaveBeenCalled()
    expect(await notificationPermission()).toBe('denied')
    expect(await requestNotificationPermission()).toBe(false)
  })

  it('registers SESSION/STOP and calls onStop for that action', async () => {
    const onStop = vi.fn()
    await registerNotificationActions(onStop)
    expect(LN.registerActionTypes).toHaveBeenCalledWith({
      types: [{ id: 'SESSION', actions: [{ id: 'STOP', title: 'Stop' }] }],
    })
    const handler = (LN.addListener.mock.calls[0] as unknown as [string, (a: unknown) => void])[1]
    handler({ actionId: 'tap', notification: {} })
    expect(onStop).not.toHaveBeenCalled()
    handler({ actionId: 'STOP', notification: {} })
    expect(onStop).toHaveBeenCalledOnce()
  })

  it('maps permission states', async () => {
    LN.checkPermissions.mockResolvedValueOnce({ display: 'prompt-with-rationale' })
    expect(await notificationPermission()).toBe('prompt')
    LN.checkPermissions.mockResolvedValueOnce({ display: 'granted' })
    expect(await notificationPermission()).toBe('granted')
    LN.requestPermissions.mockResolvedValueOnce({ display: 'granted' })
    expect(await requestNotificationPermission()).toBe(true)
  })
})

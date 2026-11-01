import { beforeEach, describe, expect, it, vi } from 'vitest'

const native = vi.hoisted(() => ({ value: true }))
const LN = vi.hoisted(() => ({
  getPending: vi.fn(),
  getDeliveredNotifications: vi.fn(),
  cancel: vi.fn(async () => {}),
  schedule: vi.fn(async () => ({ notifications: [] })),
  registerActionTypes: vi.fn(async () => {}),
  addListener: vi.fn(async () => ({ remove: async () => {} })),
  checkPermissions: vi.fn(),
  requestPermissions: vi.fn(),
  checkExactNotificationSetting: vi.fn(),
  changeExactNotificationSetting: vi.fn(async () => ({ exact_alarm: 'granted' })),
}))
vi.mock('@capacitor/core', () => ({ Capacitor: { isNativePlatform: () => native.value } }))
vi.mock('@capacitor/local-notifications', () => ({ LocalNotifications: LN }))

import {
  __resetSchedulerForTests, applySchedule, exactAlarmStatus, notificationPermission, openExactAlarmSetting, registerNotificationActions,
  requestNotificationPermission,
} from '@/notify/scheduler'
import { notifId } from '@/notify/plan'
import type { NotifSpec } from '@/notify/plan'

beforeEach(() => {
  native.value = true
  Object.values(LN).forEach((f) => f.mockClear())
  LN.getPending.mockResolvedValue({ notifications: [{ id: 7 }, { id: 1003 }] })
  LN.getDeliveredNotifications.mockResolvedValue({ notifications: [] })
  __resetSchedulerForTests()
})

const RUN0 = notifId(0, 'running', 0)
const RUN1 = notifId(1, 'running', 0)
const cancelled = (call = 0) =>
  ((LN.cancel.mock.calls[call] as unknown as [{ notifications: { id: number }[] }])[0].notifications.map((n) => n.id))
const scheduledIds = (call = 0) =>
  ((LN.schedule.mock.calls[call] as unknown as [{ notifications: { id: number }[] }])[0].notifications.map((n) => n.id))

const spec = (over: Partial<NotifSpec> = {}): NotifSpec => ({
  id: 1, habitId: 'h', kind: 'reminder', at: 5000, title: 'T', body: 'B', largeIconTier: 3, ...over,
})

describe('scheduler', () => {
  it('cancels all pending (and both running ids) before scheduling', async () => {
    await applySchedule([spec()])
    expect(cancelled().sort((a, b) => a - b)).toEqual([7, RUN0, 1003, RUN1].sort((a, b) => a - b))
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

  it('cancels a delivered running notification that is not pending (Stop / switch timers)', async () => {
    // The ongoing "running" notification is delivered immediately, so it never shows in getPending().
    LN.getPending.mockResolvedValue({ notifications: [] })
    LN.getDeliveredNotifications.mockResolvedValue({ notifications: [{ id: RUN0 }] })
    const run = spec({ id: RUN0, kind: 'running', at: null, ongoing: true, actionTypeId: 'SESSION' })
    await applySchedule([run])
    // Timer stopped: the plan has no running spec any more.
    await applySchedule([spec()])
    expect(cancelled(1)).toEqual(expect.arrayContaining([RUN0, RUN1]))
    // Switched to the other habit: slot 0's running id is cancelled, slot 1's is posted.
    LN.cancel.mockClear()
    LN.schedule.mockClear()
    await applySchedule([spec({ id: RUN1, kind: 'running', at: null, ongoing: true })])
    expect(cancelled()).toContain(RUN0)
    expect(scheduledIds()).toEqual([RUN1])
  })

  it('does not re-post an unchanged running notification that is still delivered', async () => {
    LN.getPending.mockResolvedValue({ notifications: [] })
    const run = spec({ id: RUN0, kind: 'running', at: null, ongoing: true, body: 'Running' })
    await applySchedule([run, spec()])
    expect(scheduledIds(0)).toEqual([RUN0, 1])
    LN.getDeliveredNotifications.mockResolvedValue({ notifications: [{ id: RUN0 }] })
    await applySchedule([run, spec()])
    expect(cancelled(1)).not.toContain(RUN0)
    expect(cancelled(1)).toContain(RUN1)
    expect(scheduledIds(1)).toEqual([1])
    // Body changed: cancelled and re-posted.
    await applySchedule([{ ...run, body: 'Other' }])
    expect(cancelled(2)).toContain(RUN0)
    expect(scheduledIds(2)).toEqual([RUN0])
    // Swiped away / not delivered any more: re-posted even if unchanged.
    LN.getDeliveredNotifications.mockResolvedValue({ notifications: [] })
    await applySchedule([{ ...run, body: 'Other' }])
    expect(scheduledIds(3)).toEqual([RUN0])
  })

  it('still cancels the running ids if getDeliveredNotifications is unavailable', async () => {
    LN.getPending.mockResolvedValue({ notifications: [] })
    LN.getDeliveredNotifications.mockRejectedValue(new Error('not implemented'))
    const run = spec({ id: RUN0, kind: 'running', at: null, ongoing: true })
    await applySchedule([run])
    await applySchedule([run])
    expect(cancelled(1)).toEqual(expect.arrayContaining([RUN0, RUN1]))
    expect(scheduledIds(1)).toEqual([RUN0])
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
      types: [{ id: 'SESSION', actions: [{ id: 'STOP', title: 'Pause' }] }],
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

  it('maps exact-alarm states; unsupported when the platform rejects', async () => {
    LN.checkExactNotificationSetting.mockResolvedValueOnce({ exact_alarm: 'granted' })
    expect(await exactAlarmStatus()).toBe('granted')
    LN.checkExactNotificationSetting.mockResolvedValueOnce({ exact_alarm: 'denied' })
    expect(await exactAlarmStatus()).toBe('denied')
    LN.checkExactNotificationSetting.mockRejectedValueOnce(new Error('not implemented'))
    expect(await exactAlarmStatus()).toBe('unsupported')
  })

  it('openExactAlarmSetting opens the system screen on native only', async () => {
    await openExactAlarmSetting()
    expect(LN.changeExactNotificationSetting).toHaveBeenCalledOnce()
    native.value = false
    await openExactAlarmSetting()
    expect(LN.changeExactNotificationSetting).toHaveBeenCalledOnce()
    expect(await exactAlarmStatus()).toBe('unsupported')
    expect(LN.checkExactNotificationSetting).not.toHaveBeenCalled()
  })
})

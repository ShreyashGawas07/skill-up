import { Capacitor } from '@capacitor/core'
import { LocalNotifications } from '@capacitor/local-notifications'
import type { LocalNotificationSchema } from '@capacitor/local-notifications'
import type { NotifSpec } from './plan'

const native = () => Capacitor.isNativePlatform()

function toNative(s: NotifSpec): LocalNotificationSchema {
  const n: LocalNotificationSchema = {
    id: s.id,
    title: s.title,
    body: s.body,
    smallIcon: 'ic_stat_flame',
    extra: { habitId: s.habitId, kind: s.kind },
  }
  // No `schedule` means "deliver now" on Android; allowWhileIdle only matters for timed ones.
  if (s.at !== null) n.schedule = { at: new Date(s.at), allowWhileIdle: true }
  if (s.largeIconTier !== undefined) n.largeIcon = `rank_${s.largeIconTier}`
  if (s.ongoing) {
    n.ongoing = true
    n.autoCancel = false
  }
  if (s.actionTypeId) n.actionTypeId = s.actionTypeId
  return n
}

/**
 * Replaces every pending notification with `specs`. Ids are slot-based and shift when slots
 * change, so everything is cancelled first (this also removes the ongoing "running" one).
 */
export async function applySchedule(specs: NotifSpec[]): Promise<void> {
  if (!native()) return
  const { notifications: pending } = await LocalNotifications.getPending()
  if (pending.length) await LocalNotifications.cancel({ notifications: pending.map((p) => ({ id: p.id })) })
  if (specs.length) await LocalNotifications.schedule({ notifications: specs.map(toNative) })
}

/** Registers the running-session action type ('SESSION' with a 'STOP' button). */
export async function registerNotificationActions(onStop: () => void): Promise<void> {
  if (!native()) return
  await LocalNotifications.registerActionTypes({
    types: [{ id: 'SESSION', actions: [{ id: 'STOP', title: 'Stop' }] }],
  })
  await LocalNotifications.addListener('localNotificationActionPerformed', (a) => {
    if (a.actionId === 'STOP') onStop()
  })
}

export async function notificationPermission(): Promise<'granted' | 'denied' | 'prompt'> {
  if (!native()) return 'denied'
  const { display } = await LocalNotifications.checkPermissions()
  return display === 'granted' || display === 'denied' ? display : 'prompt'
}

export async function requestNotificationPermission(): Promise<boolean> {
  if (!native()) return false
  const { display } = await LocalNotifications.requestPermissions()
  return display === 'granted'
}

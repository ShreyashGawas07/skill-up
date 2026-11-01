import { Capacitor } from '@capacitor/core'
import { LocalNotifications } from '@capacitor/local-notifications'
import type { LocalNotificationSchema } from '@capacitor/local-notifications'
import { notifId } from './plan'
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

/** Ids the ongoing "running" notification can use (one per habit slot). */
const RUNNING_IDS = [notifId(0, 'running', 0), notifId(1, 'running', 0)]

/** The running notification last posted (id + text), to avoid re-posting it unchanged. */
let lastRunning: { id: number; title: string; body: string } | undefined

/** Test hook: forgets the last posted running notification. */
export function __resetSchedulerForTests(): void {
  lastRunning = undefined
}

async function deliveredIds(): Promise<Set<number>> {
  try {
    const { notifications } = await LocalNotifications.getDeliveredNotifications()
    return new Set(notifications.map((n) => n.id))
  } catch {
    return new Set()
  }
}

/**
 * Replaces every pending notification with `specs`. Ids are slot-based and shift when slots
 * change, so everything is cancelled first. The ongoing "running" notification is delivered at
 * once (never pending), so both running ids are always cancelled too — unless the plan posts the
 * same running notification that is still showing, which is then left alone instead of re-posted.
 */
export async function applySchedule(specs: NotifSpec[]): Promise<void> {
  if (!native()) return
  const [{ notifications: pending }, delivered] = await Promise.all([LocalNotifications.getPending(), deliveredIds()])
  const running = specs.find((s) => s.kind === 'running')
  const keep =
    running && lastRunning && lastRunning.id === running.id && lastRunning.title === running.title &&
    lastRunning.body === running.body && delivered.has(running.id)
      ? running.id
      : undefined
  const ids = new Set([...pending.map((p) => p.id), ...RUNNING_IDS])
  if (keep !== undefined) ids.delete(keep)
  await LocalNotifications.cancel({ notifications: [...ids].map((id) => ({ id })) })
  const post = specs.filter((s) => s.id !== keep)
  if (post.length) await LocalNotifications.schedule({ notifications: post.map(toNative) })
  lastRunning = running ? { id: running.id, title: running.title, body: running.body } : undefined
}

/** Registers the running-session action type ('SESSION' with a 'STOP' button). */
export async function registerNotificationActions(onStop: () => void): Promise<void> {
  if (!native()) return
  await LocalNotifications.registerActionTypes({
    types: [{ id: 'SESSION', actions: [{ id: 'STOP', title: 'Pause' }] }],
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

export type ExactAlarm = 'granted' | 'denied' | 'unsupported'

/**
 * Android 12+ "Alarms & reminders" access. Without it the plugin falls back to inexact alarms and
 * reminders can arrive late. 'unsupported' on web (and if the platform doesn't implement it).
 */
export async function exactAlarmStatus(): Promise<ExactAlarm> {
  if (!native()) return 'unsupported'
  try {
    const { exact_alarm } = await LocalNotifications.checkExactNotificationSetting()
    return exact_alarm === 'granted' ? 'granted' : 'denied'
  } catch {
    return 'unsupported'
  }
}

/** Opens the system "Alarms & reminders" screen for SkillUp (no-op on web). Re-check on resume. */
export async function openExactAlarmSetting(): Promise<void> {
  if (!native()) return
  await LocalNotifications.changeExactNotificationSetting()
}

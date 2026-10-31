import { useCallback, useEffect, useState } from 'react'
import { App } from '@capacitor/app'
import { Capacitor } from '@capacitor/core'
import {
  exactAlarmStatus, notificationPermission, openExactAlarmSetting, requestNotificationPermission, type ExactAlarm,
} from '@/notify/scheduler'

/** 'unsupported' = not running natively (web preview): no local notifications at all. */
export type Permission = 'granted' | 'denied' | 'prompt' | 'unsupported'

/** Reads a native status on mount and whenever the app resumes; 'unsupported' on web. */
function useNativeStatus<T>(read: () => Promise<T>): [T | 'unsupported' | undefined, () => Promise<void>] {
  const native = Capacitor.isNativePlatform()
  const [value, setValue] = useState<T | 'unsupported' | undefined>(native ? undefined : 'unsupported')
  const check = useCallback(async () => {
    if (!native) return
    try {
      setValue(await read())
    } catch {
      setValue(undefined)
    }
  }, [native, read])

  useEffect(() => {
    if (!native) return
    let alive = true
    let remove: (() => void) | undefined
    void check()
    try {
      void App.addListener('appStateChange', ({ isActive }) => {
        if (isActive && alive) void check()
      })
        .then((h) => {
          if (alive) remove = () => void h.remove()
          else void h.remove()
        })
        .catch(() => {})
    } catch {
      // App plugin unavailable; the mount-time check is enough.
    }
    return () => {
      alive = false
      remove?.()
    }
  }, [check, native])

  return [value, check]
}

/** Current notification permission; on native, re-checked on mount and whenever the app resumes. */
export function usePermission(): [Permission | undefined, () => Promise<void>] {
  return useNativeStatus(notificationPermission)
}

/** Android exact-alarm ("Alarms & reminders") access; re-checked on resume (the user returns from system settings). */
export function useExactAlarm(): [ExactAlarm | undefined, () => Promise<void>] {
  return useNativeStatus(exactAlarmStatus)
}

/**
 * Asks for notification permission, then re-checks it and re-plans notifications (a grant means
 * reminders can now be scheduled). Re-checks even if the request fails.
 */
export async function enableNotifications(recheck: () => Promise<void>, reschedule: () => Promise<void>): Promise<void> {
  try {
    await requestNotificationPermission()
  } catch {
    // Fall through: the re-check shows whatever the system now reports.
  }
  await recheck()
  await reschedule()
}

/**
 * Opens the system "Alarms & reminders" screen, then re-checks (also re-checked on resume).
 * Re-checks even if the screen could not be opened.
 */
export async function enableExactAlarms(recheck: () => Promise<void>): Promise<void> {
  try {
    await openExactAlarmSetting()
  } catch {
    // Fall through to the re-check.
  }
  await recheck()
}

import { useCallback, useEffect, useState } from 'react'
import { App } from '@capacitor/app'
import { notificationPermission } from '@/notify/scheduler'

export type Permission = 'granted' | 'denied' | 'prompt'

/** Current notification permission; re-checked on mount and whenever the app resumes. */
export function usePermission(): [Permission | undefined, () => Promise<void>] {
  const [perm, setPerm] = useState<Permission>()
  const check = useCallback(async () => {
    try {
      setPerm(await notificationPermission())
    } catch {
      setPerm(undefined)
    }
  }, [])

  useEffect(() => {
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
      // App plugin unavailable (web); mount-time check is enough.
    }
    return () => {
      alive = false
      remove?.()
    }
  }, [check])

  return [perm, check]
}

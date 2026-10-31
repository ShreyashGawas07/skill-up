import { useCallback, useEffect, useState } from 'react'
import { App } from '@capacitor/app'
import { Capacitor } from '@capacitor/core'
import { notificationPermission } from '@/notify/scheduler'

/** 'unsupported' = not running natively (web preview): no local notifications at all. */
export type Permission = 'granted' | 'denied' | 'prompt' | 'unsupported'

/** Current notification permission; on native, re-checked on mount and whenever the app resumes. */
export function usePermission(): [Permission | undefined, () => Promise<void>] {
  const native = Capacitor.isNativePlatform()
  const [perm, setPerm] = useState<Permission | undefined>(native ? undefined : 'unsupported')
  const check = useCallback(async () => {
    if (!native) return
    try {
      setPerm(await notificationPermission())
    } catch {
      setPerm(undefined)
    }
  }, [native])

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

  return [perm, check]
}

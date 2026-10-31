import { Haptics, ImpactStyle, NotificationType } from '@capacitor/haptics'

/** Fire-and-forget; errors (e.g. no vibration API on web) are swallowed. */
const safe = (fn: () => Promise<void>) => () => {
  try {
    fn().catch(() => {})
  } catch {
    // ignore
  }
}

export const haptic = {
  tick: safe(() => Haptics.impact({ style: ImpactStyle.Light })),
  success: safe(() => Haptics.notification({ type: NotificationType.Success })),
  heavy: safe(() => Haptics.impact({ style: ImpactStyle.Heavy })),
  warn: safe(() => Haptics.notification({ type: NotificationType.Warning })),
}

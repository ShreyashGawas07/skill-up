import { useState } from 'react'
import { AnimatePresence, motion } from 'framer-motion'
import { useApp } from '@/store/useApp'
import { useReduce } from '@/ui/art/useReduce'
import { motionPref } from '@/ui/screens/parts/format'
import { Glyph } from '@/ui/screens/parts/Glyphs'
import { enableExactAlarms, enableNotifications, useExactAlarm, usePermission } from './usePermission'

/** Android has no runtime way back to the prompt once denied, so we point the user at system settings. */
export const OPEN_SETTINGS_HINT = 'Open settings › Apps › SkillUp › Notifications'

export const EXACT_ALARM_TEXT = 'Reminders may be late — allow exact alarms'

/**
 * Persistent banner at the top of Home (native only): while notifications were never asked for
 * (Android 13+ shows nothing until asked) or are denied, or while they are allowed but exact alarms
 * are not (Android 12+), since reminders could then arrive late.
 */
export function PermissionBanner() {
  const [perm, recheck] = usePermission()
  const reschedule = useApp((s) => s.reschedule)
  const [exact, recheckExact] = useExactAlarm()
  const [help, setHelp] = useState(false)
  const reduce = useReduce(motionPref(useApp((s) => s.settings.reduceMotion)))
  const hidden = reduce ? { opacity: 0 } : { opacity: 0, y: -8 }

  return (
    <AnimatePresence>
      {perm === 'prompt' && (
        <motion.section
          key="prompt"
          aria-label="Reminders not enabled"
          className="mb-4 flex items-center gap-3 rounded-[22px] border-[1.5px] border-line bg-surface p-3"
          initial={hidden}
          animate={{ opacity: 1, y: 0 }}
          exit={hidden}
        >
          <span className="grid h-10 w-10 shrink-0 place-items-center rounded-full bg-accent text-on-tint border-[1.5px] border-line">
            <Glyph name="bell" />
          </span>
          <p className="min-w-0 flex-1 text-sm font-semibold">Turn on reminders so you never miss a day</p>
          <button
            type="button"
            onClick={() => void enableNotifications(recheck, reschedule)}
            className="min-h-[44px] shrink-0 rounded-full border-[1.5px] border-line bg-accent px-4 font-display font-bold text-on-tint text-sm font-semibold"
          >
            Enable
          </button>
        </motion.section>
      )}
      {perm === 'denied' && (
        <motion.section
          key="notifications"
          aria-label="Notifications off"
          className="mb-4 flex items-start gap-3 rounded-[22px] border-[1.5px] border-line bg-[#f7c29b]/25 p-3"
          initial={hidden}
          animate={{ opacity: 1, y: 0 }}
          exit={hidden}
        >
          <span className="grid h-10 w-10 shrink-0 place-items-center rounded-full border-[1.5px] border-line bg-[#f7c29b] text-on-tint">
            <Glyph name="bellOff" />
          </span>
          <div className="min-w-0 flex-1 self-center">
            <p className="font-display font-semibold">Reminders are off</p>
            {help ? (
              <p className="text-xs text-muted">{OPEN_SETTINGS_HINT}</p>
            ) : (
              <button type="button" onClick={() => setHelp(true)} className="min-h-[32px] text-xs font-semibold text-ink underline">
                How to turn on
              </button>
            )}
          </div>
        </motion.section>
      )}
      {perm === 'granted' && exact === 'denied' && (
        <motion.section
          key="exact"
          aria-label="Exact alarms off"
          className="mb-4 flex items-center gap-3 rounded-[22px] border-[1.5px] border-line bg-[#f7c29b]/25 p-3"
          initial={hidden}
          animate={{ opacity: 1, y: 0 }}
          exit={hidden}
        >
          <span className="grid h-10 w-10 shrink-0 place-items-center rounded-full border-[1.5px] border-line bg-[#f7c29b] text-on-tint">
            <Glyph name="alarm" />
          </span>
          <p className="min-w-0 flex-1 text-sm font-semibold">{EXACT_ALARM_TEXT}</p>
          <button
            type="button"
            onClick={() => void enableExactAlarms(recheckExact)}
            className="min-h-[44px] shrink-0 rounded-full border-[1.5px] border-line bg-[#f7c29b] px-4 text-sm font-bold text-on-tint"
          >
            Allow
          </button>
        </motion.section>
      )}
    </AnimatePresence>
  )
}

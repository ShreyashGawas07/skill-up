import { useState } from 'react'
import { AnimatePresence, motion } from 'framer-motion'
import { useApp } from '@/store/useApp'
import { useReduce } from '@/ui/art/useReduce'
import { motionPref } from '@/ui/screens/parts/format'
import { Glyph } from '@/ui/screens/parts/Glyphs'
import { usePermission } from './usePermission'

/** Android has no runtime way back to the prompt once denied, so we point the user at system settings. */
export const OPEN_SETTINGS_HINT = 'Open settings › Apps › SkillUp › Notifications'

/** Persistent banner at the top of Home while notifications are denied (native only). */
export function PermissionBanner() {
  const [perm] = usePermission()
  const [help, setHelp] = useState(false)
  const reduce = useReduce(motionPref(useApp((s) => s.settings.reduceMotion)))
  const hidden = reduce ? { opacity: 0 } : { opacity: 0, y: -8 }

  return (
    <AnimatePresence>
      {perm === 'denied' && (
        <motion.section
          aria-label="Notifications off"
          className="mb-4 flex items-start gap-3 rounded-3xl border border-[#ffa94d]/30 bg-[#ffa94d]/10 p-3"
          initial={hidden}
          animate={{ opacity: 1, y: 0 }}
          exit={hidden}
        >
          <span className="grid h-10 w-10 shrink-0 place-items-center rounded-full bg-[#ffa94d]/20 text-[#ffa94d]">
            <Glyph name="bellOff" />
          </span>
          <div className="min-w-0 flex-1 self-center">
            <p className="font-display font-semibold">Reminders are off</p>
            {help ? (
              <p className="text-xs text-white/60">{OPEN_SETTINGS_HINT}</p>
            ) : (
              <button type="button" onClick={() => setHelp(true)} className="min-h-[32px] text-xs font-semibold text-[#ffa94d] underline">
                How to turn on
              </button>
            )}
          </div>
        </motion.section>
      )}
    </AnimatePresence>
  )
}

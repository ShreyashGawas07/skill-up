import { useState } from 'react'
import { AnimatePresence, motion } from 'framer-motion'
import { Glyph } from '@/ui/screens/parts/Glyphs'
import { usePermission } from './usePermission'

/** Android has no runtime way back to the prompt once denied, so we point the user at system settings. */
export const OPEN_SETTINGS_HINT = 'Open settings › Apps › SkillUp › Notifications'

/** Shown at the top of Home while notifications are denied; dismissible for this visit. */
export function PermissionBanner() {
  const [perm] = usePermission()
  const [hidden, setHidden] = useState(false)
  const [help, setHelp] = useState(false)
  const show = perm === 'denied' && !hidden

  return (
    <AnimatePresence>
      {show && (
        <motion.section
          aria-label="Notifications off"
          className="mb-4 flex items-start gap-3 rounded-3xl border border-[#ffa94d]/30 bg-[#ffa94d]/10 p-3"
          initial={{ opacity: 0, y: -8 }}
          animate={{ opacity: 1, y: 0 }}
          exit={{ opacity: 0, y: -8 }}
        >
          <span className="grid h-10 w-10 shrink-0 place-items-center rounded-full bg-[#ffa94d]/20 text-[#ffa94d]">
            <Glyph name="bellOff" />
          </span>
          <div className="min-w-0 flex-1">
            <p className="font-display font-semibold">Reminders are off</p>
            {help ? (
              <p className="text-xs text-white/60">{OPEN_SETTINGS_HINT}</p>
            ) : (
              <button type="button" onClick={() => setHelp(true)} className="text-xs font-semibold text-[#ffa94d] underline">
                How to turn on
              </button>
            )}
          </div>
          <button
            type="button"
            aria-label="Dismiss"
            onClick={() => setHidden(true)}
            className="grid h-10 w-10 shrink-0 place-items-center rounded-full text-white/50"
          >
            <Glyph name="close" size={18} />
          </button>
        </motion.section>
      )}
    </AnimatePresence>
  )
}

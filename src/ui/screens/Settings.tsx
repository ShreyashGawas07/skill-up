import type { ReactNode } from 'react'
import { motion } from 'framer-motion'
import type { Settings as AppSettings } from '@/data/repo'
import { useApp } from '@/store/useApp'
import { OPEN_SETTINGS_HINT } from '@/ui/overlay/PermissionBanner'
import { enableExactAlarms, enableNotifications, useExactAlarm, usePermission } from '@/ui/overlay/usePermission'
import { BackupSection } from './parts/BackupSection'
import { motionPref } from './parts/format'
import { Glyph } from './parts/Glyphs'
import { ScreenHeader } from './parts/ScreenHeader'

function Row({ icon, label, children }: { icon: ReactNode; label: string; children: ReactNode }) {
  return (
    <div className="flex min-h-[64px] items-center gap-3 rounded-3xl bg-white/[0.04] px-4 py-3">
      <span className="grid h-10 w-10 shrink-0 place-items-center rounded-full bg-white/5 text-white/80">{icon}</span>
      <span className="flex-1 font-display font-semibold">{label}</span>
      {children}
    </div>
  )
}

const MOTION: { value: AppSettings['reduceMotion']; label: string }[] = [
  { value: 'system', label: 'System' },
  { value: 'on', label: 'On' },
  { value: 'off', label: 'Off' },
]

/** v1 is dark-only, so `settings.theme` is deliberately not exposed (and never changed) here. */
export function Settings({ onBack }: { onBack(): void }) {
  const settings = useApp((s) => s.settings)
  const saveSettings = useApp((s) => s.saveSettings)
  const rm = motionPref(settings.reduceMotion)
  const [perm, recheck] = usePermission()
  const [exact, recheckExact] = useExactAlarm()
  const save = (patch: Partial<AppSettings>) => void saveSettings({ ...settings, ...patch })

  const reschedule = useApp((s) => s.reschedule)
  // A grant re-plans notifications; exact alarms are also re-checked when the app resumes.
  const enable = () => enableNotifications(recheck, reschedule)
  const enableExact = () => enableExactAlarms(recheckExact)

  return (
    <div className="mx-auto flex min-h-screen w-full max-w-md flex-col gap-3 px-4 pb-10 pt-4">
      <ScreenHeader title="Settings" onBack={onBack} />

      <Row icon={<Glyph name={settings.sound ? 'sound' : 'mute'} />} label="Sound">
        <button
          type="button"
          role="switch"
          aria-checked={settings.sound}
          aria-label="Sound"
          onClick={() => save({ sound: !settings.sound })}
          className={`relative h-8 w-14 rounded-full transition-colors ${settings.sound ? 'bg-gradient-to-r from-[#9775fa] to-[#4dabf7]' : 'bg-white/15'}`}
        >
          <motion.span
            className="absolute top-1 h-6 w-6 rounded-full bg-white shadow"
            animate={{ left: settings.sound ? 28 : 4 }}
            transition={rm ? { duration: 0 } : { type: 'spring', stiffness: 500, damping: 30 }}
          />
        </button>
      </Row>

      <div className="rounded-3xl bg-white/[0.04] px-4 py-3">
        <div className="mb-3 flex items-center gap-3">
          <span className="grid h-10 w-10 place-items-center rounded-full bg-white/5 text-white/80">
            <Glyph name="motion" />
          </span>
          <span id="rm-label" className="font-display font-semibold">Reduce motion</span>
        </div>
        <div role="radiogroup" aria-labelledby="rm-label" className="grid grid-cols-3 gap-1 rounded-2xl bg-black/30 p-1">
          {MOTION.map((m) => {
            const on = settings.reduceMotion === m.value
            return (
              <button
                key={m.value}
                type="button"
                role="radio"
                aria-checked={on}
                onClick={() => save({ reduceMotion: m.value })}
                className={`min-h-[44px] rounded-xl text-sm font-semibold ${on ? 'bg-white/15 text-white' : 'text-white/50'}`}
              >
                {m.label}
              </button>
            )
          })}
        </div>
      </div>

      <Row icon={<Glyph name={perm === 'granted' || perm === 'unsupported' ? 'bell' : 'bellOff'} />} label="Notifications">
        {perm === 'granted' && (
          <span className="flex items-center gap-1 rounded-full bg-[#69db7c]/15 px-3 py-1 text-sm font-semibold text-[#69db7c]">
            <Glyph name="check" size={14} />
            On
          </span>
        )}
        {perm === 'unsupported' && <span className="text-sm text-white/40">Available in the app</span>}
        {perm === 'prompt' && (
          <button
            type="button"
            onClick={() => void enable()}
            className="min-h-[44px] rounded-2xl bg-gradient-to-br from-[#9775fa] to-[#4dabf7] px-4 text-sm font-semibold"
          >
            Enable
          </button>
        )}
      </Row>
      {perm === 'denied' && <p className="-mt-1 px-4 text-xs text-white/50">{OPEN_SETTINGS_HINT}</p>}

      {(exact === 'granted' || exact === 'denied') && (
        <Row icon={<Glyph name="alarm" />} label="Exact reminders">
          {exact === 'granted' ? (
            <span className="flex items-center gap-1 rounded-full bg-[#69db7c]/15 px-3 py-1 text-sm font-semibold text-[#69db7c]">
              <Glyph name="check" size={14} />
              On
            </span>
          ) : (
            <button
              type="button"
              aria-label="Enable exact reminders"
              onClick={() => void enableExact()}
              className="min-h-[44px] rounded-2xl bg-gradient-to-br from-[#9775fa] to-[#4dabf7] px-4 text-sm font-semibold"
            >
              Enable
            </button>
          )}
        </Row>
      )}

      <h2 className="mt-4 px-1 font-display text-xs font-bold uppercase tracking-[0.2em] text-white/40">Backup</h2>
      <BackupSection reducedMotion={rm} />
    </div>
  )
}

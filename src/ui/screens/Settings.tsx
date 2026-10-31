import type { ReactNode } from 'react'
import { motion } from 'framer-motion'
import type { Settings as AppSettings } from '@/data/repo'
import { useApp } from '@/store/useApp'
import { BottomNav, Segmented, TopBar } from '@/ui/kit'
import { OPEN_SETTINGS_HINT } from '@/ui/overlay/PermissionBanner'
import { enableExactAlarms, enableNotifications, useExactAlarm, usePermission } from '@/ui/overlay/usePermission'
import type { Navigate } from '@/ui/route'
import { MAX_HABITS } from './Home'
import { BackupSection } from './parts/BackupSection'
import { motionPref } from './parts/format'
import { Glyph } from './parts/Glyphs'

const ICON_TINT = ['#c9b6ec', '#a9d9b8', '#f8d77c', '#a8cdf0', '#f4a99c']

function Row({ icon, label, tint, children }: { icon: ReactNode; label: string; tint: string; children: ReactNode }) {
  return (
    <div className="card flex min-h-[64px] items-center gap-3 px-3 py-2.5">
      <span className="grid h-10 w-10 shrink-0 place-items-center rounded-full border-[1.5px] border-line text-on-tint" style={{ background: tint }}>
        {icon}
      </span>
      <span className="flex-1 font-display font-bold">{label}</span>
      {children}
    </div>
  )
}

function Block({ icon, label, tint, children }: { icon: ReactNode; label: string; tint: string; children: ReactNode }) {
  return (
    <div className="card px-3 py-3">
      <div className="mb-3 flex items-center gap-3">
        <span className="grid h-10 w-10 place-items-center rounded-full border-[1.5px] border-line text-on-tint" style={{ background: tint }}>
          {icon}
        </span>
        <span className="font-display font-bold">{label}</span>
      </div>
      <div className="rounded-full border-[1.5px] border-line/30 bg-sunk p-1">{children}</div>
    </div>
  )
}

const On = () => (
  <span className="flex items-center gap-1 rounded-full border-[1.5px] border-line bg-[#a9d9b8] px-3 py-1 text-sm font-bold text-on-tint">
    <Glyph name="check" size={14} />
    On
  </span>
)

const MOTION: { value: AppSettings['reduceMotion']; label: string }[] = [
  { value: 'system', label: 'System' },
  { value: 'on', label: 'On' },
  { value: 'off', label: 'Off' },
]

const THEMES: { value: AppSettings['theme']; label: string }[] = [
  { value: 'system', label: 'Auto' },
  { value: 'light', label: 'Light' },
  { value: 'dark', label: 'Dark' },
]

export function Settings({ onNavigate }: { onNavigate: Navigate }) {
  const settings = useApp((s) => s.settings)
  const saveSettings = useApp((s) => s.saveSettings)
  const full = useApp((s) => s.habits.filter((h) => h.archivedAt === undefined && s.states[h.id] && !s.states[h.id].eternal).length >= MAX_HABITS)
  const rm = motionPref(settings.reduceMotion)
  const [perm, recheck] = usePermission()
  const [exact, recheckExact] = useExactAlarm()
  const save = (patch: Partial<AppSettings>) => void saveSettings({ ...settings, ...patch })

  const reschedule = useApp((s) => s.reschedule)
  // A grant re-plans notifications; exact alarms are also re-checked when the app resumes.
  const enable = () => enableNotifications(recheck, reschedule)
  const enableExact = () => enableExactAlarms(recheckExact)

  return (
    <div className="mx-auto flex min-h-screen w-full max-w-md flex-col pb-28">
      <div className="px-4 pb-10 pt-[max(8px,env(safe-area-inset-top))] text-on-tint" style={{ background: ICON_TINT[0] }}>
        <TopBar title="Settings" onBack={() => onNavigate('home')} />
        <p className="mt-2 px-1 font-display text-2xl font-bold">Make it yours</p>
        <p className="px-1 text-sm opacity-70">Look, feel, reminders and backups.</p>
      </div>

      <main className="-mt-6 flex flex-1 flex-col gap-3 rounded-t-[28px] border-t-[1.5px] border-line bg-bg px-4 pt-5">
        <h2 className="label px-1">Appearance</h2>
        <Block icon={<Glyph name={settings.theme === 'dark' ? 'moon' : settings.theme === 'light' ? 'sun' : 'auto'} size={20} />} label="Theme" tint={ICON_TINT[2]}>
          <Segmented<AppSettings['theme']> options={THEMES} value={settings.theme} onChange={(theme) => save({ theme })} label="Theme" />
        </Block>
        <Block icon={<Glyph name="motion" size={20} />} label="Reduce motion" tint={ICON_TINT[3]}>
          <Segmented<AppSettings['reduceMotion']>
            options={MOTION}
            value={settings.reduceMotion}
            onChange={(reduceMotion) => save({ reduceMotion })}
            label="Reduce motion"
          />
        </Block>
        <Row icon={<Glyph name={settings.sound ? 'sound' : 'mute'} size={20} />} label="Sound" tint={ICON_TINT[1]}>
          <button
            type="button"
            role="switch"
            aria-checked={settings.sound}
            aria-label="Sound"
            onClick={() => save({ sound: !settings.sound })}
            className={`relative h-8 w-14 rounded-full border-[1.5px] border-line transition-colors ${settings.sound ? 'bg-accent' : 'bg-sunk'}`}
          >
            <motion.span
              className="absolute top-[3px] h-[22px] w-[22px] rounded-full border-[1.5px] border-line bg-surface"
              animate={{ left: settings.sound ? 28 : 3 }}
              transition={rm ? { duration: 0 } : { type: 'spring', stiffness: 500, damping: 30 }}
            />
          </button>
        </Row>

        <h2 className="label mt-3 px-1">Reminders</h2>
        <Row icon={<Glyph name={perm === 'granted' || perm === 'unsupported' ? 'bell' : 'bellOff'} size={20} />} label="Notifications" tint={ICON_TINT[4]}>
          {perm === 'granted' && <On />}
          {perm === 'unsupported' && <span className="text-sm text-muted">Available in the app</span>}
          {perm === 'prompt' && (
            <button type="button" onClick={() => void enable()} className="pill-btn bg-accent px-4 text-on-tint">
              Enable
            </button>
          )}
        </Row>
        {perm === 'denied' && <p className="-mt-1 px-4 text-xs text-muted">{OPEN_SETTINGS_HINT}</p>}

        {(exact === 'granted' || exact === 'denied') && (
          <Row icon={<Glyph name="alarm" size={20} />} label="Exact reminders" tint={ICON_TINT[2]}>
            {exact === 'granted' ? (
              <On />
            ) : (
              <button
                type="button"
                aria-label="Enable exact reminders"
                onClick={() => void enableExact()}
                className="pill-btn bg-accent px-4 text-on-tint"
              >
                Enable
              </button>
            )}
          </Row>
        )}

        <h2 className="label mt-3 px-1">Backup</h2>
        <BackupSection reducedMotion={rm} />
      </main>

      <BottomNav
        current="settings"
        onTab={(t) => t !== 'settings' && onNavigate(t)}
        onAdd={() => onNavigate('add')}
        addLocked={full}
        reducedMotion={rm}
      />
    </div>
  )
}

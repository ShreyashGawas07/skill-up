import { useEffect, useState } from 'react'
import { motion } from 'framer-motion'
import { useApp, type HabitInput } from '@/store/useApp'
import { haptic } from '@/feedback/haptics'
import { notificationPermission, requestNotificationPermission } from '@/notify/scheduler'
import { useReduce } from '@/ui/art/useReduce'
import { HABIT_COLORS } from '@/ui/theme'
import { iconGlyph } from '@/ui/icons'
import { DIAL_MAX, DIAL_MIN, DIAL_STEP, HoursDial } from './parts/HoursDial'
import { NameStep, ReminderStep, TargetStep } from './parts/AddSteps'
import { Glyph } from './parts/Glyphs'
import { motionPref } from './parts/format'

export interface ValidateCtx {
  formed: boolean
  /** Hours already logged (edit case); the target must stay above it. */
  totalHours: number
}

/** Validates the fields present on `input`; returns the first error message, or null. */
export function validateHabitInput(input: Partial<HabitInput>, ctx: ValidateCtx): string | null {
  const { name, dailyMinutes: m, targetHours: t, reminderTime: r } = input
  if (name !== undefined) {
    const n = name.trim().length
    if (n < 1 || n > 30) return 'Name must be 1–30 characters'
  }
  if (m !== undefined && (!Number.isInteger(m) || m < DIAL_MIN || m > DIAL_MAX || m % DIAL_STEP !== 0)) {
    return 'Daily time must be 0:15–12:00 in 15-minute steps'
  }
  if (t !== undefined) {
    if (!Number.isInteger(t) || t < 1) return 'Target must be a whole number of hours'
    if (t <= ctx.totalHours) return `Target must be above the ${Math.floor(ctx.totalHours)}h already logged`
  }
  if (r !== undefined && !/^([01]\d|2[0-3]):[0-5]\d$/.test(r)) return 'Reminder time must be HH:mm'
  return null
}

const STEPS = 4
const TITLES = ['Name your habit', 'Daily commitment', 'Mastery goal', 'Daily reminder']
const SWIPE = 70

interface Props {
  /** Edit an existing habit; omitted = add a new one. */
  habitId?: string
  onDone(): void
}

/**
 * Asks for notification permission if it was never asked ('prompt'), then re-plans notifications
 * so the new habit's reminders are scheduled. Failures are ignored (reminders are best-effort).
 */
async function askForNotifications(reschedule: () => Promise<void>): Promise<void> {
  try {
    if ((await notificationPermission()) !== 'prompt') return
    await requestNotificationPermission()
    await reschedule()
  } catch {
    // Permission APIs unavailable; Settings and the Home banner still offer it.
  }
}

export function AddHabit({ habitId, onDone }: Props) {
  const habits = useApp((s) => s.habits)
  const states = useApp((s) => s.states)
  const addHabit = useApp((s) => s.addHabit)
  const updateHabit = useApp((s) => s.updateHabit)
  const reschedule = useApp((s) => s.reschedule)
  const rm = motionPref(useApp((s) => s.settings.reduceMotion))
  const reduce = useReduce(rm)

  const editing = habitId ? habits.find((h) => h.id === habitId) : undefined
  const st = habitId ? states[habitId] : undefined
  const formed = !!st?.formed
  const totalHours = (st?.totalMinutes ?? 0) / 60
  const ctx: ValidateCtx = { formed, totalHours }
  const takenColors = habits.filter((h) => h.id !== habitId).map((h) => h.color)

  const [step, setStep] = useState(0)
  const [dir, setDir] = useState(1)
  const [err, setErr] = useState<string | null>(null)
  const [saving, setSaving] = useState(false)
  const [v, setV] = useState<HabitInput>(() => ({
    name: editing?.name ?? '',
    icon: editing?.icon ?? 'book',
    color: editing?.color ?? HABIT_COLORS.find((c) => !takenColors.includes(c)) ?? HABIT_COLORS[0],
    dailyMinutes: (editing ? editing.commitmentHistory[editing.commitmentHistory.length - 1]?.dailyMinutes : undefined) ?? 60,
    targetHours: editing?.targetHours ?? 10000,
    reminderTime: editing?.reminderTime ?? '19:00',
  }))
  const patch = (p: Partial<HabitInput>) => {
    setErr(null)
    setV((x) => ({ ...x, ...p }))
  }

  const fields: (keyof HabitInput)[][] = [['name', 'icon', 'color'], ['dailyMinutes'], ['targetHours'], ['reminderTime']]
  const stepError = validateHabitInput(Object.fromEntries(fields[step].map((k) => [k, v[k]])), ctx)
  const last = step === STEPS - 1

  const go = (d: 1 | -1) => {
    if (d > 0 && stepError) return
    const n = step + d
    if (n < 0 || n >= STEPS) return
    haptic.tick()
    setDir(d)
    setStep(n)
  }

  const save = async () => {
    const e = validateHabitInput(v, ctx)
    if (e) return setErr(e)
    setSaving(true)
    try {
      const input = { ...v, name: v.name.trim() }
      if (editing) {
        const { dailyMinutes, ...rest } = input
        await updateHabit(editing.id, formed ? { ...rest, dailyMinutes } : rest)
      } else {
        await addHabit(input)
        // Android 13+: nothing is ever shown until the user is asked, so ask once a habit exists.
        void askForNotifications(reschedule)
      }
      haptic.success()
      onDone()
    } catch (x) {
      setErr(x instanceof Error ? x.message : String(x))
      setSaving(false)
    }
  }

  // Edit target gone (e.g. deleted elsewhere): close instead of silently becoming an Add form.
  const missing = !!habitId && !editing
  useEffect(() => {
    if (missing) onDone()
  }, [missing, onDone])
  if (missing) return null

  const body = [
    <NameStep
      key="n"
      name={v.name}
      icon={v.icon}
      color={v.color}
      onName={(name) => patch({ name })}
      onIcon={(icon) => patch({ icon })}
      onColor={(color) => patch({ color })}
    />,
    <HoursDial key="d" value={v.dailyMinutes} color={v.color} disabled={!!editing && !formed} onChange={(dailyMinutes) => patch({ dailyMinutes })} />,
    <TargetStep key="t" value={v.targetHours} min={Math.floor(totalHours) + 1} color={v.color} onChange={(targetHours) => patch({ targetHours })} />,
    <ReminderStep key="r" value={v.reminderTime} color={v.color} onChange={(reminderTime) => patch({ reminderTime })} />,
  ][step]

  const shownErr = err ?? (step > 0 ? stepError : null)

  return (
    <div className="mx-auto flex min-h-screen w-full max-w-md flex-col">
      <div className="px-4 pb-10 pt-[max(8px,env(safe-area-inset-top))] text-on-tint transition-colors" style={{ background: v.color }}>
        <header className="flex h-14 items-center justify-between">
          <button
            type="button"
            aria-label="Close"
            onClick={onDone}
            className="grid h-10 w-10 place-items-center rounded-full border-[1.5px] border-on-tint bg-accent text-on-tint active:scale-90"
          >
            <Glyph name="close" size={18} />
          </button>
          <div className="flex gap-1.5" aria-label={`Step ${step + 1} of ${STEPS}`} role="progressbar" aria-valuenow={step + 1} aria-valuemin={1} aria-valuemax={STEPS}>
            {Array.from({ length: STEPS }, (_, i) => (
              <motion.span
                key={i}
                className="h-2.5 rounded-full border-[1.5px] border-on-tint"
                // Reduce-motion: the width snaps (static style); only the colour fades.
                style={reduce ? { width: i === step ? 28 : 8 } : undefined}
                animate={
                  reduce
                    ? { backgroundColor: i <= step ? '#28221e' : 'rgba(255,255,255,.5)' }
                    : { width: i === step ? 28 : 8, backgroundColor: i <= step ? '#28221e' : 'rgba(255,255,255,.5)' }
                }
              />
            ))}
          </div>
          <span className="w-10" />
        </header>
        <div className="mt-3 flex items-center gap-4">
          <span className="grid h-16 w-16 shrink-0 place-items-center rounded-[20px] border-[1.5px] border-on-tint bg-white/50 text-4xl" aria-hidden>
            {iconGlyph(v.icon)}
          </span>
          <div className="min-w-0">
            <p className="font-display text-xs font-bold uppercase tracking-[0.14em] opacity-70">{editing ? 'Edit habit' : 'New habit'}</p>
            <p className="truncate font-display text-2xl font-bold">{TITLES[step]}</p>
          </div>
        </div>
      </div>

      <div className="-mt-6 flex flex-1 flex-col rounded-t-[28px] border-t-[1.5px] border-line bg-bg px-4 pb-[max(20px,env(safe-area-inset-bottom))]">
        {/* Outer layer handles the swipe; the keyed inner layer animates each step in. */}
        <motion.div
          className="flex flex-1 touch-pan-y flex-col justify-center py-6"
          drag={step === 1 ? false : 'x'}
          dragConstraints={{ left: 0, right: 0 }}
          dragElastic={0.4}
          dragSnapToOrigin
          onDragEnd={(_, info) => {
            if (info.offset.x < -SWIPE) go(1)
            else if (info.offset.x > SWIPE) go(-1)
          }}
        >
          <motion.div
            key={step}
            initial={reduce ? { opacity: 0 } : { opacity: 0, x: dir * 120 }}
            animate={{ opacity: 1, x: 0 }}
            transition={{ type: 'spring', stiffness: 320, damping: 30 }}
          >
            {body}
          </motion.div>
        </motion.div>

        <p role={shownErr ? 'alert' : undefined} className="mb-3 min-h-[1.25rem] text-center text-sm font-medium text-danger">
          {shownErr}
        </p>

        <div className="flex gap-3">
          <button
            type="button"
            aria-label="Back"
            disabled={step === 0}
            onClick={() => go(-1)}
            className="grid h-14 w-14 place-items-center rounded-full border-[1.5px] border-line bg-surface active:scale-95 disabled:opacity-0"
          >
            <Glyph name="back" size={22} />
          </button>
          <button
            type="button"
            aria-label={last ? 'Save' : 'Next'}
            disabled={!!stepError || saving}
            onClick={() => (last ? void save() : go(1))}
            className="flex h-14 flex-1 items-center justify-center gap-2 rounded-full border-[1.5px] border-line bg-accent font-display text-base font-bold text-on-tint transition active:scale-95 disabled:opacity-40"
          >
            <span aria-hidden>{last ? (editing ? 'Save changes' : 'Create habit') : 'Continue'}</span>
            <Glyph name={last ? 'check' : 'next'} size={20} />
          </button>
        </div>
      </div>
    </div>
  )
}

import { useCallback, useEffect, useRef, type ComponentType } from 'react'
import { AnimatePresence, motion } from 'framer-motion'
import { TIERS } from '@/domain/tiers'
import type { Celebration, CelebrationKind } from '@/feedback/celebrations'
import { haptic } from '@/feedback/haptics'
import { playCue, type Cue } from '@/feedback/sound'
import { useApp } from '@/store/useApp'
import { clampTier } from '@/ui/art/emblemSvg'
import { useReduce } from '@/ui/art/useReduce'
import { motionPref } from '@/ui/screens/parts/format'
import { EternalScene, FormedScene } from './scenes/MilestoneScenes'
import { RankLostScene, RankRecoveredScene, RankUpScene } from './scenes/RankScenes'
import { StreakResetScene, StreakScene } from './scenes/StreakScenes'
import type { SceneProps } from './scenes/shared'

type FullKind = Exclude<CelebrationKind, 'dayComplete' | 'overtime'>

interface Spec {
  Scene: ComponentType<SceneProps>
  /** Auto-advance after this many ms. */
  ms: number
  /** Haptic + sound fire at this moment (ms), synced to the scene's impact frame. */
  at: number
  haptic: keyof typeof haptic
  cue: Cue
  label(c: Celebration): string
}

const tierName = (c: Celebration) => TIERS[clampTier(c.value ?? 1) - 1].name

const SPEC: Record<FullKind, Spec> = {
  rankUp: { Scene: RankUpScene, ms: 3800, at: 650, haptic: 'heavy', cue: 'big', label: (c) => `Rank up: ${tierName(c)}` },
  rankLost: { Scene: RankLostScene, ms: 2400, at: 300, haptic: 'warn', cue: 'loss', label: (c) => `Rank lost: now ${tierName(c)}` },
  rankRecovered: { Scene: RankRecoveredScene, ms: 3200, at: 700, haptic: 'success', cue: 'win', label: (c) => `Rank recovered: ${tierName(c)}` },
  streak: { Scene: StreakScene, ms: 2900, at: 350, haptic: 'success', cue: 'win', label: (c) => `${c.value ?? ''} day streak` },
  streakReset: { Scene: StreakResetScene, ms: 2700, at: 550, haptic: 'warn', cue: 'loss', label: () => 'Forming reset' },
  formed: { Scene: FormedScene, ms: 4200, at: 750, haptic: 'heavy', cue: 'big', label: () => 'Habit formed' },
  eternal: { Scene: EternalScene, ms: 7000, at: 1200, haptic: 'heavy', cue: 'big', label: () => 'Eternal: target complete' },
}

const isFull = (c: Celebration): c is Celebration & { kind: FullKind } => c.fullScreen && c.kind in SPEC

/**
 * Full-screen celebration moments, one at a time in queue order. Tap (or Esc/Enter/Space) skips;
 * each auto-advances after its animation. Inline kinds are Home's job, so they're marked seen here.
 */
export function CelebrationOverlay() {
  const queue = useApp((s) => s.queue)
  const habits = useApp((s) => s.habits)
  const states = useApp((s) => s.states)
  const settings = useApp((s) => s.settings)
  const dismiss = useApp((s) => s.dismiss)
  const reduce = useReduce(motionPref(settings.reduceMotion))

  // Keep showing the same item even if a higher-priority one is queued mid-animation.
  const pinned = useRef<string>()
  const current = queue.find((c) => c.key === pinned.current && isFull(c)) ?? queue.find(isFull)
  pinned.current = current?.key
  const habit = current && habits.find((h) => h.id === current.habitId)
  const remaining = queue.filter(isFull).length

  const gone = useRef(new Set<string>())
  const skip = useCallback(
    (key: string) => {
      if (gone.current.has(key)) return
      gone.current.add(key)
      void dismiss(key)
    },
    [dismiss],
  )

  // Inline kinds and items whose habit was deleted are dismissed silently.
  useEffect(() => {
    for (const c of queue) {
      if (!c.fullScreen || !(c.kind in SPEC)) skip(c.key)
      else if (!habits.some((h) => h.id === c.habitId)) skip(c.key)
    }
  }, [queue, habits, skip])

  const key = current && habit ? current.key : undefined
  const spec = current && isFull(current) ? SPEC[current.kind] : undefined
  const sound = settings.sound

  useEffect(() => {
    if (!key || !spec) return
    const cue = setTimeout(() => {
      haptic[spec.haptic]()
      if (sound) playCue(spec.cue)
    }, reduce ? 0 : spec.at)
    const done = setTimeout(() => skip(key), spec.ms)
    const onKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape' || e.key === 'Enter' || e.key === ' ') skip(key)
    }
    window.addEventListener('keydown', onKey)
    return () => {
      clearTimeout(cue)
      clearTimeout(done)
      window.removeEventListener('keydown', onKey)
    }
    // spec is derived from key; sound/reduce are read at mount of each moment.
  }, [key])

  return (
    <AnimatePresence mode="wait">
      {current && habit && spec && (
        <motion.div
          key={current.key}
          role="dialog"
          aria-modal="true"
          aria-label={`${spec.label(current)} — ${habit.name}`}
          data-motion={reduce ? 'reduced' : 'full'}
          data-kind={current.kind}
          tabIndex={-1}
          className="fixed inset-0 z-50 flex cursor-pointer select-none flex-col items-center justify-center gap-3 overflow-hidden bg-[#07070dee] px-4 text-white backdrop-blur-md"
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          exit={{ opacity: 0 }}
          transition={{ duration: 0.25 }}
          onClick={() => skip(current.key)}
        >
          <div className="absolute left-0 right-0 top-0 flex items-center justify-center pt-[max(1.25rem,env(safe-area-inset-top))]">
            <span className="flex items-center gap-2 rounded-full bg-white/5 px-3 py-1 text-sm text-white/80">
              <span aria-hidden className="h-2.5 w-2.5 rounded-full" style={{ background: habit.color, boxShadow: `0 0 8px ${habit.color}` }} />
              {habit.name}
            </span>
          </div>

          <div className="relative flex flex-col items-center gap-3 text-center">
            <spec.Scene c={current} habit={habit} state={states[current.habitId]} reduce={reduce} />
          </div>

          <div className="absolute bottom-0 left-0 right-0 flex flex-col items-center gap-3 pb-[max(1.5rem,env(safe-area-inset-bottom))]">
            <motion.p
              className="text-xs uppercase tracking-[0.3em] text-white/40"
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              transition={{ delay: 1.2, duration: 0.6 }}
            >
              Tap to continue{remaining > 1 ? ` · ${remaining - 1} more` : ''}
            </motion.p>
            {!reduce && (
              <div className="h-0.5 w-24 overflow-hidden rounded-full bg-white/10">
                <motion.div
                  className="h-full origin-left bg-white/50"
                  initial={{ scaleX: 0 }}
                  animate={{ scaleX: 1 }}
                  transition={{ duration: spec.ms / 1000, ease: 'linear' }}
                />
              </div>
            )}
          </div>
        </motion.div>
      )}
    </AnimatePresence>
  )
}

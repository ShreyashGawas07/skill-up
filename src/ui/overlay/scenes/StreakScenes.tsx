import { useEffect, useState } from 'react'
import { motion } from 'framer-motion'
import { BeadTrack } from '@/ui/art/BeadTrack'
import { Flame, flameBand } from '@/ui/art/Flame'
import { beadsBefore } from '../history'
import { anim, Glow, Kicker, Shockwave, Slam, Sparks, Stage, Sub, type SceneProps } from './shared'

const BAND = {
  orange: { glow: '#ff7a1f', hot: '#ffd166', embers: ['#ffb020', '#ff5a1f', '#fff1b8'] },
  blue: { glow: '#3a8cff', hot: '#9be3ff', embers: ['#7ae1ff', '#3a8cff', '#ffffff'] },
  violet: { glow: '#9a4dff', hot: '#f0c4ff', embers: ['#e09bff', '#9a4dff', '#ffffff'] },
}

export function StreakScene({ c, state, reduce }: SceneProps) {
  const days = c.value ?? state?.streak ?? 0
  const b = BAND[flameBand(days)]
  const FLARE = 0.35
  return (
    <>
      <Kicker color={b.hot} reduce={reduce}>Streak milestone</Kicker>
      <Stage size={250}>
        <Glow color={b.glow} size={440} delay={0} reduce={reduce} />
        <Shockwave color={b.hot} delay={FLARE} reduce={reduce} count={2} size={160} />
        <Sparks colors={b.embers} delay={FLARE} reduce={reduce} count={28} spread={150} rise={120} />
        <motion.div
          className="relative"
          {...(reduce
            ? anim(true, 0, {}, {})
            : {
                initial: { opacity: 0, scale: 0.3, y: 40 },
                animate: { opacity: 1, scale: [0.3, 1.45, 0.95, 1.05, 1], y: 0 },
                transition: { delay: 0.05, duration: 0.95, times: [0, 0.35, 0.6, 0.8, 1], ease: 'easeOut' },
              })}
        >
          <Flame streak={days} size={150} reducedMotion={reduce} />
        </motion.div>
      </Stage>
      <Slam delay={FLARE + 0.25} reduce={reduce} glow={b.glow} className="text-8xl tabular-nums">
        {days}
      </Slam>
      <Sub delay={FLARE + 0.6} reduce={reduce} className="font-display text-lg font-bold uppercase tracking-[0.3em] text-white/80">
        day streak
      </Sub>
    </>
  )
}

export function StreakResetScene({ c, habit, state, reduce }: SceneProps) {
  const before = beadsBefore(state, c.key)
  const [done, setDone] = useState(before)
  useEffect(() => {
    const t = setTimeout(() => setDone(0), 550)
    return () => clearTimeout(t)
  }, [])
  return (
    <>
      <motion.div
        aria-hidden
        className="pointer-events-none fixed inset-0 -z-10"
        style={{ background: 'radial-gradient(ellipse at center, transparent 40%, rgba(70,90,140,0.35) 100%)' }}
        initial={{ opacity: 0 }}
        animate={{ opacity: 1 }}
        transition={{ duration: 0.6 }}
      />
      <Kicker color="#a9b8d8" reduce={reduce}>Forming reset</Kicker>
      <motion.div className="my-8 w-full max-w-sm px-2" {...anim(reduce, 0.15, { opacity: 0, scale: 0.92 }, { opacity: 1, scale: 1 }, { duration: 0.4 })}>
        <BeadTrack done={done} formed={false} color={habit.color} reducedMotion={reduce} />
      </motion.div>
      <motion.h2
        className="relative font-display text-4xl font-extrabold text-white"
        {...anim(reduce, 1.1, { opacity: 0, y: 12 }, { opacity: 1, y: 0 }, { type: 'spring', stiffness: 260, damping: 20 })}
      >
        Back to day 1
      </motion.h2>
      <Sub delay={1.4} reduce={reduce} className="text-white/60">
        Every bead comes back. Start again today.
      </Sub>
    </>
  )
}

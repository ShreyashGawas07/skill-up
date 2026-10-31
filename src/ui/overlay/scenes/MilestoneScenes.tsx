import { useEffect, useState } from 'react'
import { AnimatePresence, motion } from 'framer-motion'
import confetti from 'canvas-confetti'
import { iconGlyph } from '@/ui/icons'
import { Emblem } from '@/ui/art/Emblem'
import { Glyph } from '@/ui/screens/parts/Glyphs'
import { fmtInt } from '@/ui/screens/parts/format'
import { anim, Glow, Kicker, Rays, rnd, Shockwave, Slam, Sparks, Stage, Sub, type SceneProps } from './shared'

const GOLD = ['#ffcf3f', '#fff3b0', '#ff9f1c', '#ffffff']

/** Timed canvas-confetti bursts; none under reduce motion. Cleared on unmount (skip). */
function useFireworks(reduce: boolean, bursts: { at: number; x: number; y: number; colors: string[]; n?: number }[]) {
  useEffect(() => {
    if (reduce) return
    const ids = bursts.map((b) =>
      setTimeout(() => {
        try {
          void confetti({
            particleCount: b.n ?? 90, spread: 360, startVelocity: 32, gravity: 0.7, ticks: 160, scalar: 0.9,
            origin: { x: b.x, y: b.y }, colors: b.colors, zIndex: 60,
          })
        } catch {
          // no canvas available
        }
      }, b.at),
    )
    return () => ids.forEach(clearTimeout)
    // Bursts are fixed per scene mount.
  }, [reduce])
}

function Medal({ color, icon }: { color: string; icon: string }) {
  return (
    <div className="relative grid h-[180px] w-[180px] place-items-center">
      <svg viewBox="0 0 180 180" className="absolute inset-0" aria-hidden>
        <defs>
          <radialGradient id="medal-gold" cx="0.35" cy="0.3" r="0.8">
            <stop offset="0" stopColor="#fffbe6" />
            <stop offset="0.45" stopColor="#ffcf3f" />
            <stop offset="1" stopColor="#a8630a" />
          </radialGradient>
        </defs>
        {[-1, 1].flatMap((side) =>
          Array.from({ length: 8 }, (_, i) => {
            const deg = side < 0 ? 122 + i * 16 : 58 - i * 16
            const r = (deg * Math.PI) / 180
            const cx = 90 + Math.cos(r) * 76
            const cy = 90 + Math.sin(r) * 76
            return <ellipse key={`${side}${i}`} cx={cx} cy={cy} rx="5" ry="11" fill={i % 2 ? '#ffcf3f' : '#e8a21c'} transform={`rotate(${deg} ${cx} ${cy})`} />
          }),
        )}
        <circle cx="90" cy="90" r="62" fill="url(#medal-gold)" stroke="#fff3b0" strokeWidth="3" />
        <circle cx="90" cy="90" r="50" fill={color} fillOpacity="0.25" stroke={color} strokeWidth="4" />
      </svg>
      <span className="relative text-5xl drop-shadow">{icon}</span>
      <span className="absolute -bottom-1 rounded-full bg-gradient-to-b from-[#fff3b0] to-[#ff9f1c] px-3 py-0.5 font-display text-xs font-black uppercase tracking-widest text-[#4a2a00]">
        30 days
      </span>
    </div>
  )
}

export function FormedScene({ habit, reduce }: SceneProps) {
  const UNLOCK = 0.75
  useFireworks(reduce, [
    { at: 700, x: 0.5, y: 0.38, colors: [...GOLD, habit.color], n: 120 },
    { at: 1250, x: 0.2, y: 0.3, colors: [habit.color, '#ffffff', '#ffcf3f'] },
    { at: 1700, x: 0.8, y: 0.28, colors: [habit.color, '#ffffff', '#ffcf3f'] },
    { at: 2300, x: 0.5, y: 0.18, colors: GOLD },
  ])
  return (
    <>
      <Kicker color="#ffe08a" reduce={reduce}>Habit formed</Kicker>
      <Stage size={250}>
        <Glow color="#ffcf3f" size={420} delay={UNLOCK} reduce={reduce} />
        <Rays color="#ffd860" delay={UNLOCK} size={520} reduce={reduce} />
        {/* Padlock: shakes, shackle pops, then it vanishes as the medal unlocks. */}
        <motion.div
          aria-hidden
          className="absolute text-white/80"
          initial={{ opacity: 1 }}
          animate={reduce ? { opacity: 0 } : { opacity: [1, 1, 0], scale: [1, 1, 1.6], rotate: [0, -8, 8, -6, 6, 0, 0] }}
          transition={{ delay: reduce ? UNLOCK : 0, duration: reduce ? 0.3 : UNLOCK + 0.2 }}
        >
          <Glyph name="lock" size={96} />
        </motion.div>
        <Shockwave color="#ffcf3f" delay={UNLOCK} reduce={reduce} count={2} size={190} />
        <Sparks colors={GOLD} delay={UNLOCK + 0.05} reduce={reduce} count={24} spread={180} />
        <motion.div className="relative" {...anim(reduce, UNLOCK, { opacity: 0, scale: 0.2, rotate: -25 }, { opacity: 1, scale: 1, rotate: 0 }, { type: 'spring', stiffness: 240, damping: 13 })}>
          <Medal color={habit.color} icon={iconGlyph(habit.icon)} />
        </motion.div>
      </Stage>
      <Slam delay={UNLOCK + 0.55} reduce={reduce} color="#ffd860" glow="#ff9f1c">
        Formed
      </Slam>
      <Sub delay={UNLOCK + 1} reduce={reduce}>It&apos;s part of you now. Badge added to your cabinet.</Sub>
    </>
  )
}

function Stars({ reduce }: { reduce: boolean }) {
  return (
    <div aria-hidden className="pointer-events-none fixed inset-0 -z-10 overflow-hidden">
      {Array.from({ length: 46 }, (_, i) => {
        const s = 1 + rnd(i, 7) * 2.2
        return (
          <motion.span
            key={i}
            className="absolute rounded-full bg-white"
            style={{ left: `${rnd(i, 8) * 100}%`, top: `${rnd(i, 9) * 100}%`, width: s, height: s }}
            initial={{ opacity: 0 }}
            animate={reduce ? { opacity: 0.6 } : { opacity: [0, 0.9, 0.25, 0.9] }}
            transition={reduce ? { duration: 0.6 } : { delay: rnd(i, 10) * 1.2, duration: 2 + rnd(i, 11) * 2, repeat: Infinity, repeatType: 'mirror' }}
          />
        )
      })}
    </div>
  )
}

/** Longest moment: cosmic emblem, then it flies off into the Hall of Fame. */
export function EternalScene({ habit, state, reduce }: SceneProps) {
  const [phase, setPhase] = useState<'cosmic' | 'hall'>('cosmic')
  useEffect(() => {
    const t = setTimeout(() => setPhase('hall'), 3900)
    return () => clearTimeout(t)
  }, [])
  useFireworks(reduce, [
    { at: 1300, x: 0.5, y: 0.35, colors: GOLD, n: 140 },
    { at: 2000, x: 0.15, y: 0.25, colors: GOLD },
    { at: 2500, x: 0.85, y: 0.25, colors: GOLD },
  ])
  const hours = state ? fmtInt(state.totalMinutes / 60) : undefined
  return (
    <>
      <motion.div
        aria-hidden
        className="pointer-events-none fixed inset-0 -z-10"
        style={{ background: 'radial-gradient(ellipse at 50% 40%, #3a2470 0%, #160d33 45%, #05040c 100%)' }}
        initial={{ opacity: 0 }}
        animate={{ opacity: 1 }}
        transition={{ duration: 1 }}
      />
      <Stars reduce={reduce} />
      <motion.div
        aria-hidden
        className="pointer-events-none fixed right-5 top-5 grid h-12 w-12 place-items-center rounded-full text-[#ffd860]"
        initial={{ opacity: 0 }}
        animate={phase === 'hall' ? { opacity: 1, scale: reduce ? 1 : [1, 1.5, 1], boxShadow: '0 0 30px #ffcf3f' } : { opacity: 0.25 }}
        transition={{ delay: phase === 'hall' ? 0.55 : 0, duration: 0.6 }}
      >
        <Glyph name="trophy" size={28} />
      </motion.div>
      <Kicker color="#ffe27a" reduce={reduce} delay={0.4}>Target complete</Kicker>
      <Stage size={280}>
        <motion.div aria-hidden className="absolute inset-0" animate={{ opacity: phase === 'hall' ? 0.2 : 1 }} transition={{ duration: 0.9 }}>
          <Glow color="#ffcf3f" size={500} delay={0.3} reduce={reduce} />
          <Rays color="#ffe27a" delay={0.6} size={640} reduce={reduce} />
          <Shockwave color="#ffe27a" delay={1.2} reduce={reduce} count={3} size={220} />
          <Sparks colors={GOLD} delay={1.25} reduce={reduce} count={34} spread={220} />
        </motion.div>
        <motion.div
          className="relative"
          initial={reduce ? { opacity: 0 } : { opacity: 0, scale: 0.15, y: 60 }}
          animate={
            phase === 'hall'
              ? reduce ? { opacity: 0 } : { opacity: [1, 1, 0], scale: [1, 0.5, 0.12], x: [0, 60, 150], y: [0, -180, -330] }
              : { opacity: 1, scale: 1, y: 0 }
          }
          transition={phase === 'hall' ? { duration: reduce ? 0.5 : 0.8, ease: 'easeIn' } : reduce ? { delay: 0.6, duration: 0.6 } : { delay: 0.6, type: 'spring', stiffness: 60, damping: 12 }}
        >
          <Emblem tier={10} size={210} reducedMotion={reduce} />
        </motion.div>
      </Stage>
      <AnimatePresence mode="wait">
        {phase === 'cosmic' ? (
          <motion.div key="cosmic" className="relative flex flex-col items-center gap-3" exit={{ opacity: 0 }}>
            <Slam delay={1.2} reduce={reduce} className="text-6xl">
              <span className="bg-gradient-to-b from-[#fff6d0] via-[#ffe27a] to-[#e8780c] bg-clip-text text-transparent">Eternal</span>
            </Slam>
            {hours && <Sub delay={1.7} reduce={reduce}>{hours} hours. You did the whole thing.</Sub>}
          </motion.div>
        ) : (
          <motion.div key="hall" className="relative flex flex-col items-center gap-2" initial={{ opacity: 0, y: reduce ? 0 : 16 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: 0.5 }}>
            <h2 className="font-display text-3xl font-extrabold text-[#ffe27a]">Moved to Hall of Fame</h2>
            <p className="text-white/70">{habit.name} now lives on the trophy shelf.</p>
          </motion.div>
        )}
      </AnimatePresence>
    </>
  )
}

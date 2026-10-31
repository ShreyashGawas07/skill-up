import type { ReactNode } from 'react'
import { motion, type MotionProps, type Transition } from 'framer-motion'
import type { Habit, HabitState } from '@/domain/types'
import type { Celebration } from '@/feedback/celebrations'

export interface SceneProps {
  c: Celebration
  habit: Habit
  state?: HabitState
  reduce: boolean
}

type AnimProps = Pick<MotionProps, 'initial' | 'animate' | 'transition'>

/** Full animation, or an opacity-only fade at the same moment under reduce motion. */
export function anim(
  reduce: boolean, delay: number, initial: MotionProps['initial'], animate: MotionProps['animate'], transition: Transition = {},
): AnimProps {
  if (reduce) return { initial: { opacity: 0 }, animate: { opacity: 1 }, transition: { delay, duration: 0.4 } }
  return { initial, animate, transition: { delay, ...transition } }
}

export const SLAM: Transition = { type: 'spring', stiffness: 520, damping: 17, mass: 0.9 }
export const RISE: Transition = { type: 'spring', stiffness: 170, damping: 15 }

/** Small uppercase label above the main visual. */
export function Kicker({ children, color = '#ffffffb3', delay = 0.1, reduce }: { children: ReactNode; color?: string; delay?: number; reduce: boolean }) {
  return (
    <motion.p
      className="relative font-display text-sm font-bold uppercase tracking-[0.35em]"
      style={{ color }}
      {...anim(reduce, delay, { opacity: 0, y: -12, letterSpacing: '0.8em' }, { opacity: 1, y: 0, letterSpacing: '0.35em' }, { duration: 0.6, ease: 'easeOut' })}
    >
      {children}
    </motion.p>
  )
}

/** Big display word that slams in from oversized. */
export function Slam({ children, delay, reduce, color = '#ffffff', glow, className = 'text-5xl' }: {
  children: ReactNode; delay: number; reduce: boolean; color?: string; glow?: string; className?: string
}) {
  return (
    <motion.h2
      className={`relative font-display font-black uppercase leading-none tracking-wide ${className}`}
      style={{ color, textShadow: glow ? `0 0 24px ${glow}, 0 0 60px ${glow}88` : undefined }}
      {...anim(reduce, delay, { opacity: 0, scale: 2.6, filter: 'blur(8px)' }, { opacity: 1, scale: 1, filter: 'blur(0px)' }, SLAM)}
    >
      {children}
    </motion.h2>
  )
}

export function Sub({ children, delay, reduce, className = 'text-white/70' }: { children: ReactNode; delay: number; reduce: boolean; className?: string }) {
  return (
    <motion.p className={`relative max-w-[18rem] text-center text-base ${className}`} {...anim(reduce, delay, { opacity: 0, y: 10 }, { opacity: 1, y: 0 }, { duration: 0.5 })}>
      {children}
    </motion.p>
  )
}

/** Rotating light rays behind the hero visual. Static fade under reduce motion. */
export function Rays({ color, delay = 0, size = 520, reduce, opacity = 1 }: { color: string; delay?: number; size?: number; reduce: boolean; opacity?: number }) {
  return (
    <motion.div
      aria-hidden
      className="pointer-events-none absolute left-1/2 top-1/2 rounded-full"
      style={{
        width: size,
        height: size,
        marginLeft: -size / 2,
        marginTop: -size / 2,
        background: `repeating-conic-gradient(from 0deg, ${color}66 0deg 7deg, transparent 7deg 20deg)`,
        WebkitMaskImage: 'radial-gradient(circle, #000 12%, transparent 68%)',
        maskImage: 'radial-gradient(circle, #000 12%, transparent 68%)',
      }}
      initial={reduce ? { opacity: 0 } : { opacity: 0, scale: 0.3, rotate: 0 }}
      animate={reduce ? { opacity } : { opacity, scale: 1, rotate: 360 }}
      transition={{
        opacity: { delay, duration: 0.6 },
        scale: { delay, type: 'spring', stiffness: 90, damping: 14 },
        rotate: { delay, duration: 24, repeat: Infinity, ease: 'linear' },
      }}
    />
  )
}

/** Soft radial glow pool. */
export function Glow({ color, size = 360, delay = 0, reduce }: { color: string; size?: number; delay?: number; reduce: boolean }) {
  return (
    <motion.div
      aria-hidden
      className="pointer-events-none absolute left-1/2 top-1/2 rounded-full"
      style={{ width: size, height: size, marginLeft: -size / 2, marginTop: -size / 2, background: `radial-gradient(circle, ${color}66 0%, ${color}22 40%, transparent 70%)` }}
      {...anim(reduce, delay, { opacity: 0, scale: 0.4 }, { opacity: 1, scale: 1 }, { duration: 0.8, ease: 'easeOut' })}
    />
  )
}

/** Expanding shockwave ring(s). Hidden under reduce motion. */
export function Shockwave({ color, delay, reduce, count = 1, size = 180 }: { color: string; delay: number; reduce: boolean; count?: number; size?: number }) {
  if (reduce) return null
  return (
    <>
      {Array.from({ length: count }, (_, i) => (
        <motion.div
          key={i}
          aria-hidden
          className="pointer-events-none absolute left-1/2 top-1/2 rounded-full"
          style={{ width: size, height: size, marginLeft: -size / 2, marginTop: -size / 2, border: `3px solid ${color}`, boxShadow: `0 0 24px ${color}` }}
          initial={{ opacity: 0, scale: 0.4 }}
          animate={{ opacity: [0, 0.9, 0], scale: [0.4, 1.1, 2.4] }}
          transition={{ delay: delay + i * 0.18, duration: 1.1, ease: 'easeOut' }}
        />
      ))}
    </>
  )
}

/** Deterministic pseudo-random in [0,1) for particle layouts. */
export const rnd = (i: number, salt = 1) => {
  const x = Math.sin(i * 12.9898 + salt * 78.233) * 43758.5453
  return x - Math.floor(x)
}

/** Sparks bursting outward (and drifting up) from the centre. Hidden under reduce motion. */
export function Sparks({ colors, delay, reduce, count = 22, spread = 170, rise = 0 }: {
  colors: string[]; delay: number; reduce: boolean; count?: number; spread?: number; rise?: number
}) {
  if (reduce) return null
  return (
    <div aria-hidden className="pointer-events-none absolute left-1/2 top-1/2">
      {Array.from({ length: count }, (_, i) => {
        const a = (i / count) * Math.PI * 2 + rnd(i) * 0.5
        const d = spread * (0.45 + rnd(i, 2) * 0.55)
        const s = 3 + rnd(i, 3) * 5
        return (
          <motion.span
            key={i}
            className="absolute rounded-full"
            style={{ width: s, height: s, marginLeft: -s / 2, marginTop: -s / 2, background: colors[i % colors.length], boxShadow: `0 0 8px ${colors[i % colors.length]}` }}
            initial={{ x: 0, y: 0, opacity: 0, scale: 0.4 }}
            animate={{ x: Math.cos(a) * d, y: Math.sin(a) * d - rise, opacity: [0, 1, 0], scale: [0.4, 1.2, 0.6] }}
            transition={{ delay: delay + rnd(i, 4) * 0.15, duration: 1 + rnd(i, 5) * 0.6, ease: [0.15, 0.7, 0.3, 1] }}
          />
        )
      })}
    </div>
  )
}

/** Square hero stage that centres layered visuals. */
export function Stage({ size = 240, children }: { size?: number; children: ReactNode }) {
  return (
    <div className="relative my-2 grid place-items-center" style={{ width: size, height: size }}>
      {children}
    </div>
  )
}

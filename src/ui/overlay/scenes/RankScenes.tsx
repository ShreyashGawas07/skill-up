import { motion } from 'framer-motion'
import { TIERS } from '@/domain/tiers'
import { TIER_STYLE } from '@/ui/theme'
import { Emblem } from '@/ui/art/Emblem'
import { clampTier } from '@/ui/art/emblemSvg'
import { rankBefore, rankBeforeLoss } from '../history'
import { anim, Glow, Kicker, Rays, RISE, Shockwave, Slam, Sparks, Stage, Sub, type SceneProps } from './shared'

const nameOf = (t: number) => TIERS[clampTier(t) - 1].name
const SHARDS = 10

/** The old emblem trembles, then breaks into wedges that fly apart. Fades out under reduce motion. */
function Shatter({ tier, size, at, reduce }: { tier: number; size: number; at: number; reduce: boolean }) {
  if (reduce) {
    return (
      <motion.div aria-hidden className="absolute" initial={{ opacity: 1 }} animate={{ opacity: 0 }} transition={{ delay: at, duration: 0.3 }}>
        <Emblem tier={tier} size={size} animate={false} reducedMotion />
      </motion.div>
    )
  }
  return (
    <motion.div
      aria-hidden
      className="absolute"
      style={{ width: size, height: size }}
      initial={{ opacity: 0, scale: 0.8 }}
      animate={{ opacity: 1, scale: 1, x: [0, 0, -5, 5, -6, 6, -3, 0], rotate: [0, 0, -2, 2, -3, 3, 0, 0] }}
      transition={{ opacity: { duration: 0.2 }, scale: { duration: 0.25 }, x: { duration: at, times: [0, 0.35, 0.5, 0.6, 0.7, 0.8, 0.9, 1] }, rotate: { duration: at } }}
    >
      {Array.from({ length: SHARDS }, (_, i) => {
        const a0 = (i / SHARDS) * Math.PI * 2
        const a1 = ((i + 1) / SHARDS) * Math.PI * 2
        const mid = (a0 + a1) / 2
        const pt = (a: number) => `${50 + Math.cos(a) * 75}% ${50 + Math.sin(a) * 75}%`
        const clip = `polygon(50% 50%, ${pt(a0)}, ${pt(a1)})`
        const dist = size * (0.9 + (i % 3) * 0.35)
        return (
          <motion.div
            key={i}
            className="absolute inset-0"
            style={{ clipPath: clip, WebkitClipPath: clip }}
            initial={{ x: 0, y: 0, rotate: 0, opacity: 1 }}
            animate={{ x: Math.cos(mid) * dist, y: Math.sin(mid) * dist + size * 0.6, rotate: (i % 2 ? 1 : -1) * (90 + i * 25), opacity: 0, scale: 0.7 }}
            transition={{ delay: at, duration: 0.95, ease: [0.2, 0.75, 0.35, 1] }}
          >
            <Emblem tier={tier} size={size} animate={false} reducedMotion />
          </motion.div>
        )
      })}
    </motion.div>
  )
}

/** Brief white flash over everything (impact frame). */
function Flash({ at, reduce }: { at: number; reduce: boolean }) {
  if (reduce) return null
  return (
    <motion.div
      aria-hidden
      className="pointer-events-none fixed inset-0 bg-white"
      initial={{ opacity: 0 }}
      animate={{ opacity: [0, 0.55, 0] }}
      transition={{ delay: at, duration: 0.45, times: [0, 0.15, 1] }}
    />
  )
}

export function RankUpScene({ c, state, reduce }: SceneProps) {
  const tier = clampTier(c.value ?? state?.rank ?? 1)
  const before = rankBefore(state, c.key) ?? tier - 1
  const style = TIER_STYLE[tier]
  const SHATTER = 0.65
  return (
    <>
      <Kicker color={style.glow} reduce={reduce}>Rank up</Kicker>
      <Stage size={260}>
        <Glow color={style.glow} size={420} delay={SHATTER} reduce={reduce} />
        <Rays color={style.glow} delay={SHATTER + 0.1} size={560} reduce={reduce} />
        {before >= 1 && before < tier && <Shatter tier={before} size={150} at={SHATTER} reduce={reduce} />}
        <Shockwave color={style.primary} delay={SHATTER + 0.05} reduce={reduce} count={2} />
        <Sparks colors={[style.primary, style.glow, '#ffffff']} delay={SHATTER + 0.3} reduce={reduce} count={26} spread={190} />
        <motion.div className="relative" {...anim(reduce, SHATTER + 0.25, { opacity: 0, y: 120, scale: 0.4 }, { opacity: 1, y: 0, scale: 1 }, RISE)}>
          <Emblem tier={tier} size={200} reducedMotion={reduce} />
        </motion.div>
      </Stage>
      <Slam delay={SHATTER + 0.75} reduce={reduce} color={style.primary} glow={style.glow}>
        {nameOf(tier)}
      </Slam>
      <Sub delay={SHATTER + 1.15} reduce={reduce}>Tier {tier} of 10</Sub>
      <Flash at={SHATTER} reduce={reduce} />
    </>
  )
}

const RUNG = 52

export function RankLostScene({ c, state, reduce }: SceneProps) {
  const tier = clampTier(c.value ?? state?.rank ?? 1)
  const from = clampTier(rankBeforeLoss(state, c.key, tier))
  const steps = Math.max(0, from - tier)
  const CRACK = 0.3
  const DROP = 0.75
  const top = -(steps * RUNG) / 2
  return (
    <>
      <motion.div
        aria-hidden
        className="pointer-events-none fixed inset-0 -z-10"
        style={{ background: 'radial-gradient(ellipse at center, transparent 35%, rgba(200,20,45,0.38) 75%, rgba(150,0,25,0.7) 100%)' }}
        initial={{ opacity: 0 }}
        animate={{ opacity: reduce ? 1 : [0, 1, 0.75] }}
        transition={{ duration: reduce ? 0.4 : 0.9, times: reduce ? undefined : [0, 0.35, 1] }}
      />
      <Kicker color="#ff8a98" reduce={reduce}>Rank lost</Kicker>
      <Stage size={240}>
        {Array.from({ length: steps + 1 }, (_, i) => (
          <motion.div
            key={i}
            aria-hidden
            className="absolute h-1 w-40 rounded-full bg-white/15"
            style={{ top: `calc(50% + ${top + i * RUNG}px + 48px)` }}
            initial={{ opacity: 0, scaleX: 0.3 }}
            animate={{ opacity: 1, scaleX: 1 }}
            transition={{ delay: 0.05 * i, duration: reduce ? 0.3 : 0.4 }}
          />
        ))}
        <motion.div
          className="absolute"
          initial={{ y: top }}
          animate={reduce ? { y: top } : { y: [top, top, top - 10, top + steps * RUNG, top + steps * RUNG - 8, top + steps * RUNG] }}
          transition={{ duration: 1.1, delay: DROP - 0.35, times: [0, 0.3, 0.42, 0.75, 0.88, 1], ease: 'easeIn' }}
        >
          <motion.div
            animate={reduce ? undefined : { x: [0, -7, 7, -5, 5, -2, 0] }}
            transition={{ delay: CRACK, duration: 0.35 }}
            className="relative"
            style={{ width: 110, height: 110 }}
          >
            <motion.div aria-hidden className="absolute inset-0" initial={{ opacity: 1 }} animate={{ opacity: 0 }} transition={{ delay: CRACK, duration: 0.15 }}>
              <Emblem tier={from} size={110} animate={false} reducedMotion={reduce} />
            </motion.div>
            <motion.div aria-hidden className="absolute inset-0" initial={{ opacity: 0 }} animate={{ opacity: [0, 1, 1, 0] }} transition={{ delay: CRACK, duration: DROP + 0.4, times: [0, 0.1, 0.75, 1] }}>
              <Emblem tier={from} size={110} cracked reducedMotion={reduce} />
            </motion.div>
            <motion.div className="absolute inset-0" initial={{ opacity: 0 }} animate={{ opacity: 1 }} transition={{ delay: CRACK + DROP + 0.25, duration: 0.35 }}>
              <Emblem tier={tier} size={110} animate={false} reducedMotion={reduce} />
            </motion.div>
          </motion.div>
        </motion.div>
      </Stage>
      <motion.h2
        className="relative font-display text-3xl font-extrabold text-white"
        {...anim(reduce, 1.0, { opacity: 0, y: -14 }, { opacity: 1, y: 0 }, { type: 'spring', stiffness: 300, damping: 20 })}
      >
        {`${nameOf(from)} → ${nameOf(tier)}`}
      </motion.h2>
      <Sub delay={1.3} reduce={reduce} className="text-white/60">
        7 done days in a row wins a tier back.
      </Sub>
    </>
  )
}

export function RankRecoveredScene({ c, state, reduce }: SceneProps) {
  const tier = clampTier(c.value ?? state?.rank ?? 1)
  const style = TIER_STYLE[tier]
  const IGNITE = 0.7
  return (
    <>
      <Kicker color={style.glow} reduce={reduce}>Rank recovered</Kicker>
      <Stage size={250}>
        <Glow color={style.glow} size={380} delay={IGNITE} reduce={reduce} />
        <Rays color={style.glow} delay={IGNITE + 0.1} size={460} reduce={reduce} opacity={0.6} />
        <Shockwave color={style.primary} delay={IGNITE} reduce={reduce} count={3} size={170} />
        <Sparks colors={[style.primary, style.glow]} delay={IGNITE + 0.15} reduce={reduce} count={18} spread={150} rise={40} />
        <motion.div
          className="relative"
          style={{ width: 180, height: 180 }}
          animate={reduce ? undefined : { scale: [1, 1, 1.12, 1] }}
          transition={{ duration: IGNITE + 0.6, times: [0, IGNITE / (IGNITE + 0.6), 0.85, 1] }}
        >
          <Emblem tier={tier} size={180} reducedMotion={reduce} />
          <motion.div
            aria-hidden
            className="absolute inset-0"
            style={{ filter: 'grayscale(1) brightness(0.5)' }}
            initial={{ opacity: 1 }}
            animate={{ opacity: 0 }}
            transition={{ delay: IGNITE, duration: 0.9, ease: 'easeOut' }}
          >
            <Emblem tier={tier} size={180} animate={false} reducedMotion />
          </motion.div>
        </motion.div>
      </Stage>
      <Slam delay={IGNITE + 0.5} reduce={reduce} color={style.primary} glow={style.glow} className="text-4xl">
        {nameOf(tier)}
      </Slam>
      <Sub delay={IGNITE + 0.9} reduce={reduce}>Seven strong days. Your colour is back.</Sub>
    </>
  )
}

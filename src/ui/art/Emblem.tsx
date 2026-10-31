import { useId, useMemo } from 'react'
import { motion } from 'framer-motion'
import { TIERS } from '@/domain/tiers'
import { TIER_STYLE } from '@/ui/theme'
import { clampTier, emblemSvg } from './emblemSvg'
import { useReduce } from './useReduce'

interface Props {
  tier: number
  size?: number
  cracked?: boolean
  locked?: boolean
  /** Enable glow/shimmer (tiers ≥7) and rotating rays (tier 10). Default true. */
  animate?: boolean
  reducedMotion?: boolean
  className?: string
}

export function Emblem({ tier, size = 96, cracked, locked, animate = true, reducedMotion, className }: Props) {
  const t = clampTier(tier)
  const rawId = useId()
  const svg = useMemo(
    () => emblemSvg(t, { cracked, locked, idSuffix: rawId.replace(/[^A-Za-z0-9]/g, '') }),
    [t, cracked, locked, rawId],
  )
  const reduce = useReduce(reducedMotion)
  const live = animate && !locked && !cracked
  const glow = TIER_STYLE[t].glow
  const name = TIERS[t - 1].name
  const label = `${name}${locked ? ', locked' : ''}${cracked ? ', lost' : ''}`
  const mask = useMemo(() => `url("data:image/svg+xml;utf8,${encodeURIComponent(svg)}")`, [svg])

  return (
    <div
      role="img"
      aria-label={label}
      data-tier={t}
      className={`relative shrink-0 ${className ?? ''}`}
      style={{ width: size, height: size }}
    >
      {live && t >= 5 && (
        <motion.div
          aria-hidden
          className="pointer-events-none absolute inset-[-12%] rounded-full"
          style={{ background: `radial-gradient(circle, ${glow}55 0%, transparent 65%)` }}
          animate={reduce || t < 7 ? undefined : { opacity: [0.55, 1, 0.55], scale: [0.96, 1.04, 0.96] }}
          transition={{ duration: 3, repeat: Infinity, ease: 'easeInOut' }}
        />
      )}
      {live && t === 10 && (
        <motion.div
          aria-hidden
          className="pointer-events-none absolute inset-[-18%] rounded-full"
          style={{
            background: `repeating-conic-gradient(from 0deg, ${glow}66 0deg 5deg, transparent 5deg 22.5deg)`,
            WebkitMaskImage: 'radial-gradient(circle, #000 25%, transparent 70%)',
            maskImage: 'radial-gradient(circle, #000 25%, transparent 70%)',
          }}
          animate={reduce ? { opacity: [0.6, 1, 0.6] } : { rotate: 360 }}
          transition={reduce ? { duration: 4, repeat: Infinity } : { duration: 40, repeat: Infinity, ease: 'linear' }}
        />
      )}
      <div
        aria-hidden
        className="absolute inset-0 [&>svg]:h-full [&>svg]:w-full"
        style={locked ? { filter: 'saturate(0.6)' } : undefined}
        dangerouslySetInnerHTML={{ __html: svg }}
      />
      {live && t >= 7 && (
        <motion.div
          aria-hidden
          data-shimmer
          className="pointer-events-none absolute inset-0"
          style={{
            WebkitMaskImage: mask,
            maskImage: mask,
            WebkitMaskSize: '100% 100%',
            maskSize: '100% 100%',
            background:
              'linear-gradient(115deg, transparent 38%, rgba(255,255,255,0.65) 50%, transparent 62%)',
            backgroundSize: '260% 100%',
            mixBlendMode: 'overlay',
          }}
          initial={{ backgroundPosition: '120% 0%' }}
          animate={reduce ? { opacity: [0, 0.6, 0] } : { backgroundPosition: ['120% 0%', '-20% 0%'] }}
          transition={{ duration: reduce ? 4 : 2.4, repeat: Infinity, repeatDelay: reduce ? 0 : 2.2, ease: 'easeInOut' }}
        />
      )}
    </div>
  )
}

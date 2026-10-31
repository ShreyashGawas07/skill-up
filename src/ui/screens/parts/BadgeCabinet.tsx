import type { HabitState } from '@/domain/types'
import { Emblem } from '@/ui/art/Emblem'

/** The 30-day "Formed" seal: a laurel ring with a check, greyed until formed. */
function FormedSeal({ lit, size = 56 }: { lit: boolean; size?: number }) {
  const c = lit ? '#2f8a4f' : '#8a8178'
  return (
    <svg viewBox="0 0 56 56" width={size} height={size} role="img" aria-label={lit ? 'Formed' : 'Formed, locked'}>
      <defs>
        <radialGradient id={`seal-${lit ? 'on' : 'off'}`} cx="0.4" cy="0.35" r="0.7">
          <stop offset="0" stopColor={lit ? '#d3f9d8' : '#d8d0c3'} />
          <stop offset="1" stopColor={lit ? '#5fbf7f' : '#9a9184'} />
        </radialGradient>
      </defs>
      <circle cx="28" cy="28" r="22" fill={`url(#seal-${lit ? 'on' : 'off'})`} opacity={lit ? 1 : 0.6} />
      <circle cx="28" cy="28" r="25" fill="none" stroke={c} strokeWidth="2" strokeDasharray="3 3" />
      {lit ? (
        <path d="M19 29l6 6 12-13" fill="none" stroke="#fff" strokeWidth="4" strokeLinecap="round" strokeLinejoin="round" />
      ) : (
        <path d="M23 27v-3a5 5 0 0 1 10 0v3M21 27h14v10H21z" fill="none" stroke="#c9ced6" strokeWidth="2.4" strokeLinejoin="round" />
      )}
    </svg>
  )
}

/** Earned badges: the Formed seal plus every tier ever reached; tiers since lost are greyed. */
export function BadgeCabinet({ state, reducedMotion }: { state: HabitState; reducedMotion?: boolean }) {
  const tiers = [...state.badges.tiersReached].sort((a, b) => a - b)
  return (
    <ul aria-label="Badges" className="grid grid-cols-4 gap-3">
      <li className="flex flex-col items-center gap-1">
        <FormedSeal lit={state.badges.formed} />
        {!state.badges.formed && (
          <span className="font-display text-xs font-semibold text-muted">{state.formingDone}/30</span>
        )}
      </li>
      {tiers.map((t) => {
        const lost = t > state.rank
        return (
          <li key={t} data-lost={lost || undefined} className={`flex justify-center ${lost ? 'opacity-50 grayscale' : ''}`}>
            <Emblem tier={t} size={56} cracked={lost} animate={false} reducedMotion={reducedMotion} />
          </li>
        )
      })}
    </ul>
  )
}

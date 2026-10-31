export const TIERS: { tier: number; name: string; pct: number }[] = [
  { tier: 1, name: 'Novice', pct: 0 },
  { tier: 2, name: 'Apprentice', pct: 0.5 },
  { tier: 3, name: 'Adept', pct: 2 },
  { tier: 4, name: 'Skilled', pct: 5 },
  { tier: 5, name: 'Expert', pct: 10 },
  { tier: 6, name: 'Elite', pct: 20 },
  { tier: 7, name: 'Master', pct: 40 },
  { tier: 8, name: 'Grandmaster', pct: 65 },
  { tier: 9, name: 'Legend', pct: 85 },
  { tier: 10, name: 'Eternal', pct: 100 },
]

export const MAX_TIER = TIERS.length

/** Highest tier whose threshold is reached (1..10). Compared as minutes·100 vs pct·hours·60 to stay exact. */
export function earnedTier(totalMinutes: number, targetHours: number): number {
  let tier = 1
  for (const t of TIERS) {
    if (totalMinutes * 100 >= t.pct * targetHours * 60) tier = t.tier
  }
  return tier
}

export function tierThresholdHours(tier: number, targetHours: number): number {
  const t = TIERS[Math.min(Math.max(tier, 1), MAX_TIER) - 1]
  return (t.pct * targetHours) / 100
}

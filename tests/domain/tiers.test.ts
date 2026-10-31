import { describe, it, expect } from 'vitest'
import { TIERS, earnedTier, tierThresholdHours } from '@/domain/tiers'

describe('tiers', () => {
  it('has 10 tiers with the spec names and percentages', () => {
    expect(TIERS.map((t) => t.tier)).toEqual([1, 2, 3, 4, 5, 6, 7, 8, 9, 10])
    expect(TIERS.map((t) => t.pct)).toEqual([0, 0.5, 2, 5, 10, 20, 40, 65, 85, 100])
    expect(TIERS.map((t) => t.name)).toEqual([
      'Novice', 'Apprentice', 'Adept', 'Skilled', 'Expert', 'Elite', 'Master', 'Grandmaster', 'Legend', 'Eternal',
    ])
  })

  it('earnedTier at default target', () => {
    expect(earnedTier(0, 10000)).toBe(1)
    expect(earnedTier(50 * 60, 10000)).toBe(2)
    expect(earnedTier(49 * 60 + 59, 10000)).toBe(1)
    expect(earnedTier(10000 * 60, 10000)).toBe(10)
  })

  it('earnedTier with a non-default target', () => {
    // Brief listed 5 here, but 50 h of 1000 h is 5% = tier 4 (Skilled) per the tier table; 10% (100 h) = tier 5.
    expect(earnedTier(50 * 60, 1000)).toBe(4)
    expect(earnedTier(100 * 60, 1000)).toBe(5)
    expect(earnedTier(100 * 60 - 1, 1000)).toBe(4)
  })

  it('tierThresholdHours', () => {
    expect(tierThresholdHours(7, 10000)).toBe(4000)
    expect(tierThresholdHours(1, 10000)).toBe(0)
    expect(tierThresholdHours(2, 10000)).toBe(50)
  })
})

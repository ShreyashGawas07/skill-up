import { addDays, parse, format } from 'date-fns'
import { commitmentOn, dayKey, daysBetween, minutesByDay } from './days'
import { MAX_TIER, earnedTier as tierFor } from './tiers'
import type { AppEvent, DayKey, DayRecord, EventType, Habit, HabitState, Session } from './types'

/** A running session older than this is excluded until the user resolves it. */
export const STALE_MS = 16 * 3600_000

export const FORMING_DAYS = 30
export const RECOVERY_DAYS = 7
export const MISS_PENALTY = 2

const FIXED_MILESTONES = [7, 14, 30, 50, 100, 200, 365]

export function isStreakMilestone(streak: number): boolean {
  return FIXED_MILESTONES.includes(streak) || (streak > 365 && streak % 365 === 0)
}

function previousDay(key: DayKey): DayKey {
  return format(addDays(parse(key, 'yyyy-MM-dd', new Date()), -1), 'yyyy-MM-dd')
}

/**
 * Pure replay of a habit's sessions from its creation day to `now`.
 * Same inputs always produce the same state and the same event keys.
 */
export function evaluate(habit: Habit, sessions: Session[], now: number): HabitState {
  const today = dayKey(now)
  const creationKey = dayKey(habit.createdAt)

  let staleSession: Session | undefined
  const counted: Session[] = []
  for (const s of sessions) {
    if (s.habitId !== habit.id) continue
    if (s.end === undefined && now - s.start > STALE_MS) {
      staleSession = s
      continue
    }
    counted.push(s)
  }
  const minutes = minutesByDay(counted, now)

  const events: AppEvent[] = []
  const emit = (type: EventType, day: DayKey, value?: number) => {
    const key = value === undefined ? `${type}:${day}` : `${type}:${day}:${value}`
    events.push(value === undefined ? { key, type, habitId: habit.id, day } : { key, type, habitId: habit.id, day, value })
  }

  const days: DayRecord[] = []
  let total = 0
  let overtime = 0
  let streak = 0
  let longest = 0
  let formingDone = 0
  let formed = false
  let earned = 1
  let lostTiers = 0
  let recovery = 0
  let eternal = false
  const rankOf = () => Math.max(1, earned - lostTiers)

  for (const key of daysBetween(creationKey, today)) {
    const m = minutes.get(key) ?? 0
    const c = commitmentOn(habit, key)
    total += m

    const status = m >= c ? 'done' : key === today ? 'pending' : key === creationKey ? 'grace' : 'missed'
    days.push({ key, minutes: m, commitment: c, status })

    if (status === 'done') {
      overtime += m - c
      streak++
      longest = Math.max(longest, streak)
      emit('DAY_COMPLETE', key)
      if (m > c) emit('OVERTIME', key, m - c)
      if (isStreakMilestone(streak)) emit('STREAK_MILESTONE', key, streak)
      if (!formed) {
        formingDone++
        if (formingDone === FORMING_DAYS) {
          formed = true
          emit('HABIT_FORMED', key)
        }
      }
      if (lostTiers > 0) {
        recovery++
        if (recovery === RECOVERY_DAYS) {
          lostTiers--
          recovery = 0
          emit('RANK_RECOVERED', key, rankOf())
        }
      }
    } else if (status === 'missed') {
      if (!formed && formingDone > 0) emit('STREAK_RESET', key)
      formingDone = formed ? formingDone : 0
      streak = 0
      recovery = 0
      const prevRank = rankOf()
      lostTiers = Math.min(lostTiers + MISS_PENALTY, earned - 1)
      if (rankOf() !== prevRank) emit('RANK_LOST', key, rankOf())
    }

    const earnedNow = tierFor(total, habit.targetHours)
    if (earnedNow > earned) {
      earned = earnedNow
      if (earned === MAX_TIER) {
        // Eternal clears penalties before the rank-up is reported.
        lostTiers = 0
        recovery = 0
      }
      emit('RANK_UP', key, rankOf())
    }
    if (earned === MAX_TIER) {
      eternal = true
      emit('ETERNAL', key)
      break
    }
  }

  const yesterday = days.find((d) => d.key === previousDay(today))

  return {
    habitId: habit.id,
    today,
    todayMinutes: minutes.get(today) ?? 0,
    commitment: commitmentOn(habit, today),
    days,
    formingDone,
    formed,
    streak,
    longestStreak: longest,
    totalMinutes: total,
    overtimeMinutes: overtime,
    earnedTier: earned,
    lostTiers,
    recoveryProgress: recovery,
    rank: rankOf(),
    eternal,
    badges: { formed, tiersReached: Array.from({ length: earned }, (_, i) => i + 1) },
    missedYesterday: yesterday?.status === 'missed',
    ...(staleSession ? { staleSession } : {}),
    events,
  }
}

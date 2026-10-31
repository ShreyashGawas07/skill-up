import { addDays, addMinutes, format, set, startOfDay } from 'date-fns'
import type { Habit, HabitState, Session } from '@/domain/types'
import { TIERS } from '@/domain/tiers'
import { FORMING_DAYS, MISS_PENALTY } from '@/domain/evaluate'
import { commitmentOn, dayKey } from '@/domain/days'
import { pickMessage } from './messages'
import type { MsgCtx } from './messages'

export type NotifKind = 'reminder' | 'lastChance' | 'running' | 'dayComplete' | 'missed'

export interface NotifSpec {
  id: number
  habitId: string
  kind: NotifKind
  at: number | null // null = now
  title: string
  body: string
  ongoing?: boolean
  largeIconTier?: number
  actionTypeId?: 'SESSION'
}

const KIND_INDEX: Record<NotifKind, number> = { reminder: 0, lastChance: 1, running: 2, dayComplete: 3, missed: 4 }
const LAST_CHANCE = { hours: 22, minutes: 30 }
const MISSED_AT = { hours: 8, minutes: 0 }
const MAX_SLOTS = 2
const MAX_HORIZON = 99 // dayOffset must stay < 100 so ids never collide across kinds

export function notifId(slot: 0 | 1, kind: NotifKind, dayOffset: number): number {
  return slot * 1000 + KIND_INDEX[kind] * 100 + dayOffset
}

const tierName = (tier: number) => TIERS[Math.min(Math.max(tier, 1), TIERS.length) - 1].name

/** Local wall-clock time on the day `offset` days after `now`'s day (DST-safe). */
function atLocal(now: number, offset: number, t: { hours: number; minutes: number }): number {
  return set(addDays(startOfDay(now), offset), { ...t, seconds: 0, milliseconds: 0 }).getTime()
}

function parseHHmm(s: string): { hours: number; minutes: number } {
  const [h, m] = s.split(':').map(Number)
  return { hours: h || 0, minutes: m || 0 }
}

export function buildSchedule(input: {
  habits: Habit[]
  states: Record<string, HabitState>
  running?: Session
  now: number
  horizonDays?: number
}): NotifSpec[] {
  const { habits, states, running, now } = input
  const horizon = Math.min(Math.max(0, Math.floor(input.horizonDays ?? 7)), MAX_HORIZON)
  const active = habits
    .filter((h) => h.archivedAt === undefined && states[h.id] && !states[h.id].eternal)
    .sort((a, b) => a.createdAt - b.createdAt)
    .slice(0, MAX_SLOTS)

  const specs: NotifSpec[] = []
  active.forEach((habit, i) => {
    const slot = i as 0 | 1
    const st = states[habit.id]
    const rankCtx = (rank: number) => ({ rankName: tierName(rank), dropToName: tierName(Math.max(1, rank - 2)) })
    const base = { habit: habit.name, ...rankCtx(st.rank) }
    const push = (kind: NotifKind, offset: number, at: number | null, ctx: MsgCtx, extra: Partial<NotifSpec> = {}) => {
      const day = dayKey(at ?? now)
      specs.push({
        id: notifId(slot, kind, offset),
        habitId: habit.id,
        kind,
        at,
        ...pickMessage(kind, ctx, habit.id + day + kind),
        largeIconTier: st.rank,
        ...extra,
      })
    }

    const live = running && running.habitId === habit.id && running.end === undefined && !st.staleSession
      ? running
      : undefined
    const remainingToday = st.commitment - st.todayMinutes
    const todayDone = remainingToday <= 0
    /** Rank after `misses` further missed days, starting from the current state. */
    const projectedRank = (misses: number) =>
      Math.max(1, st.earnedTier - Math.min(st.lostTiers + MISS_PENALTY * misses, st.earnedTier - 1))
    /** Missed days strictly before day `d` (d >= 1), assuming nothing else gets done. */
    const missesBefore = (d: number) => (todayDone ? d - 1 : d)
    const formingToday = st.formed ? undefined : st.formingDone + 1

    // Running session: ongoing notification + day-complete at the moment the commitment is met.
    if (live) {
      const startedAt = format(live.start, 'HH:mm')
      push('running', 0, null, { ...base, minutesLeft: Math.max(0, remainingToday), streak: st.streak, startedAt }, {
        ongoing: true,
        actionTypeId: 'SESSION',
      })
      if (st.commitment > 0 && remainingToday > 0) {
        const at = addMinutes(now, remainingToday).getTime()
        if (dayKey(at) === dayKey(now)) {
          push('dayComplete', 0, at, { ...base, minutesLeft: st.commitment, streak: st.streak + 1 })
        }
      }
    }

    // Morning after a miss: today (yesterday was missed) ...
    if (st.missedYesterday) {
      const at = atLocal(now, 0, MISSED_AT)
      if (at > now) {
        const yesterday = dayKey(addDays(startOfDay(now), -1).getTime())
        const rankLost = st.events.some((e) => e.type === 'RANK_LOST' && e.day === yesterday)
        push('missed', 0, at, { ...base, minutesLeft: st.commitment, streak: st.streak, formingDay: formingToday, rankLost })
      }
    }
    // ... and each future morning, which only fires if the previous day was missed too.
    for (let d = 1; d <= horizon; d++) {
      if (d === 1 && todayDone) continue
      const at = atLocal(now, d, MISSED_AT)
      const commitment = commitmentOn(habit, dayKey(at))
      if (commitment <= 0) continue
      const after = projectedRank(missesBefore(d))
      const before = projectedRank(missesBefore(d) - 1)
      push('missed', d, at, { habit: habit.name, ...rankCtx(after), minutesLeft: commitment, streak: 0, rankLost: after < before })
    }

    // Reminders and last chances, today (if not done and no session is running) and the next `horizon` days.
    const reminderTime = parseHHmm(habit.reminderTime)
    // A reminder at or after 22:30 would duplicate lastChance.
    const remindersOn = reminderTime.hours * 60 + reminderTime.minutes < LAST_CHANCE.hours * 60 + LAST_CHANCE.minutes
    for (let d = 0; d <= horizon; d++) {
      let ctx: MsgCtx
      if (d === 0) {
        if (live || st.commitment <= 0 || remainingToday <= 0) continue
        const day = formingToday !== undefined && formingToday <= FORMING_DAYS ? formingToday : undefined
        ctx = { ...base, minutesLeft: remainingToday, streak: st.streak, formingDay: day }
      } else {
        // Future days: only fire if nothing was done since this plan (any app activity reschedules),
        // so cite the full commitment, the rank projected after the intervening misses, and no
        // streak/forming day (both would be reset by then). The icon keeps the current rank.
        const commitment = commitmentOn(habit, dayKey(atLocal(now, d, LAST_CHANCE)))
        if (commitment <= 0) continue
        ctx = { habit: habit.name, ...rankCtx(projectedRank(missesBefore(d))), minutesLeft: commitment, streak: 0 }
      }
      const rAt = atLocal(now, d, reminderTime)
      if (remindersOn && rAt > now) push('reminder', d, rAt, ctx)
      const lAt = atLocal(now, d, LAST_CHANCE)
      if (lAt > now) push('lastChance', d, lAt, ctx)
    }
  })
  return specs
}

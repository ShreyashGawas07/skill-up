import { create } from 'zustand'
import { App } from '@capacitor/app'
import { repo, DEFAULT_SETTINGS } from '@/data/repo'
import type { Settings } from '@/data/repo'
import { evaluate, isStale } from '@/domain/evaluate'
import { dayKey, nextDay } from '@/domain/days'
import type { Habit, HabitState, Session } from '@/domain/types'
import { buildSchedule } from '@/notify/plan'
import { applySchedule, registerNotificationActions } from '@/notify/scheduler'
import { celebrationKey, toCelebrations } from '@/feedback/celebrations'
import type { Celebration } from '@/feedback/celebrations'
import {
  resolveStale as resolveStaleTimer, StaleSessionError, startTimer, stopTimer,
} from '@/timer/timer'

export interface HabitInput {
  name: string
  icon: string
  color: string
  dailyMinutes: number
  targetHours: number
  reminderTime: string
}

export type HabitPatch = Partial<Pick<Habit, 'name' | 'icon' | 'color' | 'targetHours' | 'reminderTime' | 'archivedAt'>> & {
  dailyMinutes?: number
}

export interface AppStore {
  habits: Habit[]
  sessions: Session[]
  settings: Settings
  states: Record<string, HabitState>
  running?: Session
  queue: Celebration[]
  now: number
  load(): Promise<void>
  tick(now: number): void
  addHabit(input: HabitInput): Promise<Habit>
  updateHabit(id: string, patch: HabitPatch): Promise<void>
  deleteHabit(id: string): Promise<void>
  start(habitId: string): Promise<void>
  stop(): Promise<void>
  resolveStale(endAt: number): Promise<void>
  dismiss(key: string): Promise<void>
  saveSettings(s: Settings): Promise<void>
}

let clock: () => number = () => Date.now()
/** Test hook: replaces the time source used by every store action. */
export function setClock(fn: () => number): void {
  clock = fn
}

/**
 * Sentinel seen row marking that first-load seeding ran. It has no ':' so it never matches a
 * composite `${habitId}:${eventKey}` celebration key or deleteHabit's `${id}:` prefix pruning.
 */
export const SEEDED_KEY = '__seeded__'

/** Composite keys already celebrated; loaded from the DB in load(). */
let seen = new Set<string>()
let nativeHooked = false

/** Archived habits are frozen at their archive time so their stats stop changing. */
const stateOf = (h: Habit, sessions: Session[], now: number) =>
  evaluate(h, sessions, h.archivedAt === undefined ? now : Math.min(now, h.archivedAt))

function derive(habits: Habit[], sessions: Session[], now: number) {
  const states: Record<string, HabitState> = {}
  for (const h of habits) states[h.id] = stateOf(h, sessions, now)
  // A stale open session is surfaced via states[x].staleSession, not as running.
  const running = sessions.find((s) => s.end === undefined && !isStale(s, now))
  const events = habits.filter((h) => h.archivedAt === undefined).flatMap((h) => states[h.id].events)
  const queue = toCelebrations(events, seen)
  return { states, running, queue, now }
}

const isActive = (h: Habit, states: Record<string, HabitState>) =>
  h.archivedAt === undefined && !states[h.id]?.eternal

export const useApp = create<AppStore>()((set, get) => {
  /** Reschedules run one at a time, each planning from the state current when it runs, so the last wins. */
  let scheduling: Promise<void> = Promise.resolve()
  function reschedule(): Promise<void> {
    scheduling = scheduling.then(async () => {
      const { habits, states, running, now } = get()
      try {
        await applySchedule(buildSchedule({ habits, states, running, now }))
      } catch (e) {
        console.warn('Notification scheduling failed', e)
      }
    })
    return scheduling
  }

  /** Re-reads habits and sessions, recomputes everything, and reschedules notifications. */
  async function refresh(): Promise<void> {
    const [habits, sessions] = await Promise.all([repo.listHabits(), repo.listSessions()])
    set({ habits, sessions, ...derive(habits, sessions, clock()) })
    await reschedule()
  }

  /** Runs a timer operation; a stale open session leaves state for the UI's stale dialog. */
  async function timerOp(op: () => Promise<unknown>): Promise<void> {
    try {
      await op()
    } catch (e) {
      if (!(e instanceof StaleSessionError)) throw e
    }
    await refresh()
  }

  function hookNative(): void {
    if (nativeHooked) return
    nativeHooked = true
    void registerNotificationActions(() => void get().stop()).catch(() => {})
    try {
      // On resume: recompute (day may have rolled over) and refresh the notification plan.
      void App.addListener('appStateChange', ({ isActive: active }) => {
        if (!active) return
        get().tick(clock())
        void reschedule()
      }).catch(() => {})
    } catch {
      // App plugin unavailable; the UI's minute tick still keeps state current.
    }
  }

  return {
    habits: [],
    sessions: [],
    settings: { ...DEFAULT_SETTINGS },
    states: {},
    running: undefined,
    queue: [],
    now: clock(),

    async load() {
      const [habits, sessions, settings, seenKeys] = await Promise.all([
        repo.listHabits(), repo.listSessions(), repo.getSettings(), repo.seenKeys(),
      ])
      seen = seenKeys
      const now = clock()
      if (!seen.has(SEEDED_KEY)) {
        // Once per install: don't replay celebrations for days before today.
        const today = dayKey(now)
        const old = habits
          .flatMap((h) => stateOf(h, sessions, now).events)
          .filter((e) => e.day < today)
          .map(celebrationKey)
        const keys = [...old, SEEDED_KEY]
        await repo.markSeen(keys)
        keys.forEach((k) => seen.add(k))
      }
      set({ habits, sessions, settings, ...derive(habits, sessions, now) })
      hookNative()
      await reschedule()
    },

    tick(now) {
      const { habits, sessions } = get()
      set(derive(habits, sessions, now))
    },

    async addHabit(input) {
      const { habits, states } = get()
      if (habits.filter((h) => isActive(h, states)).length >= 2) throw new Error('2 habits max')
      const now = clock()
      const habit: Habit = {
        id: crypto.randomUUID(),
        name: input.name,
        icon: input.icon,
        color: input.color,
        targetHours: input.targetHours,
        reminderTime: input.reminderTime,
        createdAt: now,
        commitmentHistory: [{ fromDate: dayKey(now), dailyMinutes: input.dailyMinutes }],
      }
      await repo.putHabit(habit)
      await refresh()
      return habit
    },

    async updateHabit(id, patch) {
      const habit = get().habits.find((h) => h.id === id)
      if (!habit) throw new Error(`Unknown habit ${id}`)
      const { dailyMinutes, ...fields } = patch
      const next: Habit = { ...habit, ...fields }
      if ('archivedAt' in fields && fields.archivedAt === undefined) {
        delete next.archivedAt
        const { habits, states } = get()
        const others = habits.filter((h) => h.id !== id && isActive(h, states)).length
        if (habit.archivedAt !== undefined && !states[id]?.eternal && others >= 2) throw new Error('2 habits max')
      }
      const history = habit.commitmentHistory
      const current = history[history.length - 1]?.dailyMinutes
      if (dailyMinutes !== undefined && dailyMinutes !== current) {
        if (!get().states[id]?.formed) throw new Error('Daily hours are locked during the 30-day forming phase')
        const fromDate = nextDay(dayKey(clock()))
        next.commitmentHistory = [...history.filter((c) => c.fromDate !== fromDate), { fromDate, dailyMinutes }]
          .sort((a, b) => a.fromDate.localeCompare(b.fromDate))
      }
      await repo.putHabit(next)
      await refresh()
    },

    async deleteHabit(id) {
      if (get().running?.habitId === id) {
        try {
          await stopTimer(clock())
        } catch (e) {
          // A stale session of this habit is deleted with the habit's sessions below.
          if (!(e instanceof StaleSessionError)) throw e
        }
      }
      await repo.deleteHabit(id)
      seen = new Set([...seen].filter((k) => !k.startsWith(`${id}:`)))
      await refresh()
    },

    async start(habitId) {
      const habit = get().habits.find((h) => h.id === habitId)
      if (!habit || habit.archivedAt !== undefined || get().states[habitId]?.eternal) return
      await timerOp(() => startTimer(habitId, clock()))
    },

    async stop() {
      await timerOp(() => stopTimer(clock()))
    },

    async resolveStale(endAt) {
      const stale = Object.values(get().states).find((s) => s.staleSession)?.staleSession
      if (!stale) return
      await resolveStaleTimer(stale, Math.min(endAt, clock()))
      await refresh()
    },

    async dismiss(key) {
      seen.add(key)
      set({ queue: get().queue.filter((c) => c.key !== key) })
      await repo.markSeen([key])
    },

    async saveSettings(s) {
      await repo.putSettings(s)
      set({ settings: { ...s } })
    },
  }
})

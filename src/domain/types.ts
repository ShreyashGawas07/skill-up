export type DayKey = string // 'YYYY-MM-DD' local

export interface CommitmentChange {
  fromDate: DayKey
  dailyMinutes: number
}

export interface Habit {
  id: string
  name: string
  icon: string
  color: string
  targetHours: number
  reminderTime: string // 'HH:mm'
  createdAt: number
  commitmentHistory: CommitmentChange[]
  archivedAt?: number
}

export interface Session {
  id: string
  habitId: string
  start: number
  end?: number
}

export type DayStatus = 'done' | 'missed' | 'pending' | 'grace' // grace = unfinished creation day

export type EventType =
  | 'DAY_COMPLETE'
  | 'OVERTIME'
  | 'STREAK_MILESTONE'
  | 'RANK_UP'
  | 'RANK_LOST'
  | 'RANK_RECOVERED'
  | 'STREAK_RESET'
  | 'HABIT_FORMED'
  | 'ETERNAL'

/** key = `${type}:${day}` or `${type}:${day}:${value}`; deterministic for the same inputs. */
export interface AppEvent {
  key: string
  type: EventType
  habitId: string
  day: DayKey
  value?: number
}

export interface DayRecord {
  key: DayKey
  minutes: number
  commitment: number
  status: DayStatus
}

export interface HabitState {
  habitId: string
  today: DayKey
  todayMinutes: number
  commitment: number
  days: DayRecord[]
  formingDone: number
  formed: boolean
  streak: number
  longestStreak: number
  totalMinutes: number
  overtimeMinutes: number
  earnedTier: number
  lostTiers: number
  recoveryProgress: number
  rank: number
  eternal: boolean
  badges: { formed: boolean; tiersReached: number[] }
  missedYesterday: boolean
  staleSession?: Session
  events: AppEvent[]
}

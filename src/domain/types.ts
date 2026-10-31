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

import { act, fireEvent, render, screen, waitFor, within } from '@testing-library/react'
import { addDays, setHours } from 'date-fns'

const sched = vi.hoisted(() => ({
  applySchedule: vi.fn(async (_specs: unknown[]) => {}),
  registerNotificationActions: vi.fn(async () => {}),
}))
vi.mock('@/notify/scheduler', () => sched)
vi.mock('@capacitor/app', () => ({ App: { addListener: vi.fn(async () => ({ remove: async () => {} })) } }))
const confetti = vi.hoisted(() => vi.fn())
vi.mock('canvas-confetti', () => ({ default: confetti }))
const haptic = vi.hoisted(() => ({ tick: vi.fn(), success: vi.fn(), heavy: vi.fn(), warn: vi.fn() }))
vi.mock('@/feedback/haptics', () => ({ haptic }))

import { db } from '@/data/db'
import { repo } from '@/data/repo'
import { dayKey } from '@/domain/days'
import type { Habit, HabitState } from '@/domain/types'
import { setClock, useApp } from '@/store/useApp'
import { Home } from '@/ui/screens/Home'

const BASE = new Date(2026, 0, 5)
const at = (n: number, h = 12) => setHours(addDays(BASE, n), h).getTime()
let now = at(0)
const S = () => useApp.getState()

const habit = (id: string, over: Partial<Habit> = {}): Habit => ({
  id, name: id, icon: 'book', color: '#4dabf7', targetHours: 10000, reminderTime: '19:00',
  createdAt: at(0, 1), commitmentHistory: [{ fromDate: dayKey(at(0)), dailyMinutes: 60 }], ...over,
})

const state = (habitId: string, over: Partial<HabitState> = {}): HabitState => ({
  habitId, today: dayKey(now), todayMinutes: 0, commitment: 60, days: [], formingDone: 12, formed: false,
  streak: 7, longestStreak: 7, totalMinutes: 312 * 60, overtimeMinutes: 0, earnedTier: 2, lostTiers: 0,
  recoveryProgress: 0, rank: 2, eternal: false, badges: { formed: false, tiersReached: [1, 2] },
  missedYesterday: false, events: [], ...over,
})

const nav = vi.fn()

beforeEach(async () => {
  await Promise.all(db.tables.map((t) => t.clear()))
  now = at(0)
  setClock(() => now)
  nav.mockClear()
  confetti.mockClear()
  haptic.success.mockClear()
  await S().load()
})

describe('Home', () => {
  it('with 0 habits shows two add slots that open the Add flow', () => {
    render(<Home onNavigate={nav} />)
    const slots = screen.getAllByRole('img', { name: 'Add a habit' })
    expect(slots).toHaveLength(2)
    fireEvent.click(slots[0])
    expect(nav).toHaveBeenCalledWith('add')
  })

  it('with 2 active habits: no add slot; "+" is locked and shows the 2-max sheet', async () => {
    await repo.putHabit(habit('a'))
    await repo.putHabit(habit('b'))
    await act(() => S().load())
    render(<Home onNavigate={nav} />)
    expect(screen.queryByRole('img', { name: 'Add a habit' })).toBeNull()
    expect(screen.queryByRole('img', { name: 'Locked slot' })).toBeNull()
    fireEvent.click(screen.getByRole('button', { name: /add habit \(locked\)/i }))
    const sheet = screen.getByRole('dialog')
    expect(within(sheet).getByRole('img', { name: 'Locked slot' })).toBeInTheDocument()
    expect(within(sheet).getByText(/2 habits max/)).toBeInTheDocument()
    expect(nav).not.toHaveBeenCalled()
  })

  it('with 1 active habit shows one card and one add slot; eternal/archived are hidden', async () => {
    await repo.putHabit(habit('a', { name: 'Guitar' }))
    await repo.putHabit(habit('z', { name: 'Old', archivedAt: at(0, 3) }))
    await act(() => S().load())
    render(<Home onNavigate={nav} />)
    expect(screen.getByText('Guitar')).toBeInTheDocument()
    expect(screen.queryByText('Old')).toBeNull()
    expect(screen.getAllByRole('img', { name: 'Add a habit' })).toHaveLength(1)
  })
})

describe('HabitCard', () => {
  it('shows emblem, ring, flame number, beads and total bar', async () => {
    await repo.putHabit(habit('a', { name: 'Guitar' }))
    await act(() => S().load())
    act(() => useApp.setState({ states: { a: state('a', { todayMinutes: 30 }) } }))
    render(<Home onNavigate={nav} />)
    expect(screen.getByRole('img', { name: 'Apprentice' })).toBeInTheDocument()
    expect(screen.getByTestId('progress')).toBeInTheDocument()
    expect(screen.getByRole('img', { name: '7 day streak' })).toBeInTheDocument()
    expect(screen.getByText('7')).toBeInTheDocument()
    expect(screen.getByText('Day 12/30')).toBeInTheDocument()
    expect(screen.getByText('312 / 10,000h')).toBeInTheDocument()
  })

  it('shows a Formed badge instead of the day counter once formed', async () => {
    await repo.putHabit(habit('a'))
    await act(() => S().load())
    act(() => useApp.setState({ states: { a: state('a', { formed: true, formingDone: 30 }) } }))
    render(<Home onNavigate={nav} />)
    expect(screen.getAllByText('Formed').length).toBeGreaterThan(0)
    expect(screen.queryByText(/Day \d+\/30/)).toBeNull()
  })

  it('Start calls start(id), becomes Stop with a running clock after tick', async () => {
    await repo.putHabit(habit('a'))
    await act(() => S().load())
    render(<Home onNavigate={nav} />)
    await act(async () => {
      fireEvent.click(screen.getByRole('button', { name: 'Start' }))
    })
    await waitFor(() => expect(S().running?.habitId).toBe('a'))
    act(() => S().tick(now + 5000))
    expect(screen.getByRole('button', { name: 'Stop' })).toBeInTheDocument()
    expect(screen.getByText('0:00:05')).toBeInTheDocument()
    expect(nav).not.toHaveBeenCalled()
  })

  it('fires confetti and haptic.success once when today crosses the commitment', async () => {
    await repo.putHabit(habit('a'))
    await act(() => S().load())
    act(() => useApp.setState({ states: { a: state('a', { todayMinutes: 59 }) } }))
    render(<Home onNavigate={nav} />)
    expect(confetti).not.toHaveBeenCalled()
    act(() => useApp.setState({ states: { a: state('a', { todayMinutes: 60 }) } }))
    expect(confetti).toHaveBeenCalledTimes(1)
    expect(haptic.success).toHaveBeenCalledTimes(1)
    expect(screen.getByText('+1 🔥')).toBeInTheDocument()
    act(() => useApp.setState({ states: { a: state('a', { todayMinutes: 61 }) } }))
    act(() => useApp.setState({ states: { a: state('a', { todayMinutes: 59 }) } }))
    act(() => useApp.setState({ states: { a: state('a', { todayMinutes: 60 }) } }))
    expect(confetti).toHaveBeenCalledTimes(1)
    expect(haptic.success).toHaveBeenCalledTimes(1)
  })

  it('does not fire when a card mounts already past the commitment', async () => {
    await repo.putHabit(habit('a'))
    await act(() => S().load())
    act(() => useApp.setState({ states: { a: state('a', { todayMinutes: 90 }) } }))
    render(<Home onNavigate={nav} />)
    expect(confetti).not.toHaveBeenCalled()
  })

  it('edit icon opens the edit flow for that habit', async () => {
    await repo.putHabit(habit('a'))
    await act(() => S().load())
    render(<Home onNavigate={nav} />)
    fireEvent.click(screen.getByRole('button', { name: 'Edit' }))
    expect(nav).toHaveBeenCalledWith('edit:a')
  })
})

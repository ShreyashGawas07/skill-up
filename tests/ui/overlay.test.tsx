import { act, fireEvent, render, screen, waitFor } from '@testing-library/react'
import { addDays, setHours } from 'date-fns'
import { MotionGlobalConfig } from 'framer-motion'

const sched = vi.hoisted(() => ({
  applySchedule: vi.fn(async (_specs: unknown[]) => {}),
  registerNotificationActions: vi.fn(async () => {}),
}))
vi.mock('@/notify/scheduler', () => sched)
vi.mock('@capacitor/app', () => ({ App: { addListener: vi.fn(async () => ({ remove: async () => {} })) } }))
const confetti = vi.hoisted(() => Object.assign(vi.fn(), { reset: vi.fn() }))
vi.mock('canvas-confetti', () => ({ default: confetti }))
const haptic = vi.hoisted(() => ({ tick: vi.fn(), success: vi.fn(), heavy: vi.fn(), warn: vi.fn() }))
vi.mock('@/feedback/haptics', () => ({ haptic }))
const sound = vi.hoisted(() => ({ playCue: vi.fn() }))
vi.mock('@/feedback/sound', () => sound)

import { db } from '@/data/db'
import { DEFAULT_SETTINGS } from '@/data/repo'
import { dayKey } from '@/domain/days'
import type { AppEvent, Habit, HabitState } from '@/domain/types'
import type { Celebration } from '@/feedback/celebrations'
import { setClock, useApp } from '@/store/useApp'
import { CelebrationOverlay } from '@/ui/overlay/CelebrationOverlay'
import { StaleSessionDialog } from '@/ui/overlay/StaleSessionDialog'

MotionGlobalConfig.skipAnimations = true

const BASE = new Date(2026, 0, 5)
const at = (n: number, h = 12) => setHours(addDays(BASE, n), h).getTime()
let now = at(0)
const S = () => useApp.getState()
/** Tests below swap store actions for spies; restore the real ones before each test. */
const REAL = { dismiss: S().dismiss, resolveStale: S().resolveStale }

const habit = (id: string, over: Partial<Habit> = {}): Habit => ({
  id, name: id, icon: 'book', color: '#4dabf7', targetHours: 10000, reminderTime: '19:00',
  createdAt: at(0, 1), commitmentHistory: [{ fromDate: dayKey(at(0)), dailyMinutes: 60 }], ...over,
})

const state = (habitId: string, over: Partial<HabitState> = {}): HabitState => ({
  habitId, today: dayKey(now), todayMinutes: 0, commitment: 60, days: [], formingDone: 12, formed: false,
  streak: 7, longestStreak: 7, totalMinutes: 312 * 60, overtimeMinutes: 0, earnedTier: 5, lostTiers: 0,
  recoveryProgress: 0, rank: 5, eternal: false, badges: { formed: false, tiersReached: [1, 2] },
  missedYesterday: false, events: [], ...over,
})

const cel = (habitId: string, kind: Celebration['kind'], value?: number, fullScreen = true): Celebration => ({
  key: `${habitId}:${kind}:${value ?? ''}`, kind, habitId, fullScreen, ...(value !== undefined ? { value } : {}),
})

function seed(queue: Celebration[], over: Partial<HabitState> = {}, settings = DEFAULT_SETTINGS) {
  act(() =>
    useApp.setState({
      habits: [habit('a', { name: 'Guitar' })],
      states: { a: state('a', over) },
      queue,
      settings: { ...settings },
    }),
  )
}

beforeEach(async () => {
  await Promise.all(db.tables.map((t) => t.clear()))
  now = at(0)
  setClock(() => now)
  useApp.setState(REAL)
  confetti.mockClear()
  confetti.reset.mockClear()
  Object.values(haptic).forEach((f) => f.mockClear())
  sound.playCue.mockClear()
  await S().load()
})

describe('CelebrationOverlay', () => {
  it('renders nothing with an empty queue', () => {
    render(<CelebrationOverlay />)
    expect(screen.queryByRole('dialog')).toBeNull()
  })

  it('shows only the first full-screen celebration; a tap dismisses it and the next appears', async () => {
    const first = cel('a', 'rankUp', 5)
    const second = cel('a', 'streak', 14)
    seed([first, second])
    render(<CelebrationOverlay />)
    expect(screen.getAllByRole('dialog')).toHaveLength(1)
    expect(screen.getByText('Expert')).toBeInTheDocument()
    expect(screen.queryByText('14')).toBeNull()

    await act(async () => {
      fireEvent.click(screen.getByRole('dialog'))
    })
    expect(S().queue.map((c) => c.key)).toEqual([second.key])
    await waitFor(() => expect(screen.getByText('14')).toBeInTheDocument())
    expect(screen.queryByText('Expert')).toBeNull()
  })

  it('silently dismisses inline (non-full-screen) items', async () => {
    seed([cel('a', 'dayComplete', undefined, false), cel('a', 'overtime', 20, false)])
    render(<CelebrationOverlay />)
    await waitFor(() => expect(S().queue).toHaveLength(0))
    expect(screen.queryByRole('dialog')).toBeNull()
  })

  it('rankUp shows the new tier name with a heavy haptic', async () => {
    seed([cel('a', 'rankUp', 7)])
    render(<CelebrationOverlay />)
    expect(screen.getByRole('dialog', { name: /rank up/i })).toBeInTheDocument()
    expect(screen.getByText('Master')).toBeInTheDocument()
    await waitFor(() => expect(haptic.heavy).toHaveBeenCalled())
  })

  it('rankLost shows "Expert → Skilled" using the rank before the drop (replayed from events)', async () => {
    const events: AppEvent[] = [
      { key: 'RANK_UP:2026-01-01:5', type: 'RANK_UP', habitId: 'a', day: '2026-01-01', value: 5 },
      { key: 'RANK_LOST:2026-01-04:4', type: 'RANK_LOST', habitId: 'a', day: '2026-01-04', value: 4 },
    ]
    seed([{ key: 'a:RANK_LOST:2026-01-04:4', kind: 'rankLost', habitId: 'a', value: 4, fullScreen: true }], {
      events, earnedTier: 5, lostTiers: 1, rank: 4,
    })
    render(<CelebrationOverlay />)
    expect(screen.getByRole('dialog', { name: /rank lost/i })).toBeInTheDocument()
    expect(screen.getByText('Expert → Skilled')).toBeInTheDocument()
    await waitFor(() => expect(haptic.warn).toHaveBeenCalled())
  })

  it('rankLost without a replayable history falls back to two tiers above, capped at earned', () => {
    seed([cel('a', 'rankLost', 3)], { earnedTier: 5, rank: 3, lostTiers: 2 })
    render(<CelebrationOverlay />)
    expect(screen.getByText('Expert → Adept')).toBeInTheDocument()
  })

  it.each([
    ['rankRecovered', 4, /rank recovered/i, 'Skilled'],
    ['streak', 30, /streak/i, '30'],
    ['streakReset', undefined, /forming reset/i, 'Guitar'],
    ['formed', undefined, /habit formed/i, 'Guitar'],
    ['eternal', undefined, /eternal/i, 'Guitar'],
  ] as const)('%s renders its scene', (kind, value, label, text) => {
    seed([cel('a', kind, value)])
    render(<CelebrationOverlay />)
    expect(screen.getByRole('dialog', { name: label })).toBeInTheDocument()
    expect(screen.getAllByText(text).length).toBeGreaterThan(0)
  })

  it('formed fires fireworks unless motion is reduced', async () => {
    seed([cel('a', 'formed')], {}, { ...DEFAULT_SETTINGS, reduceMotion: 'off' })
    const { unmount } = render(<CelebrationOverlay />)
    await waitFor(() => expect(confetti).toHaveBeenCalled())
    unmount()
    confetti.mockClear()
    seed([cel('a', 'formed')], {}, { ...DEFAULT_SETTINGS, reduceMotion: 'on' })
    render(<CelebrationOverlay />)
    await new Promise((r) => setTimeout(r, 400))
    expect(confetti).not.toHaveBeenCalled()
  })

  it('marks the overlay data-motion="reduced" when reduce motion is on', () => {
    seed([cel('a', 'rankUp', 5)], {}, { ...DEFAULT_SETTINGS, reduceMotion: 'on' })
    render(<CelebrationOverlay />)
    expect(screen.getByRole('dialog')).toHaveAttribute('data-motion', 'reduced')
  })

  it('is full motion when reduce motion is off', () => {
    seed([cel('a', 'rankUp', 5)], {}, { ...DEFAULT_SETTINGS, reduceMotion: 'off' })
    render(<CelebrationOverlay />)
    expect(screen.getByRole('dialog')).toHaveAttribute('data-motion', 'full')
  })

  it('plays a sound cue only when sound is enabled', async () => {
    seed([cel('a', 'rankLost', 3)], {}, { ...DEFAULT_SETTINGS, sound: true })
    const { unmount } = render(<CelebrationOverlay />)
    await waitFor(() => expect(sound.playCue).toHaveBeenCalledWith('loss'))
    unmount()
    sound.playCue.mockClear()
    seed([cel('a', 'rankUp', 5)], {}, { ...DEFAULT_SETTINGS, sound: false })
    render(<CelebrationOverlay />)
    await new Promise((r) => setTimeout(r, 800))
    expect(sound.playCue).not.toHaveBeenCalled()
  })

  it('auto-advances after the animation', async () => {
    const dismiss = vi.fn(async () => {})
    seed([cel('a', 'rankLost', 3)])
    act(() => useApp.setState({ dismiss }))
    vi.useFakeTimers()
    try {
      render(<CelebrationOverlay />)
      act(() => vi.advanceTimersByTime(2000))
      expect(dismiss).not.toHaveBeenCalled()
      act(() => vi.advanceTimersByTime(600))
      expect(dismiss).toHaveBeenCalledWith('a:rankLost:3')
      expect(dismiss).toHaveBeenCalledTimes(1)
    } finally {
      vi.useRealTimers()
    }
  })

  it('a tap racing the auto-advance dismisses exactly once', () => {
    const dismiss = vi.fn(async () => {})
    seed([cel('a', 'rankLost', 3)])
    act(() => useApp.setState({ dismiss }))
    vi.useFakeTimers()
    try {
      render(<CelebrationOverlay />)
      act(() => vi.advanceTimersByTime(2399))
      fireEvent.click(screen.getByRole('dialog'))
      act(() => vi.advanceTimersByTime(10))
      fireEvent.click(screen.getByRole('dialog'))
      act(() => vi.advanceTimersByTime(5000))
      expect(dismiss).toHaveBeenCalledTimes(1)
    } finally {
      vi.useRealTimers()
    }
  })

  it('focuses each moment, announces it, and skips on Enter/Space/Escape (default prevented)', async () => {
    seed([cel('a', 'rankUp', 5), cel('a', 'streak', 14), cel('a', 'rankRecovered', 4)])
    render(<CelebrationOverlay />)
    const first = screen.getByRole('dialog')
    expect(first).toHaveFocus()
    expect(screen.getByTestId('celebration-live')).toHaveAttribute('aria-live', 'assertive')
    expect(screen.getByTestId('celebration-live')).toHaveTextContent('Rank up: Expert — Guitar')
    let notPrevented = true
    await act(async () => {
      notPrevented = fireEvent.keyDown(first, { key: 'Enter' })
    })
    expect(notPrevented).toBe(false)
    expect(S().queue).toHaveLength(2)
    await waitFor(() => expect(screen.getByRole('dialog', { name: /14 day streak/ })).toHaveFocus())
    expect(screen.getByTestId('celebration-live')).toHaveTextContent('14 day streak — Guitar')
    await act(async () => {
      fireEvent.keyDown(screen.getByRole('dialog'), { key: ' ' })
    })
    await waitFor(() => expect(screen.getByRole('dialog', { name: /rank recovered/i })).toBeInTheDocument())
    await act(async () => {
      fireEvent.keyDown(screen.getByRole('dialog'), { key: 'Escape' })
    })
    expect(S().queue).toHaveLength(0)
  })

  it('ignores keys pressed outside the overlay (no global listener)', () => {
    const dismiss = vi.fn(async () => {})
    seed([cel('a', 'rankUp', 5)])
    act(() => useApp.setState({ dismiss }))
    render(<CelebrationOverlay />)
    fireEvent.keyDown(document.body, { key: 'Enter' })
    expect(dismiss).not.toHaveBeenCalled()
  })

  it('pauses (renders and schedules nothing) while a stale session is open, then resumes', () => {
    const dismiss = vi.fn(async () => {})
    seed([cel('a', 'formed')], { staleSession: { id: 's', habitId: 'a', start: now - 20 * 3600_000 } }, { ...DEFAULT_SETTINGS, sound: true, reduceMotion: 'off' })
    act(() => useApp.setState({ dismiss }))
    vi.useFakeTimers()
    try {
      render(<CelebrationOverlay />)
      expect(screen.queryByRole('dialog')).toBeNull()
      act(() => vi.advanceTimersByTime(20_000))
      expect(dismiss).not.toHaveBeenCalled()
      expect(haptic.heavy).not.toHaveBeenCalled()
      expect(sound.playCue).not.toHaveBeenCalled()
      expect(confetti).not.toHaveBeenCalled()

      act(() => useApp.setState({ states: { a: state('a') } }))
      expect(screen.getByRole('dialog', { name: /habit formed/i })).toBeInTheDocument()
      act(() => vi.advanceTimersByTime(4300))
      expect(haptic.heavy).toHaveBeenCalledTimes(1)
      expect(dismiss).toHaveBeenCalledTimes(1)
    } finally {
      vi.useRealTimers()
    }
  })

  it('clears the cue, auto-advance and fireworks timers when skipped', () => {
    const dismiss = vi.fn(async (k: string) => {
      useApp.setState({ queue: S().queue.filter((c) => c.key !== k) })
    })
    seed([cel('a', 'formed')], {}, { ...DEFAULT_SETTINGS, sound: true, reduceMotion: 'off' })
    act(() => useApp.setState({ dismiss }))
    vi.useFakeTimers()
    try {
      render(<CelebrationOverlay />)
      act(() => vi.advanceTimersByTime(100))
      act(() => {
        fireEvent.click(screen.getByRole('dialog'))
      })
      act(() => vi.advanceTimersByTime(10_000))
      expect(dismiss).toHaveBeenCalledTimes(1)
      expect(haptic.heavy).not.toHaveBeenCalled()
      expect(sound.playCue).not.toHaveBeenCalled()
      expect(confetti).not.toHaveBeenCalled()
    } finally {
      vi.useRealTimers()
    }
  })

  it('clears timers and resets confetti on unmount', () => {
    const dismiss = vi.fn(async () => {})
    seed([cel('a', 'formed')], {}, { ...DEFAULT_SETTINGS, sound: true, reduceMotion: 'off' })
    act(() => useApp.setState({ dismiss }))
    vi.useFakeTimers()
    try {
      const { unmount } = render(<CelebrationOverlay />)
      act(() => vi.advanceTimersByTime(100))
      unmount()
      expect(confetti.reset).toHaveBeenCalled()
      act(() => vi.advanceTimersByTime(10_000))
      expect(dismiss).not.toHaveBeenCalled()
      expect(haptic.heavy).not.toHaveBeenCalled()
      expect(sound.playCue).not.toHaveBeenCalled()
      expect(confetti).not.toHaveBeenCalled()
    } finally {
      vi.useRealTimers()
    }
  })

  it('dismisses an item whose habit no longer exists', async () => {
    act(() => useApp.setState({ habits: [], states: {}, queue: [cel('gone', 'rankUp', 3)] }))
    render(<CelebrationOverlay />)
    await waitFor(() => expect(S().queue).toHaveLength(0))
  })
})

describe('StaleSessionDialog', () => {
  const H = 3600_000
  const start = at(0, 8)

  function seedStale() {
    const resolveStale = vi.fn(async (_endAt: number) => {})
    act(() =>
      useApp.setState({
        habits: [habit('a', { name: 'Guitar' })],
        states: { a: state('a', { staleSession: { id: 's1', habitId: 'a', start } }) },
        now: start + 20 * H,
        resolveStale,
      }),
    )
    return resolveStale
  }

  it('is hidden without a stale session', () => {
    render(<StaleSessionDialog />)
    expect(screen.queryByRole('dialog')).toBeNull()
  })

  it('asks "Did you forget to stop?" with the habit name and start time', () => {
    seedStale()
    render(<StaleSessionDialog />)
    const dlg = screen.getByRole('dialog', { name: 'Did you forget to stop?' })
    expect(dlg).toHaveTextContent('Guitar')
    expect(dlg).toHaveTextContent('Mon 8:00 AM')
  })

  it('"Keep 16h" resolves at start + 16h', async () => {
    const resolveStale = seedStale()
    render(<StaleSessionDialog />)
    await act(async () => {
      fireEvent.click(screen.getByRole('button', { name: 'Keep 16h' }))
    })
    expect(resolveStale).toHaveBeenCalledWith(start + 16 * H)
  })

  it('trims to an earlier stop time with the picker (bounded to start..start+16h)', async () => {
    const resolveStale = seedStale()
    render(<StaleSessionDialog />)
    const picker = screen.getByRole('slider', { name: 'Stop time' })
    expect(picker).toHaveAttribute('min', '0')
    expect(picker).toHaveAttribute('max', String(16 * 60))
    fireEvent.change(picker, { target: { value: '150' } })
    expect(screen.getByRole('dialog')).toHaveTextContent('10:30 AM')
    expect(screen.getByRole('dialog')).toHaveTextContent('2h 30m')
    await act(async () => {
      fireEvent.click(screen.getByRole('button', { name: /stop at 10:30 AM/i }))
    })
    expect(resolveStale).toHaveBeenCalledWith(start + 150 * 60_000)
  })

  it('autofocuses "Keep 16h", traps Tab inside, and restores focus on close', () => {
    const outside = document.createElement('button')
    document.body.appendChild(outside)
    outside.focus()
    seedStale()
    render(<StaleSessionDialog />)
    const keep = screen.getByRole('button', { name: 'Keep 16h' })
    const last = screen.getByRole('button', { name: /stop at/i })
    expect(keep).toHaveFocus()
    last.focus()
    fireEvent.keyDown(last, { key: 'Tab' })
    expect(keep).toHaveFocus()
    fireEvent.keyDown(keep, { key: 'Tab', shiftKey: true })
    expect(last).toHaveFocus()
    act(() => useApp.setState({ states: { a: state('a') } }))
    expect(screen.queryByRole('dialog')).toBeNull()
    expect(outside).toHaveFocus()
    outside.remove()
  })

  it('offers no way to type hours or extend past 16h', () => {
    seedStale()
    render(<StaleSessionDialog />)
    expect(screen.queryByRole('textbox')).toBeNull()
    expect(screen.queryByRole('spinbutton')).toBeNull()
  })
})

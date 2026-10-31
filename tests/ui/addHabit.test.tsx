import { act, fireEvent, render, screen, waitFor } from '@testing-library/react'
import { addDays, setHours } from 'date-fns'

const sched = vi.hoisted(() => ({
  applySchedule: vi.fn(async (_specs: unknown[]) => {}),
  registerNotificationActions: vi.fn(async () => {}),
  notificationPermission: vi.fn(async (): Promise<'granted' | 'denied' | 'prompt'> => 'granted'),
  requestNotificationPermission: vi.fn(async () => true),
}))
vi.mock('@/notify/scheduler', () => sched)
vi.mock('@capacitor/app', () => ({ App: { addListener: vi.fn(async () => ({ remove: async () => {} })) } }))
vi.mock('canvas-confetti', () => ({ default: vi.fn() }))

import { db } from '@/data/db'
import { repo } from '@/data/repo'
import { dayKey, nextDay } from '@/domain/days'
import type { Habit, Session } from '@/domain/types'
import { setClock, useApp } from '@/store/useApp'
import { AddHabit, validateHabitInput } from '@/ui/screens/AddHabit'

const BASE = new Date(2026, 0, 5)
const at = (n: number, h = 12) => setHours(addDays(BASE, n), h).getTime()
let now = at(0)
const S = () => useApp.getState()
const done = vi.fn()

const habit = (id: string, over: Partial<Habit> = {}): Habit => ({
  id, name: 'Guitar', icon: 'guitar', color: '#4dabf7', targetHours: 10000, reminderTime: '19:00',
  createdAt: at(0, 1), commitmentHistory: [{ fromDate: dayKey(at(0)), dailyMinutes: 60 }], ...over,
})

const next = () => fireEvent.click(screen.getByRole('button', { name: 'Next' }))

beforeEach(async () => {
  await Promise.all(db.tables.map((t) => t.clear()))
  now = at(0)
  setClock(() => now)
  done.mockClear()
  sched.notificationPermission.mockReset().mockResolvedValue('granted')
  sched.requestNotificationPermission.mockClear()
  await S().load()
})

describe('AddHabit', () => {
  it('walks 4 steps with defaults and saves the habit', async () => {
    render(<AddHabit onDone={done} />)
    // step 1: name + icon + colour
    fireEvent.change(screen.getByRole('textbox', { name: 'Name' }), { target: { value: '  Guitar ' } })
    fireEvent.click(screen.getByRole('radio', { name: 'guitar' }))
    next()
    // step 2: daily hours dial, 15-minute steps, 0:15–12:00
    const dial = screen.getByRole('slider', { name: 'Daily time' })
    expect(dial).toHaveAttribute('aria-valuemin', '15')
    expect(dial).toHaveAttribute('aria-valuemax', '720')
    expect(dial).toHaveAttribute('aria-valuenow', '60')
    fireEvent.click(screen.getByRole('button', { name: '+15 minutes' }))
    expect(dial).toHaveAttribute('aria-valuenow', '75')
    expect(screen.getByText('1:15')).toBeInTheDocument()
    next()
    // step 3: target, default 10,000
    expect(screen.getByText('10,000')).toBeInTheDocument()
    next()
    // step 4: reminder, default 19:00
    expect(screen.getByLabelText('Reminder time')).toHaveValue('19:00')
    await act(async () => {
      fireEvent.click(screen.getByRole('button', { name: 'Save' }))
    })
    await waitFor(() => expect(done).toHaveBeenCalled())
    const h = S().habits[0]
    expect(h).toMatchObject({ name: 'Guitar', icon: 'guitar', targetHours: 10000, reminderTime: '19:00' })
    expect(h.commitmentHistory).toEqual([{ fromDate: dayKey(now), dailyMinutes: 75 }])
  })

  it('reduce-motion: step dots change width instantly (no width animation)', async () => {
    await act(() => S().saveSettings({ ...S().settings, reduceMotion: 'on' }))
    render(<AddHabit onDone={done} />)
    const dots = () => [...screen.getByRole('progressbar').children] as HTMLElement[]
    expect(dots()[0].style.width).toBe('28px')
    fireEvent.change(screen.getByRole('textbox', { name: 'Name' }), { target: { value: 'Run' } })
    next()
    expect(dots()[0].style.width).toBe('8px')
    expect(dots()[1].style.width).toBe('28px')
  })

  const saveNew = async () => {
    const view = render(<AddHabit onDone={done} />)
    fireEvent.change(screen.getByRole('textbox', { name: 'Name' }), { target: { value: 'Run' } })
    next()
    next()
    next()
    await act(async () => {
      fireEvent.click(screen.getByRole('button', { name: 'Save' }))
    })
    await waitFor(() => expect(done).toHaveBeenCalled())
    view.unmount()
  }

  it('after saving a new habit, asks for notification permission if not yet asked, then reschedules', async () => {
    sched.notificationPermission.mockResolvedValue('prompt')
    await saveNew()
    await waitFor(() => expect(sched.requestNotificationPermission).toHaveBeenCalledOnce())
    const requested = sched.requestNotificationPermission.mock.invocationCallOrder[0]
    await waitFor(() =>
      expect(sched.applySchedule.mock.invocationCallOrder.some((o) => o > requested)).toBe(true),
    )
    expect(S().habits).toHaveLength(1)
  })

  it('does not ask again when permission is already granted or denied', async () => {
    await saveNew()
    await waitFor(() => expect(sched.notificationPermission).toHaveBeenCalled())
    sched.notificationPermission.mockResolvedValue('denied')
    done.mockClear()
    await saveNew()
    await waitFor(() => expect(sched.notificationPermission).toHaveBeenCalledTimes(2))
    expect(sched.requestNotificationPermission).not.toHaveBeenCalled()
  })

  it('dial clamps to 0:15 and 12:00', () => {
    render(<AddHabit onDone={done} />)
    fireEvent.change(screen.getByRole('textbox', { name: 'Name' }), { target: { value: 'Run' } })
    next()
    const minus = screen.getByRole('button', { name: '-15 minutes' })
    for (let i = 0; i < 10; i++) fireEvent.click(minus)
    expect(screen.getByRole('slider', { name: 'Daily time' })).toHaveAttribute('aria-valuenow', '15')
    const plus = screen.getByRole('button', { name: '+15 minutes' })
    for (let i = 0; i < 60; i++) fireEvent.click(plus)
    expect(screen.getByRole('slider', { name: 'Daily time' })).toHaveAttribute('aria-valuenow', '720')
  })

  it('cannot advance past step 1 without a name', () => {
    render(<AddHabit onDone={done} />)
    expect(screen.getByRole('button', { name: 'Next' })).toBeDisabled()
  })
})

describe('Edit habit', () => {
  it('during Forming the daily dial is disabled with a lock', async () => {
    await repo.putHabit(habit('a'))
    await act(() => S().load())
    render(<AddHabit habitId="a" onDone={done} />)
    expect(screen.getByRole('textbox', { name: 'Name' })).toHaveValue('Guitar')
    next()
    expect(screen.getByRole('slider', { name: 'Daily time' })).toHaveAttribute('aria-disabled', 'true')
    expect(screen.getByRole('img', { name: 'Locked until formed' })).toBeInTheDocument()
    expect(screen.getByRole('button', { name: '+15 minutes' })).toBeDisabled()
  })

  it('after Formed a daily change is saved as a new entry from tomorrow', async () => {
    // 30 completed days → formed by today (day 30).
    await repo.putHabit(habit('a'))
    for (let n = 0; n < 30; n++) {
      const s: Session = { id: `s${n}`, habitId: 'a', start: at(n, 2), end: at(n, 2) + 60 * 60000 }
      await repo.putSession(s)
    }
    now = at(30)
    await act(() => S().load())
    expect(S().states.a.formed).toBe(true)
    render(<AddHabit habitId="a" onDone={done} />)
    next()
    fireEvent.click(screen.getByRole('button', { name: '+15 minutes' }))
    next()
    next()
    await act(async () => {
      fireEvent.click(screen.getByRole('button', { name: 'Save' }))
    })
    await waitFor(() => expect(done).toHaveBeenCalled())
    expect(S().habits[0].commitmentHistory).toEqual([
      { fromDate: dayKey(at(0)), dailyMinutes: 60 },
      { fromDate: nextDay(dayKey(now)), dailyMinutes: 75 },
    ])
  })
})

describe('Edit habit errors', () => {
  it('an unknown habitId does not fall back to add: it closes', async () => {
    const { container } = render(<AddHabit habitId="nope" onDone={done} />)
    await waitFor(() => expect(done).toHaveBeenCalled())
    expect(screen.queryByRole('textbox', { name: 'Name' })).toBeNull()
    expect(container).toBeEmptyDOMElement()
  })

  it('shows an updateHabit rejection to the user', async () => {
    await repo.putHabit(habit('a'))
    await act(() => S().load())
    const original = S().updateHabit
    useApp.setState({ updateHabit: vi.fn(async () => { throw new Error('Disk full') }) })
    try {
      render(<AddHabit habitId="a" onDone={done} />)
      next()
      next()
      next()
      await act(async () => {
        fireEvent.click(screen.getByRole('button', { name: 'Save' }))
      })
      expect(await screen.findByRole('alert')).toHaveTextContent('Disk full')
      expect(done).not.toHaveBeenCalled()
    } finally {
      act(() => useApp.setState({ updateHabit: original }))
    }
  })
})

describe('validateHabitInput', () => {
  const ok = { name: 'Run', icon: 'run', color: '#fff', dailyMinutes: 60, targetHours: 100, reminderTime: '07:30' }
  const ctx = { formed: false, totalHours: 0 }

  it('accepts a valid input', () => {
    expect(validateHabitInput(ok, ctx)).toBeNull()
  })

  it('rejects target at or below logged hours', () => {
    expect(validateHabitInput({ targetHours: 300 }, { formed: true, totalHours: 312 })).toMatch(/target/i)
    expect(validateHabitInput({ targetHours: 312 }, { formed: true, totalHours: 312 })).toMatch(/target/i)
    expect(validateHabitInput({ targetHours: 313 }, { formed: true, totalHours: 312 })).toBeNull()
  })

  it('rejects bad names, minutes, targets and times', () => {
    expect(validateHabitInput({ ...ok, name: '   ' }, ctx)).toMatch(/name/i)
    expect(validateHabitInput({ ...ok, name: 'x'.repeat(31) }, ctx)).toMatch(/name/i)
    expect(validateHabitInput({ ...ok, dailyMinutes: 10 }, ctx)).toMatch(/daily/i)
    expect(validateHabitInput({ ...ok, dailyMinutes: 735 }, ctx)).toMatch(/daily/i)
    expect(validateHabitInput({ ...ok, dailyMinutes: 50 }, ctx)).toMatch(/daily/i)
    expect(validateHabitInput({ ...ok, targetHours: 0 }, ctx)).toMatch(/target/i)
    expect(validateHabitInput({ ...ok, targetHours: 1.5 }, ctx)).toMatch(/target/i)
    expect(validateHabitInput({ ...ok, reminderTime: '7:30' }, ctx)).toMatch(/time/i)
    expect(validateHabitInput({ ...ok, reminderTime: '24:00' }, ctx)).toMatch(/time/i)
  })
})

import { act, fireEvent, render, screen, waitFor, within } from '@testing-library/react'
import { addDays, setHours, setMinutes } from 'date-fns'
import { MotionGlobalConfig } from 'framer-motion'

const sched = vi.hoisted(() => ({
  applySchedule: vi.fn(async (_specs: unknown[]) => {}),
  registerNotificationActions: vi.fn(async () => {}),
  notificationPermission: vi.fn(async (): Promise<'granted' | 'denied' | 'prompt'> => 'granted'),
  requestNotificationPermission: vi.fn(async () => true),
}))
vi.mock('@/notify/scheduler', () => sched)
vi.mock('@capacitor/app', () => ({ App: { addListener: vi.fn(async () => ({ remove: async () => {} })) } }))
vi.mock('canvas-confetti', () => ({ default: Object.assign(vi.fn(), { reset: vi.fn() }) }))
vi.mock('@/feedback/haptics', () => ({ haptic: { tick: vi.fn(), success: vi.fn(), heavy: vi.fn(), warn: vi.fn() } }))
const platform = vi.hoisted(() => ({ native: false }))
vi.mock('@capacitor/core', async (orig) => {
  const real = await orig<typeof import('@capacitor/core')>()
  return { ...real, Capacitor: { ...real.Capacitor, isNativePlatform: () => platform.native } }
})
const fs = vi.hoisted(() => ({
  writeFile: vi.fn(async (_o: { path: string; data: string; directory: string }) => ({ uri: 'file:///cache/backup.json' })),
}))
vi.mock('@capacitor/filesystem', () => ({
  Filesystem: fs,
  Directory: { Cache: 'CACHE' },
  Encoding: { UTF8: 'utf8' },
}))
const share = vi.hoisted(() => ({ share: vi.fn(async (_o: { url?: string }) => ({})) }))
vi.mock('@capacitor/share', () => ({ Share: share }))
vi.mock('@/data/backup', async (orig) => {
  const real = await orig<typeof import('@/data/backup')>()
  return { ...real, importBackup: vi.fn(real.importBackup) }
})

import { db } from '@/data/db'
import { repo } from '@/data/repo'
import { importBackup } from '@/data/backup'
import { dayKey } from '@/domain/days'
import type { Habit, HabitState, Session } from '@/domain/types'
import { setClock, useApp } from '@/store/useApp'
import { HabitDetail } from '@/ui/screens/HabitDetail'
import { HallOfFame } from '@/ui/screens/HallOfFame'
import { Settings } from '@/ui/screens/Settings'
import { Home } from '@/ui/screens/Home'

MotionGlobalConfig.skipAnimations = true

const BASE = new Date(2026, 0, 5) // Monday 5 Jan 2026
const at = (n: number, h = 12, m = 0) => setMinutes(setHours(addDays(BASE, n), h), m).getTime()
let now = at(40) // Sat 14 Feb 2026
const S = () => useApp.getState()

const habit = (id: string, over: Partial<Habit> = {}): Habit => ({
  id, name: id, icon: 'book', color: '#4dabf7', targetHours: 1000, reminderTime: '19:00',
  createdAt: at(0, 1), commitmentHistory: [{ fromDate: dayKey(at(0)), dailyMinutes: 60 }], ...over,
})

const state = (habitId: string, over: Partial<HabitState> = {}): HabitState => ({
  habitId, today: dayKey(now), todayMinutes: 0, commitment: 60, days: [], formingDone: 30, formed: true,
  streak: 3, longestStreak: 21, totalMinutes: 312 * 60, overtimeMinutes: 135, earnedTier: 5, lostTiers: 2,
  recoveryProgress: 0, rank: 3, eternal: false, badges: { formed: true, tiersReached: [1, 2, 3, 4, 5] },
  missedYesterday: false, events: [], ...over,
})

const nav = vi.fn()

beforeEach(async () => {
  await Promise.all(db.tables.map((t) => t.clear()))
  now = at(40)
  setClock(() => now)
  nav.mockClear()
  platform.native = false
  fs.writeFile.mockClear()
  share.share.mockClear()
  vi.mocked(importBackup).mockClear()
  sched.notificationPermission.mockReset().mockResolvedValue('granted')
  sched.requestNotificationPermission.mockClear()
  await S().load()
})

async function seedHabit(h: Habit, st: Partial<HabitState>, sessions: Session[] = []) {
  await repo.putHabit(h)
  for (const s of sessions) await db.sessions.put(s)
  await act(() => S().load())
  act(() => useApp.setState({ states: { ...S().states, [h.id]: state(h.id, st) } }))
}

describe('HabitDetail', () => {
  const sessions: Session[] = [
    { id: 's1', habitId: 'a', start: at(1, 9), end: at(1, 10) },
    { id: 's2', habitId: 'a', start: at(3, 18, 0), end: at(3, 19, 30) },
    { id: 's3', habitId: 'a', start: at(2, 7), end: at(2, 8) },
  ]

  it('shows the ladder, current-month heatmap with bounded month arrows, and stats', async () => {
    await seedHabit(habit('a', { name: 'Guitar' }), {}, sessions)
    render(<HabitDetail habitId="a" onNavigate={nav} />)
    expect(screen.getByRole('heading', { name: 'Guitar' })).toBeInTheDocument()
    expect(screen.getByRole('list', { name: 'Rank ladder' })).toBeInTheDocument()
    expect(screen.getByRole('grid', { name: 'February 2026' })).toBeInTheDocument()

    const next = screen.getByRole('button', { name: 'Next month' })
    const prev = screen.getByRole('button', { name: 'Previous month' })
    expect(next).toBeDisabled()
    fireEvent.click(prev)
    expect(screen.getByRole('grid', { name: 'January 2026' })).toBeInTheDocument()
    expect(prev).toBeDisabled() // created in January
    fireEvent.click(next)
    expect(screen.getByRole('grid', { name: 'February 2026' })).toBeInTheDocument()

    expect(screen.getByRole('group', { name: 'Total hours' })).toHaveTextContent('312h')
    expect(screen.getByRole('group', { name: 'Longest streak' })).toHaveTextContent('21')
    expect(screen.getByRole('group', { name: 'Overtime' })).toHaveTextContent('2:15')
  })

  it('badge cabinet shows Formed + reached tiers, lost tiers greyed', async () => {
    await seedHabit(habit('a'), {}, sessions)
    render(<HabitDetail habitId="a" onNavigate={nav} />)
    const cab = screen.getByRole('list', { name: 'Badges' })
    const q = within(cab)
    expect(q.getByRole('img', { name: 'Formed' })).toBeInTheDocument()
    for (const n of ['Novice', 'Apprentice', 'Adept', 'Skilled, lost', 'Expert, lost']) {
      expect(q.getByRole('img', { name: n })).toBeInTheDocument()
    }
    expect(q.queryByRole('img', { name: /Elite/ })).toBeNull()
  })

  it('a not-yet-formed habit shows the Formed badge as locked', async () => {
    await seedHabit(habit('a'), { formed: false, formingDone: 12, badges: { formed: false, tiersReached: [1] } })
    render(<HabitDetail habitId="a" onNavigate={nav} />)
    expect(within(screen.getByRole('list', { name: 'Badges' })).getByRole('img', { name: 'Formed, locked' })).toBeInTheDocument()
  })

  it('lists sessions newest first', async () => {
    await seedHabit(habit('a'), {}, sessions)
    render(<HabitDetail habitId="a" onNavigate={nav} />)
    const rows = within(screen.getByRole('list', { name: 'Sessions' })).getAllByRole('listitem')
    expect(rows).toHaveLength(3)
    expect(rows[0]).toHaveTextContent('Thu 8 Jan')
    expect(rows[0]).toHaveTextContent('1:30')
    expect(rows[1]).toHaveTextContent('Wed 7 Jan')
    expect(rows[2]).toHaveTextContent('Tue 6 Jan')
  })

  it('delete asks for confirmation, then deletes and returns home', async () => {
    await seedHabit(habit('a'), {}, sessions)
    render(<HabitDetail habitId="a" onNavigate={nav} />)
    fireEvent.click(screen.getByRole('button', { name: 'Delete habit' }))
    const sheet = screen.getByRole('dialog')
    fireEvent.click(within(sheet).getByRole('button', { name: 'Cancel' }))
    await waitFor(() => expect(screen.queryByRole('dialog')).toBeNull())
    expect(await repo.listHabits()).toHaveLength(1)

    fireEvent.click(screen.getByRole('button', { name: 'Delete habit' }))
    await act(async () => {
      fireEvent.click(within(screen.getByRole('dialog')).getByRole('button', { name: 'Delete' }))
    })
    await waitFor(() => expect(nav).toHaveBeenCalledWith('home'))
    expect(await repo.listHabits()).toHaveLength(0)
    expect(await repo.listSessions()).toHaveLength(0)
  })
})

describe('HallOfFame', () => {
  async function seedHall() {
    await repo.putHabit(habit('a', { name: 'Guitar' }))
    await repo.putHabit(habit('b', { name: 'Chess' }))
    await repo.putHabit(habit('c', { name: 'Old', archivedAt: at(5) }))
    await act(() => S().load())
    act(() =>
      useApp.setState({
        states: {
          a: state('a', {
            eternal: true, rank: 10, earnedTier: 10, totalMinutes: 1000 * 60,
            events: [{ key: 'ETERNAL:2026-02-01', type: 'ETERNAL', habitId: 'a', day: '2026-02-01' }],
          }),
          b: state('b'),
          c: state('c'),
        },
      }),
    )
  }

  it('lists eternal habits only, as trophies', async () => {
    await seedHall()
    render(<HallOfFame onNavigate={nav} />)
    const shelf = screen.getByRole('list', { name: 'Trophies' })
    expect(within(shelf).getAllByRole('listitem')).toHaveLength(1)
    expect(within(shelf).getByText('Guitar')).toBeInTheDocument()
    expect(within(shelf).getByRole('img', { name: 'Eternal' })).toBeInTheDocument()
    expect(within(shelf).getByText('1,000h')).toBeInTheDocument()
    expect(within(shelf).getByText('1 Feb 2026')).toBeInTheDocument()
    expect(screen.queryByText('Chess')).toBeNull()
    expect(screen.queryByText('Old')).toBeNull()
  })

  it('shows an empty shelf with no eternal habits', async () => {
    render(<HallOfFame onNavigate={nav} />)
    expect(screen.queryByRole('list', { name: 'Trophies' })).toBeNull()
    expect(screen.getByRole('img', { name: 'Eternal, locked' })).toBeInTheDocument()
  })

  it('deleting a trophy needs two confirmations', async () => {
    await seedHall()
    render(<HallOfFame onNavigate={nav} />)
    fireEvent.click(screen.getByRole('button', { name: 'Delete Guitar' }))
    fireEvent.click(within(screen.getByRole('dialog')).getByRole('button', { name: 'Delete' }))
    expect(await repo.listHabits()).toHaveLength(3)
    const second = screen.getByRole('dialog')
    expect(second).toHaveTextContent(/can't be undone/i)
    await act(async () => {
      fireEvent.click(within(second).getByRole('button', { name: 'Delete forever' }))
    })
    await waitFor(async () => expect((await repo.listHabits()).map((h) => h.id).sort()).toEqual(['b', 'c']))
  })

  it('tapping a trophy opens its detail', async () => {
    await seedHall()
    render(<HallOfFame onNavigate={nav} />)
    fireEvent.click(screen.getByRole('button', { name: 'Open Guitar' }))
    expect(nav).toHaveBeenCalledWith('detail:a')
  })
})

describe('Settings', () => {
  const onBack = vi.fn()

  it('has sound and reduce-motion controls but no theme switch', async () => {
    render(<Settings onBack={onBack} />)
    expect(screen.queryByText(/theme/i)).toBeNull()
    const sound = screen.getByRole('switch', { name: 'Sound' })
    expect(sound).toHaveAttribute('aria-checked', 'false')
    await act(async () => {
      fireEvent.click(sound)
    })
    await waitFor(() => expect(S().settings.sound).toBe(true))
    expect((await repo.getSettings()).sound).toBe(true)
    await act(async () => {
      fireEvent.click(screen.getByRole('radio', { name: 'On' }))
    })
    await waitFor(() => expect(S().settings.reduceMotion).toBe('on'))
    expect(S().settings.theme).toBe('system')
  })

  it('notifications: Enable requests permission when not yet asked', async () => {
    sched.notificationPermission.mockResolvedValue('prompt')
    render(<Settings onBack={onBack} />)
    const btn = await screen.findByRole('button', { name: 'Enable' })
    sched.notificationPermission.mockResolvedValue('granted')
    await act(async () => {
      fireEvent.click(btn)
    })
    expect(sched.requestNotificationPermission).toHaveBeenCalled()
    await waitFor(() => expect(screen.queryByRole('button', { name: 'Enable' })).toBeNull())
  })

  it('notifications: denied shows the open-settings hint', async () => {
    sched.notificationPermission.mockResolvedValue('denied')
    render(<Settings onBack={onBack} />)
    expect(await screen.findByText(/Open settings/i)).toBeInTheDocument()
    expect(screen.queryByRole('button', { name: 'Enable' })).toBeNull()
  })

  it('export on web downloads skillup-backup-YYYY-MM-DD.json', async () => {
    const created: Blob[] = []
    URL.createObjectURL = vi.fn((b: Blob) => {
      created.push(b)
      return 'blob:x'
    }) as typeof URL.createObjectURL
    URL.revokeObjectURL = vi.fn()
    let downloaded = ''
    const click = vi.spyOn(HTMLAnchorElement.prototype, 'click').mockImplementation(function (this: HTMLAnchorElement) {
      downloaded = this.download
    })
    await repo.putHabit(habit('a'))
    render(<Settings onBack={onBack} />)
    await act(async () => {
      fireEvent.click(screen.getByRole('button', { name: 'Export backup' }))
    })
    await waitFor(() => expect(click).toHaveBeenCalled())
    expect(downloaded).toBe('skillup-backup-2026-02-14.json')
    const json = JSON.parse(await created[0].text())
    expect(json.app).toBe('skillup')
    expect(json.habits).toHaveLength(1)
    expect(fs.writeFile).not.toHaveBeenCalled()
    click.mockRestore()
  })

  it('export on native writes to the cache dir and shares the file', async () => {
    platform.native = true
    render(<Settings onBack={onBack} />)
    await act(async () => {
      fireEvent.click(screen.getByRole('button', { name: 'Export backup' }))
    })
    await waitFor(() => expect(share.share).toHaveBeenCalled())
    const opts = fs.writeFile.mock.calls[0][0]
    expect(opts.path).toBe('skillup-backup-2026-02-14.json')
    expect(opts.directory).toBe('CACHE')
    expect(JSON.parse(opts.data).app).toBe('skillup')
    expect(share.share.mock.calls[0][0].url).toBe('file:///cache/backup.json')
  })

  const pick = async (text: string) => {
    const input = screen.getByLabelText('Backup file') as HTMLInputElement
    expect(input).toHaveAttribute('type', 'file')
    expect(input.accept).toContain('application/json')
    await act(async () => {
      fireEvent.change(input, { target: { files: [new File([text], 'b.json', { type: 'application/json' })] } })
    })
  }

  it('import of an invalid file shows its error and does not import', async () => {
    render(<Settings onBack={onBack} />)
    await pick('{not json')
    expect(await screen.findByRole('alert')).toHaveTextContent('File is not valid JSON')
    expect(screen.queryByRole('dialog')).toBeNull()
    expect(importBackup).not.toHaveBeenCalled()
  })

  it('import of a valid file previews counts and imports on confirm', async () => {
    const habits = [habit('x', { name: 'Piano' }), habit('y', { name: 'Code' })]
    const sessions: Session[] = Array.from({ length: 143 }, (_, i) => ({
      id: `s${i}`, habitId: i % 2 ? 'x' : 'y', start: at(0, 2) + i * 60_000, end: at(0, 2) + i * 60_000 + 30_000,
    }))
    const backup = {
      app: 'skillup', version: 1, exportedAt: now, habits, sessions, seen: [],
      settings: { theme: 'system', sound: true, reduceMotion: 'off' },
    }
    render(<Settings onBack={onBack} />)
    await pick(JSON.stringify(backup))
    const sheet = await screen.findByRole('dialog')
    expect(sheet).toHaveTextContent('2 habits, 143 sessions will replace current data')
    expect(importBackup).not.toHaveBeenCalled()
    await act(async () => {
      fireEvent.click(within(sheet).getByRole('button', { name: 'Replace' }))
    })
    await waitFor(() => expect(S().habits.map((h) => h.name).sort()).toEqual(['Code', 'Piano']))
    expect(importBackup).toHaveBeenCalledTimes(1)
    expect(S().sessions).toHaveLength(143)
    expect(S().settings.sound).toBe(true)
  })

  it('back button returns', () => {
    render(<Settings onBack={onBack} />)
    fireEvent.click(screen.getByRole('button', { name: 'Back' }))
    expect(onBack).toHaveBeenCalled()
  })
})

describe('PermissionBanner on Home', () => {
  it('shows when notification permission is denied', async () => {
    sched.notificationPermission.mockResolvedValue('denied')
    render(<Home onNavigate={nav} />)
    expect(await screen.findByRole('region', { name: 'Notifications off' })).toBeInTheDocument()
  })

  it('is hidden when permission is granted', async () => {
    render(<Home onNavigate={nav} />)
    await waitFor(() => expect(sched.notificationPermission).toHaveBeenCalled())
    expect(screen.queryByRole('region', { name: 'Notifications off' })).toBeNull()
  })
})

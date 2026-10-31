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
import { ConfirmSheet } from '@/ui/screens/parts/ConfirmSheet'
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
/** Store actions some tests swap for failing fakes; restored before each test. */
const REAL = { deleteHabit: S().deleteHabit, load: S().load }
const URL_REAL = { create: URL.createObjectURL, revoke: URL.revokeObjectURL }

/** Renders and lets mount-time async work (permission check) settle inside act. */
async function mount(ui: React.ReactElement) {
  await act(async () => {
    render(ui)
  })
}

/** Confirms step 1 of a two-step delete and waits for its sheet's exit animation to finish. */
async function firstConfirm() {
  fireEvent.click(within(screen.getByRole('dialog')).getByRole('button', { name: 'Delete' }))
  await waitFor(() => expect(screen.getAllByRole('dialog')).toHaveLength(1))
}

afterEach(() => {
  URL.createObjectURL = URL_REAL.create
  URL.revokeObjectURL = URL_REAL.revoke
})

beforeEach(async () => {
  useApp.setState(REAL)
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

  it('an eternal habit needs two confirmations to delete from detail', async () => {
    await seedHabit(habit('a'), { eternal: true, rank: 10, earnedTier: 10 })
    render(<HabitDetail habitId="a" onNavigate={nav} />)
    fireEvent.click(screen.getByRole('button', { name: 'Delete habit' }))
    await firstConfirm()
    expect(await repo.listHabits()).toHaveLength(1)
    const second = await screen.findByRole('dialog', { name: 'Are you sure?' })
    await act(async () => {
      fireEvent.click(within(second).getByRole('button', { name: 'Delete forever' }))
    })
    await waitFor(() => expect(nav).toHaveBeenCalledWith('home'))
    expect(await repo.listHabits()).toHaveLength(0)
  })

  it('a failed delete shows an alert and keeps the sheet open', async () => {
    await seedHabit(habit('a'), {})
    act(() => useApp.setState({ deleteHabit: vi.fn(async () => Promise.reject(new Error('disk full'))) }))
    render(<HabitDetail habitId="a" onNavigate={nav} />)
    fireEvent.click(screen.getByRole('button', { name: 'Delete habit' }))
    await act(async () => {
      fireEvent.click(within(screen.getByRole('dialog')).getByRole('button', { name: 'Delete' }))
    })
    const sheet = screen.getByRole('dialog')
    expect(within(sheet).getByRole('alert')).toHaveTextContent('disk full')
    expect(nav).not.toHaveBeenCalled()
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
    await firstConfirm()
    expect(await repo.listHabits()).toHaveLength(3)
    const second = screen.getByRole('dialog')
    expect(second).toHaveTextContent(/can't be undone/i)
    await act(async () => {
      fireEvent.click(within(second).getByRole('button', { name: 'Delete forever' }))
    })
    await waitFor(async () => expect((await repo.listHabits()).map((h) => h.id).sort()).toEqual(['b', 'c']))
  })

  it('a failed trophy delete shows an alert in the sheet', async () => {
    await seedHall()
    act(() => useApp.setState({ deleteHabit: vi.fn(async () => Promise.reject(new Error('locked db'))) }))
    render(<HallOfFame onNavigate={nav} />)
    fireEvent.click(screen.getByRole('button', { name: 'Delete Guitar' }))
    await firstConfirm()
    const second = await screen.findByRole('dialog', { name: 'Are you sure?' })
    await act(async () => {
      fireEvent.click(within(second).getByRole('button', { name: 'Delete forever' }))
    })
    expect(within(screen.getByRole('dialog')).getByRole('alert')).toHaveTextContent('locked db')
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
    await mount(<Settings onBack={onBack} />)
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

  it('notifications on web: "Available in the app", no permission check or hint', async () => {
    sched.notificationPermission.mockResolvedValue('denied')
    await mount(<Settings onBack={onBack} />)
    expect(screen.getByText('Available in the app')).toBeInTheDocument()
    expect(screen.queryByText(/Open settings/i)).toBeNull()
    expect(screen.queryByRole('button', { name: 'Enable' })).toBeNull()
    expect(sched.notificationPermission).not.toHaveBeenCalled()
  })

  it('notifications: Enable requests permission when not yet asked (native)', async () => {
    platform.native = true
    sched.notificationPermission.mockResolvedValue('prompt')
    await mount(<Settings onBack={onBack} />)
    const btn = await screen.findByRole('button', { name: 'Enable' })
    sched.notificationPermission.mockResolvedValue('granted')
    await act(async () => {
      fireEvent.click(btn)
    })
    expect(sched.requestNotificationPermission).toHaveBeenCalled()
    await waitFor(() => expect(screen.queryByRole('button', { name: 'Enable' })).toBeNull())
  })

  it('notifications: denied shows the open-settings hint (native)', async () => {
    platform.native = true
    sched.notificationPermission.mockResolvedValue('denied')
    await mount(<Settings onBack={onBack} />)
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
    await mount(<Settings onBack={onBack} />)
    now = at(41) // the clock moves on after the screen opened; the name uses click time
    await act(async () => {
      fireEvent.click(screen.getByRole('button', { name: 'Export backup' }))
    })
    await waitFor(() => expect(click).toHaveBeenCalled())
    expect(downloaded).toBe('skillup-backup-2026-02-15.json')
    const json = JSON.parse(await created[0].text())
    expect(json.app).toBe('skillup')
    expect(json.habits).toHaveLength(1)
    expect(fs.writeFile).not.toHaveBeenCalled()
    click.mockRestore()
  })

  it('export on native writes to the cache dir and shares the file', async () => {
    platform.native = true
    await mount(<Settings onBack={onBack} />)
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
    await mount(<Settings onBack={onBack} />)
    await pick('{not json')
    expect(await screen.findByRole('alert')).toHaveTextContent('File is not valid JSON')
    expect(screen.queryByRole('dialog')).toBeNull()
    expect(importBackup).not.toHaveBeenCalled()
  })

  it('a file that cannot be read shows an alert', async () => {
    await mount(<Settings onBack={onBack} />)
    const f = new File(['{}'], 'b.json', { type: 'application/json' })
    f.text = () => Promise.reject(new Error('permission revoked'))
    await act(async () => {
      fireEvent.change(screen.getByLabelText('Backup file'), { target: { files: [f] } })
    })
    expect(await screen.findByRole('alert')).toHaveTextContent('permission revoked')
    expect(importBackup).not.toHaveBeenCalled()
  })

  it('if import succeeds but reload fails, says to reopen the app', async () => {
    const backup = {
      app: 'skillup', version: 1, exportedAt: now, habits: [habit('x')], sessions: [], seen: [],
      settings: { theme: 'system', sound: false, reduceMotion: 'system' },
    }
    await mount(<Settings onBack={onBack} />)
    await pick(JSON.stringify(backup))
    act(() => useApp.setState({ load: vi.fn(async () => Promise.reject(new Error('boom'))) }))
    await act(async () => {
      fireEvent.click(within(screen.getByRole('dialog')).getByRole('button', { name: 'Replace' }))
    })
    expect(await screen.findByRole('alert')).toHaveTextContent('Restored — reopen the app')
    expect(screen.queryByText(/Import failed/)).toBeNull()
    expect(await repo.listHabits()).toHaveLength(1)
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
    await mount(<Settings onBack={onBack} />)
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

  it('back button returns', async () => {
    await mount(<Settings onBack={onBack} />)
    fireEvent.click(screen.getByRole('button', { name: 'Back' }))
    expect(onBack).toHaveBeenCalled()
  })
})

describe('PermissionBanner on Home', () => {
  it('shows (persistently, no dismiss) when permission is denied on native', async () => {
    platform.native = true
    sched.notificationPermission.mockResolvedValue('denied')
    await mount(<Home onNavigate={nav} />)
    const banner = await screen.findByRole('region', { name: 'Notifications off' })
    expect(within(banner).queryByRole('button', { name: /dismiss/i })).toBeNull()
  })

  it('never shows on web, even if permission reads denied', async () => {
    sched.notificationPermission.mockResolvedValue('denied')
    await mount(<Home onNavigate={nav} />)
    expect(screen.queryByRole('region', { name: 'Notifications off' })).toBeNull()
    expect(sched.notificationPermission).not.toHaveBeenCalled()
  })

  it('is hidden when permission is granted on native', async () => {
    platform.native = true
    await mount(<Home onNavigate={nav} />)
    await waitFor(() => expect(sched.notificationPermission).toHaveBeenCalled())
    expect(screen.queryByRole('region', { name: 'Notifications off' })).toBeNull()
  })
})

describe('ConfirmSheet', () => {
  it('ignores Escape and backdrop while busy', () => {
    const onCancel = vi.fn()
    const { container, rerender } = render(
      <ConfirmSheet title="T" confirmLabel="Go" busy onConfirm={() => {}} onCancel={onCancel} />,
    )
    fireEvent.keyDown(window, { key: 'Escape' })
    fireEvent.click(container.firstChild as Element)
    expect(onCancel).not.toHaveBeenCalled()
    rerender(<ConfirmSheet title="T" confirmLabel="Go" onConfirm={() => {}} onCancel={onCancel} />)
    fireEvent.keyDown(window, { key: 'Escape' })
    expect(onCancel).toHaveBeenCalledTimes(1)
  })
})

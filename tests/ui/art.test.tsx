import { render, screen } from '@testing-library/react'
import { emblemSvg } from '@/ui/art/emblemSvg'
import { TIER_STYLE, HABIT_COLORS } from '@/ui/theme'
import { Emblem } from '@/ui/art/Emblem'
import { Ring } from '@/ui/art/Ring'
import { Flame } from '@/ui/art/Flame'
import { BeadTrack } from '@/ui/art/BeadTrack'
import { Heatmap } from '@/ui/art/Heatmap'
import { Ladder } from '@/ui/art/Ladder'
import { EmptyState } from '@/ui/art/EmptyState'
import type { DayRecord, HabitState } from '@/domain/types'

function parse(svg: string): Document {
  return new DOMParser().parseFromString(svg, 'image/svg+xml')
}

function makeState(over: Partial<HabitState> = {}): HabitState {
  return {
    habitId: 'h1',
    today: '2026-11-10',
    todayMinutes: 0,
    commitment: 60,
    days: [],
    formingDone: 0,
    formed: false,
    streak: 0,
    longestStreak: 0,
    totalMinutes: 0,
    overtimeMinutes: 0,
    earnedTier: 1,
    lostTiers: 0,
    recoveryProgress: 0,
    rank: 1,
    eternal: false,
    badges: { formed: false, tiersReached: [1] },
    missedYesterday: false,
    events: [],
    ...over,
  }
}

describe('theme', () => {
  it('has a style for every tier and 8 habit colours', () => {
    for (let t = 1; t <= 10; t++) {
      const s = TIER_STYLE[t]
      expect(s.primary).toMatch(/^#/)
      expect(s.secondary).toMatch(/^#/)
      expect(s.glow).toMatch(/^#/)
      expect(s.material).toBeTruthy()
    }
    expect(HABIT_COLORS).toHaveLength(8)
  })
})

describe('emblemSvg', () => {
  it('returns a valid standalone 128x128 SVG for every tier, all different', () => {
    const out = new Set<string>()
    for (let t = 1; t <= 10; t++) {
      const svg = emblemSvg(t, { idSuffix: 'x' })
      const doc = parse(svg)
      expect(doc.getElementsByTagName('parsererror')).toHaveLength(0)
      const root = doc.documentElement
      expect(root.nodeName).toBe('svg')
      expect(root.getAttribute('viewBox')).toBe('0 0 128 128')
      expect(root.getAttribute('xmlns')).toBe('http://www.w3.org/2000/svg')
      out.add(svg)
    }
    expect(out.size).toBe(10)
  })

  it('uses unique gradient ids per call so emblems on one page do not clash', () => {
    const a = parse(emblemSvg(4))
    const b = parse(emblemSvg(4))
    const idsA = [...a.querySelectorAll('[id]')].map((e) => e.id)
    const idsB = new Set([...b.querySelectorAll('[id]')].map((e) => e.id))
    expect(idsA.length).toBeGreaterThan(0)
    expect(idsA.some((id) => idsB.has(id))).toBe(false)
  })

  it('every url(#id) reference resolves inside the same svg', () => {
    for (let t = 1; t <= 10; t++) {
      for (const opts of [{}, { cracked: true }, { locked: true }]) {
        const svg = emblemSvg(t, opts)
        const doc = parse(svg)
        const ids = new Set([...doc.querySelectorAll('[id]')].map((e) => e.id))
        for (const m of svg.matchAll(/url\(#([^)]+)\)/g)) expect(ids.has(m[1])).toBe(true)
      }
    }
  })

  it('cracked adds a data-crack element; plain does not', () => {
    expect(parse(emblemSvg(5, { cracked: true })).querySelector('[data-crack]')).not.toBeNull()
    expect(parse(emblemSvg(5)).querySelector('[data-crack]')).toBeNull()
  })

  it('locked adds a data-lock element', () => {
    expect(parse(emblemSvg(6, { locked: true })).querySelector('[data-lock]')).not.toBeNull()
  })

  it('clamps out-of-range tiers', () => {
    expect(parse(emblemSvg(0)).getElementsByTagName('parsererror')).toHaveLength(0)
    expect(parse(emblemSvg(99)).getElementsByTagName('parsererror')).toHaveLength(0)
  })
})

describe('Emblem', () => {
  it('renders the emblem with an accessible tier name', () => {
    render(<Emblem tier={7} size={64} />)
    expect(screen.getByRole('img', { name: /master/i })).toBeInTheDocument()
  })
})

describe('Ring', () => {
  it('renders an overdrive arc only when overtime > 0', () => {
    const { container, rerender } = render(<Ring progress={1} overtime={0} color="#4dabf7" size={120} />)
    expect(container.querySelector('[data-testid="overdrive"]')).toBeNull()
    rerender(<Ring progress={1} overtime={0.4} color="#4dabf7" size={120} />)
    expect(container.querySelector('[data-testid="overdrive"]')).not.toBeNull()
  })

  it('renders children in the centre', () => {
    render(
      <Ring progress={0.3} overtime={0} color="#4dabf7" size={120}>
        <span>go</span>
      </Ring>,
    )
    expect(screen.getByText('go')).toBeInTheDocument()
  })
})

describe('Flame', () => {
  it('changes colour band with streak length', () => {
    const { container, rerender } = render(<Flame streak={5} size={48} />)
    expect(container.querySelector('[data-band="orange"]')).not.toBeNull()
    rerender(<Flame streak={30} size={48} />)
    expect(container.querySelector('[data-band="blue"]')).not.toBeNull()
    rerender(<Flame streak={100} size={48} />)
    expect(container.querySelector('[data-band="violet"]')).not.toBeNull()
  })
})

describe('BeadTrack', () => {
  it('renders 12 filled beads of 30 when done=12', () => {
    const { container } = render(<BeadTrack done={12} formed={false} />)
    expect(container.querySelectorAll('[data-bead]')).toHaveLength(30)
    expect(container.querySelectorAll('[data-bead="filled"]')).toHaveLength(12)
  })

  it('fills all beads when formed', () => {
    const { container } = render(<BeadTrack done={30} formed />)
    expect(container.querySelectorAll('[data-bead="filled"]')).toHaveLength(30)
  })
})

describe('Heatmap', () => {
  it('labels days by status and outlines future days', () => {
    const days: DayRecord[] = [
      { key: '2026-11-01', minutes: 60, commitment: 60, status: 'done' },
      { key: '2026-11-02', minutes: 90, commitment: 60, status: 'done' },
      { key: '2026-11-03', minutes: 0, commitment: 60, status: 'missed' },
      { key: '2026-11-04', minutes: 20, commitment: 60, status: 'pending' },
    ]
    render(<Heatmap days={days} month="2026-11-01" color="#69db7c" />)
    expect(screen.getByLabelText(/Nov 3: missed/)).toBeInTheDocument()
    expect(screen.getByLabelText(/Nov 1: done/)).toBeInTheDocument()
    expect(screen.getByLabelText(/Nov 2: done/)).toHaveAttribute('data-overtime', 'true')
    expect(screen.getByLabelText(/Nov 20/)).toHaveAttribute('data-status', 'future')
    expect(screen.getAllByRole('gridcell').length).toBe(30)
  })
})

describe('Ladder', () => {
  it('marks lost, reached, current and next-locked tiers', () => {
    const state = makeState({
      earnedTier: 5,
      lostTiers: 2,
      rank: 3,
      totalMinutes: 100 * 60, // 100h of 1000h target
      badges: { formed: false, tiersReached: [1, 2, 3, 4, 5] },
    })
    const { container } = render(<Ladder state={state} targetHours={1000} />)
    const st = (t: number) => container.querySelector(`[data-tier="${t}"]`)?.getAttribute('data-state')
    expect(st(1)).toBe('reached')
    expect(st(2)).toBe('reached')
    expect(st(3)).toBe('current')
    expect(st(4)).toBe('lost')
    expect(st(5)).toBe('lost')
    expect(st(6)).toBe('locked')
    expect(st(7)).toBe('future')
    expect(container.querySelectorAll('[data-state="lost"]')).toHaveLength(2)
    // tier 6 = 20% of 1000h = 200h; 100h done -> 100h to go
    expect(container.querySelector('[data-tier="6"]')?.textContent).toMatch(/100h/)
  })
})

describe('EmptyState', () => {
  it('renders both variants', () => {
    const { container, rerender } = render(<EmptyState variant="add" />)
    expect(container.querySelector('svg')).not.toBeNull()
    rerender(<EmptyState variant="locked" />)
    expect(container.querySelector('[data-variant="locked"]')).not.toBeNull()
  })
})

import { render, screen } from '@testing-library/react'
import App from '@/App'

vi.mock('@/notify/scheduler', () => ({ applySchedule: vi.fn(async () => {}), registerNotificationActions: vi.fn(async () => {}) }))
vi.mock('@capacitor/app', () => ({ App: { addListener: vi.fn(async () => ({ remove: async () => {} })) } }))

describe('smoke', () => {
  it('renders the SkillUp heading', () => {
    render(<App />)
    expect(screen.getByRole('heading', { name: 'SkillUp' })).toBeInTheDocument()
  })
})

import { render, screen } from '@testing-library/react'
import App from '@/App'

describe('smoke', () => {
  it('renders the SkillUp heading', () => {
    render(<App />)
    expect(screen.getByText('SkillUp')).toBeInTheDocument()
  })
})

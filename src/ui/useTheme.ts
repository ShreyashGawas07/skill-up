import { useEffect } from 'react'
import type { Settings } from '@/data/repo'

const BAR: Record<'light' | 'dark', string> = { light: '#faf4e8', dark: '#151311' }

/** Resolves the theme setting (following the OS for 'system') onto <html data-theme>. */
export function useTheme(theme: Settings['theme']): void {
  useEffect(() => {
    const mq = window.matchMedia?.('(prefers-color-scheme: dark)')
    const apply = () => {
      const mode = theme === 'system' ? (mq?.matches ? 'dark' : 'light') : theme
      document.documentElement.dataset.theme = mode
      document.querySelector('meta[name="theme-color"]')?.setAttribute('content', BAR[mode])
    }
    apply()
    if (theme !== 'system' || !mq) return
    mq.addEventListener?.('change', apply)
    return () => mq.removeEventListener?.('change', apply)
  }, [theme])
}

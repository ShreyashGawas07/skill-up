import type { Settings } from '@/data/repo'

/** Elapsed milliseconds as `h:mm:ss`. */
export function fmtClock(ms: number): string {
  const s = Math.max(0, Math.floor(ms / 1000))
  const h = Math.floor(s / 3600)
  const m = Math.floor((s % 3600) / 60)
  return `${h}:${String(m).padStart(2, '0')}:${String(s % 60).padStart(2, '0')}`
}

/** Minutes as `h:mm`. */
export function fmtHM(minutes: number): string {
  const m = Math.max(0, Math.floor(minutes))
  return `${Math.floor(m / 60)}:${String(m % 60).padStart(2, '0')}`
}

export const fmtInt = (n: number): string => Math.floor(n).toLocaleString('en-US')

/** The app's reduce-motion setting as an art-component prop (undefined = follow the OS). */
export function motionPref(s: Settings['reduceMotion']): boolean | undefined {
  return s === 'on' ? true : s === 'off' ? false : undefined
}

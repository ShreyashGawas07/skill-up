import { useEffect, useRef, useState, type RefObject } from 'react'
import confetti from 'canvas-confetti'
import type { HabitState } from '@/domain/types'
import { haptic } from '@/feedback/haptics'

interface Args {
  habitId: string
  state: HabitState
  /** This habit's timer is running. */
  live: boolean
  color: string
  reduce: boolean
  cardRef: RefObject<HTMLElement>
}

/** Auto-clears a counter-triggered pop after `ms`. */
function useFlash(ms: number): [number, () => void] {
  const [n, setN] = useState(0)
  useEffect(() => {
    if (!n) return
    const t = setTimeout(() => setN(0), ms)
    return () => clearTimeout(t)
  }, [n, ms])
  return [n, () => setN((x) => x + 1)]
}

/**
 * Live card moments:
 * - commitment crossed during a tick (prev < c ≤ now): confetti in the habit colour, haptic.success
 *   and a "+1 🔥" pop, once per habit per day;
 * - overtime: a "+15m" sparkle for every extra 15 minutes while this habit runs.
 */
export function useCardMoments({ habitId, state, live, color, reduce, cardRef }: Args) {
  const { todayMinutes: today, commitment: c, overtimeMinutes, today: day } = state
  const [pop, firePop] = useFlash(1800)
  const [spark, fireSpark] = useFlash(1500)

  const prevMin = useRef(today)
  const fired = useRef(new Set<string>())
  useEffect(() => {
    const prev = prevMin.current
    prevMin.current = today
    const key = `${habitId}:${day}`
    if (!(c > 0 && prev < c && c <= today) || fired.current.has(key)) return
    fired.current.add(key)
    const box = cardRef.current?.getBoundingClientRect()
    const origin =
      box && box.width && window.innerWidth
        ? { x: (box.left + box.width * 0.3) / window.innerWidth, y: (box.top + box.height / 2) / window.innerHeight }
        : { x: 0.5, y: 0.4 }
    // Confetti is motion: skip it entirely under reduce-motion (in-app setting or OS); keep haptic + fading pop.
    if (!reduce) {
      try {
        void confetti({ particleCount: 150, spread: 85, startVelocity: 42, origin, colors: [color, '#ffffff', '#ffd43b'] })
      } catch {
        // no canvas available
      }
    }
    haptic.success()
    firePop()
  }, [today, c, day, habitId])

  const bucket = Math.floor(overtimeMinutes / 15)
  const prevBucket = useRef(bucket)
  useEffect(() => {
    if (live && bucket > prevBucket.current && bucket > 0) {
      haptic.tick()
      fireSpark()
    }
    prevBucket.current = bucket
  }, [bucket, live])

  return { pop, spark }
}

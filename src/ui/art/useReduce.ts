import { useReducedMotion } from 'framer-motion'

/** Explicit prop (from the app's reduce-motion setting) wins; otherwise follow the OS. */
export function useReduce(prop?: boolean): boolean {
  const sys = useReducedMotion()
  return prop ?? !!sys
}

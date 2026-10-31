// Pure string builder for rank emblems — NO React/DOM imports (a Node build script renders these to PNG).
// Relative imports only so the script can load it without the `@/` alias.
import { TIER_STYLE } from '../theme'
import { cracks, defs, mix, padlock, type Ctx, type Palette } from './emblems/parts'
import { TIER_ART, extraDefs } from './emblems/tiers'

export interface EmblemOptions {
  cracked?: boolean
  locked?: boolean
  /** Suffix for gradient ids; defaults to a module counter so every call is unique. */
  idSuffix?: string
}

const TRIM: Record<number, [string, string]> = {
  1: ['#e2e5ea', '#7b808a'],
  2: ['#ffe0b8', '#9a5a2c'],
  3: ['#ffffff', '#9aa6b8'],
  4: ['#fffbe6', '#d0920f'],
  5: ['#fff0a8', '#c98a12'],
  6: ['#ffffff', '#9fb2ca'],
  7: ['#fff0a8', '#c98a12'],
  8: ['#fff0a8', '#c98a12'],
  9: ['#ffffff', '#c8d6f0'],
  10: ['#fffbe6', '#e0a21c'],
}

const LOCKED: Palette = {
  primary: '#5d626d',
  secondary: '#25282f',
  glow: '#7d838f',
  material: 'stone',
  trimLight: '#9aa0aa',
  trimDark: '#454a53',
}

const GREY = '#5c606a'

let counter = 0

export function clampTier(tier: number): number {
  return Math.min(10, Math.max(1, Math.round(Number.isFinite(tier) ? tier : 1)))
}

function palette(tier: number, opts: EmblemOptions): Palette {
  if (opts.locked) return LOCKED
  const s = TIER_STYLE[tier]
  const [trimLight, trimDark] = TRIM[tier]
  const p: Palette = { ...s, trimLight, trimDark }
  if (!opts.cracked) return p
  // Cracked = drained of colour, still recognisable.
  const k = 0.55
  return {
    ...p,
    primary: mix(p.primary, GREY, k),
    secondary: mix(p.secondary, '#202228', k),
    glow: mix(p.glow, GREY, k),
    trimLight: mix(p.trimLight, GREY, k),
    trimDark: mix(p.trimDark, '#202228', k),
    // prismatic/cosmic faces use fixed bright stops; fall back to plain metal when drained.
    material: p.material === 'prismatic' || p.material === 'cosmic' ? 'silver' : p.material,
  }
}

/** Standalone `<svg viewBox="0 0 128 128">` for a tier emblem (static; animation lives in <Emblem>). */
export function emblemSvg(tier: number, opts: EmblemOptions = {}): string {
  const t = clampTier(tier)
  const suffix = (opts.idSuffix ?? String(++counter)).replace(/[^A-Za-z0-9_-]/g, '')
  const prefix = `se${t}${opts.locked ? 'l' : ''}${opts.cracked ? 'c' : ''}-${suffix}`
  const ctx: Ctx = {
    tier: t,
    p: palette(t, opts),
    id: (n) => `${prefix}-${n}`,
    url: (n) => `url(#${prefix}-${n})`,
  }
  const art = TIER_ART[t](ctx)
  return (
    `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 128 128" data-tier="${t}">` +
    defs(ctx) +
    extraDefs(ctx) +
    `<g${opts.locked ? ' opacity="0.85"' : ''}>${art}</g>` +
    (opts.cracked ? cracks() : '') +
    (opts.locked ? padlock() : '') +
    `</svg>`
  )
}

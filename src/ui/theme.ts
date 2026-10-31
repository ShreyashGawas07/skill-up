// Pure data: no React/DOM imports (imported by emblemSvg.ts, which a Node build script uses).

export type Material =
  | 'stone'
  | 'bronze'
  | 'silver'
  | 'gold'
  | 'emerald'
  | 'sapphire'
  | 'amethyst'
  | 'crimson'
  | 'prismatic'
  | 'cosmic'

export interface TierStyle {
  /** Light/body colour of the material. */
  primary: string
  /** Deep/shadow colour of the material. */
  secondary: string
  /** Emissive highlight used for inner glows and halos. */
  glow: string
  material: Material
}

export const TIER_STYLE: Record<number, TierStyle> = {
  1: { primary: '#a7adb6', secondary: '#4a4f58', glow: '#d4d8de', material: 'stone' },
  2: { primary: '#e7a46c', secondary: '#6e3a1c', glow: '#ffc896', material: 'bronze' },
  3: { primary: '#eef2f7', secondary: '#7d8796', glow: '#ffffff', material: 'silver' },
  4: { primary: '#ffd860', secondary: '#a66a08', glow: '#fff0b0', material: 'gold' },
  5: { primary: '#4cf0a6', secondary: '#05664a', glow: '#9dffd2', material: 'emerald' },
  6: { primary: '#5eaeff', secondary: '#16349c', glow: '#a6d4ff', material: 'sapphire' },
  7: { primary: '#c995ff', secondary: '#4f1a9a', glow: '#e4c6ff', material: 'amethyst' },
  8: { primary: '#ff5c72', secondary: '#7c0c24', glow: '#ff9fac', material: 'crimson' },
  9: { primary: '#8cf3ff', secondary: '#ff6fd8', glow: '#ffffff', material: 'prismatic' },
  10: { primary: '#ffe27a', secondary: '#e8780c', glow: '#fff6d0', material: 'cosmic' },
}

/** 8 pastel habit colours (headers, bars, heatmap). Text on them is always `--on-tint` ink. */
export const HABIT_COLORS: string[] = [
  '#a9d9b8', // sage
  '#f4a99c', // coral
  '#c9b6ec', // lavender
  '#f8d77c', // butter
  '#a8cdf0', // sky
  '#f7c29b', // peach
  '#9edfd2', // mint
  '#f3b6d0', // rose
]

/** v1 saturated colours, remapped on load so existing habits pick up the pastel palette. */
const LEGACY: Record<string, string> = {
  '#ff6b6b': '#f4a99c',
  '#ffa94d': '#f7c29b',
  '#ffd43b': '#f8d77c',
  '#69db7c': '#a9d9b8',
  '#38d9a9': '#9edfd2',
  '#4dabf7': '#a8cdf0',
  '#9775fa': '#c9b6ec',
  '#f783ac': '#f3b6d0',
}

export const pastel = (color: string): string => LEGACY[color.toLowerCase()] ?? color

/** Overdrive (overtime) gold. */
export const OVERDRIVE = { from: '#fff3b0', mid: '#f5b324', to: '#e08a12' }

/** Fixed dark ink used on pastel tints in both themes. */
export const ON_TINT = '#28221e'

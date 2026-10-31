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

/** 8 habit accent colours (cards, rings, heatmap). */
export const HABIT_COLORS: string[] = [
  '#ff6b6b', // coral
  '#ffa94d', // tangerine
  '#ffd43b', // sun
  '#69db7c', // mint
  '#38d9a9', // teal
  '#4dabf7', // sky
  '#9775fa', // violet
  '#f783ac', // pink
]

/** Overdrive (overtime) ring gold. */
export const OVERDRIVE = { from: '#fff3b0', mid: '#ffcf3f', to: '#ff9f1c' }

export const BG = '#0b0b12'

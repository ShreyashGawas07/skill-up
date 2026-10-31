// Pure SVG string helpers for emblems. No React/DOM imports (used by a Node build script).
import type { TierStyle } from '../../theme'

export interface Palette extends TierStyle {
  trimLight: string
  trimDark: string
}

export interface Ctx {
  tier: number
  p: Palette
  /** Namespaced id for a gradient (unique per emblemSvg call). */
  id: (name: string) => string
  /** `url(#…)` for a namespaced id. */
  url: (name: string) => string
}

export const r2 = (n: number): number => Math.round(n * 100) / 100

// ---------- colour ----------
function hexToRgb(hex: string): [number, number, number] {
  const h = hex.replace('#', '')
  return [0, 2, 4].map((i) => parseInt(h.slice(i, i + 2), 16)) as [number, number, number]
}

export function mix(a: string, b: string, t: number): string {
  const ca = hexToRgb(a)
  const cb = hexToRgb(b)
  return (
    '#' +
    ca
      .map((v, i) => Math.round(v + (cb[i] - v) * t))
      .map((v) => v.toString(16).padStart(2, '0'))
      .join('')
  )
}

// ---------- geometry ----------
export const SHIELD =
  'M64 12 L106 24 C106 24 107 50 104 66 C99 92 82 106 64 118 C46 106 29 92 24 66 C21 50 22 24 22 24 Z'

export function circlePath(cx: number, cy: number, r: number): string {
  return `M${r2(cx - r)} ${cy} A${r} ${r} 0 1 0 ${r2(cx + r)} ${cy} A${r} ${r} 0 1 0 ${r2(cx - r)} ${cy} Z`
}

export function starPoints(cx: number, cy: number, n: number, ro: number, ri: number, rotDeg = -90): [number, number][] {
  const pts: [number, number][] = []
  for (let i = 0; i < n * 2; i++) {
    const r = i % 2 === 0 ? ro : ri
    const a = ((rotDeg + (i * 180) / n) * Math.PI) / 180
    pts.push([r2(cx + r * Math.cos(a)), r2(cy + r * Math.sin(a))])
  }
  return pts
}

export function starPath(cx: number, cy: number, n: number, ro: number, ri: number, rotDeg = -90): string {
  return 'M' + starPoints(cx, cy, n, ro, ri, rotDeg).map(([x, y]) => `${x} ${y}`).join(' L') + ' Z'
}

/** Scale a group about (cx, cy). */
export function about(k: number, cx = 64, cy = 64, dx = 0, dy = 0): string {
  return `translate(${r2(cx + dx)} ${r2(cy + dy)}) scale(${k}) translate(${-cx} ${-cy})`
}

export const MIRROR = 'translate(128 0) scale(-1 1)'

// ---------- defs ----------
export function defs(ctx: Ctx): string {
  const { p, id } = ctx
  const deep = mix(p.secondary, '#000000', 0.45)
  let face: string
  if (p.material === 'prismatic') {
    face = `<linearGradient id="${id('face')}" x1="0.1" y1="0" x2="0.9" y2="1">
<stop offset="0" stop-color="#9ff7ff"/><stop offset="0.3" stop-color="#a99bff"/>
<stop offset="0.6" stop-color="#ff74d6"/><stop offset="1" stop-color="#ffcf6e"/></linearGradient>`
  } else if (p.material === 'cosmic') {
    face = `<radialGradient id="${id('face')}" cx="0.42" cy="0.38" r="0.7">
<stop offset="0" stop-color="${p.glow}"/><stop offset="0.35" stop-color="${p.primary}"/>
<stop offset="0.75" stop-color="#ffaa2a"/><stop offset="1" stop-color="${p.secondary}"/></radialGradient>`
  } else {
    face = `<linearGradient id="${id('face')}" x1="0.2" y1="0" x2="0.8" y2="1">
<stop offset="0" stop-color="${p.primary}"/><stop offset="0.55" stop-color="${mix(p.primary, p.secondary, 0.55)}"/>
<stop offset="1" stop-color="${p.secondary}"/></linearGradient>`
  }
  return `<defs>
${face}
<linearGradient id="${id('rim')}" x1="0" y1="0" x2="0" y2="1">
<stop offset="0" stop-color="${p.glow}"/><stop offset="0.3" stop-color="${p.primary}"/>
<stop offset="0.75" stop-color="${p.secondary}"/><stop offset="1" stop-color="${deep}"/></linearGradient>
<linearGradient id="${id('sheen')}" x1="0" y1="0" x2="0" y2="1">
<stop offset="0" stop-color="#ffffff" stop-opacity="0.6"/><stop offset="0.42" stop-color="#ffffff" stop-opacity="0.1"/>
<stop offset="0.5" stop-color="#ffffff" stop-opacity="0"/></linearGradient>
<radialGradient id="${id('inner')}" cx="0.5" cy="0.48" r="0.55">
<stop offset="0" stop-color="${p.glow}" stop-opacity="0.55"/><stop offset="1" stop-color="${p.glow}" stop-opacity="0"/></radialGradient>
<radialGradient id="${id('halo')}" cx="0.5" cy="0.5" r="0.5">
<stop offset="0.35" stop-color="${p.glow}" stop-opacity="0.55"/><stop offset="1" stop-color="${p.glow}" stop-opacity="0"/></radialGradient>
<linearGradient id="${id('trim')}" x1="0" y1="0" x2="0" y2="1">
<stop offset="0" stop-color="${p.trimLight}"/><stop offset="0.55" stop-color="${mix(p.trimLight, p.trimDark, 0.6)}"/>
<stop offset="1" stop-color="${p.trimDark}"/></linearGradient>
<linearGradient id="${id('wing')}" x1="0" y1="0" x2="1" y2="1">
<stop offset="0" stop-color="${p.glow}"/><stop offset="0.5" stop-color="${p.primary}"/>
<stop offset="1" stop-color="${p.secondary}"/></linearGradient>
<radialGradient id="${id('gem')}" cx="0.35" cy="0.3" r="0.8">
<stop offset="0" stop-color="#ffffff"/><stop offset="0.25" stop-color="${p.glow}"/>
<stop offset="0.6" stop-color="${p.primary}"/><stop offset="1" stop-color="${p.secondary}"/></radialGradient>
</defs>`
}

// ---------- layered bodies ----------
/** Bevelled body: drop shadow, metallic rim, inset face with inner glow, top sheen and edge highlight. */
export function body(ctx: Ctx, d: string, opts: { k?: number; cx?: number; cy?: number; rim?: string } = {}): string {
  const { k = 0.85, cx = 64, cy = 64 } = opts
  const rim = opts.rim ?? ctx.url('rim')
  return `<path d="${d}" transform="translate(0 3)" fill="#000000" fill-opacity="0.38"/>
<path d="${d}" fill="${rim}"/>
<path d="${d}" fill="none" stroke="#000000" stroke-opacity="0.45" stroke-width="1.4"/>
<g transform="${about(k, cx, cy)}">
<path d="${d}" fill="#000000" fill-opacity="0.35" transform="translate(0 -1.5)"/>
<path d="${d}" fill="${ctx.url('face')}"/>
<path d="${d}" fill="${ctx.url('inner')}"/>
<path d="${d}" fill="${ctx.url('sheen')}"/>
<path d="${d}" fill="none" stroke="#ffffff" stroke-opacity="0.45" stroke-width="1.2"/>
</g>`
}

export function halo(ctx: Ctx, r = 62, opacity = 1): string {
  return `<circle cx="64" cy="64" r="${r}" fill="${ctx.url('halo')}" opacity="${opacity}"/>`
}

/** A star split into light/dark facets for a cut-metal look. */
export function facetStar(cx: number, cy: number, n: number, ro: number, ri: number, light: string, dark: string, rot = -90): string {
  const pts = starPoints(cx, cy, n, ro, ri, rot)
  let out = `<path d="${starPath(cx, cy, n, ro, ri, rot)}" transform="translate(0 1.5)" fill="#000000" fill-opacity="0.35"/>`
  for (let i = 0; i < pts.length; i++) {
    const a = pts[i]
    const b = pts[(i + 1) % pts.length]
    const fill = i % 2 === 0 ? light : dark
    out += `<path d="M${cx} ${cy} L${a[0]} ${a[1]} L${b[0]} ${b[1]} Z" fill="${fill}"/>`
  }
  out += `<path d="${starPath(cx, cy, n, ro, ri, rot)}" fill="none" stroke="#000000" stroke-opacity="0.35" stroke-width="0.8" stroke-linejoin="round"/>`
  return out
}

/** Faceted cut gem (rhombus/kite) with 4 lit facets and a sparkle. */
export function gem(ctx: Ctx, cx: number, cy: number, w: number, h: number): string {
  const { p } = ctx
  const t = cy - h * 0.42
  const b = cy + h * 0.58
  const l = cx - w / 2
  const r = cx + w / 2
  const outline = `M${cx} ${r2(t)} L${r2(r)} ${cy} L${cx} ${r2(b)} L${r2(l)} ${cy} Z`
  return `<path d="${outline}" transform="translate(0 2)" fill="#000000" fill-opacity="0.4"/>
<path d="M${cx} ${r2(t)} L${r2(l)} ${cy} L${cx} ${cy} Z" fill="${p.glow}"/>
<path d="M${cx} ${r2(t)} L${r2(r)} ${cy} L${cx} ${cy} Z" fill="${p.primary}"/>
<path d="M${r2(l)} ${cy} L${cx} ${r2(b)} L${cx} ${cy} Z" fill="${mix(p.primary, p.secondary, 0.5)}"/>
<path d="M${r2(r)} ${cy} L${cx} ${r2(b)} L${cx} ${cy} Z" fill="${p.secondary}"/>
<path d="${outline}" fill="none" stroke="${ctx.url('trim')}" stroke-width="2.2" stroke-linejoin="round"/>
<path d="${starPath(r2(cx - w * 0.16), r2(cy - h * 0.16), 4, w * 0.16, w * 0.04, -90)}" fill="#ffffff" fill-opacity="0.9"/>`
}

/** Left-side wing of n feathers; mirror with MIRROR for the right. */
export function wing(ctx: Ctx, cfg: { rootX: number; rootY: number; n: number; len: number; from: number; to: number; w: number }): string {
  const { rootX, rootY, n, len, from, to, w } = cfg
  let out = ''
  for (let i = n - 1; i >= 0; i--) {
    const ang = ((from + ((to - from) * i) / Math.max(1, n - 1)) * Math.PI) / 180
    const bx = rootX + i * 1.5
    const by = rootY + i * 5.5
    const L = len * (1 - i * 0.07)
    const ux = -Math.cos(ang)
    const uy = Math.sin(ang)
    const tx = bx + ux * L
    const ty = by + uy * L
    const nx = -uy
    const ny = ux
    const mx = bx + ux * L * 0.55
    const my = by + uy * L * 0.55
    const fw = w * (1 - i * 0.05)
    const d = `M${r2(bx)} ${r2(by)} Q${r2(mx + nx * fw)} ${r2(my + ny * fw)} ${r2(tx)} ${r2(ty)} Q${r2(mx - nx * fw * 0.7)} ${r2(my - ny * fw * 0.7)} ${r2(bx)} ${r2(by)} Z`
    out += `<path d="${d}" fill="${ctx.url('wing')}" stroke="#000000" stroke-opacity="0.35" stroke-width="0.9" stroke-linejoin="round"/>`
    out += `<path d="M${r2(bx)} ${r2(by)} L${r2(bx + ux * L * 0.82)} ${r2(by + uy * L * 0.82)}" stroke="#ffffff" stroke-opacity="0.45" stroke-width="0.9" stroke-linecap="round"/>`
  }
  return out
}

export function wings(ctx: Ctx, cfg: Parameters<typeof wing>[1]): string {
  const left = wing(ctx, cfg)
  return `<g>${left}</g><g transform="${MIRROR}">${left}</g>`
}

/** Laurel branch on the left; mirror for right. */
export function laurel(ctx: Ctx, cy = 66, R = 48, leaves = 8): string {
  let side = `<path d="M${r2(64 + R * Math.cos(Math.PI * 0.55))} ${r2(cy + R * Math.sin(Math.PI * 0.55))} A${R} ${R} 0 0 1 ${r2(64 + R * Math.cos(Math.PI * 1.22))} ${r2(cy + R * Math.sin(Math.PI * 1.22))}" fill="none" stroke="${ctx.url('trim')}" stroke-width="2.2" stroke-linecap="round"/>`
  for (let i = 0; i < leaves; i++) {
    const phi = Math.PI * (0.6 + (0.6 * i) / (leaves - 1))
    for (const off of [-5, 5]) {
      const rr = R + off
      const x = 64 + rr * Math.cos(phi)
      const y = cy + rr * Math.sin(phi)
      const rot = (phi * 180) / Math.PI + 90 + (off > 0 ? -28 : 28)
      side += `<ellipse cx="${r2(x)}" cy="${r2(y)}" rx="7.5" ry="3.2" transform="rotate(${r2(rot)} ${r2(x)} ${r2(y)})" fill="${ctx.url('trim')}" stroke="#000000" stroke-opacity="0.35" stroke-width="0.7"/>`
    }
  }
  return `<g>${side}</g><g transform="${MIRROR}">${side}</g>`
}

/** Crown with 5 points, jewelled orbs and a band. */
export function crown(ctx: Ctx, cx: number, yb: number, w: number, h: number): string {
  const x0 = cx - w / 2
  const x1 = cx + w / 2
  const tips: [number, number][] = [
    [x0 - 2, yb - h * 0.72],
    [cx - w * 0.26, yb - h * 0.88],
    [cx, yb - h],
    [cx + w * 0.26, yb - h * 0.88],
    [x1 + 2, yb - h * 0.72],
  ]
  const valleys: [number, number][] = [
    [cx - w * 0.38, yb - h * 0.4],
    [cx - w * 0.13, yb - h * 0.45],
    [cx + w * 0.13, yb - h * 0.45],
    [cx + w * 0.38, yb - h * 0.4],
  ]
  let d = `M${r2(x0)} ${yb}`
  tips.forEach((t, i) => {
    d += ` L${r2(t[0])} ${r2(t[1])}`
    if (valleys[i]) d += ` L${r2(valleys[i][0])} ${r2(valleys[i][1])}`
  })
  d += ` L${r2(x1)} ${yb} Z`
  let out = `<path d="${d}" transform="translate(0 2.5)" fill="#000000" fill-opacity="0.4"/>
<path d="${d}" fill="${ctx.url('trim')}" stroke="#000000" stroke-opacity="0.45" stroke-width="1.1" stroke-linejoin="round"/>
<path d="${d}" fill="${ctx.url('sheen')}"/>
<rect x="${r2(x0 - 1)}" y="${r2(yb - 6)}" width="${r2(w + 2)}" height="7" rx="2" fill="${ctx.url('trim')}" stroke="#000000" stroke-opacity="0.45" stroke-width="1"/>`
  tips.forEach(([x, y], i) => {
    out += `<circle cx="${r2(x)}" cy="${r2(y - 2)}" r="${i === 2 ? 3.6 : 2.8}" fill="${ctx.url('gem')}" stroke="#000000" stroke-opacity="0.4" stroke-width="0.7"/>`
  })
  for (let i = -1; i <= 1; i++) {
    out += `<circle cx="${r2(cx + i * w * 0.3)}" cy="${r2(yb - 2.5)}" r="${i === 0 ? 2.6 : 1.8}" fill="${ctx.url('gem')}"/>`
  }
  return out
}

export function rays(ctx: Ctx, n: number, ro: number, ri: number, opacity: number, rot = -90): string {
  return `<path d="${starPath(64, 64, n, ro, ri, rot)}" fill="${ctx.p.glow}" fill-opacity="${opacity}"/>`
}

// ---------- overlays ----------
export function cracks(): string {
  const main = 'M58 16 L66 34 L58 46 L70 62 L62 76 L72 96 L66 112'
  const branch1 = 'M66 34 L80 40 L86 52'
  const branch2 = 'M70 62 L50 68 L40 82'
  const branch3 = 'M62 76 L78 84'
  const all = [main, branch1, branch2, branch3]
  return `<g data-crack="true">
${all.map((d) => `<path d="${d}" fill="none" stroke="#ffffff" stroke-opacity="0.35" stroke-width="1" transform="translate(0.9 0.9)" stroke-linejoin="round"/>`).join('')}
${all.map((d, i) => `<path d="${d}" fill="none" stroke="#0d0608" stroke-width="${i === 0 ? 2.6 : 1.8}" stroke-linejoin="round" stroke-linecap="round"/>`).join('')}
</g>`
}

export function padlock(): string {
  return `<g data-lock="true">
<circle cx="98" cy="100" r="17" fill="#0b0b12" fill-opacity="0.75"/>
<path d="M91.5 99 V93.5 A6.5 6.5 0 0 1 104.5 93.5 V99" fill="none" stroke="#b7bcc6" stroke-width="3.2" stroke-linecap="round"/>
<rect x="87.5" y="98" width="21" height="15" rx="3.5" fill="#6b717d" stroke="#c9ced6" stroke-width="1.2"/>
<rect x="88.5" y="99" width="19" height="5" rx="2" fill="#ffffff" fill-opacity="0.22"/>
<circle cx="98" cy="104.5" r="2.2" fill="#1a1c22"/>
<rect x="97.1" y="105" width="1.8" height="4.5" rx="0.9" fill="#1a1c22"/>
</g>`
}

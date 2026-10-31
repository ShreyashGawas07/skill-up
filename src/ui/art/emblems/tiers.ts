// Per-tier emblem artwork (inner SVG markup). Detail grows with tier. Pure strings.
import {
  SHIELD,
  about,
  body,
  circlePath,
  crown,
  facetStar,
  gem,
  halo,
  laurel,
  mix,
  rays,
  starPath,
  wings,
  type Ctx,
} from './parts'

// 1 — Novice: a rough round stone with a carved ring and chips.
function stone(ctx: Ctx): string {
  const pebble = 'M62 18 C86 16 108 32 110 58 C112 86 94 108 66 110 C38 112 18 94 18 66 C18 40 36 20 62 18 Z'
  const specks = [
    [44, 40, 1.6],
    [82, 36, 1.2],
    [90, 78, 1.8],
    [40, 84, 1.3],
    [70, 92, 1.1],
    [56, 30, 1],
  ]
    .map(([x, y, r]) => `<circle cx="${x}" cy="${y}" r="${r}" fill="#000000" fill-opacity="0.28"/>`)
    .join('')
  return `${body(ctx, pebble, { k: 0.88 })}
${specks}
<path d="M88 28 L96 34 L90 38 Z" fill="#000000" fill-opacity="0.25"/>
<path d="M26 70 L32 76 L26 80 Z" fill="#000000" fill-opacity="0.25"/>
<circle cx="64" cy="65" r="22" fill="none" stroke="#ffffff" stroke-opacity="0.28" stroke-width="3" transform="translate(0 1.2)"/>
<circle cx="64" cy="65" r="22" fill="none" stroke="${mix(ctx.p.secondary, '#000000', 0.35)}" stroke-width="3"/>
<path d="M54 70 L64 56 L74 70" fill="none" stroke="#ffffff" stroke-opacity="0.28" stroke-width="4" stroke-linecap="round" stroke-linejoin="round" transform="translate(0 1.2)"/>
<path d="M54 70 L64 56 L74 70" fill="none" stroke="${mix(ctx.p.secondary, '#000000', 0.35)}" stroke-width="4" stroke-linecap="round" stroke-linejoin="round"/>`
}

function rivet(ctx: Ctx, x: number, y: number, r = 3.2): string {
  return `<circle cx="${x}" cy="${y + 1}" r="${r}" fill="#000000" fill-opacity="0.4"/>
<circle cx="${x}" cy="${y}" r="${r}" fill="${ctx.url('trim')}"/>
<circle cx="${x - r * 0.3}" cy="${y - r * 0.35}" r="${r * 0.35}" fill="#ffffff" fill-opacity="0.8"/>`
}

// 2 — Apprentice: bronze heater shield with a central boss and rivets.
function bronze(ctx: Ctx): string {
  return `${body(ctx, SHIELD)}
<path d="M64 22 V48" stroke="#000000" stroke-opacity="0.3" stroke-width="3" stroke-linecap="round"/>
<path d="M64 22 V48" stroke="#ffffff" stroke-opacity="0.35" stroke-width="1.2" stroke-linecap="round" transform="translate(-1 0)"/>
<path d="M64 80 V104" stroke="#000000" stroke-opacity="0.3" stroke-width="3" stroke-linecap="round"/>
${body(ctx, circlePath(64, 64, 16), { k: 0.7, rim: ctx.url('trim') })}
${rivet(ctx, 36, 32)}${rivet(ctx, 92, 32)}${rivet(ctx, 38, 76)}${rivet(ctx, 90, 76)}`
}

// 3 — Adept: silver shield with twin chevrons.
function silver(ctx: Ctx): string {
  const chev = (y: number) => `M36 ${y} L64 ${y + 15} L92 ${y} L92 ${y + 11} L64 ${y + 26} L36 ${y + 11} Z`
  const deep = mix(ctx.p.secondary, '#1a2a4a', 0.6)
  const one = (y: number) => `<path d="${chev(y)}" transform="translate(0 2)" fill="#000000" fill-opacity="0.4"/>
<path d="${chev(y)}" fill="${deep}" stroke="#ffffff" stroke-opacity="0.85" stroke-width="1.6" stroke-linejoin="round"/>
<path d="M36 ${y} L64 ${y + 15} L92 ${y}" fill="none" stroke="#ffffff" stroke-width="2" stroke-linejoin="round" stroke-opacity="0.9"/>`
  return `${body(ctx, SHIELD)}
${one(42)}${one(66)}
${rivet(ctx, 64, 28, 3.6)}`
}

// 4 — Skilled: gold shield with a cut star and crest point.
function gold(ctx: Ctx): string {
  return `${facetStar(64, 12, 4, 9, 3, '#fffbe6', '#e0a21c')}
${body(ctx, SHIELD)}
<path d="M30 30 L98 30" stroke="#ffffff" stroke-opacity="0.25" stroke-width="1"/>
${facetStar(64, 63, 5, 28, 11.5, '#fffdf0', mix(ctx.p.secondary, '#7a3a00', 0.3))}
${rivet(ctx, 34, 34, 2.6)}${rivet(ctx, 94, 34, 2.6)}${rivet(ctx, 64, 100, 2.6)}`
}

// 5 — Expert: emerald crest framed by a gold laurel, with a cut gem.
function emerald(ctx: Ctx): string {
  const crest = 'M64 16 L96 32 L98 74 L64 112 L30 74 L32 32 Z'
  return `${halo(ctx, 62, 0.55)}
${laurel(ctx, 68, 50, 7)}
${body(ctx, crest)}
<path d="M64 24 L64 104 M38 36 L90 36" stroke="#000000" stroke-opacity="0.18" stroke-width="1.4"/>
${gem(ctx, 64, 62, 30, 40)}
${rivet(ctx, 64, 26, 2.6)}`
}

// 6 — Elite: sapphire shield with silver wings and a gem.
function sapphire(ctx: Ctx): string {
  return `${halo(ctx, 62, 0.6)}
${wings(ctx, { rootX: 44, rootY: 38, n: 6, len: 40, from: -28, to: 30, w: 9 })}
<g transform="${about(0.8, 64, 64, 0, 4)}">${body(ctx, SHIELD)}
<path d="M28 30 L64 20 L100 30" fill="none" stroke="${ctx.url('trim')}" stroke-width="4" stroke-linejoin="round"/>
${gem(ctx, 64, 64, 32, 44)}</g>`
}

// 7 — Master: amethyst crest wearing a gold crown, with side fins.
function amethyst(ctx: Ctx): string {
  const fin = 'M30 52 L10 40 L18 62 L8 76 L30 74 Z'
  return `${halo(ctx, 64, 0.75)}
${rays(ctx, 12, 64, 40, 0.18)}
<path d="${fin}" fill="${ctx.url('wing')}" stroke="#000000" stroke-opacity="0.4" stroke-width="1"/>
<path d="${fin}" fill="${ctx.url('wing')}" stroke="#000000" stroke-opacity="0.4" stroke-width="1" transform="translate(128 0) scale(-1 1)"/>
<g transform="${about(0.82, 64, 64, 0, 10)}">${body(ctx, SHIELD)}
${gem(ctx, 64, 66, 30, 42)}
<path d="M40 100 Q64 86 88 100" fill="none" stroke="${ctx.url('trim')}" stroke-width="3" stroke-linecap="round"/></g>
${crown(ctx, 64, 34, 50, 26)}`
}

// 8 — Grandmaster: crimson winged crown over a shield, with rays.
function crimson(ctx: Ctx): string {
  return `${halo(ctx, 64, 0.85)}
${rays(ctx, 16, 64, 44, 0.2)}
${wings(ctx, { rootX: 44, rootY: 40, n: 7, len: 48, from: -36, to: 28, w: 9.5 })}
<g transform="${about(0.74, 64, 64, 0, 14)}">${body(ctx, SHIELD)}
<path d="M30 34 L64 24 L98 34" fill="none" stroke="${ctx.url('trim')}" stroke-width="4" stroke-linejoin="round"/>
${gem(ctx, 64, 66, 32, 46)}
${rivet(ctx, 40, 44, 3)}${rivet(ctx, 88, 44, 3)}</g>
${crown(ctx, 64, 40, 54, 30)}`
}

// 9 — Legend: prismatic star-burst with wings and a cut star medallion.
function prismatic(ctx: Ctx): string {
  return `${halo(ctx, 64, 0.9)}
${rays(ctx, 24, 64, 46, 0.25, -82.5)}
<path d="${starPath(64, 64, 8, 58, 30)}" fill="${ctx.url('face')}" stroke="#ffffff" stroke-opacity="0.7" stroke-width="1.2" stroke-linejoin="round"/>
<path d="${starPath(64, 64, 8, 58, 30)}" fill="${ctx.url('sheen')}"/>
${wings(ctx, { rootX: 46, rootY: 50, n: 6, len: 38, from: -24, to: 32, w: 8.5 })}
${body(ctx, circlePath(64, 64, 28), { rim: ctx.url('trim') })}
${facetStar(64, 64, 5, 20, 8.5, '#ffffff', '#b9a6ff')}
<path d="${starPath(90, 30, 4, 7, 1.6)}" fill="#ffffff"/>
<path d="${starPath(34, 98, 4, 5, 1.2)}" fill="#ffffff" fill-opacity="0.85"/>`
}

// 10 — Eternal: cosmic gold sun with tilted orbit rings and planets.
function cosmic(ctx: Ctx): string {
  const orbit = (rot: number, planetAngle: number, pr: number) => {
    const a = (planetAngle * Math.PI) / 180
    const px = Math.round((64 + 58 * Math.cos(a)) * 100) / 100
    const py = Math.round((64 + 17 * Math.sin(a)) * 100) / 100
    return {
      back: `<g transform="rotate(${rot} 64 64)"><ellipse cx="64" cy="64" rx="58" ry="17" fill="none" stroke="${ctx.url('trim')}" stroke-opacity="0.55" stroke-width="2.2"/></g>`,
      front: `<g transform="rotate(${rot} 64 64)"><path d="M6 64 A58 17 0 0 0 122 64" fill="none" stroke="${ctx.url('trim')}" stroke-width="2.6"/>
<circle cx="${px}" cy="${py}" r="${pr}" fill="${ctx.url('gem')}" stroke="#000000" stroke-opacity="0.35" stroke-width="0.6"/></g>`,
    }
  }
  const o1 = orbit(-24, 50, 4.2)
  const o2 = orbit(24, 160, 3.2)
  const sparkles = [
    [24, 22, 4],
    [106, 18, 3],
    [112, 104, 3.5],
    [18, 106, 2.5],
  ]
    .map(([x, y, r]) => `<path d="${starPath(x, y, 4, r, r * 0.25)}" fill="#ffffff"/>`)
    .join('')
  return `${halo(ctx, 64, 1)}
${rays(ctx, 16, 64, 34, 0.35)}
<path d="${starPath(64, 64, 16, 56, 34)}" fill="${ctx.url('face')}" stroke="#ffffff" stroke-opacity="0.55" stroke-width="1" stroke-linejoin="round"/>
<path d="${starPath(64, 64, 16, 44, 32, -78.75)}" fill="${ctx.url('trim')}" fill-opacity="0.9"/>
${o1.back}${o2.back}
${body(ctx, circlePath(64, 64, 30), { rim: ctx.url('trim') })}
<circle cx="64" cy="64" r="15" fill="${ctx.url('space')}" stroke="${ctx.url('trim')}" stroke-width="2"/>
<circle cx="58" cy="60" r="0.9" fill="#ffffff"/><circle cx="70" cy="58" r="0.7" fill="#ffffff"/><circle cx="68" cy="71" r="0.8" fill="#ffffff"/>
${facetStar(64, 64, 4, 11, 3, '#ffffff', '#ffe27a')}
${o1.front}${o2.front}
${sparkles}`
}

export const TIER_ART: Record<number, (ctx: Ctx) => string> = {
  1: stone,
  2: bronze,
  3: silver,
  4: gold,
  5: emerald,
  6: sapphire,
  7: amethyst,
  8: crimson,
  9: prismatic,
  10: cosmic,
}

/** Extra defs some tiers need. */
export function extraDefs(ctx: Ctx): string {
  if (ctx.tier !== 10) return ''
  return `<defs><radialGradient id="${ctx.id('space')}" cx="0.4" cy="0.35" r="0.75">
<stop offset="0" stop-color="#7b4dff"/><stop offset="0.55" stop-color="#2a1260"/><stop offset="1" stop-color="#0a0420"/></radialGradient></defs>`
}

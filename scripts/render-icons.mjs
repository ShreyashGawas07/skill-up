// Renders Android icon assets from the app's own SVG art (run with `tsx scripts/render-icons.mjs`).
//   drawable-nodpi/rank_1..10.png 256 px tier emblems (notification large icons; nodpi = never rescaled)
//   drawable/ic_stat_flame.png    96 px white flame (notification small icon)
//   mipmap-*/ic_launcher*.png     tier-10 emblem on the dark background (launcher icon)
//   drawable*/splash.png          tier-10 emblem centred on the dark background (splash)
import { mkdirSync, readFileSync, readdirSync, rmSync, writeFileSync, existsSync } from 'node:fs'
import { dirname, join, resolve } from 'node:path'
import { fileURLToPath } from 'node:url'
import { Resvg } from '@resvg/resvg-js'
import { emblemSvg } from '../src/ui/art/emblemSvg.ts'
import { FLAME_OUTER } from '../src/ui/art/flamePath.ts'

const ROOT = join(dirname(fileURLToPath(import.meta.url)), '..')
const RES = join(ROOT, 'android', 'app', 'src', 'main', 'res')
const BG = '#0b0b12'


const LAUNCHER = { mdpi: 48, hdpi: 72, xhdpi: 96, xxhdpi: 144, xxxhdpi: 192 }
// Adaptive-icon foreground layers are 108dp; only the centre 66dp is guaranteed visible.
const FOREGROUND = { mdpi: 108, hdpi: 162, xhdpi: 216, xxhdpi: 324, xxxhdpi: 432 }

export function renderPng(svg, width) {
  return new Resvg(svg, { fitTo: { mode: 'width', value: width } }).render().asPng()
}

/** Width/height from a PNG's IHDR chunk. */
export function pngSize(buf) {
  return { width: buf.readUInt32BE(16), height: buf.readUInt32BE(20) }
}

/** Places a tier emblem (128-unit viewBox) at x,y with the given size inside an outer SVG. */
function placeEmblem(tier, x, y, size) {
  return emblemSvg(tier, { idSuffix: 'icon' }).replace('<svg ', `<svg x="${x}" y="${y}" width="${size}" height="${size}" `)
}

export function flameSvg() {
  // Square 84-unit viewBox around the 44x72 flame with a little padding.
  return `<svg xmlns="http://www.w3.org/2000/svg" viewBox="-10 -2 84 84"><path d="${FLAME_OUTER}" fill="#ffffff"/></svg>`
}

export function launcherSvg(round) {
  const shape = round
    ? `<circle cx="64" cy="64" r="64" fill="${BG}"/>`
    : `<rect width="128" height="128" rx="24" fill="${BG}"/>`
  const s = round ? 96 : 104
  const o = (128 - s) / 2
  return `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 128 128">${shape}${placeEmblem(10, o, o, s)}</svg>`
}

export function foregroundSvg() {
  // 108-unit canvas, emblem kept inside the 66-unit safe zone (plus a little bleed).
  const s = 72
  const o = (108 - s) / 2
  return `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 108 108">${placeEmblem(10, o, o, s)}</svg>`
}

export function splashSvg(width, height) {
  const s = Math.round(Math.min(width, height) * 0.4)
  const x = Math.round((width - s) / 2)
  const y = Math.round((height - s) / 2)
  return `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 ${width} ${height}"><rect width="${width}" height="${height}" fill="${BG}"/>${placeEmblem(10, x, y, s)}</svg>`
}

function write(rel, png) {
  const file = join(RES, rel)
  mkdirSync(dirname(file), { recursive: true })
  writeFileSync(file, png)
  const { width, height } = pngSize(png)
  console.log(`  ${rel} (${width}x${height})`)
}

function main() {
  if (!existsSync(RES)) {
    console.error(`Missing ${RES} - run \`npx cap add android\` first.`)
    process.exit(1)
  }
  console.log('Rendering Android icons:')
  // Earlier builds wrote these to drawable/ (treated as mdpi and upscaled); remove stale copies.
  for (let t = 1; t <= 10; t++) rmSync(join(RES, 'drawable', `rank_${t}.png`), { force: true })
  for (let t = 1; t <= 10; t++) write(`drawable-nodpi/rank_${t}.png`, renderPng(emblemSvg(t, { idSuffix: 'n' }), 256))
  write('drawable/ic_stat_flame.png', renderPng(flameSvg(), 96))
  for (const [d, px] of Object.entries(LAUNCHER)) {
    write(`mipmap-${d}/ic_launcher.png`, renderPng(launcherSvg(false), px))
    write(`mipmap-${d}/ic_launcher_round.png`, renderPng(launcherSvg(true), px))
  }
  for (const [d, px] of Object.entries(FOREGROUND)) write(`mipmap-${d}/ic_launcher_foreground.png`, renderPng(foregroundSvg(), px))
  // Adaptive icon background colour.
  writeFileSync(
    join(RES, 'values', 'ic_launcher_background.xml'),
    `<?xml version="1.0" encoding="utf-8"?>\n<resources>\n    <color name="ic_launcher_background">${BG.toUpperCase()}</color>\n</resources>\n`,
  )
  // Splash screens: keep each existing file's dimensions.
  for (const dir of readdirSync(RES).filter((d) => d.startsWith('drawable'))) {
    const file = join(RES, dir, 'splash.png')
    if (!existsSync(file)) continue
    const { width, height } = pngSize(readFileSync(file))
    write(`${dir}/splash.png`, renderPng(splashSvg(width, height), width))
  }
}

if (process.argv[1] && resolve(process.argv[1]).toLowerCase() === resolve(fileURLToPath(import.meta.url)).toLowerCase()) main()

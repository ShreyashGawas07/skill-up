// @vitest-environment node
import { Resvg } from '@resvg/resvg-js'
import { emblemSvg } from '../../src/ui/art/emblemSvg'

// scripts/render-icons.mjs renders emblemSvg output with resvg into Android drawables.
const size = (png: Buffer) => ({ width: png.readUInt32BE(16), height: png.readUInt32BE(20) })

describe('icon rendering (scripts/render-icons.mjs)', () => {
  it.each([1, 5, 10])('renders tier %i emblem to a 256 px PNG', (tier) => {
    const png = new Resvg(emblemSvg(tier, { idSuffix: 't' }), { fitTo: { mode: 'width', value: 256 } }).render().asPng()
    expect(png.subarray(1, 4).toString('ascii')).toBe('PNG')
    expect(size(png)).toEqual({ width: 256, height: 256 })
  })

  it('renders something visible (not a blank canvas)', () => {
    const img = new Resvg(emblemSvg(10, { idSuffix: 't' }), { fitTo: { mode: 'width', value: 64 } }).render()
    const px = img.pixels
    let opaque = 0
    for (let i = 3; i < px.length; i += 4) if (px[i] > 200) opaque++
    expect(opaque).toBeGreaterThan(64 * 64 * 0.2)
  })
})

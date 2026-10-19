import { describe, expect, test } from 'claude-code/testing'

import type { Theme } from './map'
import { GROUND, PX, pillarShaft } from './pixelart'
import { groundPixel, hexToInt } from './pixels'

const THEMES: readonly Theme[] = ['crypt', 'flooded', 'fungal', 'frozen', 'forge']
const SPAN = 8 * PX
const luma = (hex: string) => {
  const n = parseInt(hex.slice(1), 16)
  return 0.299 * ((n >> 16) & 0xff) + 0.587 * ((n >> 8) & 0xff) + 0.114 * (n & 0xff)
}
/** A texture over eight tiles by eight. */
const sample = (tex: (x: number, y: number) => string) => Array.from({ length: SPAN * SPAN }, (_, i) => tex(i % SPAN, Math.floor(i / SPAN)))
/** A tile's pattern with its colors left out: each pixel the order its color first appears in the tile. */
const shape = (tex: (x: number, y: number) => string, tx: number, ty: number) => {
  const seen: string[] = []
  return Array.from({ length: PX * PX }, (_, i) => {
    const c = tex(tx * PX + (i % PX), ty * PX + Math.floor(i / PX))
    if (!seen.includes(c)) seen.push(c)
    return seen.indexOf(c)
  }).join(',')
}

describe('each theme\'s ground', () => {
  test('is its own shapes, not another theme\'s recolored: no two themes share a floor or wall pattern', async () => {
    for (const part of ['floor', 'wall'] as const) {
      const patterns = THEMES.map(t => Array.from({ length: 16 }, (_, i) => shape(GROUND[t][part], i % 4, Math.floor(i / 4))).join('|'))
      expect(new Set(patterns).size).toBe(THEMES.length)
    }
  })

  test('sets its walls apart from its floor by brightness alone, by at least 10 of 255 on average', async () => {
    for (const t of THEMES) {
      const mean = (a: string[]) => a.reduce((s, h) => s + luma(h), 0) / a.length
      expect(Math.abs(mean(sample(GROUND[t].floor)) - mean(sample(GROUND[t].wall)))).toBeGreaterThanOrEqual(10)
    }
  })

  test('keeps its floor quiet: at most 8 colors, its three commonest seven pixels in ten or more, accents (40 brighter than the floor\'s mean) at most 6%', async () => {
    for (const t of THEMES) {
      const floor = sample(GROUND[t].floor)
      const counts = new Map<string, number>()
      for (const c of floor) counts.set(c, (counts.get(c) ?? 0) + 1)
      const top = [...counts.values()].sort((a, b) => b - a).slice(0, 3).reduce((a, b) => a + b, 0)
      const mean = floor.reduce((s, h) => s + luma(h), 0) / floor.length
      const accents = floor.filter(h => luma(h) > mean + 40).length / floor.length
      expect([counts.size <= 8, top / floor.length >= 0.7, accents <= 0.06]).toEqual([true, true, true])
    }
  })

  test('is drawn in its own colors, untinted; a pillar stands on its theme\'s floor', async () => {
    for (const t of THEMES) {
      for (const [x, y] of [[3, 2], [13, 21], [40, 5]] as const) {
        expect(groundPixel('floor', x, y, t)).toBe(hexToInt(GROUND[t].floor(x, y)))
        expect(groundPixel('wall', x, y, t)).toBe(hexToInt(GROUND[t].wall(x, y)))
      }
      // Pixels 0 and 7 of a pillar's middle row are floor round the column.
      for (const lx of [0, 7]) {
        expect(pillarShaft(lx, 4)).toBeUndefined()
        expect(groundPixel('pillar', lx, 4, t)).toBe(hexToInt(GROUND[t].floor(lx, 4)))
      }
      expect(pillarShaft(3, 4)).toBeDefined()
    }
  })
})

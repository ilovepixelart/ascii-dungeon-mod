import { describe, expect, test } from 'claude-code/testing'

import { shots } from './screens'
import { BG, canvas } from './canvas'
import { WINDOW_TOP, drawBox } from './window'

/** The windows laid out on the bag's grid, a pixel from their edges as the grid is: the bag, the smith, retiring, the
 * stash, the shop, and the compact bag, narrower. The strip and the dash are no windows. */
const GRID_WINDOWS = /^(inventory|compact|forge|retire|chest|shop|strip|dash)/
/** Windows whose page tabs hang from the title bar: no room over them. */
const TABBED = /^(codex|settings)/

/** How far a window's content stands from each edge: its pixels and its boxes' frames, under the title bar. */
const margins = (px: string[][], boxes: readonly { role: string; x: number; y: number; w: number; h: number; border: string }[]) => {
  const c = canvas(px[0]!.length, px.length)
  c.px = px.map(row => [...row])
  for (const b of boxes.filter(x => !['title', 'gold', 'label', 'tabs'].includes(x.role))) drawBox(c, b)
  let left = Infinity, right = -1, top = Infinity, bottom = -1
  c.px.forEach((row, y) => y >= WINDOW_TOP && row.forEach((p, x) => {
    if (p === BG) return
    left = Math.min(left, x)
    right = Math.max(right, x)
    top = Math.min(top, y)
    bottom = Math.max(bottom, y)
  }))
  return { left, right: c.px[0]!.length - 1 - right, top: top - WINDOW_TOP, bottom: c.px.length - 1 - bottom }
}

describe('a window', () => {
  test('keeps its content 2 px clear of its sides, its title bar and its bottom; a centred row leaves the odd pixel right', async () => {
    const all = shots().filter(s => !GRID_WINDOWS.test(s.name))
    expect(all.length).toBeGreaterThan(30)
    for (const s of all) {
      const m = margins(s.px, s.boxes)
      const want = { left: 2, right: m.right === 3 ? 3 : 2, top: TABBED.test(s.name) ? 0 : 2, bottom: 2 }
      expect([s.name, m]).toEqual([s.name, want])
    }
  })
})

describe('a portrait', () => {
  test('has its box beside it 3 px off, on every window with one', async () => {
    const all = shots()
    for (const name of ['death-king', 'recap', 'sheet-knight', 'talk-elder', 'talk-mystic']) {
      const s = all.find(x => x.name === name)!
      // The portrait's right edge: the first column, from the left, whose pixels under the title bar end a run of frame.
      const beside = s.boxes.filter(b => !['title', 'gold', 'label', 'tabs', 'button'].includes(b.role)).sort((a, b) => a.y - b.y)[0]!
      const row = s.px[beside.y * 2 + 2]!
      let right = beside.x - 1
      while (right >= 0 && row[right] === BG) right -= 1
      expect([name, beside.x - 1 - right]).toEqual([name, 3])
    }
  })
})

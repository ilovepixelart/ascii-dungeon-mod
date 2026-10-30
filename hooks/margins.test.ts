import { describe, expect, test } from 'claude-code/testing'

import { shots } from './screens'
import { BG, canvas } from './canvas'
import { WINDOW_TOP, drawBox } from './window'
import { SPACE } from './ui/tokens'

/** The windows laid out on the bag's grid, a pixel from their edges as the grid is: the bag, the smith, retiring, the
 * stash, the shop, and the compact bag, narrower. The strip and the dash are no windows. */
const GRID_WINDOWS = /^(inventory|compact|forge|retire|chest|shop|strip|dash)/
/** Windows whose page tabs hang from the title bar: no room over them. */
const TABBED = /^(codex|settings|help)/

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

describe('a window\'s parts', () => {
  /** The rows of bare ground between a box and the nearest drawn row over it, across the box's width. */
  const roomOver = (px: string[][], b: { x: number; y: number; w: number }) => {
    let y = b.y * 2 - 1
    while (y >= WINDOW_TOP && px[y]!.slice(b.x, b.x + b.w).every(p => p === BG)) y -= 1
    // Nothing drawn over it in the body: the box stands under the title bar, as the margins say.
    return y < WINDOW_TOP ? undefined : b.y * 2 - 1 - y
  }

  test('stand 2 px over the box under them: the last row of cards, slots or buttons', async () => {
    const all = shots().filter(s => /^(talent-[0-3]|deep-|codex-|settings-|talk-)/.test(s.name))
    expect(all.length).toBeGreaterThan(15)
    for (const s of all) {
      const box = s.boxes.filter(b => b.role === 'about' || b.role === 'words').sort((a, b) => b.y - a.y)[0]
      const room = box === undefined || s.name.startsWith('talk-') ? undefined : roomOver(s.px, box)
      if (room !== undefined) expect([s.name, room]).toEqual([s.name, 2])
    }
  })

  test('the talent cards stand 2 px over their buttons', async () => {
    const s = shots().find(x => x.name === 'talent-0')!
    const take = s.boxes.find(b => b.role === 'button')!
    expect(roomOver(s.px, take)).toBe(2)
  })

  test('stand a gap apart in a row of buttons, the one gap every window uses', async () => {
    // The sheet's + buttons stand at their attributes' rows, not in a row of their own.
    for (const s of shots().filter(x => !x.name.startsWith('sheet-'))) {
      const buttons = s.boxes.filter(b => b.role === 'button')
      for (const a of buttons) {
        const next = buttons.filter(b => b.y === a.y && b.x > a.x).sort((p, q) => p.x - q.x)[0]
        if (next !== undefined) expect([s.name, next.x - (a.x + a.w)]).toEqual([s.name, SPACE.gap])
      }
    }
  })
})

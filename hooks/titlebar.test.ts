import { describe, expect, test } from 'claude-code/testing'

import { CLOSE_BOX, TITLE_INK, WINDOW_W, chromeBoxes, onPixels, painted, windowPixels } from './window'
import { inventoryScreenPixels } from './inventory'
import { newGame } from './world'
import { HEAD_H } from './window'
import { canvas } from './canvas'
import { shots } from './screens'

const textOf = (b: { lines: { text: string }[][] }) => b.lines.map(l => l.map(r => r.text).join(''))

describe('the title bar in terminal text', () => {
  test('a window\'s title is written from column 3 on the bar\'s middle row; no letter is drawn in its pixels', async () => {
    const px = windowPixels({ title: 'MERCHANT', gold: 5 }, canvas(WINDOW_W, 10).px).px
    const [title] = chromeBoxes(px)
    expect([textOf(title!), title!.x + 1, title!.y + 1]).toEqual([['MERCHANT'], 3, 2])
    expect(px.slice(0, HEAD_H).flat()).not.toContain(TITLE_INK)
  })

  test('gold in full, its thousands set apart by commas, after the coin', async () => {
    const said = (gold: number) => textOf(chromeBoxes(windowPixels({ title: 'MERCHANT', gold }, canvas(WINDOW_W, 10).px).px)[1]!)[0]
    expect([0, 999, 1000, 999999, 1234567, 2000000000].map(said)).toEqual(['0', '999', '1,000', '999,999', '1,234,567', '2,000,000,000'])
  })

  test('gold of any amount ends short of the close box', async () => {
    for (const gold of [999999, 1234567, 99999999999]) {
      const gold_ = chromeBoxes(windowPixels({ title: 'MERCHANT', gold }, canvas(WINDOW_W, 10).px).px)[1]!
      expect(gold_.x + gold_.w).toBeLessThanOrEqual(CLOSE_BOX[0])
    }
  })

  test('every window the previews draw has its title bar\'s text, and no pixel letters in the bar', async () => {
    // The strip under the map is in the previews too, and is no window.
    const all = shots().filter(s => !s.name.startsWith('strip-'))
    const missing = all.filter(s => !s.boxes.some(b => b.role === 'title') && s.px.length > HEAD_H).map(s => s.name)
    const lettered = all.filter(s => s.px.slice(0, HEAD_H).some(row => row.includes(TITLE_INK))).map(s => s.name)
    expect([missing, lettered]).toEqual([[], []])
  })

  test('pixels not drawn as a window have no title-bar text', async () => {
    expect(chromeBoxes(canvas(WINDOW_W, 10).px)).toEqual([])
  })

  test('a color as the Raster paints it, each channel the nearest multiple of 17', async () => {
    // The title bar's and a tab's grounds, as a screenshot of the pane measured them (#111121 and #222232, give or take one).
    expect([painted('#15131b'), painted('#24212c'), painted('#000000'), painted('#ffffff'), painted('#0e0d13')]).toEqual(['#111122', '#222233', '#000000', '#ffffff', '#111111'])
  })

  test('text over pixels is on the ground the pixels are painted; a hovered tab\'s label on the glow\'s inside, as measured', async () => {
    const tabs = onPixels(chromeBoxes(inventoryScreenPixels(newGame(1, 'knight'))).filter(b => b.role === 'title'), { x: 2, y: 0, w: 6, h: 10 })
    // HERO hovered: the glow's inside a screenshot measured, #333333; BAG, the tab shown; the rest, the bar.
    expect(tabs.map(b => b.bg)).toEqual(['#333333', '#222233', '#111122', '#111122', '#111122'])
    // A box with no ground of its own takes a text box's fill, as painted.
    expect(onPixels([{ role: 'card', x: 40, y: 10, w: 10, h: 3, border: '#ffffff', lines: [[{ text: 'x' }]] }])[0]!.bg).toBe('#111111')
  })
})

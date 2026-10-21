import { describe, expect, test } from 'claude-code/testing'

import { CLOSE_BOX, TITLE_INK, WINDOW_W, chromeBoxes, windowPixels } from './window'
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
})

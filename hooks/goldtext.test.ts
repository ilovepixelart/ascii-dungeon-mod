import { expect, test } from 'claude-code/testing'

import { CLOSE_BOX, WINDOW_W, goldText, windowPixels } from './window'
import { canvas } from './canvas'
import { INK } from './ui/tokens'

test('the title bar\'s gold: in full to six digits, then in thousands, then in millions', async () => {
  expect([0, 999, 999999, 1000000, 1234567, 99999999, 100000000, 2000000000].map(goldText)).toEqual(['0', '999', '999999', '1000K', '1234K', '99999K', '100M', '2000M'])
})

test('gold of any amount stops short of the close box', async () => {
  for (const gold of [999999, 1234567, 2000000000]) {
    const px = windowPixels({ title: 'MERCHANT', gold }, canvas(WINDOW_W, 10).px).px
    const [x, y, w, h] = CLOSE_BOX
    const under = px.slice(y, y + h).flatMap(row => row.slice(x - 1, x + w)).filter(p => p === INK.gold)
    expect(under).toEqual([])
  }
})

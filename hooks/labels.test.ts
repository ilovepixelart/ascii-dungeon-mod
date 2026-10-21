import { describe, expect, test } from 'claude-code/testing'

import { artLabel } from './pieces'
import { shots } from './screens'
import { hudBoxes } from './hud'
import { newGame } from './world'

describe('a label on art', () => {
  test('is a box over its letters alone, on its whole cell, on the ground under it', async () => {
    // "25" from x 9 on row 20: the box's frame a cell round it, its text on cell row 10.
    expect(artLabel('25', 9, 20, '#ffd34d', '#0e0d13')).toEqual({ role: 'label', x: 8, y: 9, w: 4, h: 3, border: '#0e0d13', bg: '#0e0d13', pad: 0, lines: [[{ text: '25', color: '#ffd34d', bold: true }]] })
  })
})

describe('the windows\' labels', () => {
  const all = shots()
  const said = (name: string) => all.find(s => s.name === name)!.boxes.filter(b => b.role === 'label').map(b => b.lines[0]!.map(r => r.text).join(''))

  test('on every window, each label lies on a whole cell on plain ground, no pixel letters under it', async () => {
    let seen = 0
    for (const s of all) {
      for (const b of s.boxes.filter(x => x.role === 'label' && x.bg !== undefined)) {
        seen += 1
        expect([s.name, Number.isInteger(b.y)]).toEqual([s.name, true])
        const row = (b.y + 1) * 2
        // Each character's cell, the ground it is written on: its own (a bar's number, over fill and track) or the box's.
        const grounds = b.lines[0]!.flatMap(r => [...r.text].map(() => r.bg ?? b.bg))
        for (const y of [row, row + 1]) expect([s.name, y, s.px[y]!.slice(b.x + 1, b.x + 1 + grounds.length)]).toEqual([s.name, y, grounds])
      }
    }
    expect(seen).toBeGreaterThan(100)
  })

  test('each window says its numbers and names', async () => {
    // The shop: its nine prices, then its belt's one Health Potion.
    expect(said('shop')).toEqual(['25', '50', '80', '45', '50', '50', '75', '35', '60', '1'])
    expect(said('inventory-knight-epic')).toEqual(['1', '1', '1', '1', '1'])
    expect(said('start-knight')).toEqual(['KNIGHT', 'MAGE', 'ROGUE'])
    expect(said('talent-0')).toEqual(['WORK', 'WORK', 'WORK'])
    expect(said('talk-dog')).toEqual(['x 0'])
  })

  test('the strip says its gold, its depth and its belt\'s counts as text', async () => {
    const g = { ...newGame(4), gold: 214, depth: 7, belt: [{ kind: 'health' as const, tiers: [3, 0, 0] as [number, number, number] }, null, null, null, null] }
    const words = hudBoxes(g, 111, []).filter(b => b.role === 'label').map(b => b.lines[0]!.map(r => r.text).join(''))
    expect(words.slice(2)).toEqual(['3', '214', '7'])
  })
})

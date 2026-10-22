import { describe, expect, test } from 'claude-code/testing'

import { canvas } from './canvas'
import type { Canvas } from './canvas'
import { flatCard, hoveredRect, lightUp, ribbon, ribbonLabel } from './ui/kit'
import { FAMILIES, INK, SURFACE } from './ui/tokens'

const at = (c: Canvas, x: number, y: number) => c.px[y]![x]

describe('cards', () => {
  test('a flat card is framed white when chosen, in its edge when not', async () => {
    const r = { x: 1, y: 1, w: 6, h: 5 }
    for (const [isOn, edge] of [[true, INK.focus], [false, SURFACE.cardEdge]] as const) {
      const c = canvas(8, 7)
      flatCard(c, r, isOn)
      expect([at(c, 1, 1), at(c, 6, 5), at(c, 3, 3)]).toEqual([edge, edge, SURFACE.card])
    }
  })

  test('a ribbon in its family\'s ink, its ends notched to the card\'s face', async () => {
    const f = FAMILIES.road
    const c = canvas(30, 10)
    ribbon(c, f, 0, 30, 1)
    // Notched on its middle three rows, the second to the fourth below its top.
    expect([at(c, 2, 2), at(c, 2, 3), at(c, 2, 5), at(c, 2, 6), at(c, 27, 4)]).toEqual([f.ink, SURFACE.card, SURFACE.card, f.ink, SURFACE.card])
    expect([at(c, 3, 1), at(c, 3, 7)]).toEqual([f.ink, f.dark])
    // No letters in pixels: its word is text.
    expect(c.px.flat()).not.toContain(INK.onRibbon)
  })

  test('a ribbon\'s word is text centred on it, on the first whole cell two rows down, on the ribbon\'s ink', async () => {
    const f = FAMILIES.road
    // SURVIVAL on a 30 wide ribbon from 0: 8 letters from 11; the ribbon at row 1, its word on row 4.
    expect(ribbonLabel(f, 0, 30, 1)).toEqual({ role: 'label', x: 10, y: 1, w: 10, h: 3, border: f.ink, bg: f.ink, pad: 0, lines: [[{ text: 'SURVIVAL', color: INK.onRibbon, bold: true }]] })
  })
})

describe('the hover', () => {
  test('is over the smallest clickable place holding the pointer; off them all, none', async () => {
    const card = { x: 0, y: 0, w: 20, h: 20 }
    const gem = { x: 5, y: 5, w: 3, h: 3 }
    expect(hoveredRect([card, gem], { x: 6, y: 6 })).toEqual(gem)
    expect(hoveredRect([card, gem], { x: 1, y: 1 })).toEqual(card)
    expect(hoveredRect([card, gem], { x: 20, y: 1 })).toBeUndefined()
  })

  test('lights the outline half way to white, the inside a tenth of the way, and leaves the rest as it was', async () => {
    const px = Array.from({ length: 6 }, () => Array<string>(6).fill('#000000'))
    const lit = lightUp(px, { x: 1, y: 1, w: 4, h: 3 })
    // #000000 half way to #ffffff: 127.5, rounded to 128.
    expect([lit[1]![1], lit[3]![4], lit[2]![1], lit[1]![3]]).toEqual(Array(4).fill('#808080'))
    // A tenth of 255 is 25.5, rounded to 26: #1a.
    expect([lit[2]![2], lit[2]![3]]).toEqual(['#1a1a1a', '#1a1a1a'])
    expect([lit[0]![0], lit[4]![1], lit[2]![5]]).toEqual(Array(3).fill('#000000'))
    expect(px[1]![1]).toBe('#000000')
  })
})

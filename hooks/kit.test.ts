import { describe, expect, test } from 'claude-code/testing'

import { BG, canvas } from './canvas'
import type { Canvas } from './canvas'
import { bevelCard, flatCard, gem, hoveredRect, lightUp, recede, ribbon, sparkles } from './ui/kit'
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

  test('a beveled card rests lit top and left, dark bottom and right; chosen, it rises by the lift with a white rim', async () => {
    const f = FAMILIES.fight
    const r = { x: 2, y: 6, w: 10, h: 12 }
    const resting = canvas(14, 24)
    bevelCard(resting, r, f, false, 3, ink => ink)
    expect([at(resting, 5, 6), at(resting, 2, 9), at(resting, 5, 17), at(resting, 11, 9)]).toEqual([f.light, f.light, f.dark, f.dark])
    const chosen = canvas(14, 24)
    bevelCard(chosen, r, f, true, 3, ink => ink)
    expect(at(chosen, 5, 3)).toBe(INK.focus)
    expect(at(chosen, 5, 2)).toBe(BG)
    // Its shadow stays where it rested, a row deeper than a resting card's.
    expect([at(chosen, 5, 18), at(chosen, 5, 20), at(resting, 5, 20)]).toEqual([SURFACE.shadow, SURFACE.shadow, BG])
  })

  test('a gem\'s heart is white when chosen, its family\'s ink when not', async () => {
    const f = FAMILIES.work
    const on = canvas(5, 5)
    gem(on, f, 2, 2, true, ink => ink)
    const off = canvas(5, 5)
    gem(off, f, 2, 2, false, ink => ink)
    expect([at(on, 2, 2), at(on, 2, 1), at(off, 2, 2), at(off, 2, 1)]).toEqual([INK.focus, f.ink, f.ink, f.dark])
  })

  test('a ribbon in its family\'s ink, its ends notched in the face\'s tint, its word on it', async () => {
    const f = FAMILIES.road
    const c = canvas(30, 10)
    ribbon(c, f, 0, 30, 1, ink => ink)
    // Notched on its middle three rows, the second to the fourth below its top.
    expect([at(c, 2, 2), at(c, 2, 3), at(c, 2, 5), at(c, 2, 6), at(c, 27, 4)]).toEqual([f.ink, f.top, f.top, f.ink, f.top])
    expect([at(c, 3, 1), at(c, 3, 7)]).toEqual([f.ink, f.dark])
    expect(c.px.flat()).toContain(INK.onRibbon)
  })

  test('the chosen card\'s sparkles sit clear of it, white and gold at each top corner', async () => {
    const c = canvas(20, 10)
    sparkles(c, { x: 4, y: 4, w: 10, h: 5 })
    expect([at(c, 2, 2), at(c, 2, 3), at(c, 3, 2), at(c, 15, 2), at(c, 15, 3), at(c, 14, 2)]).toEqual([INK.focus, INK.gold, INK.gold, INK.focus, INK.gold, INK.gold])
    expect(c.px.slice(4).flat().every(p => p === BG)).toBe(true)
  })

  test('what is not chosen recedes a quarter and more into the dark', async () => {
    // White at 72%, the veil #0b0a0f at 28%: 255 * 0.72 + 11 * 0.28 = 186.7, + 10 * 0.28 = 186.4, + 15 * 0.28 = 187.8.
    expect(recede('#ffffff')).toBe('#bbbabc')
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

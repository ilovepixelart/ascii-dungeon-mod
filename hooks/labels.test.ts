import { describe, expect, test } from 'claude-code/testing'

import { artLabel, mix } from './pieces'
import { shots } from './screens'
import { hudBoxes } from './hud'
import { newGame } from './world'
import type { Game } from '../types'
import type { Gesture, OverlayBox } from './window'
import { apply } from './game'
import { BAG_UI_IDLE, bagGesture, bagOverlay } from './bagui'
import { compactGesture, compactOverlay } from './compact'
import { SHOP_UI_IDLE, WARES, shopGesture, shopOverlay } from './shop'

describe('a label on art', () => {
  test('is a box over its letters alone, on its whole cell, on the ground under it', async () => {
    // "25" from x 9 on row 20: the box's frame a cell round it, its text on cell row 10.
    expect(artLabel('25', 9, 20, '#ffd34d', '#0e0d13')).toEqual({ role: 'label', x: 8, y: 9, w: 4, h: 3, border: '#0e0d13', bg: '#0e0d13', pad: 0, lines: [[{ text: '25', color: '#ffd34d', bold: true }]] })
  })
})

describe('the windows\' labels', () => {
  const all = shots()
  const said = (name: string) => all.find(s => s.name === name)!.boxes.filter(b => b.role === 'label').map(b => b.lines[0]!.map(r => r.text).join(''))

  test('on every window, each label lies on a whole cell on the ground under it, no pixel letters under it', async () => {
    let seen = 0
    for (const s of all) {
      for (const b of s.boxes.filter(x => x.role === 'label' && x.bg !== undefined)) {
        seen += 1
        expect([s.name, Number.isInteger(b.y)]).toEqual([s.name, true])
        const row = (b.y + 1) * 2
        // Each character's cell, the ground it is written on: its own (a bar's number, over fill and track; a count, over
        // its icon) or the box's. A text cell shows one ground for the two pixels it covers: theirs when they are one
        // color, else halfway between them; so no pixel letters can hide under it.
        const grounds = b.lines[0]!.flatMap(r => [...r.text].map(() => r.bg ?? b.bg))
        const under = grounds.map((_, j) => {
          const [top, bottom] = [s.px[row]![b.x + 1 + j]!, s.px[row + 1]![b.x + 1 + j]!]
          return top === bottom ? top : mix(top, bottom, 0.5)
        })
        expect([s.name, under]).toEqual([s.name, grounds])
      }
    }
    expect(seen).toBeGreaterThan(100)
  })

  test('each window says its numbers and names', async () => {
    // The shop: its nine prices, then its belt's one Health Potion.
    expect(said('shop')).toEqual(['25', '50', '80', '45', '50', '50', '75', '35', '60', '1'])
    expect(said('inventory-knight-epic')).toEqual(['1', '1', '1', '1', '1'])
    expect(said('start-knight')).toEqual(['KNIGHT', 'MAGE', 'ROGUE'])
    expect(said('talent-0')).toEqual(['CRAFT', 'CRAFT', 'CRAFT', 'TEST DRIVEN', 'CLEAN COMMIT', 'SHIP IT'])
    expect(said('talk-dog')).toEqual(['x 0'])
  })

  test('the strip says its gold, its depth and its belt\'s counts as text', async () => {
    const g = { ...newGame(4), gold: 214, depth: 7, belt: [{ kind: 'health' as const, tiers: [3, 0, 0] as [number, number, number] }, null, null, null, null] }
    const words = hudBoxes(g, 111, []).filter(b => b.role === 'label').map(b => b.lines[0]!.map(r => r.text).join(''))
    // After the HP and the level, on bars or orbs: the slot's count, the gold and the depth.
    expect(words.slice(-3)).toEqual(['3', '214', '7'])
  })
})

describe('a click on a label on art', () => {
  // A click at a label's first character, as the click layer reports one: the cell, to the middle.
  const on = (b: { x: number; y: number }): Gesture => ({ type: 'release', from: { x: b.x + 1.5, y: b.y + 1.5 }, at: { x: b.x + 1.5, y: b.y + 1.5 }, button: 'left' })
  const kitted = (): Game => ({ ...newGame(4, 'knight'), belt: (['health', 'regen', 'fury', 'ward', 'smoke'] as const).map(kind => ({ kind, tiers: [2, 0, 0] as [number, number, number] })) })

  test('goes through to what it labels: a belt slot\'s count uses the slot, in the bag, the compact bag and the merchant', async () => {
    const g = kitted()
    const counts = (boxes: readonly OverlayBox[]) => boxes.filter(b => b.role === 'label')
    counts(bagOverlay(g, BAG_UI_IDLE)).forEach((b, i) => expect(bagGesture(g, BAG_UI_IDLE, on(b)).actions).toEqual([{ kind: 'use', slot: i }]))
    counts(compactOverlay(g, BAG_UI_IDLE)).forEach((b, i) => expect(compactGesture(g, BAG_UI_IDLE, on(b)).actions).toEqual([{ kind: 'use', slot: i }]))
    const town = { ...apply(g, { kind: 'portal' }), gold: 300 }
    const shopCounts = counts(shopOverlay(town, SHOP_UI_IDLE)).slice(WARES.length)
    expect(shopCounts).toHaveLength(5)
    shopCounts.forEach((b, i) => expect(shopGesture(town, SHOP_UI_IDLE, on(b)).actions).toEqual([{ kind: 'use', slot: i }]))
  })

  test('a ware\'s price chooses the ware', async () => {
    const town = { ...apply(kitted(), { kind: 'portal' }), gold: 300 }
    const prices = shopOverlay(town, SHOP_UI_IDLE).filter(b => b.role === 'label').slice(0, WARES.length)
    prices.forEach((b, i) => expect(shopGesture(town, SHOP_UI_IDLE, on(b)).ui.ware).toBe(WARES[i]))
  })
})

import { describe, expect, test } from 'claude-code/testing'

import { CLASSES, kitted, shots } from './screens'
import { apply, newGame } from './game'
import { BG } from './canvas'
import { CHEST_UI_IDLE, chestOverlay, chestPixels } from './chest'
import { SHOP_UI_IDLE, shopOverlay, shopPixels } from './shop'
import { BAG_UI_IDLE, bagOverlay } from './bagui'
import { compactOverlay } from './compact'
import { FORGE_UI_IDLE, forgeOverlay } from './forge'
import { RARITY_COLOR, RARITY_RANK, plainItem } from './items'
import { INK, SURFACE } from './ui/tokens'
import type { Game, Rarity } from '../types'
import type { OverlayBox } from './window'

/** The boxes about an item: a card, what is worn, its menu. */
const CARDS = ['worn', 'item', 'card', 'menu']

/** Where a pixel round a card's frame is not the window's bare ground (another box on it included), or past the
 * window's edge. */
const touching = (px: string[][], b: OverlayBox, boxes: readonly OverlayBox[]) => {
  const ring: [number, number][] = []
  for (let x = b.x - 1; x <= b.x + b.w; x += 1) ring.push([x, b.y * 2 - 1], [x, (b.y + b.h) * 2])
  for (let y = b.y * 2; y < (b.y + b.h) * 2; y += 1) ring.push([b.x - 1, y], [b.x + b.w, y])
  const onBox = (x: number, y: number) => boxes.some(o => o !== b && x >= o.x && x < o.x + o.w && y >= o.y * 2 && y < (o.y + o.h) * 2)
  return ring.filter(([x, y]) => px[y]?.[x] !== BG || onBox(x, y))
}

describe('a card about an item', () => {
  test('stands on bare ground, a pixel of it round its frame, clear of every slot, frame and window edge, in every window', async () => {
    const town = { ...apply(newGame(4), { kind: 'portal' }), gold: 300 }
    const seen: string[] = []
    const check = (name: string, px: string[][], boxes: readonly OverlayBox[]) => {
      for (const b of boxes.filter(x => CARDS.includes(x.role))) {
        seen.push(name)
        expect([name, b.role, touching(px, b, boxes.filter(o => o.role !== 'label'))]).toEqual([name, b.role, []])
      }
    }
    for (const s of shots()) check(s.name, s.px, s.boxes)
    // The stash and the shop with each bag item chosen in turn: the gallery's shots choose none.
    for (const cls of CLASSES) {
      const g = { ...town, ...kitted(cls, 'rare'), where: 'town' as const }
      const stash = { ...g, stashed: [g.bag.slice(0, 4)] }
      for (const { id } of g.bag) {
        const chest = chestOverlay({ ...stash, cursor: id }, CHEST_UI_IDLE)
        check(`chest-${cls}-${id}`, chestPixels({ ...stash, cursor: id }, CHEST_UI_IDLE, chest), chest)
        const shop = shopOverlay({ ...g, cursor: id }, SHOP_UI_IDLE)
        check(`shop-${cls}-${id}`, shopPixels({ ...g, cursor: id }, SHOP_UI_IDLE, shop), shop)
      }
    }
    expect(seen.length).toBeGreaterThan(80)
  })

  // Common's tier white sits a step from the focus white that marks what is chosen and armed, so a Common card framed
  // in it looked selected. A Common card wears the plain frame instead; every other tier keeps its colour.
  test('is framed in its tier\'s colour, a Common one in the plain frame, never in the focus white, in every window', async () => {
    const town = { ...apply(newGame(4), { kind: 'portal' }), gold: 300, where: 'town' as const }
    const want = (r: Rarity) => (r === 'common' ? SURFACE.frame : RARITY_COLOR[r])
    const frames = (rarity: Rarity) => {
      const g: Game = structuredClone(town)
      const item = { ...plainItem(g, 'ring', rarity), x: 0, y: 0 }
      const worn = { ...plainItem(g, 'ring', rarity), x: 0, y: 0 }
      const bag = { ...g, bag: [item], gear: { ring: worn }, cursor: item.id }
      const stash = { ...bag, stashed: [[]] }
      const of = (boxes: readonly OverlayBox[], role: string) => boxes.find(b => b.role === role)?.border
      return {
        bag: of(bagOverlay(bag, BAG_UI_IDLE), 'item'),
        compact: of(compactOverlay(bag, BAG_UI_IDLE), 'card'),
        chest: of(chestOverlay(stash, CHEST_UI_IDLE), 'card'),
        shop: of(shopOverlay(bag, SHOP_UI_IDLE), 'card'),
        forge: of(forgeOverlay(bag, { ...FORGE_UI_IDLE, slot: 'ring' }), 'card'),
      }
    }
    for (const r of RARITY_RANK) {
      const w = want(r)
      expect([r, frames(r)]).toEqual([r, { bag: w, compact: w, chest: w, shop: w, forge: w }])
    }
    expect(want('common')).not.toBe(INK.focus)
  })
})

describe('every window\'s words', () => {
  test('set off the thousands of every number with commas: no run of four digits or more in any box', async () => {
    const town = { ...apply(newGame(4), { kind: 'portal' }), gold: 12345 }
    const said: string[] = []
    for (const s of shots()) for (const b of s.boxes) for (const line of b.lines) said.push(`${s.name}: ${line.map(r => r.text).join('')}`)
    // The stash's tabs not yet bought, and the shop, with gold to spare.
    for (const tab of [1, 2, 3, 'sets', 'legends'] as const) for (const b of chestOverlay(town, { ...CHEST_UI_IDLE, tab })) for (const line of b.lines) said.push(`chest ${tab}: ${line.map(r => r.text).join('')}`)
    expect(said.filter(line => /\d{4}/.test(line))).toEqual([])
    expect(said.length).toBeGreaterThan(300)
  })
})

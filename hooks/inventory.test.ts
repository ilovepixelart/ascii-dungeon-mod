import { describe, expect, test } from 'claude-code/testing'

import type { Game, Item, Rarity } from '../types'
import { CELL, ICONS } from './icons'
import { HEAD_H } from './window'
import { BAG_X, BAG_Y, BELT_STEP, BELT_X, BELT_Y, CURSOR, INV_H, INV_W, OFF_CLASS, UPGRADE, WORN_SLOTS, CLOSE_BOX, CLOSE_INK, GHOST_INK, INV_TOP, LABEL_INK, TITLE_INK, TITLE_X, TITLE_Y, beltLabel, dropTarget, inventoryPixels, inventoryScreenPixels, itemCard, POPOVER_BG } from './inventory'
import { BAG_W, RARITY_COLOR, plainItem } from './items'
import { mix } from './pieces'
import { BELT_SLOT_W, GRID, SLOT } from './canvas'
import { PAL, textMask } from './pixelart'
import { newGame } from './world'

const knight = (): Game => newGame(1, 'knight')
const put = (g: Game, base: string, rarity: Rarity, x: number, y: number, over: Partial<Item> = {}): Item => {
  const item = { ...plainItem(g, base, rarity), x, y, ...over }
  g.bag = [...g.bag, item]
  return item
}
/** The inner box of a bag item, in panel pixels. */
const box = (item: Item) => ({ x: BAG_X + item.x * CELL + 1, y: BAG_Y + item.y * CELL + 1, w: item.w * CELL - 1, h: item.h * CELL - 1 })
const at = (px: string[][], x: number, y: number) => px[y]?.[x]
const text = (lines: ReturnType<typeof itemCard>) => lines.map(l => l.map(r => r.text).join(''))

describe('the panel', () => {
  test('is INV_W by INV_H pixels and every belt slot lies inside it', async () => {
    const px = inventoryPixels(knight())
    expect(px.length).toBe(INV_H)
    for (const row of px) expect(row.length).toBe(INV_W)
    expect(BELT_X + 4 * BELT_STEP + BELT_SLOT_W).toBeLessThanOrEqual(INV_W)
    expect(BELT_Y + SLOT).toBeLessThanOrEqual(INV_H)
  })

  test('draws an item\'s icon pixel for pixel, centered in its footprint', async () => {
    const g = knight()
    const ring = put(g, 'ring', 'common', 3, 2)
    const art = ICONS.ring!.art
    const b = box(ring)
    const px = inventoryPixels(g)
    art.forEach((row, dy) => [...row].forEach((k, dx) => {
      if (k !== '.') expect(px[b.y + dy]?.[b.x + dx]).toBe(PAL[k])
    }))
  })

  test('frames every tier but Common in its own color', async () => {
    const g = knight()
    const items = (['common', 'uncommon', 'rare', 'epic', 'legendary'] as const).map((r, i) => put(g, 'ring', r, i, 5))
    const px = inventoryPixels(g)
    for (const item of items) {
      const b = box(item)
      const edge = px[b.y - 1]?.[b.x + 2]
      if (item.rarity === 'common') expect(edge).not.toBe(RARITY_COLOR.common)
      else expect(edge).toBe(RARITY_COLOR[item.rarity])
    }
  })

  test('marks an item this class cannot wear with a red X, and an upgrade with a green mark', async () => {
    const g = knight()
    const robe = put(g, 'robe', 'common', 0, 0)
    const plate = put(g, 'plate', 'common', 2, 0)
    const px = inventoryPixels(g)
    const r = box(robe)
    const p = box(plate)
    expect(px[r.y]?.[r.x + r.w - 3]).toBe(OFF_CLASS)
    expect(px[r.y + 2]?.[r.x + r.w - 1]).toBe(OFF_CLASS)
    expect(px[p.y + p.h - 1]?.[p.x]).toBe(UPGRADE)
    expect(px[r.y + r.h - 1]?.[r.x]).not.toBe(UPGRADE)
  })

  test('frames the selected item all round in white, outside its tier frame, even in the last column', async () => {
    const g = knight()
    const helm = put(g, 'steelHelm', 'rare', 4, 0)
    const wand = put(g, 'wand', 'rare', BAG_W - 1, 2)
    for (const item of [helm, wand]) {
      g.cursor = item.id
      const b = box(item)
      const px = inventoryPixels(g)
      const ring = [
        ...Array.from({ length: b.w + 4 }, (_, i) => px[b.y - 2]?.[b.x - 2 + i]),
        ...Array.from({ length: b.w + 4 }, (_, i) => px[b.y + b.h + 1]?.[b.x - 2 + i]),
        ...Array.from({ length: b.h + 4 }, (_, i) => px[b.y - 2 + i]?.[b.x - 2]),
        ...Array.from({ length: b.h + 4 }, (_, i) => px[b.y - 2 + i]?.[b.x + b.w + 1]),
      ]
      expect(ring.every(p => p === CURSOR)).toBe(true)
      expect(px[b.y - 1]?.[b.x + 2]).toBe(RARITY_COLOR.rare)
    }
  })

  test('frames the worn slot the selected item goes to: white when it can be worn, red when not; the others stay plain', async () => {
    const g = knight()
    const helm = put(g, 'steelHelm', 'common', 4, 0)
    const wand = put(g, 'wand', 'common', 6, 0)
    const edge = (px: string[][], slot: keyof typeof WORN_SLOTS) => {
      const [x, y, w] = WORN_SLOTS[slot]
      return px[y - 1]?.[x + Math.floor(w / 2)]
    }
    g.cursor = helm.id
    expect(edge(inventoryPixels(g), 'helm')).toBe(CURSOR)
    expect(edge(inventoryPixels(g), 'boots')).toBe(GRID)
    g.cursor = wand.id
    expect(edge(inventoryPixels(g), 'weapon')).toBe(OFF_CLASS)
    expect(edge(inventoryPixels(g), 'helm')).toBe(GRID)
  })

  test('shows a faint ghost in an empty worn slot and the item in a filled one', async () => {
    const g = knight()
    const [ax, ay, aw, ah] = WORN_SLOTS.amulet
    const px = inventoryPixels(g)
    const amulet = new Set(px.slice(ay, ay + ah).flatMap(r => r.slice(ax, ax + aw)))
    expect(amulet.has('#2a2732')).toBe(true)
    const [hx, hy, hw, hh] = WORN_SLOTS.helm
    const helm = new Set(px.slice(hy, hy + hh).flatMap(r => r.slice(hx, hx + hw)))
    expect(helm.has(PAL.n!)).toBe(true)
  })

  test('shows each belt stack\'s count in white', async () => {
    const g = { ...knight(), belt: [{ kind: 'health' as const, tiers: [4, 3, 0] as [number, number, number] }, null, null, null, null] }
    const px = inventoryPixels(g)
    const slot = new Set(px.slice(BELT_Y, BELT_Y + SLOT).flatMap(r => r.slice(BELT_X, BELT_X + BELT_SLOT_W)))
    expect(slot.has('#ffffff')).toBe(true)
    // Four Health Potions and three Greater: it shows the Greater, the tier it uses next, and counts those three.
    expect(beltLabel(g, 0)).toBe('Greater Health Potion x3')
    expect(beltLabel(g, 1)).toBe('empty')
  })
})

describe('the item card', () => {
  test('names the item and its tier, its slot and class, and its change against what is worn', async () => {
    const g = knight()
    const chain = put(g, 'chain', 'rare', 0, 0, { name: 'Sturdy Chain Shirt', def: 4 })
    g.cursor = chain.id
    expect(text(itemCard(g))).toEqual(['Sturdy Chain Shirt (Rare)', 'Armor, Knight only', '+4 def', 'vs Tunic: +4 def ^  -4 HP v', 'Sells for 54'])
  })

  test('shows another class\'s item as locked, in red', async () => {
    const g = knight()
    const robe = put(g, 'robe', 'common', 0, 0)
    g.cursor = robe.id
    const lock = itemCard(g)[1]?.find(r => r.text === 'Mage only')
    expect(lock?.color).toBe(OFF_CLASS)
  })

  test('a Legendary shows its power', async () => {
    const g = knight()
    const band = put(g, 'ring', 'legendary', 0, 0, { name: 'Band of the Endless Loop', power: 'loopHeal' })
    g.cursor = band.id
    expect(text(itemCard(g))).toContain('Every fifth kill heals 3 HP.')
  })
})

describe('the inventory screen', () => {

  test('is the panel under a title bar', async () => {
    const g = knight()
    const screen = inventoryScreenPixels(g)
    expect(screen.length).toBe(INV_TOP + INV_H)
    for (const row of screen) expect(row.length).toBe(INV_W)
    expect(screen.slice(INV_TOP)).toEqual(inventoryPixels(g))
  })

  test('writes INVENTORY in the title bar in pixel letters, and no labels under it', async () => {
    const screen = inventoryScreenPixels(knight())
    const inked = (text: string, x: number, y: number, ink: string) =>
      textMask(text).every((row, dy) => [...row].every((k, dx) => (k === '#') === (at(screen, x + dx, y + dy) === ink)))
    expect(inked('INVENTORY', TITLE_X, TITLE_Y, TITLE_INK)).toBe(true)
    expect(screen.slice(HEAD_H, INV_TOP).flat().includes(LABEL_INK)).toBe(false)
  })

  test('draws a close box with a red X at its place', async () => {
    const screen = inventoryScreenPixels(knight())
    const [x, y, w, h] = CLOSE_BOX
    const inside = screen.slice(y, y + h).flatMap(r => r.slice(x, x + w))
    expect(inside.filter(p => p === CLOSE_INK).length).toBeGreaterThanOrEqual(9)
  })
})

describe('dragging', () => {
  // A drag holds the pointer in screen pixels and where on the item it was grabbed.
  const g = knight()
  const helm = put(g, 'steelHelm', 'common', 4, 0)
  put(g, 'chain', 'common', 0, 0)
  const cellAt = (x: number, y: number) => ({ x: BAG_X + x * CELL + 1, y: INV_TOP + BAG_Y + y * CELL + 1 })
  const holding = (to: { x: number; y: number }) => ({ source: { kind: 'bag' as const, id: helm.id }, at: { x: to.x + 3, y: to.y + 3 }, grab: { x: 3, y: 3 } })

  test('the target glows as the hover does, through what is drawn there: in white where the item fits, in red where not', async () => {
    const still = inventoryScreenPixels(g)
    // The target's frame, a pixel outside the cell: its left edge, half way down.
    const edge = (cx: number, cy: number) => ({ x: cellAt(cx, cy).x - 1, y: cellAt(cx, cy).y + 2 })
    const fits = edge(5, 3)
    const blocked = edge(1, 0)
    expect(inventoryScreenPixels(g, holding(cellAt(5, 3)))[fits.y]![fits.x]).toBe(mix(still[fits.y]![fits.x]!, CURSOR, 0.5))
    expect(inventoryScreenPixels(g, holding(cellAt(1, 0)))[blocked.y]![blocked.x]).toBe(mix(still[blocked.y]![blocked.x]!, OFF_CLASS, 0.5))
  })

  test('over the bag, the target is the cell under the item\'s top-left; it fits on free cells or its own', async () => {
    expect(dropTarget(g, holding(cellAt(5, 3)))).toEqual({ kind: 'bag', x: 5, y: 3, fits: true })
    expect(dropTarget(g, holding(cellAt(4, 1)))).toEqual({ kind: 'bag', x: 4, y: 1, fits: true })
    expect(dropTarget(g, holding(cellAt(1, 0)))).toEqual({ kind: 'bag', x: 1, y: 0, fits: false })
    expect(dropTarget(g, holding(cellAt(7, 0)))).toEqual({ kind: 'bag', x: 7, y: 0, fits: false })
  })

  test('over a worn slot, the target is that slot; it fits only the slot the item is worn in, by a hero who can wear it', async () => {
    const [hx, hy] = WORN_SLOTS.helm
    const [bx, by] = WORN_SLOTS.boots
    const over = (x: number, y: number) => ({ ...holding({ x: 0, y: 0 }), at: { x: x + 2, y: INV_TOP + y + 2 } })
    expect(dropTarget(g, over(hx, hy))).toEqual({ kind: 'slot', slot: 'helm', fits: true })
    expect(dropTarget(g, over(bx, by))).toEqual({ kind: 'slot', slot: 'boots', fits: false })
    const wand = put(g, 'wand', 'common', 7, 0)
    const [wx, wy] = WORN_SLOTS.weapon
    expect(dropTarget(g, { source: { kind: 'bag', id: wand.id }, at: { x: wx + 2, y: INV_TOP + wy + 2 }, grab: { x: 0, y: 0 } })).toEqual({ kind: 'slot', slot: 'weapon', fits: false })
  })

  test('outside the bag and the worn slots there is no target', async () => {
    expect(dropTarget(g, { ...holding({ x: 0, y: 0 }), at: { x: 1, y: 1 } })).toBeUndefined()
  })

  test('draws the item\'s old place as a ghost', async () => {
    const from = box(helm)
    const fits = inventoryScreenPixels(g, holding(cellAt(5, 3)))
    const icon = new Set(fits.slice(INV_TOP + from.y, INV_TOP + from.y + from.h).flatMap(r => r.slice(from.x, from.x + from.w)))
    expect([...icon].some(p => p !== '#1a1820' && p !== GHOST_INK)).toBe(false)
  })
})

describe('popovers drawn in pixels', () => {
  test('each box is a 1 px frame in its own color round a dark fill, at its cells on the screen', async () => {
    const g = newGame(1, 'knight')
    const box = { x: 10, y: 4, w: 12, h: 5, border: '#3b8eea' }
    const px = inventoryScreenPixels(g, undefined, [box])
    // Cells are one pixel across and two down: the box spans pixels 10..21 across and 8..17 down.
    for (let y = 8; y <= 17; y += 1) expect([px[y]![10], px[y]![21]]).toEqual(['#3b8eea', '#3b8eea'])
    for (let x = 10; x <= 21; x += 1) expect([px[8]![x], px[17]![x]]).toEqual(['#3b8eea', '#3b8eea'])
    for (let y = 9; y <= 16; y += 1) for (let x = 11; x <= 20; x += 1) expect(px[y]![x]).toBe(POPOVER_BG)
    // Outside the box the screen is as without it.
    const bare = inventoryScreenPixels(g)
    expect(px[7]![10]).toBe(bare[7]![10])
    expect(px[8]![22]).toBe(bare[8]![22])
  })
})

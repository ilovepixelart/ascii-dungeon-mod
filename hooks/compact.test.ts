import { describe, expect, test } from 'claude-code/testing'

import type { Game, Item } from '../types'
import { BAG_UI_IDLE } from './bagui'
import { shots } from './screens'
import { BG } from './canvas'
import { COMPACT_H, COMPACT_W, compactGesture, compactOverlay, compactPixels } from './compact'
import { CELL } from './icons'
import { SLOTS, plainItem } from './items'
import { WINDOW_TOP, closeBoxOf } from './window'
import type { Gesture } from './window'
import { newGame } from './world'
/** The window's cards and menus, the labels on its art left out. */
const cards = (...args: Parameters<typeof compactOverlay>) => compactOverlay(...args).filter(b => b.role !== 'label')

const knight = (): Game => ({ ...newGame(1, 'knight'), bag: [] })
const put = (g: Game, base: string, x: number, y: number): Item => {
  const item = { ...plainItem(g, base, 'rare'), x, y }
  g.bag = [...g.bag, item]
  return item
}
const tap = (cx: number, cy: number, button: 'left' | 'right' = 'left'): Gesture => ({ type: 'release', from: { x: cx, y: cy }, at: { x: cx, y: cy }, button })
/** The middle of a bag item, in cells: the bag's grid starts a pixel in, two below the title bar's room. */
const onItem = (item: Item) => tap(2 + item.x * CELL + 4.5, (WINDOW_TOP + 2 + item.y * CELL + 4) / 2 + 0.25)

describe('the compact screen\'s room', () => {
  test('room each side: a top-left item\'s brackets keep off the left edge, the worn list 2 px off the right as the grid is off the left', async () => {
    for (const s of shots().filter(x => x.name.startsWith('compact-'))) {
      // The body's outer columns are the window's ground alone.
      const edges = s.px.slice(WINDOW_TOP).flatMap(row => [row[0], row[COMPACT_W - 1]])
      expect([s.name, [...new Set(edges)]]).toEqual([s.name, [BG]])
      const list = s.boxes.find(b => b.role === 'worn')!
      expect([s.name, list.x + list.w]).toEqual([s.name, COMPACT_W - 2])
    }
  })
})

describe('the compact inventory', () => {
  test('lists what is worn, a slot to two rows: its name, then the item or a dash', async () => {
    const g = knight()
    const list = cards(g, BAG_UI_IDLE)[0]!.lines.map(l => l.map(r => r.text).join(''))
    expect(list.length).toBe(SLOTS.length * 2)
    expect(list.slice(0, 2)).toEqual(['Weapon', 'Short Sword'])
    expect(list[list.indexOf('Ring') + 1]).toBe('-')
  })

  test('a worn name too long for a row takes both of its slot\'s rows; too long for both, its base\'s name shows', async () => {
    const g = knight()
    const boots = { ...plainItem(g, 'boots', 'rare'), name: 'Refactored Leather Boots of Fast Feedback' }
    const ring = { ...plainItem(g, 'ring', 'legendary'), name: 'Band of the Endless Loop' }
    const worn = { ...g, gear: { ...g.gear, boots, ring } }
    const list = cards(worn, BAG_UI_IDLE)[0]!
    const rows = list.lines.map(l => l.map(r => r.text).join(''))
    const of = (slot: (typeof SLOTS)[number]) => rows.slice(SLOTS.indexOf(slot) * 2, SLOTS.indexOf(slot) * 2 + 2)
    expect([of('weapon'), of('boots'), of('ring')]).toEqual([['Weapon', 'Short Sword'], ['Boots', 'Leather Boots'], ['Band of the', 'Endless Loop']])
    expect(rows.filter(r => r.length > list.w - 4)).toEqual([])
  })

  test('a click on a worn row takes that piece off; on an empty slot\'s, nothing', async () => {
    const g = knight()
    const list = cards(g, BAG_UI_IDLE)[0]!
    SLOTS.forEach((slot, i) => {
      const out = compactGesture(g, BAG_UI_IDLE, tap(list.x + 3.5, list.y + 1 + 2 * i + 1.5))
      expect(out.actions).toEqual(g.gear[slot] === undefined ? (g.cursor === null ? [] : [{ kind: 'deselect' }]) : [{ kind: 'unequip', slot }])
    })
  })

  test('a bag item is chosen, again its menu; the menu\'s Equip equips', async () => {
    const g = knight()
    const ring = put(g, 'ring', 2, 1)
    expect(compactGesture(g, BAG_UI_IDLE, onItem(ring)).actions).toEqual([{ kind: 'select', id: ring.id }])
    const chosen = { ...g, cursor: ring.id }
    const open = compactGesture(chosen, BAG_UI_IDLE, onItem(ring)).ui
    expect(open.menu).toEqual({ id: ring.id, confirm: false })
    const menu = cards(chosen, open).find(b => b.role === 'menu')!
    expect(compactGesture(chosen, open, tap(menu.x + 2.5, menu.y + 1.5)).actions).toEqual([{ kind: 'equip' }])
  })

  test('a bag item dragged to free cells is placed there; onto another, it stays', async () => {
    const g = knight()
    const ring = put(g, 'ring', 0, 0)
    put(g, 'ring', 3, 0)
    const from = onItem(ring).from
    const to = (dx: number): Gesture => ({ type: 'release', from, at: { x: from.x + dx * CELL, y: from.y }, button: 'left' })
    expect(compactGesture(g, BAG_UI_IDLE, to(5)).actions).toEqual([{ kind: 'place', id: ring.id, x: 5, y: 0 }])
    expect(compactGesture(g, BAG_UI_IDLE, to(3)).actions).toEqual([])
  })

  test('the close box closes it; a belt slot is used', async () => {
    const g = knight()
    const [x, y] = closeBoxOf(COMPACT_W)
    expect(compactGesture(g, BAG_UI_IDLE, tap(x + 2.5, (y + 2) / 2)).actions).toEqual([{ kind: 'panel', panel: 'bag' }])
    expect(compactGesture(g, BAG_UI_IDLE, tap(1 + 4.5, (COMPACT_H - 12 + 4) / 2)).actions).toEqual([{ kind: 'use', slot: 0 }])
  })

  test('is COMPACT_W wide and its card and menu stay inside it, off the item', async () => {
    const g = knight()
    const ring = put(g, 'ring', 7, 5)
    const chosen = { ...g, cursor: ring.id }
    const px = compactPixels(chosen)
    expect(px.length).toBe(COMPACT_H)
    for (const row of px) expect(row.length).toBe(COMPACT_W)
    const own = { x: 1 + ring.x * CELL, y: WINDOW_TOP + 2 + ring.y * CELL, w: CELL, h: CELL }
    for (const b of cards(chosen, { ...BAG_UI_IDLE, menu: { id: ring.id, confirm: false } }).filter(b => b.role !== 'worn')) {
      expect(b.x >= 0 && b.x + b.w <= COMPACT_W && (b.y + b.h) * 2 <= COMPACT_H).toBe(true)
      const covers = own.x < b.x + b.w && b.x < own.x + own.w && own.y < (b.y + b.h) * 2 && b.y * 2 < own.y + own.h
      expect(covers).toBe(false)
    }
  })
})

describe('the compact bag\'s edges and words', () => {
  test('the worn list stands 2 px from the window\'s right side, as the bag stands from its left', async () => {
    const list = compactOverlay(knight(), BAG_UI_IDLE).find(b => b.role === 'worn')!
    expect(COMPACT_W - (list.x + list.w)).toBe(2)
  })

  test('an armed Destroy says to click again, in the wide bag\'s words', async () => {
    const g = knight()
    const sword = put(g, 'sword', 0, 0)
    const armed = { ...BAG_UI_IDLE, menu: { id: sword.id, confirm: true } }
    const menu = compactOverlay({ ...g, bag: [sword], cursor: sword.id }, armed).find(b => b.role === 'menu')!
    expect(menu.lines.map(l => l.map(r => r.text).join(''))).toContain('d Destroy? click again')
  })
})

import { describe, expect, test } from 'claude-code/testing'

import type { Game, Item } from '../types'
import { BAG_UI_IDLE } from './bagui'
import { COMPACT_H, COMPACT_W, compactGesture, compactOverlay, compactPixels } from './compact'
import { CELL } from './icons'
import { SLOTS, plainItem } from './items'
import { WINDOW_TOP, closeBoxOf } from './window'
import type { Gesture } from './window'
import { newGame } from './world'

const knight = (): Game => ({ ...newGame(1, 'knight'), bag: [] })
const put = (g: Game, base: string, x: number, y: number): Item => {
  const item = { ...plainItem(g, base, 'rare'), x, y }
  g.bag = [...g.bag, item]
  return item
}
const tap = (cx: number, cy: number, button: 'left' | 'right' = 'left'): Gesture => ({ type: 'release', from: { x: cx, y: cy }, at: { x: cx, y: cy }, button })
/** The middle of a bag item, in cells: the bag's grid starts a pixel in, two below the title bar's room. */
const onItem = (item: Item) => tap(1 + item.x * CELL + 4.5, (WINDOW_TOP + 2 + item.y * CELL + 4) / 2 + 0.25)

describe('the compact inventory', () => {
  test('lists what is worn, a slot to two rows: its name, then the item or a dash', async () => {
    const g = knight()
    const list = compactOverlay(g, BAG_UI_IDLE)[0]!.lines.map(l => l.map(r => r.text).join(''))
    expect(list.length).toBe(SLOTS.length * 2)
    expect(list.slice(0, 2)).toEqual(['Weapon', 'Short Sword'])
    expect(list[list.indexOf('Ring') + 1]).toBe('-')
  })

  test('a click on a worn row takes that piece off; on an empty slot\'s, nothing', async () => {
    const g = knight()
    const list = compactOverlay(g, BAG_UI_IDLE)[0]!
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
    const menu = compactOverlay(chosen, open).find(b => b.role === 'menu')!
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
    for (const b of compactOverlay(chosen, { ...BAG_UI_IDLE, menu: { id: ring.id, confirm: false } }).filter(b => b.role !== 'worn')) {
      expect(b.x >= 0 && b.x + b.w <= COMPACT_W && (b.y + b.h) * 2 <= COMPACT_H).toBe(true)
      const covers = own.x < b.x + b.w && b.x < own.x + own.w && own.y < (b.y + b.h) * 2 && b.y * 2 < own.y + own.h
      expect(covers).toBe(false)
    }
  })
})

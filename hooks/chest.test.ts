import { describe, expect, test } from 'claude-code/testing'

import type { Game, Item, Rarity } from '../types'
import { STASH_SIZE } from './game'
import { BAG_X, BAG_Y } from './inventory'
import { CELL } from './icons'
import { BAG_H, BAG_W, plainItem } from './items'
import { WINDOW_TOP, CLOSE_BOX } from './window'
import type { Gesture, OverlayBox } from './window'
import { CHEST_UI_IDLE, chestGesture, chestOverlay, chestPixels, nextStored, whyNotStore, whyNotTake } from './chest'
import { CURSOR } from './pieces'
import type { ChestUi } from './chest'
import { newGame } from './world'

const hero = (): Game => ({ ...newGame(1, 'knight'), bag: [], stashed: [] })
const item = (g: Game, base: string, rarity: Rarity, over: Partial<Item> = {}): Item => ({ ...plainItem(g, base, rarity), x: 0, y: 0, ...over })
const click = (x: number, y: number, button: 'left' | 'right' = 'left'): Gesture => ({ type: 'release', from: { x, y }, at: { x, y }, button })
/** A click on the chest's row i: the list starts a cell below the window's top, its rows a cell under its frame. */
const onRow = (i: number, button: 'left' | 'right' = 'left') => click(5.5, WINDOW_TOP / 2 + 2 + i + 0.5, button)
const onBag = (it: Item) => click(BAG_X + it.x * CELL + 3.5, (WINDOW_TOP + BAG_Y + it.y * CELL + 3) / 2 + 0.25)
const lines = (g: Game, ui: ChestUi, role: string) => chestOverlay(g, ui).find(b => b.role === role)?.lines.map(l => l.map(r => r.text).join(''))
const onEntry = (g: Game, ui: ChestUi) => {
  const m = chestOverlay(g, ui).find(b => b.role === 'menu')!
  return click(m.x + 2.5, m.y + 1.5)
}

describe('the chest', () => {
  test('lists each stored item in a row, the rest of its room empty, the chosen one marked', async () => {
    const g = hero()
    g.stashed = [item(g, 'ring', 'rare', { id: 501, name: 'Band of Wit' }), item(g, 'robe', 'epic', { id: 502, name: 'Robe of Embers' })]
    const list = lines(g, { stored: 502, menu: false }, 'list')!
    expect(list.length).toBe(STASH_SIZE)
    expect(list.slice(0, 3)).toEqual(['  Band of Wit', '> Robe of Embers', '-'])
  })

  test('a clicked row is chosen and shows its card; again, or right-clicked, its menu: Take', async () => {
    const g = hero()
    g.stashed = [item(g, 'ring', 'rare', { id: 501 })]
    const once = chestGesture(g, CHEST_UI_IDLE, onRow(0))
    expect(once).toEqual({ ui: { stored: 501, menu: false }, actions: [] })
    expect(lines(g, once.ui, 'card')?.[0]).toBe('In your stash')
    const twice = chestGesture(g, once.ui, onRow(0))
    expect(twice.ui).toEqual({ stored: 501, menu: true })
    expect(chestGesture(g, CHEST_UI_IDLE, onRow(0, 'right')).ui).toEqual({ stored: 501, menu: true })
    expect(lines(g, twice.ui, 'menu')).toEqual(['t Take'])
    expect(chestGesture(g, twice.ui, onEntry(g, twice.ui))).toEqual({ ui: CHEST_UI_IDLE, actions: [{ kind: 'retrieve', id: 501 }] })
  })

  test('choosing a row lets go of a chosen bag item; an empty row chooses nothing', async () => {
    const g = hero()
    const ring = item(g, 'ring', 'common', { id: 7 })
    g.bag = [ring]
    g.cursor = 7
    g.stashed = [item(g, 'ring', 'rare', { id: 501 })]
    expect(chestGesture(g, CHEST_UI_IDLE, onRow(0)).actions).toEqual([{ kind: 'deselect' }])
    expect(chestGesture(g, CHEST_UI_IDLE, onRow(5)).ui).toEqual(CHEST_UI_IDLE)
  })

  test('with no room in the bag, Take says so and does nothing', async () => {
    const g = hero()
    g.bag = [item(g, 'ring', 'common', { w: 8, h: 6 })]
    const stored = item(g, 'ring', 'rare', { id: 501 })
    g.stashed = [stored]
    expect(whyNotTake(g, stored)).toBe('no room in your bag')
    expect(whyNotTake(hero(), stored)).toBeUndefined()
    const open: ChestUi = { stored: 501, menu: true }
    expect(lines(g, open, 'menu')).toEqual(['t Take  no room in your bag'])
    expect(chestGesture(g, open, onEntry(g, open))).toEqual({ ui: open, actions: [] })
  })

  test('the step key goes through the chest and wraps; an empty chest chooses nothing', async () => {
    const g = hero()
    g.stashed = [item(g, 'ring', 'rare', { id: 501 }), item(g, 'ring', 'rare', { id: 502 })]
    expect(nextStored(g, CHEST_UI_IDLE).stored).toBe(501)
    expect(nextStored(g, { stored: 501, menu: true })).toEqual({ stored: 502, menu: false })
    expect(nextStored(g, { stored: 502, menu: false }).stored).toBe(501)
    expect(nextStored(hero(), CHEST_UI_IDLE)).toEqual(CHEST_UI_IDLE)
  })
})

describe('the bag beside it', () => {
  test('a clicked bag item is chosen; again, its menu: Store, which stores it', async () => {
    const g = hero()
    const ring = item(g, 'ring', 'common', { id: 7, x: 2, y: 1 })
    g.bag = [ring]
    const once = chestGesture(g, { stored: 501, menu: false }, onBag(ring))
    expect(once).toEqual({ ui: { stored: null, menu: false }, actions: [{ kind: 'select', id: 7 }] })
    g.cursor = 7
    const twice = chestGesture(g, once.ui, onBag(ring))
    expect(twice.ui).toEqual({ stored: null, menu: true })
    expect(lines(g, twice.ui, 'menu')).toEqual(['s Store'])
    expect(chestGesture(g, twice.ui, onEntry(g, twice.ui))).toEqual({ ui: CHEST_UI_IDLE, actions: [{ kind: 'store' }] })
  })

  test('with the chest full, Store says so and does nothing', async () => {
    const g = hero()
    const ring = item(g, 'ring', 'common', { id: 7 })
    g.bag = [ring]
    g.cursor = 7
    g.stashed = Array.from({ length: STASH_SIZE }, (_, i) => item(g, 'ring', 'common', { id: 600 + i }))
    expect(whyNotStore(g)).toBe('the chest is full')
    expect(whyNotStore({ ...g, stashed: g.stashed.slice(1) })).toBeUndefined()
    const open: ChestUi = { stored: null, menu: true }
    expect(chestGesture(g, open, onEntry(g, open))).toEqual({ ui: open, actions: [] })
  })

  test('with a chest row chosen, the bag item the game still has selected is not framed as chosen', async () => {
    const g = hero()
    const ring = item(g, 'ring', 'common', { id: 7, x: 1, y: 1 })
    g.bag = [ring]
    g.cursor = 7
    g.stashed = [item(g, 'ring', 'rare', { id: 501 })]
    const frameAt = (ui: ChestUi) => chestPixels(g, ui)[WINDOW_TOP + BAG_Y + ring.y * CELL - 1]?.[BAG_X + ring.x * CELL + 3]
    expect(frameAt(CHEST_UI_IDLE)).toBe(CURSOR)
    expect(frameAt({ stored: 501, menu: false })).not.toBe(CURSOR)
  })

  test('empty space lets go of what is chosen; the close box closes the window; a drag does nothing', async () => {
    const g = hero()
    g.bag = [item(g, 'ring', 'common', { id: 7 })]
    g.cursor = 7
    expect(chestGesture(g, CHEST_UI_IDLE, click(100.5, 31.5))).toEqual({ ui: CHEST_UI_IDLE, actions: [{ kind: 'deselect' }] })
    const [x, y] = CLOSE_BOX
    expect(chestGesture(g, CHEST_UI_IDLE, click(x + 2.5, (y + 2) / 2)).actions).toEqual([{ kind: 'panel', panel: 'stash' }])
    expect(chestGesture(g, CHEST_UI_IDLE, { type: 'drag', from: { x: 5, y: 15 }, at: { x: 30, y: 15 } }).actions).toEqual([])
  })
})

describe('the stash, crowded', () => {
  /** A bag with a ring in every cell, and the chest full: a card has no clear spot over the bag. */
  const crowded = (): Game => {
    const g = hero()
    const bag = Array.from({ length: BAG_W * BAG_H }, (_, i) => ({ ...plainItem({ nextId: 7000 + i }, 'ring'), w: 1, h: 1, x: Math.floor(i / BAG_H), y: i % BAG_H }))
    // Epics with every stat and a trigger: cards too tall to fit under the list, the last row's reaching furthest down.
    return { ...g, bag, stashed: Array.from({ length: STASH_SIZE }, (_, i) => item(g, 'amulet', 'epic', { id: 8000 + i, trigger: 'thorns', atk: 1, def: 1, hp: 1, crit: 1, xp: 1 })) }
  }
  const overlap = (a: OverlayBox, b: OverlayBox) => a.x < b.x + b.w && b.x < a.x + a.w && a.y < b.y + b.h && b.y < a.y + a.h

  test('a chosen stored item\'s card and menu never lie over the chest\'s list', async () => {
    const g = crowded()
    const hits: string[] = []
    for (const stored of g.stashed) for (const menu of [false, true]) {
      const boxes = chestOverlay(g, { stored: stored.id, menu })
      boxes.forEach((a, i) => boxes.slice(i + 1).forEach(b => {
        if (overlap(a, b)) hits.push(`${stored.id} ${menu}: ${a.role} over ${b.role}`)
      }))
    }
    expect(hits).toEqual([])
  })

  test('a stored name too long for its row shows as its base\'s name', async () => {
    const g = hero()
    const long = item(g, 'boots', 'rare', { name: 'Refactored Leather Boots of Fast Feedback' })
    const list = chestOverlay({ ...g, stashed: [long] }, CHEST_UI_IDLE)[0]!
    expect(lines({ ...g, stashed: [long] }, CHEST_UI_IDLE, 'list')![0]).toBe('  Leather Boots')
    expect(list.lines.every(l => l.map(r => r.text).join('').length <= list.w - 4)).toBe(true)
  })
})

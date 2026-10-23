import { describe, expect, test } from 'claude-code/testing'

import type { Game, Item, Rarity } from '../types'
import { CELL } from './icons'
import { BAG_H, BAG_W, RARITY_COLOR, plainItem } from './items'
import { CLOSE_BOX, WINDOW_TOP, chromeBoxes } from './window'
import type { Gesture, OverlayBox } from './window'
import { CHEST_H, CHEST_UI_IDLE, chestGesture, chestOverlay, chestPixels, nextStored, nextTab, storeOn, whyNotStore, whyNotTake } from './chest'
import { fullTab } from './fixtures'
import { BG, GRID, canvas } from './canvas'
import { itemGrid } from './pieces'
import { SET_PLACES } from './stash'
import { baseOf } from './items'
const baseNameOf = (base: string) => baseOf(base)?.name ?? base
import { INK } from './ui/tokens'
import { CURSOR } from './pieces'
import type { ChestUi } from './chest'
import { newGame } from './world'

const hero = (): Game => ({ ...newGame(1, 'knight'), bag: [], stashed: [[]] })
const item = (g: Game, base: string, rarity: Rarity, over: Partial<Item> = {}): Item => ({ ...plainItem(g, base, rarity), x: 0, y: 0, ...over })
const click = (x: number, y: number, button: 'left' | 'right' = 'left'): Gesture => ({ type: 'release', from: { x, y }, at: { x, y }, button })
/** The tab's grid, its frame from x 4 and 2 under the title bar; the bag's 4 under its 43 rows: a cell's middle. */
const STASH_TOP = WINDOW_TOP + 2
const BAG_TOP = STASH_TOP + BAG_H * CELL + 1 + 4
const onStored = (it: Item, button: 'left' | 'right' = 'left') => click(4 + it.x * CELL + 3.5, (STASH_TOP + it.y * CELL + 3) / 2 + 0.25, button)
const onBag = (it: Item, button: 'left' | 'right' = 'left') => click(4 + it.x * CELL + 3.5, (BAG_TOP + it.y * CELL + 3) / 2 + 0.25, button)
// A row of the sets' or the Legendaries' list: over the tab's grid's place, its frame, then a row an item.
const onRow = (i: number, button: 'left' | 'right' = 'left') => click(7.5, STASH_TOP / 2 + 1 + i + 0.5, button)
const lines = (g: Game, ui: ChestUi, role: string) => chestOverlay(g, ui).find(b => b.role === role)?.lines.map(l => l.map(r => r.text).join(''))
const onEntry = (g: Game, ui: ChestUi) => {
  const m = chestOverlay(g, ui).find(b => b.role === 'menu')!
  return click(m.x + 2.5, m.y + 1.5)
}

describe('the chest', () => {
  test('lays a plain tab\'s items on a grid the bag\'s size, each at its cells as the bag draws them, the chosen one framed', async () => {
    const g = hero()
    g.stashed = [[item(g, 'ring', 'rare', { id: 501, x: 0, y: 0 }), item(g, 'robe', 'epic', { id: 502, x: 3, y: 2 })]]
    const px = chestPixels(g, { stored: 502, menu: false, tab: 0 })
    // The bag's own grid drawing of the same items, the same one chosen: the tab's grid is it, pixel for pixel.
    const drawn = canvas(BAG_W * CELL + 1, BAG_H * CELL + 1)
    itemGrid(drawn, { ...g, cursor: 502 }, g.stashed[0]!, 0, 0, BAG_W, BAG_H)
    const tab = px.slice(STASH_TOP, STASH_TOP + BAG_H * CELL + 1).map(r => r.slice(4, 4 + BAG_W * CELL + 1))
    expect(tab).toEqual(drawn.px)
    expect(lines(g, CHEST_UI_IDLE, 'list')).toBeUndefined()
  })

  test('frames both grids from x 4, so a chosen item\'s brackets, 2 px outside it, keep 2 px clear of the edge', async () => {
    const px = chestPixels(hero(), CHEST_UI_IDLE)
    // Each grid's left line on column 4, bare ground on column 3.
    for (const y of [STASH_TOP + 3, BAG_TOP + 3]) expect([px[y]![3], px[y]![4]]).toEqual([BG, GRID])
  })

  test('stands the tab\'s grid over the bag\'s, the cards beside them: 54 rows, its tabs and the gold in the title bar', async () => {
    const g = { ...hero(), gold: 1234 }
    expect(CHEST_H).toBe(108)
    const px = chestPixels(g, CHEST_UI_IDLE)
    const said = chromeBoxes(px).map(b => b.lines[0]!.map(r => r.text).join(''))
    expect(said).toEqual(['1', '2', '3', '4', 'SETS', 'LEGENDS', '1,234'])
  })

  test('a clicked stored item is chosen and shows its card; again, its menu: Take', async () => {
    const g = hero()
    const ring = item(g, 'ring', 'rare', { id: 501, x: 2, y: 3 })
    g.stashed = [[ring]]
    const onRow = () => onStored(ring)
    const once = chestGesture(g, CHEST_UI_IDLE, onRow())
    expect(once).toEqual({ ui: { stored: 501, menu: false, tab: 0 }, actions: [] })
    expect(lines(g, once.ui, 'card')?.[0]).toBe('In your stash')
    const twice = chestGesture(g, once.ui, onRow())
    expect(twice.ui).toEqual({ stored: 501, menu: true, tab: 0 })
    expect(lines(g, twice.ui, 'menu')).toEqual(['t Take'])
    expect(chestGesture(g, twice.ui, onEntry(g, twice.ui))).toEqual({ ui: CHEST_UI_IDLE, actions: [{ kind: 'retrieve', id: 501 }] })
  })

  test('choosing a stored item lets go of a chosen bag item; an empty cell of the tab chooses nothing', async () => {
    const g = hero()
    const ring = item(g, 'ring', 'common', { id: 7 })
    g.bag = [ring]
    g.cursor = 7
    const stored = item(g, 'ring', 'rare', { id: 501 })
    g.stashed = [[stored]]
    expect(chestGesture(g, CHEST_UI_IDLE, onStored(stored)).actions).toEqual([{ kind: 'deselect' }])
    expect(chestGesture(g, CHEST_UI_IDLE, onStored({ ...stored, x: 5, y: 4 })).ui).toEqual(CHEST_UI_IDLE)
  })

  test('with no room in the bag, Take says so and does nothing', async () => {
    const g = hero()
    g.bag = [item(g, 'ring', 'common', { w: 8, h: 6 })]
    const stored = item(g, 'ring', 'rare', { id: 501 })
    g.stashed = [[stored]]
    expect(whyNotTake(g, stored)).toBe('no room in your bag')
    expect(whyNotTake(hero(), stored)).toBeUndefined()
    const open: ChestUi = { stored: 501, menu: true, tab: 0 }
    expect(lines(g, open, 'menu')).toEqual(['t Take  no room in your bag'])
    expect(chestGesture(g, open, onEntry(g, open))).toEqual({ ui: open, actions: [] })
  })

  test('the step key goes through the chest, column by column, and wraps; an empty chest chooses nothing', async () => {
    const g = hero()
    g.stashed = [[item(g, 'ring', 'rare', { id: 502, x: 1, y: 0 }), item(g, 'ring', 'rare', { id: 501, x: 0, y: 4 })]]
    expect(nextStored(g, CHEST_UI_IDLE).stored).toBe(501)
    expect(nextStored(g, { stored: 501, menu: true, tab: 0 })).toEqual({ stored: 502, menu: false, tab: 0 })
    expect(nextStored(g, { stored: 502, menu: false, tab: 0 }).stored).toBe(501)
    expect(nextStored(hero(), CHEST_UI_IDLE)).toEqual(CHEST_UI_IDLE)
  })
})

describe('a right-click moves at once', () => {
  test('on a stored item, it takes the item out, nothing left chosen', async () => {
    const g = hero()
    const ring = item(g, 'ring', 'rare', { id: 501 })
    g.stashed = [[ring]]
    expect(chestGesture(g, CHEST_UI_IDLE, onStored(ring, 'right'))).toEqual({ ui: CHEST_UI_IDLE, actions: [{ kind: 'retrieve', id: 501 }] })
  })

  test('on a bag item, it stores it on the tab shown', async () => {
    const g = hero()
    g.stashed = [[], []]
    const ring = item(g, 'ring', 'common', { id: 7, x: 2, y: 1 })
    g.bag = [ring]
    const on2: ChestUi = { ...CHEST_UI_IDLE, tab: 1 }
    expect(chestGesture(g, on2, onBag(ring, 'right'))).toEqual({ ui: on2, actions: [{ kind: 'select', id: 7 }, { kind: 'store', tab: 1 }] })
  })

  test('when the move cannot be made, it opens the menu, which says why', async () => {
    const g = hero()
    g.bag = [item(g, 'ring', 'common', { id: 7, w: 8, h: 6 })]
    const stored = item(g, 'ring', 'rare', { id: 501 })
    g.stashed = [[stored]]
    const taken = chestGesture(g, CHEST_UI_IDLE, onStored(stored, 'right'))
    expect(taken).toEqual({ ui: { stored: 501, menu: true, tab: 0 }, actions: [] })
    expect(lines(g, taken.ui, 'menu')).toEqual(['t Take  no room in your bag'])
    const full = hero()
    const ring = item(full, 'ring', 'common', { id: 7 })
    full.bag = [ring]
    full.stashed = [fullTab(600)]
    expect(chestGesture(full, CHEST_UI_IDLE, onBag(ring, 'right'))).toEqual({ ui: { ...CHEST_UI_IDLE, menu: true }, actions: [{ kind: 'select', id: 7 }] })
  })
})

describe('the bag beside it', () => {
  test('a clicked bag item is chosen; again, its menu: Store, which stores it', async () => {
    const g = hero()
    const ring = item(g, 'ring', 'common', { id: 7, x: 2, y: 1 })
    g.bag = [ring]
    const once = chestGesture(g, { stored: 501, menu: false, tab: 0 }, onBag(ring))
    expect(once).toEqual({ ui: { stored: null, menu: false, tab: 0 }, actions: [{ kind: 'select', id: 7 }] })
    g.cursor = 7
    const twice = chestGesture(g, once.ui, onBag(ring))
    expect(twice.ui).toEqual({ stored: null, menu: true, tab: 0 })
    expect(lines(g, twice.ui, 'menu')).toEqual(['s Store'])
    expect(chestGesture(g, twice.ui, onEntry(g, twice.ui))).toEqual({ ui: CHEST_UI_IDLE, actions: [{ kind: 'store', tab: 0 }] })
  })

  test('with the chest full, Store says so and does nothing', async () => {
    const g = hero()
    const ring = item(g, 'ring', 'common', { id: 7 })
    g.bag = [ring]
    g.cursor = 7
    g.stashed = [fullTab(600)]
    expect(whyNotStore(g, ring)).toBe('the chest is full')
    expect(whyNotStore({ ...g, stashed: [g.stashed[0]!.slice(1)] }, ring)).toBeUndefined()
    const open: ChestUi = { stored: null, menu: true, tab: 0 }
    expect(chestGesture(g, open, onEntry(g, open))).toEqual({ ui: open, actions: [] })
  })

  test('with a chest row chosen, the bag item the game still has selected is not framed as chosen', async () => {
    const g = hero()
    const ring = item(g, 'ring', 'common', { id: 7, x: 1, y: 1 })
    g.bag = [ring]
    g.cursor = 7
    g.stashed = [[item(g, 'ring', 'rare', { id: 501 })]]
    const frameAt = (ui: ChestUi) => chestPixels(g, ui)[BAG_TOP + ring.y * CELL - 1]?.[4 + ring.x * CELL + 3]
    expect(frameAt(CHEST_UI_IDLE)).toBe(CURSOR)
    expect(frameAt({ stored: 501, menu: false, tab: 0 })).not.toBe(CURSOR)
  })

  test('empty space lets go of what is chosen; the close box closes the window; a drag does nothing', async () => {
    const g = hero()
    g.bag = [item(g, 'ring', 'common', { id: 7 })]
    g.cursor = 7
    // Beside the grids, where no card stands.
    expect(chestGesture(g, CHEST_UI_IDLE, click(100.5, 50.5))).toEqual({ ui: CHEST_UI_IDLE, actions: [{ kind: 'deselect' }] })
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
    // Epics with every stat and a trigger, a tab's every cell: cards as tall as they come.
    return { ...g, bag, stashed: [fullTab(8000).map(i => ({ ...i, base: 'amulet', rarity: 'epic' as const, trigger: 'thorns' as const, atk: 1, def: 1, hp: 1, crit: 1, xp: 1 }))] }
  }
  const overlap = (a: OverlayBox, b: OverlayBox) => a.x < b.x + b.w && b.x < a.x + a.w && a.y < b.y + b.h && b.y < a.y + a.h

  test('a chosen stored item\'s card and menu never lie over one another', async () => {
    const g = crowded()
    const hits: string[] = []
    for (const stored of g.stashed[0]!) for (const menu of [false, true]) {
      const boxes = chestOverlay(g, { stored: stored.id, menu, tab: 0 })
      boxes.forEach((a, i) => boxes.slice(i + 1).forEach(b => {
        if (overlap(a, b)) hits.push(`${stored.id} ${menu}: ${a.role} over ${b.role}`)
      }))
    }
    expect(hits).toEqual([])
  })

  test('on the sets\' tab, a stored name too long for its row shows as its base\'s name', async () => {
    const g = hero()
    const long = item(g, 'boots', 'rare', { name: 'Refactored Leather Boots of Fast Feedback and the Long Code Review' })
    const board = { ...g, stashSets: [{ ...long, set: SET_PLACES[0]!.set as Item['set'], base: SET_PLACES[0]!.base }] }
    const list = chestOverlay(board, { ...CHEST_UI_IDLE, tab: 'sets' }).find(b => b.role === 'list')!
    expect(lines(board, { ...CHEST_UI_IDLE, tab: 'sets' }, 'list')![0]).toBe(`  ${baseNameOf(SET_PLACES[0]!.base)}`)
    expect(list.lines.every(l => l.map(r => r.text).join('').length <= list.w - 4)).toBe(true)
  })
})

describe('the stash\'s tabs', () => {
  // The tabs in the title bar from x 2: 1, 2, 3, 4 three cells each and a cell apart, then SETS and LEGENDS; a click
  // on one on its middle row.
  const onTab = (x: number) => click(x + 0.5, 2.5)
  const on = (tab: ChestUi['tab']): ChestUi => ({ ...CHEST_UI_IDLE, tab })

  test('are the four plain ones, then the sets\' and the Legendaries\'; a click on one shows it', async () => {
    expect(chestGesture(hero(), CHEST_UI_IDLE, onTab(7)).ui).toEqual(on(1))
    expect(chestGesture(hero(), CHEST_UI_IDLE, onTab(20)).ui).toEqual(on('sets'))
    expect(chestGesture(hero(), CHEST_UI_IDLE, onTab(28)).ui).toEqual(on('legends'))
    expect([nextTab(on(3)), nextTab(on('legends'))]).toEqual([on('sets'), on(0)])
  })

  test('a tab not bought says what it costs and why it cannot be bought yet; Buy is grey till it can', async () => {
    const poor = hero()
    expect(lines(poor, on(1), 'list')).toEqual(['Tab 2 costs 1,000 gold.', 'You have 0 gold.'])
    expect(lines(poor, on(2), 'list')).toEqual(['Tab 3 costs 2,500 gold.', 'Buy tab 2 first.'])
    const buy = (g: Game, ui: ChestUi) => chestOverlay(g, ui).find(b => b.role === 'button')!.lines[0]![0]!
    expect(buy(poor, on(1))).toMatchObject({ text: 'BUY', color: INK.off })
    const rich = { ...hero(), gold: 1000 }
    expect(lines(rich, on(1), 'list')).toEqual(['Tab 2 costs 1,000 gold.', 'Buy it to keep more, from hero to hero.'])
    expect(buy(rich, on(1))).toMatchObject({ text: 'BUY', color: INK.text })
  })

  test('Buy buys the tab shown, only when it can', async () => {
    // Buy, 7 wide, centred under the price box (57 wide from x 4): from x 29; from pixel row 26, its words' row cell 14.
    const onBuy = click(32.5, 14.5)
    expect(chestGesture({ ...hero(), gold: 1000 }, on(1), onBuy).actions).toEqual([{ kind: 'buyTab', tab: 1 }])
    expect(chestGesture(hero(), on(1), onBuy).actions).toEqual([])
    expect(chestGesture({ ...hero(), gold: 3000 }, on('sets'), onBuy).actions).toEqual([{ kind: 'buyTab', tab: 'sets' }])
  })

  test('a bought tab shows its items, and a bag item stored from it goes there', async () => {
    const g = hero()
    const ring = item(g, 'ring', 'rare', { id: 41 })
    const two = { ...g, stashed: [[], [ring]] }
    expect(chestGesture(two, on(1), onStored(ring)).ui).toEqual({ ...on(1), stored: 41 })
    expect(storeOn(on(1))).toEqual({ kind: 'store', tab: 1 })
    expect(storeOn(on('sets'))).toEqual({ kind: 'store' })
  })

  test('the sets\' tab is a board a place a row: a piece stored there in its tier\'s color, the rest by name, dim', async () => {
    const g = hero()
    const blade: Item = { ...item(g, SET_PLACES[0]!.base, 'epic', { id: 42 }), set: SET_PLACES[0]!.set as Item['set'], name: SET_PLACES[0]!.name }
    const board = chestOverlay({ ...g, stashSets: [blade] }, on('sets')).find(b => b.role === 'list')!
    expect(board.lines.length).toBe(SET_PLACES.length)
    expect(board.lines[0]!.map(r => r.text).join('')).toBe(`  ${SET_PLACES[0]!.name}`)
    expect(board.lines[0]![1]!.color).toBe(RARITY_COLOR.epic)
    expect(board.lines[1]).toEqual([{ text: `  ${SET_PLACES[1]!.name}`, dim: true }])
  })
})

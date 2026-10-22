import { describe, expect, test } from 'claude-code/testing'

import type { Game, Item, Rarity } from '../types'
import { STASH_SIZE } from './game'
import { BAG_X, BAG_Y } from './inventory'
import { CELL } from './icons'
import { BAG_H, BAG_W, RARITY_COLOR, plainItem } from './items'
import { CLOSE_BOX, TABS_H, WINDOW_TOP } from './window'
import type { Gesture, OverlayBox } from './window'
import { CHEST_UI_IDLE, chestGesture, chestOverlay, chestPixels, nextStored, nextTab, storeOn, whyNotStore, whyNotTake } from './chest'
import { SET_PLACES } from './stash'
import { INK } from './ui/tokens'
import { CURSOR } from './pieces'
import type { ChestUi } from './chest'
import { newGame } from './world'

const hero = (): Game => ({ ...newGame(1, 'knight'), bag: [], stashed: [[]] })
const item = (g: Game, base: string, rarity: Rarity, over: Partial<Item> = {}): Item => ({ ...plainItem(g, base, rarity), x: 0, y: 0, ...over })
const click = (x: number, y: number, button: 'left' | 'right' = 'left'): Gesture => ({ type: 'release', from: { x, y }, at: { x, y }, button })
// A list row: under the tabs (TABS_H) and their rule, the list's frame, then a row an item.
const onRow = (i: number, button: 'left' | 'right' = 'left') => click(5.5, (WINDOW_TOP + TABS_H + 2) / 2 + 1 + i + 0.5, button)
const onBag = (it: Item) => click(BAG_X + it.x * CELL + 3.5, (WINDOW_TOP + BAG_Y + it.y * CELL + 3) / 2 + 0.25)
const lines = (g: Game, ui: ChestUi, role: string) => chestOverlay(g, ui).find(b => b.role === role)?.lines.map(l => l.map(r => r.text).join(''))
const onEntry = (g: Game, ui: ChestUi) => {
  const m = chestOverlay(g, ui).find(b => b.role === 'menu')!
  return click(m.x + 2.5, m.y + 1.5)
}

describe('the chest', () => {
  test('lists each stored item in a row, the rest of its room empty, the chosen one marked', async () => {
    const g = hero()
    g.stashed = [[item(g, 'ring', 'rare', { id: 501, name: 'Band of Wit' }), item(g, 'robe', 'epic', { id: 502, name: 'Robe of Embers' })]]
    const list = lines(g, { stored: 502, menu: false, tab: 0 }, 'list')!
    expect(list.length).toBe(STASH_SIZE)
    expect(list.slice(0, 3)).toEqual(['  Band of Wit', '> Robe of Embers', '-'])
  })

  test('a clicked row is chosen and shows its card; again, or right-clicked, its menu: Take', async () => {
    const g = hero()
    g.stashed = [[item(g, 'ring', 'rare', { id: 501 })]]
    const once = chestGesture(g, CHEST_UI_IDLE, onRow(0))
    expect(once).toEqual({ ui: { stored: 501, menu: false, tab: 0 }, actions: [] })
    expect(lines(g, once.ui, 'card')?.[0]).toBe('In your stash')
    const twice = chestGesture(g, once.ui, onRow(0))
    expect(twice.ui).toEqual({ stored: 501, menu: true, tab: 0 })
    expect(chestGesture(g, CHEST_UI_IDLE, onRow(0, 'right')).ui).toEqual({ stored: 501, menu: true, tab: 0 })
    expect(lines(g, twice.ui, 'menu')).toEqual(['t Take'])
    expect(chestGesture(g, twice.ui, onEntry(g, twice.ui))).toEqual({ ui: CHEST_UI_IDLE, actions: [{ kind: 'retrieve', id: 501 }] })
  })

  test('choosing a row lets go of a chosen bag item; an empty row chooses nothing', async () => {
    const g = hero()
    const ring = item(g, 'ring', 'common', { id: 7 })
    g.bag = [ring]
    g.cursor = 7
    g.stashed = [[item(g, 'ring', 'rare', { id: 501 })]]
    expect(chestGesture(g, CHEST_UI_IDLE, onRow(0)).actions).toEqual([{ kind: 'deselect' }])
    expect(chestGesture(g, CHEST_UI_IDLE, onRow(5)).ui).toEqual(CHEST_UI_IDLE)
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

  test('the step key goes through the chest and wraps; an empty chest chooses nothing', async () => {
    const g = hero()
    g.stashed = [[item(g, 'ring', 'rare', { id: 501 }), item(g, 'ring', 'rare', { id: 502 })]]
    expect(nextStored(g, CHEST_UI_IDLE).stored).toBe(501)
    expect(nextStored(g, { stored: 501, menu: true, tab: 0 })).toEqual({ stored: 502, menu: false, tab: 0 })
    expect(nextStored(g, { stored: 502, menu: false, tab: 0 }).stored).toBe(501)
    expect(nextStored(hero(), CHEST_UI_IDLE)).toEqual(CHEST_UI_IDLE)
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
    g.stashed = [Array.from({ length: STASH_SIZE }, (_, i) => item(g, 'ring', 'common', { id: 600 + i }))]
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
    const frameAt = (ui: ChestUi) => chestPixels(g, ui)[WINDOW_TOP + BAG_Y + ring.y * CELL - 1]?.[BAG_X + ring.x * CELL + 3]
    expect(frameAt(CHEST_UI_IDLE)).toBe(CURSOR)
    expect(frameAt({ stored: 501, menu: false, tab: 0 })).not.toBe(CURSOR)
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
    return { ...g, bag, stashed: [Array.from({ length: STASH_SIZE }, (_, i) => item(g, 'amulet', 'epic', { id: 8000 + i, trigger: 'thorns', atk: 1, def: 1, hp: 1, crit: 1, xp: 1 }))] }
  }
  const overlap = (a: OverlayBox, b: OverlayBox) => a.x < b.x + b.w && b.x < a.x + a.w && a.y < b.y + b.h && b.y < a.y + a.h

  test('a chosen stored item\'s card and menu never lie over the chest\'s list', async () => {
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

  test('a stored name too long for its row shows as its base\'s name', async () => {
    const g = hero()
    const long = item(g, 'boots', 'rare', { name: 'Refactored Leather Boots of Fast Feedback' })
    const list = chestOverlay({ ...g, stashed: [[long]] }, CHEST_UI_IDLE).find(b => b.role === 'list')!
    expect(lines({ ...g, stashed: [[long]] }, CHEST_UI_IDLE, 'list')![0]).toBe('  Leather Boots')
    expect(list.lines.every(l => l.map(r => r.text).join('').length <= list.w - 4)).toBe(true)
  })
})

describe('the stash\'s tabs', () => {
  // The tabs from x 2 in the window's body rows 14 to 23: 1, 2, 3, 4 three cells each and a cell apart, then SETS and
  // LEGENDS; a click on one at its middle row.
  const onTab = (x: number) => click(x + 0.5, 9.5)
  const on = (tab: ChestUi['tab']): ChestUi => ({ ...CHEST_UI_IDLE, tab })
  const tabLabels = (g: Game, ui: ChestUi) => chestOverlay(g, ui).filter(b => b.role === 'tabs').map(b => b.lines[0]![0]!.text)

  test('are the four plain ones, then the sets\' and the Legendaries\'; a click on one shows it', async () => {
    expect(tabLabels(hero(), CHEST_UI_IDLE)).toEqual(['1', '2', '3', '4', 'SETS', 'LEGENDS'])
    expect(chestGesture(hero(), CHEST_UI_IDLE, onTab(7)).ui).toEqual(on(1))
    expect(chestGesture(hero(), CHEST_UI_IDLE, onTab(20)).ui).toEqual(on('sets'))
    expect(chestGesture(hero(), CHEST_UI_IDLE, onTab(28)).ui).toEqual(on('legends'))
    expect([nextTab(on(3)), nextTab(on('legends'))]).toEqual([on('sets'), on(0)])
  })

  test('a tab not bought says what it costs and why it cannot be bought yet; Buy is grey till it can', async () => {
    const poor = hero()
    expect(lines(poor, on(1), 'list')).toEqual(['Tab 2 costs 1000 gold.', 'You have 0 gold.'])
    expect(lines(poor, on(2), 'list')).toEqual(['Tab 3 costs 2500 gold.', 'Buy tab 2 first.'])
    const buy = (g: Game, ui: ChestUi) => chestOverlay(g, ui).find(b => b.role === 'button')!.lines[0]![0]!
    expect(buy(poor, on(1))).toMatchObject({ text: 'BUY', color: INK.off })
    const rich = { ...hero(), gold: 1000 }
    expect(lines(rich, on(1), 'list')).toEqual(['Tab 2 costs 1000 gold.', 'Buy it to keep more, from hero to hero.'])
    expect(buy(rich, on(1))).toMatchObject({ text: 'BUY', color: INK.text })
  })

  test('Buy buys the tab shown, only when it can', async () => {
    // Buy at x 2, from pixel row 36: its words' row, cell 19.
    const onBuy = click(4.5, 19.5)
    expect(chestGesture({ ...hero(), gold: 1000 }, on(1), onBuy).actions).toEqual([{ kind: 'buyTab', tab: 1 }])
    expect(chestGesture(hero(), on(1), onBuy).actions).toEqual([])
    expect(chestGesture({ ...hero(), gold: 3000 }, on('sets'), onBuy).actions).toEqual([{ kind: 'buyTab', tab: 'sets' }])
  })

  test('a bought tab lists its items, and a bag item stored from it goes there', async () => {
    const g = hero()
    const ring = item(g, 'ring', 'rare', { id: 41 })
    const two = { ...g, stashed: [[], [ring]] }
    expect(lines(two, on(1), 'list')![0]).toBe(`  ${ring.name}`)
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

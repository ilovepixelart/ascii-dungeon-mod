import { describe, expect, test } from 'claude-code/testing'

import type { Game, Item, Rarity } from '../types'
import { CURSOR, UNPAID_INK, GOLD_INK } from './pieces'
import { RARITY_COLOR, junkValue, plainItem } from './items'
import { BAG_X, BAG_Y, BELT_Y } from './inventory'
import { CELL } from './icons'
import { WINDOW_TOP, CLOSE_BOX, WINDOW_W } from './window'
import { SHOP_H, SHOP_UI_IDLE, WARES, nextWare, shopGesture, shopOverlay, shopPixels, wareRect, whyNot } from './shop'
import type { ShopUi } from './shop'
import type { Gesture } from './window'
import { newGame } from './world'
/** The window's cards and menus, the labels on its art left out. */
const cards = (...args: Parameters<typeof shopOverlay>) => shopOverlay(...args).filter(b => b.role !== 'label')

const knight = (gold: number): Game => ({ ...newGame(1, 'knight'), gold, bag: [] })
const put = (g: Game, base: string, rarity: Rarity, x: number, y: number, over: Partial<Item> = {}): Item => {
  const item = { ...plainItem(g, base, rarity), x, y, ...over }
  g.bag = [...g.bag, item]
  return item
}
/** A click in the click layer's cells on window pixel (px, py). */
const tap = (px: number, py: number, button: 'left' | 'right' = 'left'): Gesture => ({ type: 'release', from: { x: px + 0.5, y: py / 2 + 0.25 }, at: { x: px + 0.5, y: py / 2 + 0.25 }, button })
const onWare = (i: number, button: 'left' | 'right' = 'left') => tap(wareRect(i).x + 7, wareRect(i).y + 4, button)
const onItem = (item: Item, button: 'left' | 'right' = 'left') => tap(BAG_X + item.x * CELL + 3, WINDOW_TOP + BAG_Y + item.y * CELL + 3, button)
const text = (g: Game, ui: ShopUi, role: 'card' | 'menu') => cards(g, ui).find(b => b.role === role)?.lines.map(l => l.map(r => r.text).join(''))
/** A click on a menu's row, in cells. */
const onRow = (g: Game, ui: ShopUi, row: number): Gesture => {
  const m = cards(g, ui).find(b => b.role === 'menu')!
  const at = { x: m.x + 2.5, y: m.y + 1 + row + 0.5 }
  return { type: 'release', from: at, at, button: 'left' }
}

describe('wares', () => {
  test('a clicked ware is chosen and shows its card: name, what it does, price and how many are on the belt', async () => {
    const g = knight(100)
    g.belt = [{ kind: 'health', tiers: [3, 0, 2] }, null, null, null, null]
    const { ui, actions } = shopGesture(g, SHOP_UI_IDLE, onWare(WARES.indexOf('health1')))
    expect(ui).toEqual({ ware: 'health1', menu: false })
    expect(actions).toEqual([])
    expect(text(g, ui, 'card')).toEqual(['Health Potion', 'Restores 35% of your HP.', 'Price 25   On your belt: 3'])
    expect(text(g, ui, 'menu')).toBeUndefined()
  })

  test('choosing a ware lets go of a chosen bag item', async () => {
    const g = knight(100)
    g.cursor = put(g, 'ring', 'common', 0, 0).id
    expect(shopGesture(g, SHOP_UI_IDLE, onWare(0)).actions).toEqual([{ kind: 'deselect' }])
  })

  test('clicked again, its menu opens; Buy buys and the menu stays open for the next', async () => {
    const g = knight(100)
    const once = shopGesture(g, SHOP_UI_IDLE, onWare(0)).ui
    const twice = shopGesture(g, once, onWare(0)).ui
    expect(twice).toEqual({ ware: WARES[0], menu: true })
    expect(text(g, twice, 'menu')).toEqual(['b Buy for 25'])
    const bought = shopGesture(g, twice, onRow(g, twice, 0))
    expect(bought.actions).toEqual([{ kind: 'buy', ware: 'health1' }])
    expect(bought.ui).toEqual(twice)
  })

  test('what cannot be bought says why, and its Buy does nothing: short of gold, or no room on the belt', async () => {
    const poor = knight(24)
    const open: ShopUi = { ware: 'health1', menu: true }
    expect(text(poor, open, 'menu')).toEqual(['b Buy for 25  not enough gold'])
    expect(shopGesture(poor, open, onRow(poor, open, 0)).actions).toEqual([])
    const full = knight(100)
    full.belt = [{ kind: 'health', tiers: [99, 0, 0] }, { kind: 'regen', tiers: [1, 0, 0] }, null, null, null]
    expect(whyNot(full, 'health1')).toBe('no room on your belt')
    expect(whyNot(full, 'regen1')).toBeUndefined()
    expect(whyNot(knight(25), 'health1')).toBeUndefined()
  })

  test('a right-click buys a ware at once, its card shown for the next; one that cannot be bought opens the menu saying why', async () => {
    const g = knight(100)
    expect(shopGesture(g, SHOP_UI_IDLE, onWare(0, 'right'))).toEqual({ ui: { ware: WARES[0], menu: false }, actions: [{ kind: 'buy', ware: WARES[0] }] })
    const poor = knight(24)
    const refused = shopGesture(poor, SHOP_UI_IDLE, onWare(0, 'right'))
    expect(refused).toEqual({ ui: { ware: WARES[0], menu: true }, actions: [] })
    expect(text(poor, refused.ui, 'menu')).toEqual(['b Buy for 25  not enough gold'])
  })

  test('a right-click sells a bag item at once; a locked one opens the menu saying why', async () => {
    const g = knight(0)
    const ring = put(g, 'ring', 'common', 1, 1)
    expect(shopGesture(g, SHOP_UI_IDLE, onItem(ring, 'right'))).toEqual({ ui: SHOP_UI_IDLE, actions: [{ kind: 'select', id: ring.id }, { kind: 'sell' }] })
    const kept = put(g, 'ring', 'rare', 3, 1, { locked: true })
    const refused = shopGesture(g, SHOP_UI_IDLE, onItem(kept, 'right'))
    expect(refused).toEqual({ ui: { ware: null, menu: true }, actions: [{ kind: 'select', id: kept.id }] })
    expect(text({ ...g, cursor: kept.id }, refused.ui, 'menu')?.[0]).toMatch(/^s Sell for \d+  locked$/)
  })

  test('a click anywhere but the menu closes it and buys nothing', async () => {
    const g = knight(100)
    const open: ShopUi = { ware: 'health1', menu: true }
    const out = shopGesture(g, open, tap(WINDOW_W - 3, WINDOW_TOP + 40))
    expect(out).toEqual({ ui: { ware: 'health1', menu: false }, actions: [] })
  })

  test('the next-ware key steps along the shelf and wraps', async () => {
    expect(nextWare(SHOP_UI_IDLE).ware).toBe(WARES[0])
    expect(nextWare({ ware: WARES[0]!, menu: true })).toEqual({ ware: WARES[1], menu: false })
    expect(nextWare({ ware: WARES[WARES.length - 1]!, menu: false }).ware).toBe(WARES[0])
  })
})

describe('the bag in the shop', () => {
  test('a clicked item is chosen, again its menu: Sell for its price, then Equip', async () => {
    const g = knight(0)
    const ring = put(g, 'ring', 'rare', 2, 1)
    const first = shopGesture(g, { ware: 'health1', menu: false }, onItem(ring))
    expect(first).toEqual({ ui: { ware: null, menu: false }, actions: [{ kind: 'select', id: ring.id }] })
    g.cursor = ring.id
    const second = shopGesture(g, first.ui, onItem(ring))
    expect(second).toEqual({ ui: { ware: null, menu: true }, actions: [] })
    expect(text(g, second.ui, 'menu')).toEqual([`s Sell for 6`, 'e Equip'])
    expect(shopGesture(g, second.ui, onRow(g, second.ui, 0))).toEqual({ ui: { ware: null, menu: false }, actions: [{ kind: 'sell' }] })
    expect(shopGesture(g, second.ui, onRow(g, second.ui, 1)).actions).toEqual([{ kind: 'equip' }])
  })

  test('gear the hero cannot wear has Equip greyed with the reason, and it does nothing', async () => {
    const g = knight(0)
    const robe = put(g, 'robe', 'common', 0, 0)
    g.cursor = robe.id
    const open: ShopUi = { ware: null, menu: true }
    expect(text(g, open, 'menu')?.[1]).toMatch(/^e Equip {2}\S/)
    expect(shopGesture(g, open, onRow(g, open, 1))).toEqual({ ui: open, actions: [] })
  })

  test('empty space lets go of what is chosen; the close box closes the shop', async () => {
    const g = knight(0)
    g.cursor = put(g, 'ring', 'common', 0, 0).id
    expect(shopGesture(g, { ware: null, menu: false }, tap(WINDOW_W - 3, WINDOW_TOP + 50))).toEqual({ ui: SHOP_UI_IDLE, actions: [{ kind: 'deselect' }] })
    const [x, y] = CLOSE_BOX
    expect(shopGesture(g, { ware: 'health1', menu: false }, tap(x + 2, y + 2)).actions).toEqual([{ kind: 'panel', panel: 'shop' }])
  })

  test('a drag, or a release far from its press, does nothing', async () => {
    const g = knight(100)
    const drag: Gesture = { type: 'drag', from: { x: 10, y: 15 }, at: { x: 30, y: 15 } }
    expect(shopGesture(g, SHOP_UI_IDLE, drag)).toEqual({ ui: SHOP_UI_IDLE, actions: [] })
    const r = wareRect(0)
    const moved: Gesture = { type: 'release', from: { x: r.x + 7.5, y: (r.y + 4) / 2 }, at: { x: r.x + 40.5, y: (r.y + 4) / 2 }, button: 'left' }
    expect(shopGesture(g, SHOP_UI_IDLE, moved)).toEqual({ ui: SHOP_UI_IDLE, actions: [] })
  })
})

describe('the window', () => {
  const inside = (r: { x: number; y: number; w: number; h: number }, b: { x: number; y: number; w: number; h: number }) =>
    r.x < b.x + b.w && b.x < r.x + r.w && r.y < (b.y + b.h) * 2 && b.y * 2 < r.y + r.h

  test('every ware\'s card and menu stay inside the window and never cover the ware or each other', async () => {
    const g = knight(30)
    put(g, 'axe', 'epic', 0, 0)
    put(g, 'ring', 'rare', 4, 0)
    for (const ware of WARES) {
      const boxes = cards(g, { ware, menu: true })
      expect(boxes.length).toBe(2)
      for (const b of boxes) {
        expect(b.x >= 0 && b.y >= 0 && b.x + b.w <= WINDOW_W && (b.y + b.h) * 2 <= SHOP_H).toBe(true)
        expect(inside(wareRect(WARES.indexOf(ware)), b)).toBe(false)
      }
      const [card, menu] = boxes
      expect(card!.x < menu!.x + menu!.w && menu!.x < card!.x + card!.w && card!.y < menu!.y + menu!.h && menu!.y < card!.y + card!.h).toBe(false)
    }
  })

  test('in a full bag, where every place hides something, a chosen item\'s card and menu still never cover it', async () => {
    const g = knight(0)
    for (let y = 0; y < 6; y += 1) for (let x = 0; x < 8; x += 1) put(g, 'ring', 'common', x, y)
    g.belt = [{ kind: 'health', tiers: [1, 0, 0] }, { kind: 'regen', tiers: [1, 0, 0] }, { kind: 'fury', tiers: [1, 0, 0] }, { kind: 'ward', tiers: [1, 0, 0] }, { kind: 'smoke', tiers: [1, 0, 0] }]
    for (const item of g.bag) {
      g.cursor = item.id
      const own = { x: BAG_X + item.x * CELL + 1, y: WINDOW_TOP + BAG_Y + item.y * CELL + 1, w: CELL - 1, h: CELL - 1 }
      for (const b of cards(g, { ware: null, menu: true })) expect(inside(own, b)).toBe(false)
    }
  })

  test('the chosen ware is framed white; a price that cannot be paid is grey, one that can is gold', async () => {
    const g = knight(30)
    const px = shopPixels(g, { ware: 'smoke1', menu: false })
    const r = wareRect(WARES.indexOf('smoke1'))
    const slotX = r.x + Math.floor((r.w - 10) / 2)
    expect(px[r.y]?.[slotX + 3]).toBe(CURSOR)
    const priceRow = (i: number) => px.slice(wareRect(i).y + 12, wareRect(i).y + 17).flatMap(row => row.slice(wareRect(i).x, wareRect(i).x + wareRect(i).w))
    // A Smoke Bomb costs 35 and 30 is short; a Health Potion's 25 is paid; an Elixir's 80 is not.
    expect(priceRow(WARES.indexOf('health1'))).toContain(GOLD_INK)
    expect(priceRow(WARES.indexOf('health3'))).toContain(UNPAID_INK)
    expect(priceRow(WARES.indexOf('health3'))).not.toContain(GOLD_INK)
    expect(px[wareRect(WARES.indexOf('health1')).y]?.[slotX + 3]).not.toBe(CURSOR)
  })

  test('with a ware chosen, the bag item the game still has selected is not framed as chosen', async () => {
    const g = knight(0)
    const ring = put(g, 'ring', 'common', 0, 0)
    g.cursor = ring.id
    const frameAt = (ui: ShopUi) => shopPixels(g, ui)[WINDOW_TOP + BAG_Y + ring.y * CELL - 1]?.[BAG_X + ring.x * CELL + 3]
    expect(frameAt(SHOP_UI_IDLE)).toBe(CURSOR)
    expect(frameAt({ ware: 'health1', menu: false })).not.toBe(CURSOR)
  })
})

test('the junk to sell: how many items are marked and the gold they come to', async () => {
  const g = knight(0)
  put(g, 'ring', 'common', 0, 0, { junk: true })
  put(g, 'ring', 'epic', 1, 0, { junk: true })
  put(g, 'ring', 'rare', 2, 0)
  // A plain ring adds no worth: it sells at its tier's PRICE (items/catalog.ts), Common 2 and Epic 12. The Rare is not junk.
  expect(junkValue(g)).toEqual({ count: 2, coins: 14 })
  expect(junkValue(knight(0))).toEqual({ count: 0, coins: 0 })
})

test('the shelf holds its wares in three rows of three, clear of the belt below and inside the window', async () => {
  expect(WARES).toHaveLength(9)
  for (let i = 0; i < WARES.length; i += 1) {
    const r = wareRect(i)
    expect(r.x + r.w).toBeLessThanOrEqual(BAG_X)
    expect(r.y + r.h).toBeLessThan(WINDOW_TOP + BELT_Y)
  }
})

test('a ware\'s card is framed as a Common item\'s, its menu in white, as every card and menu is', async () => {
  const g = { ...newGame(4), where: 'town' as const, gold: 300 }
  const ui = { ware: WARES[0]!, menu: true }
  expect(cards(g, ui).map(b => [b.role, b.border])).toEqual([['card', RARITY_COLOR.common], ['menu', CURSOR]])
})

// The merchant's window: the wares on a shelf on the left, the bag and belt as in the inventory. A ware or a bag item
// is chosen with a click and shows its card; a second click (or a right-click) opens its menu: buy, or sell and equip.
// Pure: the click layer reports whole gestures, this decides the window's next state and the game actions to apply.
import type { Game, Item } from '../types'
import type { Action, Run } from './game'
import { SHOP_PRICES, priceOfWare } from './game'
import { CONSUMABLES, hasRoom, heldOf, wareOf } from './consumables'
import type { Ware } from './consumables'
import { consumableIcon } from './icons'
import { BAG_H, BAG_W, RARITY_COLOR, canWear, classLabel, priceOf } from './items'
import { canvas } from './canvas'
import { BAG_X, BAG_Y, BELT_X, BELT_Y, INV_H } from './inventory'
import { card } from './bagui'
import { CURSOR, OFF_CLASS, TAG_H, TAG_W, belt, beltSlotRect, cellBox, itemGrid, itemOutline, wareTag } from './pieces'
import { WINDOW_TOP, CLICK_SLOP, CLOSE_BOX, WINDOW_W, boxShape, cardWithMenu, drawBox, isInside, pixel, windowPixels } from './window'
import type { Gesture, OverlayBox, Rect, Weighted } from './window'
import type { Pos } from './map'
import { INK } from './ui/tokens'

/** The wares in shelf order, three to a row. */
export const WARES = Object.keys(SHOP_PRICES) as Ware[]

/** What the window shows beyond the game: the ware chosen (a bag item is chosen in the game), and which menu is open. */
export type ShopUi = { ware: Ware | null; menu: boolean }
export const SHOP_UI_IDLE: ShopUi = { ware: null, menu: false }

/** The window's height in pixels and cells: the bag's. */
export const SHOP_H = WINDOW_TOP + INV_H
const ROWS = SHOP_H / 2

/** A ware's place on the shelf, in window pixels. */
export const wareRect = (i: number): Rect => ({ x: 1 + (i % 3) * TAG_W, y: WINDOW_TOP + 2 + Math.floor(i / 3) * (TAG_H + 1), w: TAG_W, h: TAG_H })
const itemRect = (item: Item): Rect => cellBox(item, BAG_X, WINDOW_TOP + BAG_Y)
const beltRect = (i: number): Rect => beltSlotRect(BELT_X, WINDOW_TOP + BELT_Y, i)

/** Why a ware cannot be bought now, or undefined when it can. */
export const whyNot = (g: Game, ware: Ware) =>
  g.gold < priceOfWare(ware, g) ? 'not enough gold' : !hasRoom(g, wareOf(ware).kind, wareOf(ware).tier) ? 'no room on your belt' : undefined

const chosenItem = (g: Game, ui: ShopUi) => (ui.ware === null ? g.bag.find(i => i.id === g.cursor) : undefined)

/** The window's pixels: title and gold, the shelf, the bag, the belt, and the frames of the boxes over them. */
export const shopPixels = (g: Game, ui: ShopUi, boxes: readonly OverlayBox[] = []): string[][] => {
  const body = canvas(WINDOW_W, INV_H)
  WARES.forEach((ware, i) => {
    const r = wareRect(i)
    const { kind, tier } = wareOf(ware)
    wareTag(body, consumableIcon(kind, tier), priceOfWare(ware, g), r.x, r.y - WINDOW_TOP, g.gold >= priceOfWare(ware, g), ui.ware === ware)
  })
  // With a ware chosen no bag item is: the game's cursor is drawn only while the bag has the choice.
  itemGrid(body, ui.ware === null ? g : { ...g, cursor: null }, g.bag, BAG_X, BAG_Y, BAG_W, BAG_H)
  belt(body, g, BELT_X, BELT_Y)
  const c = windowPixels({ title: 'MERCHANT', gold: g.gold }, body.px)
  for (const b of boxes) drawBox(c, b)
  return c.px
}

/** What a box over the window would hide: every ware, bag item and filled belt slot, and the title bar. */
const shown = (g: Game): Weighted[] => [
  ...WARES.map((_, i) => ({ rect: wareRect(i), weight: 1 })),
  ...g.bag.map(i => ({ rect: itemRect(i), weight: 1 })),
  ...g.belt.flatMap((b, i) => (b === null ? [] : [{ rect: beltRect(i), weight: 1 }])),
  { rect: { x: 0, y: 0, w: WINDOW_W, h: WINDOW_TOP }, weight: 1 },
]

const entry = (key: string, label: string, why?: string): Run[] =>
  why === undefined ? [{ text: key, color: INK.gold, bold: true }, { text: ` ${label}` }] : [{ text: `${key} ${label}`, dim: true }, { text: `  ${why}`, color: OFF_CLASS }]

const wareMenu = (g: Game, ware: Ware): Run[][] => [entry('b', `Buy for ${priceOfWare(ware, g)}`, whyNot(g, ware))]
const itemMenu = (g: Game, item: Item): Run[][] => [entry('s', `Sell for ${priceOf(item)}`, item.locked === true ? 'locked' : undefined), entry('e', 'Equip', canWear(g, item) ? undefined : classLabel(item))]

const wareCard = (g: Game, ware: Ware): Run[][] => {
  const { kind, tier } = wareOf(ware)
  const price = priceOfWare(ware, g)
  return [
    [{ text: CONSUMABLES[kind][tier].name, bold: true }],
    [{ text: CONSUMABLES[kind][tier].about }],
    [{ text: 'Price ', dim: true }, { text: String(price), color: g.gold >= price ? INK.gold : OFF_CLASS }, { text: `   On your belt: ${heldOf(g, kind, tier)}`, dim: true }],
  ]
}

/** The boxes over the window: the chosen ware's or bag item's card near it, and its menu under the card when open. */
export const shopOverlay = (g: Game, ui: ShopUi): OverlayBox<'card' | 'menu'>[] => {
  if (ui.ware !== null) {
    const near = wareRect(WARES.indexOf(ui.ware))
    return cardWithMenu(ROWS, shown(g), near, boxShape('card', wareCard(g, ui.ware), RARITY_COLOR.common), ui.menu ? boxShape('menu', wareMenu(g, ui.ware), CURSOR) : undefined)
  }
  const item = chosenItem(g, ui)
  if (item === undefined) return []
  return cardWithMenu(ROWS, shown(g), itemRect(item), boxShape('card', card(g, item, undefined, true), RARITY_COLOR[item.rarity]), ui.menu ? boxShape('menu', itemMenu(g, item), CURSOR) : undefined)
}

const rectArgs = (r: Rect) => [r.x, r.y, r.w, r.h] as const

/** What lies under a window pixel: a ware, a bag item, a belt slot, the close box, or nothing. */
const hit = (g: Game, p: Pos) => {
  const ware = WARES.findIndex((_, i) => isInside(p, ...rectArgs(wareRect(i))))
  if (ware >= 0) return { kind: 'ware' as const, ware: WARES[ware]! }
  const item = g.bag.find(i => isInside(p, ...rectArgs(itemRect(i))))
  if (item !== undefined) return { kind: 'item' as const, item }
  const slot = g.belt.findIndex((_, i) => isInside(p, ...rectArgs(beltRect(i))))
  if (slot >= 0) return { kind: 'belt' as const, slot }
  return isInside(p, ...CLOSE_BOX) ? { kind: 'close' as const } : undefined
}
type Outcome = { ui: ShopUi; actions: Action[] }

/** A click with a menu open: its entry acts (when it can), anywhere else closes it. */
const menuClick = (g: Game, ui: ShopUi, at: Pos): Outcome => {
  const menu = shopOverlay(g, ui).find(b => b.role === 'menu')
  const row = menu !== undefined && at.x >= menu.x && at.x < menu.x + menu.w ? Math.floor(at.y) - menu.y - 1 : -1
  if (ui.ware !== null) {
    // The menu stays open after a buy, so more of the same are a click each.
    if (row === 0) return { ui, actions: whyNot(g, ui.ware) === undefined ? [{ kind: 'buy', ware: ui.ware }] : [] }
    return { ui: { ...ui, menu: false }, actions: [] }
  }
  const item = chosenItem(g, ui)
  return item === undefined ? { ui: { ...ui, menu: false }, actions: [] } : itemMenuClick(g, ui, item, row)
}

/** A row of a bag item's menu: Sell (not a locked one), Equip (only what the class wears); anywhere else closes it. */
const itemMenuClick = (g: Game, ui: ShopUi, item: Item, row: number): Outcome => {
  const closed = { ...ui, menu: false }
  if (row === 0) return item.locked === true ? { ui, actions: [] } : { ui: closed, actions: [{ kind: 'sell' }] }
  if (row === 1) return canWear(g, item) ? { ui: closed, actions: [{ kind: 'equip' }] } : { ui, actions: [] }
  return { ui: closed, actions: [] }
}

const click = (g: Game, ui: ShopUi, at: Pos, button: string): Outcome => {
  if (ui.menu) return menuClick(g, ui, at)
  // A click on a card lands on the card, not on what it covers.
  if (shopOverlay(g, ui).some(b => isInside(at, b.x, b.y, b.w, b.h))) return { ui, actions: [] }
  const h = hit(g, pixel(at))
  if (h?.kind === 'ware') {
    const again = ui.ware === h.ware
    return { ui: { ware: h.ware, menu: again || button === 'right' }, actions: g.cursor === null ? [] : [{ kind: 'deselect' }] }
  }
  if (h?.kind === 'item') {
    const again = ui.ware === null && g.cursor === h.item.id
    return { ui: { ware: null, menu: again || button === 'right' }, actions: again ? [] : [{ kind: 'select', id: h.item.id }] }
  }
  if (h?.kind === 'belt') return { ui, actions: [{ kind: 'use', slot: h.slot }] }
  if (h?.kind === 'close') return { ui: SHOP_UI_IDLE, actions: [{ kind: 'panel', panel: 'shop' }] }
  // Empty space lets go of what is chosen.
  return { ui: SHOP_UI_IDLE, actions: g.cursor === null ? [] : [{ kind: 'deselect' }] }
}

/** The window's next state and the game actions for one gesture; a drag does nothing here. */
export const shopGesture = (g: Game, ui: ShopUi, gesture: Gesture): Outcome => {
  if (gesture.type === 'drag') return { ui, actions: [] }
  const from = pixel(gesture.from)
  const at = pixel(gesture.at)
  if (Math.max(Math.abs(at.x - from.x), Math.abs(at.y - from.y)) >= CLICK_SLOP) return { ui, actions: [] }
  return click(g, ui, gesture.at, gesture.button)
}

/** The next ware on the shelf after the chosen one, for the key that steps through them. */
export const nextWare = (ui: ShopUi): ShopUi => ({ ware: WARES[(ui.ware === null ? 0 : WARES.indexOf(ui.ware) + 1) % WARES.length]!, menu: false })

/** What a click acts on, in window pixels: the wares not chosen, and the bag's items. */
export const shopHot = (g: Game, ui: ShopUi): Rect[] => [...WARES.flatMap((w, i) => (w === ui.ware ? [] : [wareRect(i)])), ...g.bag.map(i => itemOutline(i, BAG_X, WINDOW_TOP + BAG_Y))]

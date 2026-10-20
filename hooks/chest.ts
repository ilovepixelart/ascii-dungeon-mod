// The stash's window: the chest's items on the left, a row each in their tier's color; the bag on the right, as in
// the inventory. A row or a bag item is chosen with a click and shows its card; a second click (or a right-click)
// opens its menu: take it out, or store it. Pure: the click layer reports whole gestures, this decides the window's
// next state and the game actions to apply.
import type { Game, Item } from '../types'
import type { Action, Run } from './game'
import { STASH_SIZE } from './game'
import { BAG_H, BAG_W, RARITY_COLOR, fit } from './items'
import { canvas } from './canvas'
import { BAG_X, BAG_Y } from './inventory'
import { card } from './bagui'
import { CURSOR, OFF_CLASS, cellBox, itemGrid, itemOutline } from './pieces'
import { WINDOW_TOP, CLICK_SLOP, CLOSE_BOX, WINDOW_W, boxShape, cardWithMenu, drawBox, isInside, pixel, windowPixels } from './window'
import type { Gesture, OverlayBox, Rect, Weighted } from './window'
import { INK, SURFACE } from './ui/tokens'

/** What the window shows beyond the game: the stored item chosen (a bag item is chosen in the game), and its menu. */
export type ChestUi = { stored: number | null; menu: boolean }
export const CHEST_UI_IDLE: ChestUi = { stored: null, menu: false }

/** The window's height: the bag and a row of room under it. */
export const CHEST_H = WINDOW_TOP + BAG_Y + BAG_H * 7 + 1 + 3
const ROWS = CHEST_H / 2
/** The chest's list, in cells: a row an item, framed. */
const LIST: Rect = { x: 1, y: WINDOW_TOP / 2 + 1, w: BAG_X - 3, h: STASH_SIZE + 2 }

/** Why a bag item cannot be stored, or a stored one taken out, now; undefined when it can. */
export const whyNotStore = (g: Game) => (g.stashed.length >= STASH_SIZE ? 'the chest is full' : undefined)
export const whyNotTake = (g: Game, item: Item) => (fit(g.bag, item.w, item.h) === null ? 'no room in your bag' : undefined)

const chosenStored = (g: Game, ui: ChestUi) => g.stashed.find(i => i.id === ui.stored)
const chosenBag = (g: Game, ui: ChestUi) => (ui.stored === null ? g.bag.find(i => i.id === g.cursor) : undefined)

/** The chest's rows: each stored item's name in its tier's color, the chosen one marked; the rest of the room empty. */
const listLines = (g: Game, ui: ChestUi): Run[][] =>
  Array.from({ length: STASH_SIZE }, (_, i) => {
    const item = g.stashed[i]
    if (item === undefined) return [{ text: '-', dim: true }]
    const isChosen = item.id === ui.stored
    return [{ text: isChosen ? '> ' : '  ', color: CURSOR, bold: true }, { text: item.name, color: RARITY_COLOR[item.rarity], bold: isChosen }]
  })

const entry = (key: string, label: string, why?: string): Run[] =>
  why === undefined ? [{ text: key, color: INK.gold, bold: true }, { text: ` ${label}` }] : [{ text: `${key} ${label}`, dim: true }, { text: `  ${why}`, color: OFF_CLASS }]

const itemRect = (item: Item): Rect => cellBox(item, BAG_X, WINDOW_TOP + BAG_Y)
/** A stored item's row, in window pixels. */
const rowRect = (i: number): Rect => ({ x: LIST.x, y: (LIST.y + 1 + i) * 2, w: LIST.w, h: 2 })

/** What a card over the window would hide: the bag's items, the chest's list, the title bar. */
const shown = (g: Game): Weighted[] => [
  ...g.bag.map(i => ({ rect: itemRect(i), weight: 1 })),
  { rect: { x: LIST.x, y: LIST.y * 2, w: LIST.w, h: LIST.h * 2 }, weight: 1 },
  { rect: { x: 0, y: 0, w: WINDOW_W, h: WINDOW_TOP }, weight: 1 },
]

/** The boxes over the window: the chest's list, and the chosen item's card with its menu when open. */
export const chestOverlay = (g: Game, ui: ChestUi): OverlayBox[] => {
  const list: OverlayBox = { role: 'list', ...LIST, border: SURFACE.frame, lines: listLines(g, ui) }
  const stored = chosenStored(g, ui)
  if (stored !== undefined) {
    const near = rowRect(g.stashed.indexOf(stored))
    return [list, ...cardWithMenu(ROWS, shown(g), near, boxShape('card', card(g, stored, 'In your stash', true), RARITY_COLOR[stored.rarity]), ui.menu ? boxShape('menu', [entry('t', 'Take', whyNotTake(g, stored))], CURSOR) : undefined)]
  }
  const item = chosenBag(g, ui)
  if (item === undefined) return [list]
  return [list, ...cardWithMenu(ROWS, shown(g), itemRect(item), boxShape('card', card(g, item, undefined, true), RARITY_COLOR[item.rarity]), ui.menu ? boxShape('menu', [entry('s', 'Store', whyNotStore(g))], CURSOR) : undefined)]
}

/** The window's pixels: title, the chest's count over its list, the bag, and the frames of the boxes over them. */
export const chestPixels = (g: Game, ui: ChestUi, boxes: readonly OverlayBox[] = []): string[][] => {
  const body = canvas(WINDOW_W, CHEST_H - WINDOW_TOP)
  // With a stored item chosen no bag item is: the game's cursor is drawn only while the bag has the choice.
  itemGrid(body, ui.stored === null ? g : { ...g, cursor: null }, g.bag, BAG_X, BAG_Y, BAG_W, BAG_H)
  const c = windowPixels({ title: `STASH ${g.stashed.length}/${STASH_SIZE}` }, body.px)
  for (const b of boxes) drawBox(c, b)
  return c.px
}

type Outcome = { ui: ChestUi; actions: Action[] }

/** A click with a menu open: its entry acts when it can; anywhere else closes it. */
const menuClick = (g: Game, ui: ChestUi, at: { x: number; y: number }): Outcome => {
  const menu = chestOverlay(g, ui).find(b => b.role === 'menu')
  const onEntry = menu !== undefined && isInside(at, menu.x, menu.y + 1, menu.w, 1)
  const stored = chosenStored(g, ui)
  if (onEntry && stored !== undefined) return whyNotTake(g, stored) === undefined ? { ui: CHEST_UI_IDLE, actions: [{ kind: 'retrieve', id: stored.id }] } : { ui, actions: [] }
  if (onEntry && chosenBag(g, ui) !== undefined) return whyNotStore(g) === undefined ? { ui: CHEST_UI_IDLE, actions: [{ kind: 'store' }] } : { ui, actions: [] }
  return { ui: { ...ui, menu: false }, actions: [] }
}

const click = (g: Game, ui: ChestUi, at: { x: number; y: number }, button: string): Outcome => {
  if (ui.menu) return menuClick(g, ui, at)
  const p = pixel(at)
  const row = isInside(at, LIST.x + 1, LIST.y + 1, LIST.w - 2, STASH_SIZE) ? Math.floor(at.y) - LIST.y - 1 : -1
  const stored = g.stashed[row]
  if (stored !== undefined) {
    const again = ui.stored === stored.id
    return { ui: { stored: stored.id, menu: again || button === 'right' }, actions: g.cursor === null ? [] : [{ kind: 'deselect' }] }
  }
  // A click on a card lands on the card, not on what it covers.
  if (chestOverlay(g, ui).some(b => b.role !== 'list' && isInside(at, b.x, b.y, b.w, b.h))) return { ui, actions: [] }
  const item = g.bag.find(i => {
    const r = itemRect(i)
    return isInside(p, r.x, r.y, r.w, r.h)
  })
  if (item !== undefined) {
    const again = ui.stored === null && g.cursor === item.id
    return { ui: { stored: null, menu: again || button === 'right' }, actions: again ? [] : [{ kind: 'select', id: item.id }] }
  }
  if (isInside(p, ...CLOSE_BOX)) return { ui: CHEST_UI_IDLE, actions: [{ kind: 'panel', panel: 'stash' }] }
  return { ui: CHEST_UI_IDLE, actions: g.cursor === null ? [] : [{ kind: 'deselect' }] }
}

/** The window's next state and the game actions for one gesture; a drag does nothing here. */
export const chestGesture = (g: Game, ui: ChestUi, gesture: Gesture): Outcome => {
  if (gesture.type === 'drag') return { ui, actions: [] }
  const from = pixel(gesture.from)
  const at = pixel(gesture.at)
  if (Math.max(Math.abs(at.x - from.x), Math.abs(at.y - from.y)) >= CLICK_SLOP) return { ui, actions: [] }
  return click(g, ui, gesture.at, gesture.button)
}

/** The next stored item after the chosen one, for the key that steps through the chest. */
export const nextStored = (g: Game, ui: ChestUi): ChestUi => {
  if (g.stashed.length === 0) return CHEST_UI_IDLE
  const at = g.stashed.findIndex(i => i.id === ui.stored)
  return { stored: g.stashed[(at + 1) % g.stashed.length]!.id, menu: false }
}

/** What a click acts on, in window pixels: the bag's items. */
export const chestHot = (g: Game): Rect[] => g.bag.map(i => itemOutline(i, BAG_X, WINDOW_TOP + BAG_Y))

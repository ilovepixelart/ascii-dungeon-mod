// The stash's window: its tabs over the chest's list on the left, the bag on the right, as in the inventory. A tab
// shows its items a row each in their tier's color; the sets' and the Legendaries' tabs a row a place, filled or not;
// a tab not yet bought, its price and a Buy button. A row or a bag item is chosen with a click and shows its card; a
// second click opens its menu: take it out, or store it. A right-click takes it out or stores it at once. Pure: the click layer reports whole
// gestures, this decides the window's next state and the game actions to apply.
import type { Game, Item } from '../types'
import type { Action, Run } from './game'
import { LEGEND_PLACES, SET_PLACES, STASH_SIZE, tabItems, tabName, tabPrice, whereToStore, whyNotBuy } from './stash'
import type { StashTab } from './stash'
import { BAG_H, BAG_W, RARITY_COLOR, baseOf, fit } from './items'
import { BG, canvas, fill } from './canvas'
import { BAG_X, BAG_Y } from './inventory'
import { card } from './bagui'
import { BUTTON_H, CURSOR, OFF_CLASS, button, buttonBox, buttonW, cellBox, itemGrid, itemOutline, onCell } from './pieces'
import type { ButtonState } from './pieces'
import { WINDOW_TOP, CLICK_SLOP, CLOSE_BOX, TABS_H, WINDOW_W, boxShape, cardWithMenu, drawBox, isInside, pixel, tabGround, textTabBoxes, textTabRects, windowPixels, uncovered } from './window'
import type { Gesture, OverlayBox, Rect, Tab, Weighted } from './window'
import { INK, SURFACE } from './ui/tokens'
import { countText } from './names'

/** What the window shows beyond the game: the tab shown, the stored item chosen (a bag item is chosen in the game), and
 * its menu. */
export type ChestUi = { stored: number | null; menu: boolean; tab: StashTab }
export const CHEST_UI_IDLE: ChestUi = { stored: null, menu: false, tab: 0 }
/** Nothing chosen, on the tab shown. */
export const idleOn = (ui: ChestUi): ChestUi => ({ ...CHEST_UI_IDLE, tab: ui.tab })

/** The stash's tabs in the row's order: the four plain ones, then the sets' and the Legendaries'. */
export const STASH_TABS: readonly StashTab[] = [0, 1, 2, 3, 'sets', 'legends']
const label = (t: StashTab) => (t === 'sets' ? 'SETS' : t === 'legends' ? 'LEGENDS' : String(t + 1))
const TABS: readonly Tab[] = STASH_TABS.map(t => ({ label: label(t) }))
const tabIndex = (ui: ChestUi) => Math.max(0, STASH_TABS.indexOf(ui.tab))
const top = WINDOW_TOP

/** The window's height: the bag and a row of room under it. */
export const CHEST_H = WINDOW_TOP + BAG_Y + BAG_H * 7 + 1 + 3
const ROWS = CHEST_H / 2
/** The chest's list under the tabs and their rule, in cells: a row an item (a place), framed. */
const LIST: Rect = { x: 1, y: (top + TABS_H + 2) / 2, w: BAG_X - 3, h: STASH_SIZE + 2 }
/** A tab not bought: its price in a box of two rows, the Buy button under it. */
const OFFER_H = 4
const BUY = 'BUY'
const BUY_RECT: Rect = { x: LIST.x + 1, y: onCell((LIST.y + OFFER_H) * 2 + 2), w: buttonW(BUY), h: BUTTON_H }

/** Why a bag item cannot be stored, or a stored one taken out, now; undefined when it can. */
export const whyNotStore = (g: Game, item: Item, tab: StashTab = 0) => (whereToStore(g, item, typeof tab === 'number' ? tab : 0) === undefined ? 'the chest is full' : undefined)
export const whyNotTake = (g: Game, item: Item) => (fit(g.bag, item.w, item.h) === null ? 'no room in your bag' : undefined)

const isBought = (g: Game, tab: StashTab) => tabItems(g, tab) !== undefined

/** The rows of the tab shown, each its item or none: a plain tab's items then its empty room; the sets' and the
 * Legendaries' a row a place, its item when stored. */
const rowsOf = (g: Game, tab: StashTab): (Item | undefined)[] => {
  const held = tabItems(g, tab) ?? []
  if (tab === 'sets') return SET_PLACES.map(p => held.find(i => i.set === p.set && i.base === p.base))
  if (tab === 'legends') return LEGEND_PLACES.map(p => held.find(i => i.power === p.power))
  return Array.from({ length: STASH_SIZE }, (_, i) => held[i])
}
/** A row's place's name, on the sets' and the Legendaries' tabs, for a row with nothing there. */
const placeName = (tab: StashTab, row: number) => (tab === 'sets' ? SET_PLACES[row]?.name : tab === 'legends' ? LEGEND_PLACES[row]?.name : undefined)

const shownItems = (g: Game, ui: ChestUi) => (isBought(g, ui.tab) ? rowsOf(g, ui.tab) : [])
const chosenStored = (g: Game, ui: ChestUi) => shownItems(g, ui).find(i => i !== undefined && i.id === ui.stored)
const chosenBag = (g: Game, ui: ChestUi) => (ui.stored === null ? g.bag.find(i => i.id === g.cursor) : undefined)

/** The list's rows: each item's name in its tier's color, the chosen one marked; an empty place by its name, dim; the
 * rest of the room a dash. */
const listLines = (g: Game, ui: ChestUi): Run[][] =>
  rowsOf(g, ui.tab).map((item, i) => {
    if (item === undefined) return [{ text: `  ${placeName(ui.tab, i) ?? '-'}`, dim: true }]
    const isChosen = item.id === ui.stored
    // A name too long for the row shows as its base's: the card says the whole.
    const name = item.name.length <= LIST.w - 6 ? item.name : (baseOf(item.base)?.name ?? item.name.slice(0, LIST.w - 6))
    return [{ text: isChosen ? '> ' : '  ', color: CURSOR, bold: true }, { text: name, color: RARITY_COLOR[item.rarity], bold: isChosen }]
  })

/** A tab not bought, in words: what it costs, and why it cannot be bought now. */
const offerLines = (g: Game, tab: StashTab): Run[][] => {
  const why = whyNotBuy(g, tab)
  const name = tabName(tab)
  const head: Run[] = [{ text: `${name.charAt(0).toUpperCase()}${name.slice(1)} costs ` }, { text: `${tabPrice(tab)} gold`, color: INK.gold }, { text: '.' }]
  const reason = why === undefined ? 'Buy it to keep more, from hero to hero.' : why.startsWith('buy ') ? `${why.charAt(0).toUpperCase()}${why.slice(1)}.` : `You have ${countText(g.gold)} gold.`
  return [head, [{ text: reason, dim: true }]]
}
const buyState = (g: Game, tab: StashTab): ButtonState => (whyNotBuy(g, tab) === undefined ? 'ready' : 'off')

const entry = (key: string, text: string, why?: string): Run[] =>
  why === undefined ? [{ text: key, color: INK.gold, bold: true }, { text: ` ${text}` }] : [{ text: `${key} ${text}`, dim: true }, { text: `  ${why}`, color: OFF_CLASS }]

const itemRect = (item: Item): Rect => cellBox(item, BAG_X, WINDOW_TOP + BAG_Y)
/** A list row, in window pixels. */
const rowRect = (i: number): Rect => ({ x: LIST.x, y: (LIST.y + 1 + i) * 2, w: LIST.w, h: 2 })

/** What a card over the window would hide: the bag's items, the chest's list, the tabs and the title bar. */
const shown = (g: Game): Weighted[] => [
  ...g.bag.map(i => ({ rect: itemRect(i), weight: 1 })),
  { rect: { x: LIST.x, y: LIST.y * 2, w: LIST.w, h: LIST.h * 2 }, weight: 1 },
  { rect: { x: 0, y: 0, w: WINDOW_W, h: top + TABS_H + 2 }, weight: 1 },
]

/** The boxes over the window: the tabs' labels; the list (or a tab not bought, its price and Buy); the chosen item's
 * card with its menu when open. */
export const chestOverlay = (g: Game, ui: ChestUi): OverlayBox[] => {
  const tabs = textTabBoxes(TABS, tabIndex(ui), top, BG)
  if (!isBought(g, ui.tab)) {
    const offer: OverlayBox = { role: 'list', ...LIST, h: OFFER_H, border: SURFACE.frame, lines: offerLines(g, ui.tab) }
    const buy = BUY_RECT
    return [...tabs, offer, buttonBox(BUY, buy.x, buy.y, buyState(g, ui.tab))]
  }
  const list: OverlayBox = { role: 'list', ...LIST, border: SURFACE.frame, lines: listLines(g, ui) }
  const stored = chosenStored(g, ui)
  if (stored !== undefined) {
    const near = rowRect(rowsOf(g, ui.tab).indexOf(stored))
    return [...tabs, list, ...cardWithMenu(ROWS, shown(g), near, boxShape('card', card(g, stored, 'In your stash', true), RARITY_COLOR[stored.rarity]), ui.menu ? boxShape('menu', [entry('t', 'Take', whyNotTake(g, stored))], CURSOR) : undefined, WINDOW_W, [list])]
  }
  const item = chosenBag(g, ui)
  if (item === undefined) return [...tabs, list]
  return [...tabs, list, ...cardWithMenu(ROWS, shown(g), itemRect(item), boxShape('card', card(g, item, undefined, true), RARITY_COLOR[item.rarity]), ui.menu ? boxShape('menu', [entry('s', 'Store', whyNotStore(g, item, ui.tab))], CURSOR) : undefined, WINDOW_W, [list])]
}

/** The title: the stash, and what the tab shown holds of its room; a tab not bought, no count. */
export const chestTitle = (g: Game, ui: ChestUi) => {
  const held = tabItems(g, ui.tab)
  return held === undefined ? 'STASH' : `STASH ${held.length}/${rowsOf(g, ui.tab).length}`
}

/** The window's pixels: title and the tab's count; the tabs and their rule; the bag; a tab not bought, its Buy
 * button; the frames of the boxes over them. */
export const chestPixels = (g: Game, ui: ChestUi, boxes: readonly OverlayBox[] = []): string[][] => {
  const body = canvas(WINDOW_W, CHEST_H - top)
  tabGround(body, TABS, tabIndex(ui), 0)
  fill(body, LIST.x, TABS_H, LIST.w, 1, SURFACE.line)
  // With a stored item chosen no bag item is: the game's cursor is drawn only while the bag has the choice.
  itemGrid(body, ui.stored === null ? g : { ...g, cursor: null }, g.bag, BAG_X, BAG_Y, BAG_W, BAG_H)
  if (!isBought(g, ui.tab)) {
    const buy = BUY_RECT
    button(body, BUY, buy.x, buy.y - top, buyState(g, ui.tab))
  }
  const c = windowPixels({ title: chestTitle(g, ui) }, body.px)
  for (const b of boxes) if (b.role !== 'tabs' && b.role !== 'button') drawBox(c, b)
  return c.px
}

type Outcome = { ui: ChestUi; actions: Action[] }

/** A click with a menu open: its entry acts when it can; anywhere else closes it. */
const menuClick = (g: Game, ui: ChestUi, at: { x: number; y: number }): Outcome => {
  const menu = chestOverlay(g, ui).find(b => b.role === 'menu')
  const onEntry = menu !== undefined && isInside(at, menu.x, menu.y + 1, menu.w, 1)
  const stored = chosenStored(g, ui)
  if (onEntry && stored !== undefined) return whyNotTake(g, stored) === undefined ? { ui: idleOn(ui), actions: [{ kind: 'retrieve', id: stored.id }] } : { ui, actions: [] }
  const item = chosenBag(g, ui)
  if (onEntry && item !== undefined) return whyNotStore(g, item, ui.tab) === undefined ? { ui: idleOn(ui), actions: [storeOn(ui)] } : { ui, actions: [] }
  return { ui: { ...ui, menu: false }, actions: [] }
}

/** Storing from the window: on the plain tab shown, or the first with room (a set piece or a Legendary on its own tab). */
export const storeOn = (ui: ChestUi): Action => ({ kind: 'store', ...(typeof ui.tab === 'number' ? { tab: ui.tab } : {}) })

/** A click on the tabs, the list or Buy: the tab shown, a row chosen, a tab bought; undefined off them. */
const listClick = (g: Game, ui: ChestUi, at: { x: number; y: number }, button: string): Outcome | undefined => {
  const p = pixel(at)
  const tab = textTabRects(TABS, top).findIndex(r => isInside(p, r.x, r.y, r.w, r.h))
  if (tab >= 0) return { ui: { ...CHEST_UI_IDLE, tab: STASH_TABS[tab]! }, actions: g.cursor === null ? [] : [{ kind: 'deselect' }] }
  if (!isBought(g, ui.tab)) {
    const buy = BUY_RECT
    if (!isInside(p, buy.x, buy.y, buy.w, buy.h)) return undefined
    return { ui, actions: whyNotBuy(g, ui.tab) === undefined ? [{ kind: 'buyTab', tab: ui.tab }] : [] }
  }
  const row = isInside(at, LIST.x + 1, LIST.y + 1, LIST.w - 2, LIST.h - 2) ? Math.floor(at.y) - LIST.y - 1 : -1
  const stored = rowsOf(g, ui.tab)[row]
  if (stored === undefined) return undefined
  const letGo: Action[] = g.cursor === null ? [] : [{ kind: 'deselect' }]
  if (button === 'right' && whyNotTake(g, stored) === undefined) return { ui: idleOn(ui), actions: [...letGo, { kind: 'retrieve', id: stored.id }] }
  const again = ui.stored === stored.id
  return { ui: { ...ui, stored: stored.id, menu: again || button === 'right' }, actions: letGo }
}

/** A click on a bag item: chosen, again its menu; a right-click stores it at once, or opens the menu saying why not. */
const bagClick = (g: Game, ui: ChestUi, item: Item, button: string): Outcome => {
  if (button === 'right' && whyNotStore(g, item, ui.tab) === undefined) return { ui: idleOn(ui), actions: [{ kind: 'select', id: item.id }, storeOn(ui)] }
  const again = ui.stored === null && g.cursor === item.id
  return { ui: { ...ui, stored: null, menu: again || button === 'right' }, actions: again ? [] : [{ kind: 'select', id: item.id }] }
}

const click = (g: Game, ui: ChestUi, at: { x: number; y: number }, button: string): Outcome => {
  if (ui.menu) return menuClick(g, ui, at)
  const onList = listClick(g, ui, at, button)
  if (onList !== undefined) return onList
  // A click on a card lands on the card, not on what it covers.
  if (chestOverlay(g, ui).some(b => (b.role === 'card' || b.role === 'menu') && isInside(at, b.x, b.y, b.w, b.h))) return { ui, actions: [] }
  const p = pixel(at)
  const item = g.bag.find(i => {
    const r = itemRect(i)
    return isInside(p, r.x, r.y, r.w, r.h)
  })
  if (item !== undefined) return bagClick(g, ui, item, button)
  if (isInside(p, ...CLOSE_BOX)) return { ui: CHEST_UI_IDLE, actions: [{ kind: 'panel', panel: 'stash' }] }
  return { ui: idleOn(ui), actions: g.cursor === null ? [] : [{ kind: 'deselect' }] }
}

/** The window's next state and the game actions for one gesture; a drag does nothing here. */
export const chestGesture = (g: Game, ui: ChestUi, gesture: Gesture): Outcome => {
  if (gesture.type === 'drag') return { ui, actions: [] }
  const from = pixel(gesture.from)
  const at = pixel(gesture.at)
  if (Math.max(Math.abs(at.x - from.x), Math.abs(at.y - from.y)) >= CLICK_SLOP) return { ui, actions: [] }
  return click(g, ui, gesture.at, gesture.button)
}

/** The next stored item after the chosen one on the tab shown, for the key that steps through the chest. */
export const nextStored = (g: Game, ui: ChestUi): ChestUi => {
  const held = shownItems(g, ui).filter((i): i is Item => i !== undefined)
  if (held.length === 0) return idleOn(ui)
  const at = held.findIndex(i => i.id === ui.stored)
  return { ...ui, stored: held[(at + 1) % held.length]!.id, menu: false }
}

/** The tab after the one shown, round to the first, for the key that turns them. */
export const nextTab = (ui: ChestUi): ChestUi => ({ ...CHEST_UI_IDLE, tab: STASH_TABS[(tabIndex(ui) + 1) % STASH_TABS.length]! })

/**
 * What a click acts on, in window pixels: the other tabs, the rows holding an item, Buy while it can buy, and the bag's
 * items. With a menu open, nothing: a click anywhere but on the menu only closes it.
 */
export const chestHot = (g: Game, ui: ChestUi): Rect[] => {
  if (ui.menu) return []
  const tabs = textTabRects(TABS, top).filter((_, i) => i !== tabIndex(ui))
  const rows = shownItems(g, ui).flatMap((item, i) => (item === undefined ? [] : [rowRect(i)]))
  const buy = !isBought(g, ui.tab) && buyState(g, ui.tab) === 'ready' ? [BUY_RECT] : []
  return uncovered([...tabs, ...rows, ...buy, ...g.bag.map(i => itemOutline(i, BAG_X, WINDOW_TOP + BAG_Y))], chestOverlay(g, ui).filter(b => b.role === 'card' || b.role === 'menu'))
}

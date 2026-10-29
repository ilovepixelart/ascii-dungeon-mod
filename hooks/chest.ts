// The stash's window: its tabs in the title bar with the gold; the tab shown over the bag, each a grid the bag's size;
// the chosen item's card and its menu beside them. A plain tab's items lie on its grid as the bag's do; the sets' and
// the Legendaries' tabs are boards, a slot a place, each its piece's size, the piece in its tier's box or its shape
// dark; a tab not yet bought, its price and a Buy button. An item of the
// tab or the bag is chosen with a click and shows its card; a second click opens its menu: take it out, or store it.
// A right-click takes it out or stores it at once. Pure: the click layer reports whole gestures, this decides the
// window's next state and the game actions to apply.
import type { Game, Item } from '../types'
import type { Action, Run } from './game'
import { LEGEND_PLACES, SET_PLACES, specialTabOf, tabItems, tabName, tabPrice, whereToStore, whyNotBuy } from './stash'
import type { StashTab } from './stash'
import { BAG_H, BAG_W, baseOf, fit, fitsAt } from './items'
import { GRID, SLOT_BG, art, canvas, fill, frame } from './canvas'
import { CELL, ICONS } from './icons'
import { card } from './bagui'
import { BUTTON_H, CARD_FRAME, CURSOR, GHOST_INK, OFF_CLASS, button, buttonBox, buttonW, cellBox, centered, drawItem, gridBox, itemArt, itemGrid, runX, itemOutline, onCell } from './pieces'
import { glow } from './ui/kit'
import type { Pos } from './map'
import type { ButtonState } from './pieces'
import { CLICK_SLOP, CLOSE_BOX, WINDOW_TOP, WINDOW_W, boxShape, cardWithMenu, drawBox, isInside, pixel, remembered, textTabRects, uncovered, windowPixels } from './window'
import type { Chrome, Gesture, OverlayBox, Rect, Tab, Weighted } from './window'
import { INK, SURFACE } from './ui/tokens'
import { countText } from './names'

/** An item held by the pointer: from the tab shown or the bag, where on it it was grabbed, and the pointer, in window
 * pixels. */
type Held = { from: 'tab' | 'bag'; id: number; grab: Pos; at: Pos }
/** What the window shows beyond the game: the tab shown, the stored item chosen (a bag item is chosen in the game), its
 * menu, and an item being dragged. */
export type ChestUi = { stored: number | null; menu: boolean; tab: StashTab; drag?: Held }
export const CHEST_UI_IDLE: ChestUi = { stored: null, menu: false, tab: 0 }
/** Nothing chosen, on the tab shown. */
export const idleOn = (ui: ChestUi): ChestUi => ({ ...CHEST_UI_IDLE, tab: ui.tab })

/** The stash's tabs in the title bar's order: the four plain ones, then the sets' and the Legendaries'. */
export const STASH_TABS: readonly StashTab[] = [0, 1, 2, 3, 'sets', 'legends']
const label = (t: StashTab) => (t === 'sets' ? 'SETS' : t === 'legends' ? 'LEGENDS' : String(t + 1))
const TABS: readonly Tab[] = STASH_TABS.map(t => ({ label: label(t) }))
const tabIndex = (ui: ChestUi) => Math.max(0, STASH_TABS.indexOf(ui.tab))
const top = WINDOW_TOP
const chrome = (g: Game, ui: ChestUi): Chrome => ({ title: 'STASH', tabs: { items: TABS, chosen: tabIndex(ui) }, gold: g.gold })

/** A grid the bag's size, frame and all, in pixels. */
const GRID_W = BAG_W * CELL + 1
const GRID_H = BAG_H * CELL + 1
/** The tab's grid 2 under the title bar, the bag's 4 under it, both 4 in from the left, so a chosen item's white
 * brackets, 2 px outside it, keep 2 px clear of the window's edge; the cards beside them. */
const STASH_AT = { x: 4, y: 2 }
const BAG_AT = { x: STASH_AT.x, y: STASH_AT.y + GRID_H + 4 }
/** The window's height: the two grids and 2 px of room under them. */
export const CHEST_H = top + BAG_AT.y + GRID_H + 2
const ROWS = CHEST_H / 2
/** Where the tab's words go over its grid's place, in cells: the sets' and the Legendaries' rows, a tab's offer. */
const PANEL: Rect = { x: STASH_AT.x, y: (top + STASH_AT.y) / 2, w: GRID_W, h: GRID_H / 2 }
/** A tab not bought: its price in a box of two rows, the Buy button centred under it. */
const OFFER_H = 4
const BUY = 'BUY'
const BUY_RECT: Rect = { x: runX(buttonW(BUY), PANEL.x, PANEL.x + PANEL.w), y: onCell((PANEL.y + OFFER_H) * 2 + 2), w: buttonW(BUY), h: BUTTON_H }

/** Why a bag item cannot be stored, or a stored one taken out, now; undefined when it can. */
export const whyNotStore = (g: Game, item: Item, tab: StashTab = 0) => (whereToStore(g, item, typeof tab === 'number' ? tab : 0) === undefined ? 'the chest is full' : undefined)
export const whyNotTake = (g: Game, item: Item) => (fit(g.bag, item.w, item.h) === null ? 'no room in your bag' : undefined)

const isBought = (g: Game, tab: StashTab) => tabItems(g, tab) !== undefined
const isPlain = (tab: StashTab): tab is number => typeof tab === 'number'

/** The sets' and the Legendaries' places, each its item or none. */
const placesOf = (g: Game, tab: 'sets' | 'legends'): (Item | undefined)[] => {
  const held = tabItems(g, tab) ?? []
  return tab === 'sets' ? SET_PLACES.map(p => held.find(i => i.set === p.set && i.base === p.base)) : LEGEND_PLACES.map(p => held.find(i => i.power === p.power))
}

/** A place's slot on its board, in window pixels: its piece's cells with a frame round them, as in the bag. */
type Slot = Rect & { base: string }
const slotOf = (base: string, x: number, y: number): Slot => {
  const b = baseOf(base)
  return { base, x, y, w: (b?.w ?? 1) * CELL + 1, h: (b?.h ?? 1) * CELL + 1 }
}
/** The boards over the tab's grid's place, centred across the window inside its 4 px margins. */
const BOARD_LEFT = STASH_AT.x
const BOARD_RIGHT = WINDOW_W - STASH_AT.x
const BOARD_TOP = top + STASH_AT.y
/** The sets' board: a column a set, its weapon and armor side by side, 2 apart, its helm centred under them, 2 under;
 * the columns 6 apart. */
const SET_COLUMN = slotOf('sword', 0, 0).w + 2 + slotOf('plate', 0, 0).w
const SET_GAP = 6
const setSlots = (): Slot[] => {
  const sets = [...new Set(SET_PLACES.map(p => p.set))]
  const x0 = runX(sets.length * SET_COLUMN + (sets.length - 1) * SET_GAP, BOARD_LEFT, BOARD_RIGHT)
  return SET_PLACES.map(p => {
    const x = x0 + sets.indexOf(p.set) * (SET_COLUMN + SET_GAP)
    const [weapon, armor] = SET_PLACES.filter(q => q.set === p.set)
    const first = slotOf(weapon!.base, x, BOARD_TOP)
    if (p === weapon) return first
    if (p === armor) return slotOf(p.base, x + first.w + 2, BOARD_TOP)
    const helm = slotOf(p.base, 0, BOARD_TOP + first.h + 2)
    return { ...helm, x: x + Math.floor((SET_COLUMN - helm.w) / 2) }
  })
}
/** The Legendaries' board: their slots in a row, 4 apart. */
const LEGEND_GAP = 4
const legendSlots = (): Slot[] => {
  const slots = LEGEND_PLACES.map(p => slotOf(p.base, 0, BOARD_TOP))
  let x = runX(slots.reduce((n, s) => n + s.w, 0) + LEGEND_GAP * (slots.length - 1), BOARD_LEFT, BOARD_RIGHT)
  return slots.map(s => {
    const at = { ...s, x }
    x += s.w + LEGEND_GAP
    return at
  })
}
const boardOf = (tab: 'sets' | 'legends') => (tab === 'sets' ? setSlots() : legendSlots())

/** The items on the tab shown, in the order the chest's key steps through them. */
const shownItems = (g: Game, ui: ChestUi): Item[] =>
  !isBought(g, ui.tab) ? [] : isPlain(ui.tab) ? [...(tabItems(g, ui.tab) ?? [])].sort((a, b) => a.x - b.x || a.y - b.y) : placesOf(g, ui.tab).filter((i): i is Item => i !== undefined)
const chosenStored = (g: Game, ui: ChestUi) => shownItems(g, ui).find(i => i.id === ui.stored)
const chosenBag = (g: Game, ui: ChestUi) => (ui.stored === null ? g.bag.find(i => i.id === g.cursor) : undefined)

/** A tab not bought, in words: what it costs, and why it cannot be bought now. */
const offerLines = (g: Game, tab: StashTab): Run[][] => {
  const why = whyNotBuy(g, tab)
  const name = tabName(tab)
  const head: Run[] = [{ text: `${name.charAt(0).toUpperCase()}${name.slice(1)} costs ` }, { text: `${countText(tabPrice(tab))} gold`, color: INK.gold }, { text: '.' }]
  const reason = why === undefined ? 'Buy it to keep more, from hero to hero.' : why.startsWith('buy ') ? `${why.charAt(0).toUpperCase()}${why.slice(1)}.` : `You have ${countText(g.gold)} gold.`
  return [head, [{ text: reason, dim: true }]]
}
const buyState = (g: Game, tab: StashTab): ButtonState => (whyNotBuy(g, tab) === undefined ? 'ready' : 'off')

const entry = (key: string, text: string, why?: string): Run[] =>
  why === undefined ? [{ text: key, color: INK.gold, bold: true }, { text: ` ${text}` }] : [{ text: `${key} ${text}`, dim: true }, { text: `  ${why}`, color: OFF_CLASS }]

/** A bag item, and a plain tab's item, in window pixels. */
const bagRect = (item: Item): Rect => cellBox(item, BAG_AT.x, top + BAG_AT.y)
const storedRect = (item: Item): Rect => cellBox(item, STASH_AT.x, top + STASH_AT.y)
/** Where a stored item is in window pixels: its cells on a plain tab, inside its slot's frame on a board. */
const placeRect = (g: Game, ui: ChestUi, item: Item): Rect => {
  if (isPlain(ui.tab)) return storedRect(item)
  const s = boardOf(ui.tab)[placesOf(g, ui.tab).indexOf(item)]!
  return { x: s.x + 1, y: s.y + 1, w: s.w - 2, h: s.h - 2 }
}

/** What a card over the window would hide: both grids and their items, and the title bar. */
const shown = (g: Game, ui: ChestUi): Weighted[] => [
  ...(isPlain(ui.tab) ? [{ rect: gridBox(STASH_AT.x, top + STASH_AT.y), weight: 1 }] : boardOf(ui.tab).map(rect => ({ rect, weight: 1 }))),
  { rect: gridBox(BAG_AT.x, top + BAG_AT.y), weight: 1 },
  ...shownItems(g, ui).map(i => ({ rect: placeRect(g, ui, i), weight: 1 })),
  ...g.bag.map(i => ({ rect: bagRect(i), weight: 1 })),
  { rect: { x: 0, y: 0, w: WINDOW_W, h: top }, weight: 1 },
]

/** The words over the tab's place: a tab's offer, or none on a bought one. */
const panelBoxes = (g: Game, ui: ChestUi): OverlayBox[] =>
  isBought(g, ui.tab) ? [] : [{ role: 'list', ...PANEL, h: OFFER_H, border: SURFACE.frame, lines: offerLines(g, ui.tab) }, buttonBox(BUY, BUY_RECT.x, BUY_RECT.y, buyState(g, ui.tab))]

/** The boxes over the window: the tab's words; the chosen item's card with its menu when open. */
export const chestOverlay = remembered((g: Game, ui: ChestUi): OverlayBox[] => {
  const panel = panelBoxes(g, ui)
  if (ui.drag !== undefined) return panel
  const others = panel.filter(b => b.role === 'list')
  const stored = chosenStored(g, ui)
  if (stored !== undefined) {
    const menu = ui.menu ? boxShape('menu', [entry('t', 'Take', whyNotTake(g, stored))], CURSOR) : undefined
    return [...panel, ...cardWithMenu(ROWS, shown(g, ui), placeRect(g, ui, stored), boxShape('card', card(g, stored, 'In your stash', true), CARD_FRAME[stored.rarity]), menu, WINDOW_W, others)]
  }
  const item = chosenBag(g, ui)
  if (item === undefined) return panel
  const menu = ui.menu ? boxShape('menu', [entry('s', 'Store', whyNotStore(g, item, ui.tab))], CURSOR) : undefined
  return [...panel, ...cardWithMenu(ROWS, shown(g, ui), bagRect(item), boxShape('card', card(g, item, undefined, true), CARD_FRAME[item.rarity]), menu, WINDOW_W, others)]
})

/** A board: each slot framed as the bag's cells are, its piece in its tier's box (the chosen one bracketed), or its
 * piece's shape in the ghost's ink while none is stored there. */
const drawBoard = (body: ReturnType<typeof canvas>, g: Game, ui: ChestUi, tab: 'sets' | 'legends') => {
  const held = placesOf(g, tab)
  boardOf(tab).forEach((s, i) => {
    const y = s.y - top
    fill(body, s.x, y, s.w, s.h, SLOT_BG)
    frame(body, s.x, y, s.w, s.h, GRID)
    const item = held[i]
    if (item !== undefined) drawItem(body, { ...g, cursor: ui.stored }, item, s.x + 1, y + 1, s.w - 2, s.h - 2)
    else {
      const rows = ICONS[s.base]?.art ?? []
      const [ax, ay] = centered(rows, s.x + 1, y + 1, s.w - 2, s.h - 2)
      art(body, rows, ax, ay, GHOST_INK)
    }
  })
}

/** An item held: its old place a ghost, where it would land lit white where it fits and red where not, the item at
 * the pointer; in the body's pixels. */
const drawHeld = (body: ReturnType<typeof canvas>, g: Game, ui: ChestUi, drag: Held) => {
  const item = heldItem(g, ui, drag)
  if (item === undefined) return
  const rows = itemArt(item)
  const from = drag.from === 'bag' ? bagRect(item) : placeRect(g, ui, item)
  fill(body, from.x, from.y - top, from.w, from.h, SLOT_BG)
  const [gx, gy] = centered(rows, from.x, from.y - top, from.w, from.h)
  art(body, rows, gx, gy, GHOST_INK)
  const target = targetOf(g, ui, drag)
  if (target !== undefined && target.onto !== 'board') {
    const r = cellBox({ x: target.x, y: target.y, w: item.w, h: item.h }, target.onto === 'bag' ? BAG_AT.x : STASH_AT.x, target.onto === 'bag' ? BAG_AT.y : STASH_AT.y)
    glow(body, { x: r.x - 1, y: r.y - 1, w: r.w + 2, h: r.h + 2 }, target.fits ? CURSOR : OFF_CLASS)
  }
  const [ix, iy] = centered(rows, drag.at.x - drag.grab.x, drag.at.y - drag.grab.y - top, from.w, from.h)
  art(body, rows, ix, iy)
}

/** The window's pixels: the tabs and the gold in the title bar; a plain tab's grid with its items, else the place
 * its words go; the bag; a tab not bought, its Buy button; the frames of the boxes over them. */
export const chestPixels = (g: Game, ui: ChestUi, boxes: readonly OverlayBox[] = []): string[][] => {
  const body = canvas(WINDOW_W, CHEST_H - top)
  // Each grid draws its own choice: the stored one on the tab, the game's cursor in the bag while the bag has it.
  if (isPlain(ui.tab) && isBought(g, ui.tab)) itemGrid(body, { ...g, cursor: ui.stored }, tabItems(g, ui.tab) ?? [], STASH_AT.x, STASH_AT.y, BAG_W, BAG_H)
  else if (!isPlain(ui.tab) && isBought(g, ui.tab)) drawBoard(body, g, ui, ui.tab)
  itemGrid(body, ui.stored === null ? g : { ...g, cursor: null }, g.bag, BAG_AT.x, BAG_AT.y, BAG_W, BAG_H)
  if (!isBought(g, ui.tab)) button(body, BUY, BUY_RECT.x, BUY_RECT.y - top, buyState(g, ui.tab))
  if (ui.drag !== undefined) drawHeld(body, g, ui, ui.drag)
  const c = windowPixels(chrome(g, ui), body.px)
  for (const b of boxes) if (b.role !== 'button') drawBox(c, b)
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
export const storeOn = (ui: ChestUi): Action => ({ kind: 'store', ...(isPlain(ui.tab) ? { tab: ui.tab } : {}) })

/** The stored item under a pixel on the tab shown: a plain tab's at its cells, a special one's on its row. */
const storedAt = (g: Game, ui: ChestUi, p: { x: number; y: number }) => shownItems(g, ui).find(i => {
  const r = placeRect(g, ui, i)
  return isInside(p, r.x, r.y, r.w, r.h)
})

/** A click on a stored item: chosen, again its menu; a right-click takes it out at once, or opens the menu saying
 * why not. */
const storedClick = (g: Game, ui: ChestUi, stored: Item, button: string): Outcome => {
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

/** A click on the tabs or Buy: the tab shown, a tab bought; undefined off them. */
const tabClick = (g: Game, ui: ChestUi, p: { x: number; y: number }): Outcome | undefined => {
  const tab = textTabRects(TABS).findIndex(r => isInside(p, r.x, r.y, r.w, r.h))
  if (tab >= 0) return { ui: { ...CHEST_UI_IDLE, tab: STASH_TABS[tab]! }, actions: g.cursor === null ? [] : [{ kind: 'deselect' }] }
  if (isBought(g, ui.tab) || !isInside(p, BUY_RECT.x, BUY_RECT.y, BUY_RECT.w, BUY_RECT.h)) return undefined
  return { ui, actions: whyNotBuy(g, ui.tab) === undefined ? [{ kind: 'buyTab', tab: ui.tab }] : [] }
}

const click = (g: Game, ui: ChestUi, at: { x: number; y: number }, button: string): Outcome => {
  if (ui.menu) return menuClick(g, ui, at)
  const p = pixel(at)
  const onTab = tabClick(g, ui, p)
  if (onTab !== undefined) return onTab
  // A click on a card lands on the card, not on what it covers.
  if (chestOverlay(g, ui).some(b => (b.role === 'card' || b.role === 'menu') && isInside(at, b.x, b.y, b.w, b.h))) return { ui, actions: [] }
  const stored = storedAt(g, ui, p)
  if (stored !== undefined) return storedClick(g, ui, stored, button)
  const item = g.bag.find(i => {
    const r = bagRect(i)
    return isInside(p, r.x, r.y, r.w, r.h)
  })
  if (item !== undefined) return bagClick(g, ui, item, button)
  if (isInside(p, ...CLOSE_BOX)) return { ui: CHEST_UI_IDLE, actions: [{ kind: 'panel', panel: 'stash' }] }
  return { ui: idleOn(ui), actions: g.cursor === null ? [] : [{ kind: 'deselect' }] }
}

/** The item a press at `p` takes hold of, and where on it: one of the tab shown, or of the bag. */
const grabAt = (g: Game, ui: ChestUi, p: Pos): Omit<Held, 'at'> | undefined => {
  const stored = storedAt(g, ui, p)
  if (stored !== undefined) {
    const r = placeRect(g, ui, stored)
    return { from: 'tab', id: stored.id, grab: { x: p.x - r.x, y: p.y - r.y } }
  }
  const item = g.bag.find(i => {
    const r = bagRect(i)
    return isInside(p, r.x, r.y, r.w, r.h)
  })
  if (item === undefined) return undefined
  const r = bagRect(item)
  return { from: 'bag', id: item.id, grab: { x: p.x - r.x, y: p.y - r.y } }
}
const heldItem = (g: Game, ui: ChestUi, drag: Held) => (drag.from === 'bag' ? g.bag.find(i => i.id === drag.id) : shownItems(g, ui).find(i => i.id === drag.id))

/** Where a held item would land: the cells of a grid under its top-left, whether it fits there (over nothing but
 * itself), or a board, when it is a bag item of that board's; undefined off them. */
type Target = { onto: 'tab' | 'bag'; x: number; y: number; fits: boolean } | { onto: 'board'; fits: boolean }
const targetOf = (g: Game, ui: ChestUi, drag: Held): Target | undefined => {
  const item = heldItem(g, ui, drag)
  if (item === undefined) return undefined
  const onGrid = (onto: 'tab' | 'bag', at: { x: number; y: number }, held: readonly Item[]): Target | undefined => {
    if (!isInside(drag.at, at.x, top + at.y, GRID_W, GRID_H)) return undefined
    const x = Math.round((drag.at.x - drag.grab.x - at.x - 1) / CELL)
    const y = Math.round((drag.at.y - drag.grab.y - top - at.y - 1) / CELL)
    return { onto, x, y, fits: fitsAt(held, item.w, item.h, x, y, drag.from === onto ? item.id : undefined) }
  }
  const bag = onGrid('bag', BAG_AT, g.bag)
  if (bag !== undefined || !isBought(g, ui.tab)) return bag
  if (isPlain(ui.tab)) return onGrid('tab', STASH_AT, tabItems(g, ui.tab) ?? [])
  if (!isInside(drag.at, BOARD_LEFT, BOARD_TOP, BOARD_RIGHT - BOARD_LEFT, GRID_H)) return undefined
  return { onto: 'board', fits: drag.from === 'bag' && specialTabOf(item) === ui.tab && whyNotStore(g, item, ui.tab) === undefined }
}

/** A held item let go: stored, taken, moved or placed where it lands and fits; anywhere else, nothing. */
const dropOf = (g: Game, ui: ChestUi, drag: Held): Action[] => {
  const target = targetOf(g, ui, drag)
  if (target === undefined || !target.fits) return []
  if (target.onto === 'board') return [{ kind: 'select', id: drag.id }, storeOn(ui)]
  const at = { x: target.x, y: target.y }
  if (drag.from === 'bag') return target.onto === 'bag' ? [{ kind: 'place', id: drag.id, ...at }] : [{ kind: 'select', id: drag.id }, { kind: 'store', tab: ui.tab as number, at }]
  return target.onto === 'bag' ? [{ kind: 'retrieve', id: drag.id, at }] : [{ kind: 'moveStashed', id: drag.id, ...at }]
}

/** The window's next state and the game actions for one gesture: a drag holds the item pressed, its release drops it;
 * a press that barely moved is a click. */
export const chestGesture = (g: Game, ui: ChestUi, gesture: Gesture): Outcome => {
  const from = pixel(gesture.from)
  const at = pixel(gesture.at)
  const moved = Math.max(Math.abs(at.x - from.x), Math.abs(at.y - from.y)) >= CLICK_SLOP
  const grabbed = moved && !ui.menu ? grabAt(g, ui, from) : undefined
  const settled = { ...ui, drag: undefined }
  if (gesture.type === 'drag') return grabbed === undefined ? { ui: settled, actions: [] } : { ui: { ...settled, menu: false, drag: { ...grabbed, at } }, actions: [] }
  if (grabbed !== undefined) return { ui: idleOn(ui), actions: dropOf(g, ui, { ...grabbed, at }) }
  if (moved) return { ui: settled, actions: [] }
  return click(g, settled, gesture.at, gesture.button)
}

/** The next stored item after the chosen one on the tab shown, for the key that steps through the chest. */
export const nextStored = (g: Game, ui: ChestUi): ChestUi => {
  const held = shownItems(g, ui)
  if (held.length === 0) return idleOn(ui)
  const at = held.findIndex(i => i.id === ui.stored)
  return { ...ui, stored: held[(at + 1) % held.length]!.id, menu: false }
}

/** The tab after the one shown, round to the first, for the key that turns them. */
export const nextTab = (ui: ChestUi): ChestUi => ({ ...CHEST_UI_IDLE, tab: STASH_TABS[(tabIndex(ui) + 1) % STASH_TABS.length]! })

/**
 * What a click acts on, in window pixels: the other tabs, the tab's items, Buy while it can buy, and the bag's items.
 * With a menu open, nothing: a click anywhere but on the menu only closes it.
 */
export const chestHot = (g: Game, ui: ChestUi): Rect[] => {
  if (ui.menu) return []
  const tabs = textTabRects(TABS).filter((_, i) => i !== tabIndex(ui))
  const stored = shownItems(g, ui).map(i => (isPlain(ui.tab) ? itemOutline(i, STASH_AT.x, top + STASH_AT.y) : boardOf(ui.tab)[placesOf(g, ui.tab).indexOf(i)]!))
  const buy = !isBought(g, ui.tab) && buyState(g, ui.tab) === 'ready' ? [BUY_RECT] : []
  return uncovered([...tabs, ...stored, ...buy, ...g.bag.map(i => itemOutline(i, BAG_AT.x, top + BAG_AT.y))], chestOverlay(g, ui).filter(b => b.role === 'card' || b.role === 'menu'))
}

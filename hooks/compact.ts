// The inventory for a pane 80 to 104 columns wide, too narrow for the worn slots beside the bag: the bag and the belt
// in pixels as in the full screen, what is worn as a text list beside them. A click on a worn row takes it off; a bag
// item is chosen, compared, opened and moved as in the full screen. Pure, like `bagui.ts`.
import type { Game, Item, Slot } from '../types'
import type { Action, Run } from './game'
import { BAG_H, BAG_W, RARITY_COLOR, SLOTS, baseOf, canWear, classLabel, fitsAt } from './items'
import { wrap } from './talk'
import { beltHot, removable } from './inventory'
import { canvas } from './canvas'
import { CELL } from './icons'
import { card } from './bagui'
import type { BagUi } from './bagui'
import { BAG_UI_IDLE } from './bagui'
import { CURSOR, OFF_CLASS, belt, beltSlotRect, cellBox, itemGrid, itemOutline } from './pieces'
import { WINDOW_TOP, CLICK_SLOP, boxShape, cardWithMenu, closeBoxOf, drawBox, isInside, pixel, windowPixels, uncovered } from './window'
import type { Gesture, OverlayBox, Rect, Weighted } from './window'
import type { Pos } from './map'
import { INK, SURFACE } from './ui/tokens'

/** The compact screen's width, and the narrowest pane it is drawn in. */
export const COMPACT_W = 80
const BAG_X = 1
const BAG_Y = 2
const BELT_X = 1
const BELT_Y = BAG_Y + BAG_H * CELL + 1 + 3
const LIST_X = BAG_X + BAG_W * CELL + 3
/** The screen's height in pixels: the bag, the belt, a pixel of room. */
export const COMPACT_H = WINDOW_TOP + BELT_Y + 10 + 2
const ROWS = COMPACT_H / 2
const SLOT_WORD: Readonly<Record<Slot, string>> = { weapon: 'Weapon', offhand: 'Off-hand', helm: 'Helm', armor: 'Armor', boots: 'Boots', ring: 'Ring', amulet: 'Amulet' }
/** The worn list, in cells: two rows a slot, its name and what is worn there. */
const LIST: Rect = { x: LIST_X, y: WINDOW_TOP / 2 + 1, w: COMPACT_W - LIST_X, h: SLOTS.length * 2 + 2 }
const CLOSE = closeBoxOf(COMPACT_W)

const itemRect = (item: Item): Rect => cellBox(item, BAG_X, WINDOW_TOP + BAG_Y)
const beltRect = (i: number): Rect => beltSlotRect(BELT_X, WINDOW_TOP + BELT_Y, i)

/** A row of the worn list holds this many characters: the box's width less its frame and a cell of room each side. */
const LIST_ROW = LIST.w - 4

/**
 * A slot's two rows: its name, then what is worn there; a worn name too long for a row takes both rows, broken at its
 * spaces, and one too long for both shows as its base's name. The bag's card says the whole.
 */
const slotLines = (slot: Slot, worn: Item | undefined): Run[][] => {
  if (worn === undefined) return [[{ text: SLOT_WORD[slot], dim: true }], [{ text: '-', dim: true }]]
  const name = (text: string): Run[] => [{ text, color: RARITY_COLOR[worn.rarity] }]
  if (worn.name.length <= LIST_ROW) return [[{ text: SLOT_WORD[slot], dim: true }], name(worn.name)]
  const rows = wrap([name(worn.name)], LIST_ROW)
  return rows.length <= 2 ? rows : [[{ text: SLOT_WORD[slot], dim: true }], name(baseOf(worn.base)?.name ?? worn.name.slice(0, LIST_ROW))]
}

const listLines = (g: Game): Run[][] => SLOTS.flatMap(slot => slotLines(slot, g.gear[slot]))

const menuLines = (g: Game, item: Item, confirm: boolean): Run[][] => [
  canWear(g, item) ? [{ text: 'e', color: INK.gold, bold: true }, { text: ' Equip' }] : [{ text: 'e Equip', dim: true }, { text: `  ${classLabel(item)}`, color: OFF_CLASS }],
  item.locked === true
    ? [{ text: 'd Destroy', dim: true }, { text: '  locked', color: OFF_CLASS }]
    : [{ text: 'd', color: INK.gold, bold: true }, confirm ? { text: ' Destroy? again', color: OFF_CLASS, bold: true } : { text: ' Destroy' }],
  [{ text: 'g', color: INK.gold, bold: true }, { text: item.locked === true ? ' Unlock' : ' Lock' }],
]

/** What a card would hide: the bag's items, the worn list, the filled belt slots, the title bar. */
const shown = (g: Game): Weighted[] => [
  ...g.bag.map(i => ({ rect: itemRect(i), weight: 1 })),
  { rect: { x: LIST.x, y: LIST.y * 2, w: LIST.w, h: LIST.h * 2 }, weight: 1 },
  ...g.belt.flatMap((b, i) => (b === null ? [] : [{ rect: beltRect(i), weight: 1 }])),
  { rect: { x: 0, y: 0, w: COMPACT_W, h: WINDOW_TOP }, weight: 1 },
]

/** The boxes over the screen: the worn list, and the chosen item's card with its menu when open. */
export const compactOverlay = (g: Game, ui: BagUi): OverlayBox[] => {
  const list: OverlayBox = { role: 'worn', ...LIST, border: SURFACE.frame, lines: listLines(g) }
  const item = g.bag.find(i => i.id === g.cursor)
  if (item === undefined || ui.drag !== null) return [list]
  const menu = ui.menu?.id === item.id ? boxShape('menu', menuLines(g, item, ui.menu.confirm), CURSOR) : undefined
  return [list, ...cardWithMenu(ROWS, shown(g), itemRect(item), boxShape('card', card(g, item, undefined, true), RARITY_COLOR[item.rarity]), menu, COMPACT_W)]
}

/** The screen's pixels: title and gold, the bag, the belt, and the frames of the boxes over them. */
export const compactPixels = (g: Game, boxes: readonly OverlayBox[] = []): string[][] => {
  const body = canvas(COMPACT_W, COMPACT_H - WINDOW_TOP)
  itemGrid(body, g, g.bag, BAG_X, BAG_Y, BAG_W, BAG_H)
  belt(body, g, BELT_X, BELT_Y)
  const c = windowPixels({ title: 'INVENTORY', gold: g.gold }, body.px, COMPACT_W)
  for (const b of boxes) drawBox(c, b)
  return c.px
}

/** What lies under a screen pixel (and the cell it is in, for the list): a bag item, a worn row, a belt slot, the close box. */
const hit = (g: Game, p: Pos, cell: Pos) => {
  const item = g.bag.find(i => isInside(p, itemRect(i).x, itemRect(i).y, itemRect(i).w, itemRect(i).h))
  if (item !== undefined) return { kind: 'bag' as const, item }
  if (isInside(cell, LIST.x + 1, LIST.y + 1, LIST.w - 2, LIST.h - 2)) {
    const slot = SLOTS[Math.floor((Math.floor(cell.y) - LIST.y - 1) / 2)]
    return slot === undefined || g.gear[slot] === undefined ? undefined : { kind: 'worn' as const, slot }
  }
  const slot = g.belt.findIndex((_, i) => isInside(p, beltRect(i).x, beltRect(i).y, beltRect(i).w, beltRect(i).h))
  if (slot >= 0) return { kind: 'belt' as const, slot }
  return isInside(p, ...CLOSE) ? { kind: 'close' as const } : undefined
}

type Outcome = { ui: BagUi; actions: Action[] }

const menuClick = (g: Game, ui: BagUi, at: Pos): Outcome => {
  const menu = compactOverlay(g, ui).find(b => b.role === 'menu')
  const item = g.bag.find(i => i.id === ui.menu?.id)
  const entry = menu !== undefined && at.x >= menu.x && at.x < menu.x + menu.w ? Math.floor(at.y) - menu.y - 1 : -1
  if (item === undefined || entry < 0 || entry > 2) return { ui: BAG_UI_IDLE, actions: [] }
  if (entry === 0) return canWear(g, item) ? { ui: BAG_UI_IDLE, actions: [{ kind: 'equip' }] } : { ui, actions: [] }
  if (entry === 2) return { ui: BAG_UI_IDLE, actions: [{ kind: 'lock' }] }
  if (item.locked === true) return { ui, actions: [] }
  return ui.menu?.confirm === true ? { ui: BAG_UI_IDLE, actions: [{ kind: 'destroy' }] } : { ui: { ...ui, menu: { id: item.id, confirm: true } }, actions: [] }
}

/** A bag item dragged to a cell: placed there when it fits, else left where it was. */
const dropAt = (g: Game, item: Item, from: Pos, at: Pos): Action[] => {
  const x = item.x + Math.round((at.x - from.x) / CELL)
  const y = item.y + Math.round((at.y - from.y) / CELL)
  return fitsAt(g.bag, item.w, item.h, x, y, item.id) ? [{ kind: 'place', id: item.id, x, y }] : []
}

/** The screen's next state and the game actions for one gesture. */
export const compactGesture = (g: Game, ui: BagUi, gesture: Gesture): Outcome => {
  const from = pixel(gesture.from)
  const at = pixel(gesture.at)
  const moved = Math.max(Math.abs(at.x - from.x), Math.abs(at.y - from.y)) >= CLICK_SLOP
  const grabbed = hit(g, from, gesture.from)
  if (gesture.type === 'drag') return { ui, actions: [] }
  if (moved) return { ui: BAG_UI_IDLE, actions: grabbed?.kind === 'bag' ? dropAt(g, grabbed.item, from, at) : [] }
  if (ui.menu !== null) return menuClick(g, ui, gesture.at)
  if (compactOverlay(g, ui).some(b => b.role !== 'worn' && isInside(gesture.at, b.x, b.y, b.w, b.h))) return { ui, actions: [] }
  return clickOn(g, ui, hit(g, at, gesture.at), gesture.type === 'release' && gesture.button === 'right')
}

/**
 * A click on what lies under it: a bag item selected, or its menu opened (a second click, or a right-click); worn gear
 * taken off; a belt slot used; the close box; anywhere else lets the selection go.
 */
const clickOn = (g: Game, ui: BagUi, h: ReturnType<typeof hit>, isRight: boolean): Outcome => {
  if (h?.kind === 'bag') {
    const menu = { id: h.item.id, confirm: false }
    if (isRight) return { ui: { ...ui, menu }, actions: [{ kind: 'select', id: h.item.id }] }
    return h.item.id === g.cursor ? { ui: { ...ui, menu }, actions: [] } : { ui, actions: [{ kind: 'select', id: h.item.id }] }
  }
  if (h?.kind === 'worn') return { ui, actions: [{ kind: 'unequip', slot: h.slot }] }
  if (h?.kind === 'belt') return { ui, actions: [{ kind: 'use', slot: h.slot }] }
  if (h?.kind === 'close') return { ui, actions: [{ kind: 'panel', panel: 'bag' }] }
  return { ui, actions: g.cursor === null ? [] : [{ kind: 'deselect' }] }
}

/** A worn slot's two rows of the list, in window pixels: where a click takes its piece off. */
const wornRow = (i: number): Rect => ({ x: LIST.x + 1, y: (LIST.y + 1 + 2 * i) * 2, w: LIST.w - 2, h: 4 })

/** What a click acts on, in window pixels: the bag's items, the worn rows whose piece can come off, the belt. */
export const compactHot = (g: Game, ui: BagUi): Rect[] => {
  const off = removable(g)
  const hot = [
    ...g.bag.map(i => itemOutline(i, BAG_X, WINDOW_TOP + BAG_Y)),
    ...SLOTS.flatMap((s, i) => (off.gear[s] === undefined ? [] : [wornRow(i)])),
    ...beltHot(g, BELT_X, WINDOW_TOP + BELT_Y),
  ]
  return uncovered(hot, compactOverlay(g, ui).filter(b => b.role !== 'worn'))
}

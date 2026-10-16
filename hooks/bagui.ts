// The inventory screen under the mouse: the popovers and the menu laid out over the panel, and what a gesture does.
// Pure: the click layer reports whole gestures, this decides the screen's next state and the game actions to apply.
import type { Game, Item, Slot } from '../types'
import type { Action, Run } from './game'
import { CELL } from './icons'
import { BAG_X, BAG_Y, BELT_STEP, BELT_X, BELT_Y, CLOSE_BOX, CURSOR, INV_H, INV_TOP, OFF_CLASS, UPGRADE, WORN_SLOTS, dropTarget } from './inventory'
import type { Drag } from './inventory'
import { POWERS, RARITY_COLOR, RARITY_NAME, TRIGGERS, canWear, classLabel, deltaLines, describe, isTriggerWornElsewhere, priceOf } from './items'
import { wrap } from './talk'
import type { Pos } from './map'
import { beltSlotRect } from './pieces'
import { CLICK_SLOP, boxShape, coverage as coverageOf, isInside, pixel, place } from './window'
import type { Gesture, OverlayBox as Box, Rect } from './window'

export type { Gesture } from './window'

/** What the screen shows beyond the game: an open menu (and whether Destroy is armed), an item being dragged. */
export type BagUi = { menu: { id: number; confirm: boolean } | null; drag: Drag | null }
export const BAG_UI_IDLE: BagUi = { menu: null, drag: null }

/** A framed text box over the panel, in cells from the panel's top-left. */
export type OverlayBox = Box<'worn' | 'item' | 'menu'>

const SLOT_WORD: Readonly<Record<Slot, string>> = { weapon: 'Weapon', offhand: 'Off-hand', helm: 'Helm', armor: 'Armor', boots: 'Boots', ring: 'Ring', amulet: 'Amulet' }
const WORN_BORDER = '#6b6258'
const KEY_INK = '#ffd34d'

/** The stat a line is about, without its number or arrow: '+7 def' and '-4 HP v' both give their label. */
const statKey = (text: string) => text.replace(/^[+-]?\d+%?\s*/, '').replace(/ [\^v]$/, '')

/** One line a stat, with its change against what is worn when comparing; stats only the worn item has come last, as losses. */
const statLines = (g: Game, item: Item, compare: boolean): Run[][] => {
  const own = describe(item) === 'no bonuses' ? [] : describe(item).split('  ')
  const changes = compare ? deltaLines(g, item) : []
  const width = Math.max(0, ...own.map(s => s.length))
  const change = (d: { text: string; isGain: boolean }): Run => ({ text: d.text.replace(/ [^ ]+ ([\^v])$/, ' $1'), color: d.isGain ? UPGRADE : OFF_CLASS, bold: true })
  const lines: Run[][] = own.map(s => {
    const d = changes.find(c => statKey(c.text) === statKey(s))
    return d === undefined ? [{ text: s }] : [{ text: s.padEnd(width + 2) }, change(d)]
  })
  for (const d of changes) if (!own.some(s => statKey(s) === statKey(d.text))) lines.push([{ text: statKey(d.text).padEnd(width + 2), dim: true }, change(d)])
  return lines
}

/** An item's popover lines: an optional title, name, tier and slot, its stats (against what is worn when comparing), power, price. */
export const card = (g: Game, item: Item, title: string | undefined, compare: boolean): Run[][] => [
  ...(title === undefined ? [] : [[{ text: title, dim: true }]]),
  [{ text: item.name, color: RARITY_COLOR[item.rarity], bold: true }],
  [{ text: `${RARITY_NAME[item.rarity]} ${SLOT_WORD[item.slot]}`, color: RARITY_COLOR[item.rarity] }, ...(canWear(g, item) ? [] : [{ text: `  ${classLabel(item)}`, color: OFF_CLASS, bold: true }])],
  ...statLines(g, item, compare),
  ...(item.power === undefined ? [] : [[{ text: POWERS[item.power] ?? item.power, color: RARITY_COLOR.legendary }]]),
  ...triggerLines(g, item),
  [{ text: 'Sells for ', dim: true }, { text: String(priceOf(item)), color: KEY_INK }],
]

/** A card's text width for what a trigger does, so the card stays as narrow as its other lines. */
const TRIGGER_W = 29

/** A trigger's lines on a card: its name in the item's tier color, what it does wrapped under it, and a note when another worn piece has it. */
const triggerLines = (g: Game, item: Item): Run[][] => {
  if (item.trigger === undefined) return []
  const t = TRIGGERS[item.trigger]
  return [
    [{ text: t.name, color: RARITY_COLOR[item.rarity], bold: true }],
    ...wrap([[{ text: t.does, dim: true }]], TRIGGER_W),
    ...(isTriggerWornElsewhere(g, item) ? [[{ text: 'Same trigger as worn: no effect', color: OFF_CLASS }]] : []),
  ]
}

/** The screen's height in cells. */
const ROWS = (INV_TOP + INV_H) / 2

const menuLines = (g: Game, item: Item, confirm: boolean): Run[][] => [
  canWear(g, item) ? [{ text: 'e', color: KEY_INK, bold: true }, { text: ' Equip' }] : [{ text: 'e Equip', dim: true }, { text: `  ${classLabel(item)}`, color: OFF_CLASS }],
  item.locked === true
    ? [{ text: 'd Destroy', dim: true }, { text: '  locked', color: OFF_CLASS }]
    : [{ text: 'd', color: KEY_INK, bold: true }, confirm ? { text: ' Destroy? click again', color: OFF_CLASS, bold: true } : { text: ' Destroy' }],
  [{ text: 'g', color: KEY_INK, bold: true }, { text: item.locked === true ? ' Unlock' : ' Lock' }],
]

/** Covering an item being compared costs this much against one pixel of any other: it is never worth it. */
const KEEP = 100000

/**
 * What a box would hide: each pixel of a bag item, worn piece or filled belt slot counts 1, the two items being
 * compared KEEP. The result is the weight under a box.
 */
export const coverage = (g: Game, keep: readonly Rect[]) => coverageOf(ROWS, [
  ...g.bag.map(i => ({ rect: { x: BAG_X + i.x * CELL, y: INV_TOP + BAG_Y + i.y * CELL, w: i.w * CELL, h: i.h * CELL }, weight: 1 })),
  ...(Object.keys(WORN_SLOTS) as Slot[]).filter(slot => g.gear[slot] !== undefined).map(slot => {
    const [x, y, w, h] = WORN_SLOTS[slot]
    return { rect: { x, y: INV_TOP + y, w, h }, weight: 1 }
  }),
  ...g.belt.flatMap((b, i) => (b === null ? [] : [{ rect: beltSlotRect(BELT_X, INV_TOP + BELT_Y, i), weight: 1 }])),
  ...keep.map(rect => ({ rect, weight: KEEP })),
])

/**
 * The boxes over the panel while an item is selected: what is worn in its slot, titled Equipped, near that slot; the
 * item's card near the item; and its menu, when open, near the card. Each goes where it hides the least, never on
 * the item or on what it is compared with.
 */
export const bagOverlay = (g: Game, ui: BagUi): OverlayBox[] => {
  const item = g.bag.find(i => i.id === g.cursor)
  if (item === undefined || ui.drag !== null) return []
  const own: Rect = { x: BAG_X + item.x * CELL, y: INV_TOP + BAG_Y + item.y * CELL, w: item.w * CELL, h: item.h * CELL }
  const worn = g.gear[item.slot]
  const [wx, wy, ww, wh] = WORN_SLOTS[item.slot]
  const wornRect: Rect = { x: wx, y: INV_TOP + wy, w: ww, h: wh }
  const cost = coverage(g, worn === undefined ? [own] : [own, wornRect])
  const boxes: OverlayBox[] = []
  const put = (role: OverlayBox['role'], lines: Run[][], border: string, near: Rect) => {
    const shape = boxShape(role, lines, border)
    const at = place(cost, ROWS, boxes, near, shape.w, shape.h)
    const box = { ...shape, ...at }
    boxes.push(box)
    return box
  }
  if (worn !== undefined) put('worn', card(g, worn, 'Equipped', false), WORN_BORDER, wornRect)
  const mine = put('item', card(g, item, worn === undefined ? 'Nothing worn here' : undefined, true), RARITY_COLOR[item.rarity], own)
  if (ui.menu?.id === item.id) put('menu', menuLines(g, item, ui.menu.confirm), CURSOR, { x: mine.x, y: (mine.y + mine.h) * 2, w: mine.w, h: 2 })
  return boxes
}

/** What lies under a screen pixel: a bag item, worn gear, a belt slot, the close box, or nothing. */
const hit = (g: Game, p: Pos) => {
  const q = { x: p.x, y: p.y - INV_TOP }
  const item = g.bag.find(i => isInside(q, BAG_X + i.x * CELL + 1, BAG_Y + i.y * CELL + 1, i.w * CELL - 1, i.h * CELL - 1))
  if (item !== undefined) return { kind: 'bag' as const, item }
  const slot = (Object.keys(WORN_SLOTS) as Slot[]).find(s => isInside(q, ...WORN_SLOTS[s]))
  if (slot !== undefined) return g.gear[slot] === undefined ? undefined : { kind: 'worn' as const, slot }
  const belt = g.belt.findIndex((_, i) => {
    const r = beltSlotRect(BELT_X, BELT_Y, i)
    return isInside(q, r.x, r.y, r.w, r.h)
  })
  if (belt >= 0) return { kind: 'belt' as const, slot: belt }
  return isInside(p, ...CLOSE_BOX) ? { kind: 'close' as const } : undefined
}

/** Where the item under a pixel was grabbed: its source, and the pointer's offset from its box's top-left. */
const grabAt = (g: Game, p: Pos): Pick<Drag, 'source' | 'grab'> | undefined => {
  const h = hit(g, p)
  if (h?.kind === 'bag') return { source: { kind: 'bag', id: h.item.id }, grab: { x: p.x - (BAG_X + h.item.x * CELL + 1), y: p.y - (INV_TOP + BAG_Y + h.item.y * CELL + 1) } }
  if (h?.kind === 'worn') {
    const [x, y] = WORN_SLOTS[h.slot]
    return { source: { kind: 'worn', slot: h.slot }, grab: { x: p.x - x, y: p.y - (INV_TOP + y) } }
  }
  return undefined
}

/** A drag let go: the bag item placed or equipped, the worn one taken off into the spot; anywhere else, nothing. */
const drop = (g: Game, drag: Drag): Action[] => {
  const target = dropTarget(g, drag)
  if (target === undefined || !target.fits) return []
  const { source } = drag
  if (source.kind === 'bag') return target.kind === 'bag' ? [{ kind: 'place', id: source.id, x: target.x, y: target.y }] : [{ kind: 'select', id: source.id }, { kind: 'equip' }]
  const worn = g.gear[source.slot]
  return target.kind === 'bag' && worn !== undefined ? [{ kind: 'unequip', slot: source.slot }, { kind: 'place', id: worn.id, x: target.x, y: target.y }] : []
}

/** A click with the menu open: an entry acts (Destroy only when armed), anywhere else closes it. */
const menuClick = (g: Game, ui: BagUi, at: Pos): { ui: BagUi; actions: Action[] } => {
  const menu = bagOverlay(g, ui).find(b => b.role === 'menu')
  const item = g.bag.find(i => i.id === ui.menu?.id)
  const entry = menu !== undefined && at.x >= menu.x && at.x < menu.x + menu.w ? Math.floor(at.y) - menu.y - 1 : -1
  if (item === undefined || entry < 0 || entry > 2) return { ui: BAG_UI_IDLE, actions: [] }
  if (entry === 0) return canWear(g, item) ? { ui: BAG_UI_IDLE, actions: [{ kind: 'equip' }] } : { ui, actions: [] }
  if (entry === 2) return { ui: BAG_UI_IDLE, actions: [{ kind: 'lock' }] }
  if (item.locked === true) return { ui, actions: [] }
  return ui.menu?.confirm === true ? { ui: BAG_UI_IDLE, actions: [{ kind: 'destroy' }] } : { ui: { ...ui, menu: { id: item.id, confirm: true } }, actions: [] }
}

const click = (g: Game, ui: BagUi, at: Pos, button: string): { ui: BagUi; actions: Action[] } => {
  if (ui.menu !== null) return menuClick(g, ui, at)
  // A click on a popover lands on the box, not on what it covers.
  if (bagOverlay(g, ui).some(b => isInside(at, b.x, b.y, b.w, b.h))) return { ui, actions: [] }
  const h = hit(g, pixel(at))
  if (h?.kind === 'bag') {
    const menu = { id: h.item.id, confirm: false }
    if (button === 'right') return { ui: { ...ui, menu }, actions: [{ kind: 'select', id: h.item.id }] }
    return h.item.id === g.cursor ? { ui: { ...ui, menu }, actions: [] } : { ui, actions: [{ kind: 'select', id: h.item.id }] }
  }
  if (h?.kind === 'worn') return { ui, actions: [{ kind: 'unequip', slot: h.slot }] }
  if (h?.kind === 'belt') return { ui, actions: [{ kind: 'use', slot: h.slot }] }
  if (h?.kind === 'close') return { ui, actions: [{ kind: 'panel', panel: 'bag' }] }
  // Empty space lets go of what is selected.
  return { ui, actions: g.cursor === null ? [] : [{ kind: 'deselect' }] }
}

/** The screen's next state and the game actions for one gesture. */
export const bagGesture = (g: Game, ui: BagUi, gesture: Gesture): { ui: BagUi; actions: Action[] } => {
  const from = pixel(gesture.from)
  const at = pixel(gesture.at)
  const grabbed = grabAt(g, from)
  const moved = Math.max(Math.abs(at.x - from.x), Math.abs(at.y - from.y)) >= CLICK_SLOP
  if (gesture.type === 'drag') return grabbed === undefined || !moved ? { ui, actions: [] } : { ui: { menu: null, drag: { ...grabbed, at } }, actions: [] }
  if (moved && grabbed !== undefined) return { ui: BAG_UI_IDLE, actions: drop(g, { ...grabbed, at }) }
  return click(g, { ...ui, drag: null }, gesture.at, gesture.button)
}

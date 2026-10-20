// The inventory screen in pixels: worn slots, the bag grid, the belt; and the selected item's card in text.
import type { Game, Item, Slot } from '../types'
import { activeTier, nameOf } from './consumables'
import type { Run } from './game'
import { CELL, ICONS } from './icons'
import { BAG_H, BAG_W, POWERS, SETS, SET_COLOR, TRIGGERS, setWorn, fit, fitsAt, RARITY_COLOR, RARITY_NAME, canWear, classLabel, deltaLines, describe, isTriggerWornElsewhere, priceOf, selected } from './items'
import { GRID, SLOT, SLOT_BG, art, canvas, fill, frame, put } from './canvas'
import { BELT_STEP, CURSOR, GHOST, GHOST_INK, OFF_CLASS, UPGRADE, belt, beltSlotRect, cellBox, centered, drawItem, itemArt, itemGrid, itemOutline } from './pieces'
import { WINDOW_TOP, WINDOW_W, drawBox, isInside, windowPixels } from './window'
import type { Rect } from './window'
import type { Pos } from './map'
import type { Canvas } from './canvas'
import { INK } from './ui/tokens'
import { glow } from './ui/kit'

export { BELT_STEP, CURSOR, GHOST_INK, OFF_CLASS, UPGRADE } from './pieces'
export { CLOSE_BOX, CLOSE_INK, LABEL_INK, POPOVER_BG, TITLE_INK, TITLE_X, TITLE_Y } from './window'

/** One pixel past the bag, so a selected item in its last column keeps its frame. */
export const INV_W = WINDOW_W
export const BAG_X = 47
/** Two pixels below the top, so the selection brackets of a top-row item stay on the panel. */
export const BAG_Y = 2
/** The belt runs along the bottom, under both the worn slots and the bag, so all five slots fit the width. */
export const BELT_Y = 57
export const INV_H = BELT_Y + SLOT + 1
export const BELT_X = 2
/** The panel starts below the window's title bar. */
export const INV_TOP = WINDOW_TOP

/** Each worn slot's inner rectangle (x, y, w, h), sized to the largest footprint its items have. */
export const WORN_SLOTS: Readonly<Record<Slot, readonly [number, number, number, number]>> = {
  ring: [5, 5, 6, 6],
  helm: [17, 2, 13, 13],
  amulet: [36, 5, 6, 6],
  weapon: [2, 19, 13, 20],
  armor: [17, 19, 13, 20],
  offhand: [32, 19, 13, 20],
  boots: [17, 42, 13, 13],
}

/** The worn slots at the panel's top-left, each framed in the color `edge` gives it, an empty one showing its ghost. */
export const wornSlots = (c: Canvas, g: Game, edge: (slot: Slot) => string) => {
  for (const [slot, [x, y, w, h]] of Object.entries(WORN_SLOTS) as [Slot, readonly [number, number, number, number]][]) {
    fill(c, x, y, w, h, SLOT_BG)
    frame(c, x - 1, y - 1, w + 2, h + 2, edge(slot))
    const worn = g.gear[slot]
    if (worn !== undefined) drawItem(c, g, worn, x, y, w, h)
    else {
      const rows = ICONS[GHOST[slot]]?.art ?? []
      const [ax, ay] = centered(rows, x, y, w, h)
      art(c, rows, ax, ay, GHOST_INK)
    }
  }
}

/** The whole panel, INV_W by INV_H pixels, as '#rrggbb' rows. */
export const inventoryPixels = (g: Game): string[][] => {
  const c = canvas(INV_W, INV_H)
  // The slot the selected item goes to is framed like the item: white where it can be worn, red where it cannot.
  const chosen = selected(g)
  wornSlots(c, g, slot => (chosen?.slot === slot ? (canWear(g, chosen) ? CURSOR : OFF_CLASS) : GRID))
  itemGrid(c, g, g.bag, BAG_X, BAG_Y, BAG_W, BAG_H)
  belt(c, g, BELT_X, BELT_Y)
  return c.px
}


/** What is being dragged: a bag item or a worn one, the pointer in screen pixels, and where on the item it was grabbed. */
export type Drag = { source: { kind: 'bag'; id: number } | { kind: 'worn'; slot: Slot }; at: Pos; grab: Pos }
export type DropTarget = { kind: 'bag'; x: number; y: number; fits: boolean } | { kind: 'slot'; slot: Slot; fits: boolean }

const draggedItem = (g: Game, drag: Drag) => (drag.source.kind === 'bag' ? g.bag.find(i => i.id === (drag.source as { id: number }).id) : g.gear[drag.source.slot])

/** Where a dragged item would land: the worn slot under the pointer, else the bag cell under the item's top-left. */
export const dropTarget = (g: Game, drag: Drag): DropTarget | undefined => {
  const item = draggedItem(g, drag)
  if (item === undefined) return undefined
  const p = { x: drag.at.x, y: drag.at.y - INV_TOP }
  const slot = (Object.keys(WORN_SLOTS) as Slot[]).find(s => isInside(p, ...WORN_SLOTS[s]))
  if (slot !== undefined) return { kind: 'slot', slot, fits: drag.source.kind === 'bag' && item.slot === slot && canWear(g, item) }
  if (!isInside(p, BAG_X, BAG_Y, BAG_W * CELL + 1, BAG_H * CELL + 1)) return undefined
  const x = Math.round((p.x - drag.grab.x - BAG_X - 1) / CELL)
  const y = Math.round((p.y - drag.grab.y - BAG_Y - 1) / CELL)
  return { kind: 'bag', x, y, fits: fitsAt(g.bag, item.w, item.h, x, y, drag.source.kind === 'bag' ? item.id : undefined) }
}

/** A drag on the screen: the item's old place as a ghost, its target framed and tinted, the icon at the pointer. */
/** Where a drag would drop, with its frame: lit as the hover lights what a click acts on, in white where it fits, in
 * red where it will not go. */
const drawTarget = (c: Canvas, [tx, ty, tw, th]: readonly [number, number, number, number], fits: boolean) =>
  glow(c, { x: tx - 1, y: INV_TOP + ty - 1, w: tw + 2, h: th + 2 }, fits ? CURSOR : OFF_CLASS)

const drawDrag = (c: Canvas, g: Game, drag: Drag) => {
  const item = draggedItem(g, drag)
  if (item === undefined) return
  const bagBox = (it: { x: number; y: number }) => {
    const b = cellBox({ ...it, w: item.w, h: item.h }, BAG_X, BAG_Y)
    return [b.x, b.y, b.w, b.h] as const
  }
  const [sx, sy, sw, sh] = drag.source.kind === 'bag' ? bagBox(item) : WORN_SLOTS[drag.source.slot]
  const rows = itemArt(item)
  fill(c, sx, INV_TOP + sy, sw, sh, SLOT_BG)
  const [gx, gy] = centered(rows, sx, INV_TOP + sy, sw, sh)
  art(c, rows, gx, gy, GHOST_INK)
  const target = dropTarget(g, drag)
  if (target !== undefined) drawTarget(c, target.kind === 'slot' ? WORN_SLOTS[target.slot] : bagBox(target), target.fits)
  const [ix, iy] = centered(rows, drag.at.x - drag.grab.x, drag.at.y - drag.grab.y, sw, sh)
  art(c, rows, ix, iy)
}

/** A popover's place in cells (one pixel across, two down) and its frame's color. */
export type PopoverFrame = { x: number; y: number; w: number; h: number; border: string }

/**
 * The whole inventory screen: title bar with gold and the close box, the panel, any drag, and
 * the popovers' frames over it all.
 */
export const inventoryScreenPixels = (g: Game, drag?: Drag, popovers: readonly PopoverFrame[] = []): string[][] => {
  const c = windowPixels({ title: 'INVENTORY', gold: g.gold }, inventoryPixels(g))
  if (drag !== undefined) drawDrag(c, g, drag)
  for (const b of popovers) drawBox(c, b)
  return c.px
}

const SLOT_NAME: Readonly<Record<Slot, string>> = { weapon: 'Weapon', offhand: 'Off-hand', helm: 'Helm', armor: 'Armor', boots: 'Boots', ring: 'Ring', amulet: 'Amulet' }

/** The selected item in words: name and tier, slot and class, bonuses, change against what is worn, power, price. */
/** What wearing the item would change against what is worn there, gains in green, losses in red; none when nothing would. */
const changeLine = (g: Game, item: Item): Run[] | undefined => {
  const changes = deltaLines(g, item)
  if (changes.length === 0) return undefined
  const worn = g.gear[item.slot]
  return [
    { text: worn === undefined ? 'vs nothing worn: ' : `vs ${worn.name}: `, dim: true },
    ...changes.flatMap((d, i) => [...(i > 0 ? [{ text: '  ' }] : []), { text: d.text, color: d.isGain ? UPGRADE : OFF_CLASS, bold: true }]),
  ]
}

export const itemCard = (g: Game): Run[][] => {
  const item = selected(g)
  if (item === undefined) return [[{ text: g.bag.length === 0 ? 'Your bag is empty. Slay foes for loot.' : 'Press n to pick an item.', dim: true }]]
  const tier = RARITY_COLOR[item.rarity]
  const lines: Run[][] = [
    [{ text: item.name, color: tier, bold: true }, { text: ` (${RARITY_NAME[item.rarity]})`, color: tier }],
    [{ text: `${SLOT_NAME[item.slot]}, `, dim: true }, canWear(g, item) ? { text: classLabel(item), dim: true } : { text: classLabel(item), color: OFF_CLASS, bold: true }],
    [{ text: describe(item) }],
  ]
  const changes = changeLine(g, item)
  if (changes !== undefined) lines.push(changes)
  if (item.power !== undefined) lines.push([{ text: POWERS[item.power] ?? item.power, color: RARITY_COLOR.legendary }])
  if (item.set !== undefined) {
    const set = SETS[item.set]
    lines.push([{ text: `${set.name}, ${setWorn(g, item.set)} of ${set.pieces.length} worn: `, color: SET_COLOR, bold: true }, { text: `2, ${set.twoSaid}; ${set.pieces.length}, ${set.three}`, dim: true }])
  }
  if (item.trigger !== undefined) lines.push([{ text: `${TRIGGERS[item.trigger].name}: `, color: RARITY_COLOR[item.rarity], bold: true }, { text: TRIGGERS[item.trigger].does, dim: true }, ...(isTriggerWornElsewhere(g, item) ? [{ text: '  same trigger as worn: no effect', color: OFF_CLASS }] : [])])
  lines.push([{ text: 'Sells for ', dim: true }, { text: String(priceOf(item)), color: INK.gold }, ...(item.junk ? [{ text: '  marked junk', dim: true }] : [])])
  return lines
}

/** A belt button's label; its hotkey prints the slot number in front of it. */
export const beltLabel = (g: Game, i: number) => {
  const slot = g.belt[i]
  const tier = activeTier(slot)
  return slot === null || slot === undefined || tier === undefined ? 'empty' : `${nameOf(slot.kind, tier)} x${slot.tiers[tier - 1]}`
}

/** The worn slots holding a piece, with their frames, in window pixels for a panel whose top is at `top`: what the hover lights. */
export const wornOutlines = (g: Game, top: number): Rect[] =>
  (Object.entries(WORN_SLOTS) as [Slot, readonly [number, number, number, number]][]).filter(([slot]) => g.gear[slot] !== undefined).map(([, [x, y, w, h]]) => ({ x: x - 1, y: top + y - 1, w: w + 2, h: h + 2 }))

/** What is worn that the bag has room to take off into: a worn piece is clicked off, or dragged, only so far. */
export const removable = (g: Game): Game => ({ ...g, gear: Object.fromEntries(Object.entries(g.gear).filter(([, i]) => i !== undefined && fit(g.bag, i.w, i.h) !== null)) })

/** The belt slots holding something, in window pixels for a belt whose top left is at `x`, `y`: a click uses one. */
export const beltHot = (g: Game, x: number, y: number): Rect[] => g.belt.flatMap((s, i) => (s === null ? [] : [beltSlotRect(x, y, i)]))

/** What a click acts on in the inventory, in window pixels: the bag's items, the worn pieces that can come off, the belt. */
export const inventoryHot = (g: Game): Rect[] => [...g.bag.map(i => itemOutline(i, BAG_X, INV_TOP + BAG_Y)), ...wornOutlines(removable(g), INV_TOP), ...beltHot(g, BELT_X, INV_TOP + BELT_Y)]

// The inventory screen in pixels: worn slots, the bag grid, the belt; and the selected item's card in text.
import type { Game, Slot } from '../types'
import { bestTier, countOf, nameOf } from './consumables'
import type { Run } from './game'
import { CELL, ICONS } from './icons'
import { BAG_H, BAG_W, POWERS, fitsAt, RARITY_COLOR, RARITY_NAME, canWear, classLabel, deltaLines, describe, priceOf, selected } from './items'
import { GRID, SLOT, SLOT_BG, art, canvas, canvasCells, fill, frame, put } from './canvas'
import { BELT_STEP, CURSOR, GHOST, GHOST_INK, OFF_CLASS, UPGRADE, belt, cellBox, centered, drawItem, itemArt, itemGrid } from './pieces'
import { BODY_TOP, WINDOW_W, drawBox, isInside, windowPixels } from './window'
import type { Pos } from './map'
import type { Canvas } from './canvas'

export { BELT_STEP, CURSOR, GHOST_INK, OFF_CLASS, UPGRADE } from './pieces'
export { CLOSE_BOX, CLOSE_INK, LABEL_INK, LABEL_Y, POPOVER_BG, TITLE_INK, TITLE_X, TITLE_Y } from './window'

/** One pixel past the bag, so a selected item in its last column keeps its frame. */
export const INV_W = WINDOW_W
export const BAG_X = 47
/** Two pixels below the top, so the selection brackets of a top-row item stay on the panel. */
export const BAG_Y = 2
/** The belt runs along the bottom, under both the worn slots and the bag, so all five slots fit the width. */
export const BELT_Y = 57
export const INV_H = BELT_Y + SLOT + 1
export const BELT_X = 2
/** The panel starts below the window's title bar and labels. */
export const INV_TOP = BODY_TOP

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

const BLOCKED_TINT = '#4a1c22'
const FITS_TINT = '#2e2c38'

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
  if (target !== undefined) {
    const [tx, ty, tw, th] = target.kind === 'slot' ? WORN_SLOTS[target.slot] : bagBox(target)
    for (let y = 0; y < th; y += 1) for (let x = 0; x < tw; x += 1) if ((x + y) % 2 === 0) put(c, tx + x, INV_TOP + ty + y, target.fits ? FITS_TINT : BLOCKED_TINT)
    frame(c, tx - 1, INV_TOP + ty - 1, tw + 2, th + 2, target.fits ? CURSOR : OFF_CLASS)
  }
  const [ix, iy] = centered(rows, drag.at.x - drag.grab.x, drag.at.y - drag.grab.y, sw, sh)
  art(c, rows, ix, iy)
}

/** A popover's place in cells (one pixel across, two down) and its frame's color. */
export type PopoverFrame = { x: number; y: number; w: number; h: number; border: string }

/**
 * The whole inventory screen: title bar with gold and the close box, the section labels, the panel, any drag, and
 * the popovers' frames over it all.
 */
export const inventoryScreenPixels = (g: Game, drag?: Drag, popovers: readonly PopoverFrame[] = []): string[][] => {
  const c = windowPixels({ title: 'INVENTORY', gold: g.gold, labels: [{ text: 'WORN', x: 2 }, { text: 'BAG', x: BAG_X + 1 }] }, inventoryPixels(g))
  if (drag !== undefined) drawDrag(c, g, drag)
  for (const b of popovers) drawBox(c, b)
  return c.px
}

/** The screen as Raster cells: INV_W columns by (INV_TOP + INV_H) / 2 rows. */
export const inventoryScreenCells = (g: Game, drag?: Drag, popovers: readonly PopoverFrame[] = []) =>
  canvasCells({ w: INV_W, h: INV_TOP + INV_H, px: inventoryScreenPixels(g, drag, popovers) })

/** The panel as Raster cells: INV_W columns by INV_H / 2 rows. */
export const inventoryCells = (g: Game) => canvasCells({ w: INV_W, h: INV_H, px: inventoryPixels(g) })

const SLOT_NAME: Readonly<Record<Slot, string>> = { weapon: 'Weapon', offhand: 'Off-hand', helm: 'Helm', armor: 'Armor', boots: 'Boots', ring: 'Ring', amulet: 'Amulet' }

/** The selected item in words: name and tier, slot and class, bonuses, change against what is worn, power, price. */
export const itemCard = (g: Game): Run[][] => {
  const item = selected(g)
  if (item === undefined) return [[{ text: g.bag.length === 0 ? 'Your bag is empty. Slay foes for loot.' : 'Press n to pick an item.', dim: true }]]
  const tier = RARITY_COLOR[item.rarity]
  const worn = g.gear[item.slot]
  const lines: Run[][] = [
    [{ text: item.name, color: tier, bold: true }, { text: ` (${RARITY_NAME[item.rarity]})`, color: tier }],
    [{ text: `${SLOT_NAME[item.slot]}, `, dim: true }, canWear(g, item) ? { text: classLabel(item), dim: true } : { text: classLabel(item), color: OFF_CLASS, bold: true }],
    [{ text: describe(item) }],
  ]
  const changes = deltaLines(g, item)
  if (changes.length > 0) {
    lines.push([
      { text: worn === undefined ? 'vs nothing worn: ' : `vs ${worn.name}: `, dim: true },
      ...changes.flatMap((d, i) => [...(i > 0 ? [{ text: '  ' }] : []), { text: d.text, color: d.isGain ? UPGRADE : OFF_CLASS, bold: true }]),
    ])
  }
  if (item.power !== undefined) lines.push([{ text: POWERS[item.power] ?? item.power, color: RARITY_COLOR.legendary }])
  lines.push([{ text: 'Sells for ', dim: true }, { text: String(priceOf(item)), color: '#ffd34d' }, ...(item.junk ? [{ text: '  marked junk', dim: true }] : [])])
  return lines
}

/** A belt button's label; its hotkey prints the slot number in front of it. */
export const beltLabel = (g: Game, i: number) => {
  const slot = g.belt[i]
  const tier = bestTier(slot)
  return slot === null || slot === undefined || tier === undefined ? 'empty' : `${nameOf(slot.kind, tier)} x${countOf(slot)}`
}

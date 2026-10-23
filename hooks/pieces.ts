// The pieces windows are built from: an item in its tier box with the marks that say what it means for this hero,
// an item grid, the belt. Each draws at a given place on a canvas; the windows say where.
import type { Game, Item, Rarity, Slot } from '../types'
import { CELL, ICONS, consumableIcon } from './icons'
import { activeTier } from './consumables'
import type { BeltSlot } from '../types'
import { BAG_H, BAG_W, RARITY_COLOR, canWear, isUpgrade } from './items'
import { BELT_SLOT_W, BG, GRID, SLOT, SLOT_BG, art, fill, frame, put } from './canvas'
import type { Canvas } from './canvas'
import { PAL, PX } from './pixelart'
import type { OverlayBox, Rect } from './window'
import type { Run } from './game'
import { INK, SURFACE } from './ui/tokens'
import { countText } from './names'

export const GHOST_INK = INK.ghost
export const OFF_CLASS = INK.wrong
export const UPGRADE = INK.good
export const CURSOR = INK.focus
/** A locked item's mark in its bottom-right corner: a small padlock. */
export const LOCK_INK = INK.text
const LOCK_MARK: readonly string[] = ['.w.', 'w.w', 'www', 'www']
export const BELT_STEP = BELT_SLOT_W + 1
export const GOLD_INK = INK.gold
const COIN_RIM = INK.coinRim
/** A price that cannot be paid: the coin and its number in grey. */
export const UNPAID_INK = INK.dim
const UNPAID_RIM = INK.unpaidRim

export const mix = (a: string, b: string, t: number) =>
  `#${[1, 3, 5].map(i => Math.round(Number.parseInt(a.slice(i, i + 2), 16) * (1 - t) + Number.parseInt(b.slice(i, i + 2), 16) * t).toString(16).padStart(2, '0')).join('')}`

/** The tier on an item's box: a tinted background, then a frame whose shape names the tier without its color. */
export const tierBox = (c: Canvas, x: number, y: number, w: number, h: number, tier: Rarity) => {
  const color = RARITY_COLOR[tier]
  fill(c, x, y, w, h, tier === 'common' ? SLOT_BG : mix(SLOT_BG, color, 0.18))
  if (tier === 'common') return
  frame(c, x - 1, y - 1, w + 2, h + 2, color)
  const bright = mix(color, INK.white, 0.6)
  if (tier === 'rare' || tier === 'legendary') for (const [cx, cy] of [[x - 1, y - 1], [x + w, y - 1], [x - 1, y + h], [x + w, y + h]] as const) put(c, cx, cy, bright)
  if (tier === 'epic' || tier === 'legendary') frame(c, x, y, w, h, mix(color, SLOT_BG, 0.35))
}

/** The selection: a white frame just outside the box, so the tier frame stays visible inside it. */
export const cursor = (c: Canvas, x: number, y: number, w: number, h: number) => frame(c, x - 1, y - 1, w + 2, h + 2, CURSOR)

/** Where sprite rows go to sit centered in a box. */
export const centered = (rows: readonly string[], x: number, y: number, w: number, h: number) =>
  [x + Math.floor((w - (rows[0]?.length ?? 0)) / 2), y + Math.floor((h - rows.length) / 2)] as const

/** What an empty slot takes, drawn as a faint ghost so the slot's purpose shows; an item without art of its own shows it too. */
export const GHOST: Readonly<Record<Slot, string>> = { ring: 'ring', helm: 'steelHelm', amulet: 'amulet', weapon: 'sword', armor: 'tunic', offhand: 'buckler', boots: 'boots' }

export const itemArt = (item: Item) => ICONS[item.base]?.art ?? ICONS[GHOST[item.slot]]?.art ?? []

/** An item over its box at inner top-left x, y: tier, art, then the marks that say what it means for this hero. */
export const drawItem = (c: Canvas, g: Game, item: Item, x: number, y: number, w: number, h: number) => {
  tierBox(c, x, y, w, h, item.rarity)
  const rows = itemArt(item)
  const [ax, ay] = centered(rows, x, y, w, h)
  art(c, rows, ax, ay)
  if (!canWear(g, item)) for (const [dx, dy] of [[0, 0], [2, 0], [1, 1], [0, 2], [2, 2]] as const) put(c, x + w - 3 + dx, y + dy, OFF_CLASS)
  else if (isUpgrade(g, item)) for (const [dx, dy] of [[0, 1], [1, 0], [2, 1]] as const) put(c, x + dx, y + h - 2 + dy, UPGRADE)
  if (item.locked === true) art(c, LOCK_MARK, x + w - 3, y + h - 4, LOCK_INK)
  if (item.id === g.cursor) cursor(c, x - 1, y - 1, w + 2, h + 2)
}

/** An item grid `cols` by `rows` cells at x, y: its ground and lines. */
export const gridLines = (c: Canvas, x: number, y: number, cols: number, rows: number) => {
  fill(c, x, y, cols * CELL + 1, rows * CELL + 1, SLOT_BG)
  for (let i = 0; i <= cols; i += 1) fill(c, x + i * CELL, y, 1, rows * CELL + 1, GRID)
  for (let j = 0; j <= rows; j += 1) fill(c, x, y + j * CELL, cols * CELL + 1, 1, GRID)
}

/** The inner box of an item lying in a grid at x, y. */
export const cellBox = (item: Pick<Item, 'x' | 'y' | 'w' | 'h'>, x: number, y: number): Rect =>
  ({ x: x + item.x * CELL + 1, y: y + item.y * CELL + 1, w: item.w * CELL - 1, h: item.h * CELL - 1 })

/** Where a run `w` wide starts, centred between `left` and `right`, the odd pixel on the right. */
export const runX = (w: number, left: number, right: number) => left + Math.floor((right - left - w) / 2)

/** The bag's grid at x, y with its frame: what a card over the bag keeps off, filled or empty. */
export const gridBox = (x: number, y: number): Rect => ({ x, y, w: BAG_W * CELL + 1, h: BAG_H * CELL + 1 })

/** An item lying in a grid at x, y as the hover lights it: its box and the frame round it. */
export const itemOutline = (item: Pick<Item, 'x' | 'y' | 'w' | 'h'>, x: number, y: number): Rect => {
  const b = cellBox(item, x, y)
  return { x: b.x - 1, y: b.y - 1, w: b.w + 2, h: b.h + 2 }
}

/** An item grid at x, y with its items laid in it. */
export const itemGrid = (c: Canvas, g: Game, items: readonly Item[], x: number, y: number, cols: number, rows: number) => {
  gridLines(c, x, y, cols, rows)
  for (const item of items) {
    const b = cellBox(item, x, y)
    drawItem(c, g, item, b.x, b.y, b.w, b.h)
  }
  // The ring reaches into the next cells, so the items drawn after the selected one would cover it.
  const picked = items.find(i => i.id === g.cursor)
  if (picked) {
    const b = cellBox(picked, x, y)
    cursor(c, b.x - 1, b.y - 1, b.w + 2, b.h + 2)
  }
}

/** A belt slot's place when the belt starts at x0, y: as drawn, BELT_SLOT_W by SLOT. */
export const beltSlotRect = (x0: number, y: number, i: number): Rect => ({ x: x0 + i * BELT_STEP, y, w: BELT_SLOT_W, h: SLOT })

export const TIER_INK = INK.gold

/** A belt slot at x, y: its frame; filled, the icon of the tier it uses next (`activeTier`) and along its top a pip a
 * tier above the first. How many of that tier it holds is `beltCounts`'s, on the icon's bottom right. */
export const beltSlot = (c: Canvas, slot: BeltSlot | null | undefined, x: number, y: number) => {
  frame(c, x, y, BELT_SLOT_W, SLOT, GRID)
  fill(c, x + 1, y + 1, BELT_SLOT_W - 2, PX, SLOT_BG)
  const tier = activeTier(slot)
  if (slot === null || slot === undefined || tier === undefined) return
  art(c, consumableIcon(slot.kind, tier), x + 1, y + 1)
  for (let p = 1; p < tier; p += 1) put(c, x + 1 + 2 * (p - 1), y + 1, TIER_INK)
}

/** The belt at x, y: a slot a kind, as `beltSlot` draws it. */
export const belt = (c: Canvas, g: Game, x0: number, y: number) => g.belt.forEach((slot, i) => beltSlot(c, slot, x0 + i * BELT_STEP, y))

/**
 * Terminal text over pixels at x, y (window pixels, y even: one cell row), each character a cell, on `ground`, the
 * color the pixels under it are: a box over its letters alone.
 */
export const artLabel = (text: string, x: number, y: number, ink: string, ground: string, bold = true): OverlayBox<'label'> =>
  ({ role: 'label', x: x - 1, y: y / 2 - 1, w: text.length + 2, h: 3, border: ground, bg: ground, pad: 0, lines: [[{ text, color: ink, bold }]] })

/** How many of the tier each belt slot uses next, for a belt whose slot i is at slotX(i), y in window pixels: on its
 * icon's bottom right corner, the last whole cell inside its frame, as a stack's count is. `beltCountsAt` for the bag's
 * belt, BELT_STEP apart. */
export const beltCounts = (g: Game, slotX: (i: number) => number, y: number): OverlayBox<'label'>[] =>
  g.belt.flatMap((slot, i) => {
    const tier = activeTier(slot)
    if (slot === null || slot === undefined || tier === undefined) return []
    const text = String(slot.tiers[tier - 1])
    const x = slotX(i) + BELT_SLOT_W - 1 - text.length
    const row = onCell(y + 6)
    // Clear of the icon: each digit's cell on the icon's own two pixels under it, as near as one ground shows them; its
    // ink dark or light by them all, so the number reads over a pale icon or a dark one.
    const icon = consumableIcon(slot.kind, tier)
    const pixel = (px: number, py: number) => {
      const k = icon[py - y - 1]?.[px - slotX(i) - 1]
      return k === undefined || k === '.' ? SLOT_BG : (PAL[k] ?? SLOT_BG)
    }
    const grounds = [...text].map((_, d) => mix(pixel(x + d, row), pixel(x + d, row + 1), 0.5))
    const ink = inkOn(grounds.reduce((a, b) => mix(a, b, 0.5)))
    return [{ ...artLabel(text, x, row, ink, grounds[0]!), lines: [[...text].map((ch, d) => ({ text: ch, color: ink, bg: grounds[d]!, bold: true }))] }]
  })
export const beltCountsAt = (g: Game, x0: number, y: number) => beltCounts(g, i => x0 + i * BELT_STEP, y)

/** Two boxes, in cells, that share a cell. */
export const overlaps = (a: OverlayBox, b: OverlayBox) => a.x < b.x + b.w && b.x < a.x + a.w && a.y < b.y + b.h && b.y < a.y + a.h
/** The labels no box of `over` covers: a card or a menu over a label hides it. */
export const clearOf = <L extends OverlayBox>(labels: readonly L[], over: readonly OverlayBox[]): L[] => labels.filter(l => !over.some(b => overlaps(l, b)))
/** The boxes a click lands on: all but the labels on art (a price, a count), which a click goes through to what they
 * label, and which the hover lights through. */
export const clickable = <B extends OverlayBox>(boxes: readonly B[]): B[] => boxes.filter(b => b.role !== 'label')

/** A small coin, four pixels square, its top-left at x, y; grey when what it prices cannot be paid. */
/** The gold's mark, 5 by 5, where the gold is counted (the title bar, the strip): a coin lit top left, its inks. */
export const COIN_MARK: readonly string[] = ['.yyy.', 'yYyyy', 'yYyyy', 'yyyyo', '.yoo.']
export const COIN_INK: Readonly<Record<string, string>> = { y: INK.gold, Y: INK.coinGlint, o: INK.coinShade }
export const coinMark = (c: Canvas, x: number, y: number) =>
  COIN_MARK.forEach((row, dy) => [...row].forEach((k, dx) => k !== '.' && put(c, x + dx, y + dy, COIN_INK[k]!)))

export const coin = (c: Canvas, x: number, y: number, canPay = true) => {
  art(c, ['.ww.', 'wwww', 'wwww', '.ww.'], x, y, canPay ? COIN_RIM : UNPAID_RIM)
  fill(c, x + 1, y + 1, 2, 2, canPay ? GOLD_INK : UNPAID_INK)
}

/** A ware on a shelf: TAG_W wide, TAG_H tall; its icon in a slot, the price under it. */
export const TAG_W = 15
export const TAG_H = SLOT + 7

/** Where a ware's price goes under its slot, for its tag at x, y: the coin, a cell, the number as text, centred, on the
 * first whole cell two pixels under the slot. */
const tagPrice = (cost: number, x: number, y: number) => {
  const text = countText(cost)
  const left = x + Math.floor((TAG_W - (5 + text.length)) / 2)
  return { text, coinX: left, textX: left + 5, row: onCell(y + SLOT + 2) }
}

/** A ware at x, y: the icon centered in its slot, framed white when chosen; under it the price's coin, grey when it
 * cannot be paid. Its number is `warePrice`'s. */
export const wareTag = (c: Canvas, icon: readonly string[], cost: number, x: number, y: number, canPay: boolean, chosen: boolean) => {
  const sx = x + Math.floor((TAG_W - SLOT) / 2)
  fill(c, sx + 1, y + 1, SLOT - 2, SLOT - 2, SLOT_BG)
  frame(c, sx, y, SLOT, SLOT, chosen ? CURSOR : GRID)
  art(c, icon, sx + 1, y + 1)
  const at = tagPrice(cost, x, y)
  coin(c, at.coinX, at.row - 1, canPay)
}

/** A ware's price as text beside its coin, for its tag at x, y in window pixels: gold, or grey when it cannot be paid. */
export const warePrice = (cost: number, x: number, y: number, canPay: boolean) => {
  const at = tagPrice(cost, x, y)
  return artLabel(at.text, at.textX, at.row, canPay ? GOLD_INK : UNPAID_INK, BG)
}

/** A flat bar's height: one text row, so the text on it covers it exactly. */
/** A flat bar's height: its mark's, two text rows, its number on the middle two pixel rows. */
export const FLAT_BAR_H = 4
const INK_LIGHT = INK.text
const INK_DARK = INK.onBright

/** The text color that reads on a color: dark on a bright one, light on a dark one. */
export const inkOn = (color: string) => {
  const n = Number.parseInt(color.slice(1), 16)
  const lum = 0.299 * ((n >> 16) & 0xff) + 0.587 * ((n >> 8) & 0xff) + 0.114 * (n & 0xff)
  return lum > 140 ? INK_DARK : INK_LIGHT
}

/**
 * A flat bar: FLAT_BAR_H pixels of one color, `share` of `w` filled, the rest its empty track; at x, y on canvas `c`.
 * It starts on an odd pixel row of its surface, so its middle two rows are one text row for its number.
 */
export const flatBar = (c: Canvas, x: number, y: number, w: number, share: number, color: string, empty: string) =>
  bar(c, x, y, w, FLAT_BAR_H, share, [color, color, color], empty)

/**
 * Text centred on a flat bar, as a text box over the pixels: `x`, `y` the bar's place in the surface's pixels (a cell
 * one across, two down, `y` odd), on its middle two rows, each character on the bar's color under it, in the ink
 * that reads there.
 */
export const barLabel = (x: number, y: number, w: number, share: number, color: string, empty: string, text: string): OverlayBox<'label'> => {
  const filled = Math.round(Math.max(0, Math.min(1, share)) * w)
  const x0 = Math.floor((w - text.length) / 2)
  const runs = [...text].map((ch, i) => {
    const under = x0 + i < filled ? color : empty
    return { text: ch, color: inkOn(under), bg: under, bold: true }
  })
  return { role: 'label', x: x + x0 - 1, y: Math.floor((y + (FLAT_BAR_H - 2) / 2) / 2) - 1, w: text.length + 2, h: 3, border: empty, bg: empty, pad: 0, lines: [runs] }
}

/** A bar, `share` of it filled, its rows toned top to bottom (lit, body, shaded); no frame. */
export const bar = (c: Canvas, x: number, y: number, w: number, h: number, share: number, tones: readonly string[], empty: string) => {
  const filled = Math.round(Math.max(0, Math.min(1, share)) * w)
  for (let dy = 0; dy < h; dy += 1) {
    const tone = (dy === 0 ? tones[0] : dy === h - 1 ? tones[2] : tones[1]) ?? empty
    for (let dx = 0; dx < w; dx += 1) put(c, x + dx, y + dy, dx < filled ? tone : empty)
  }
}

/** A button's height: its frame, its lit top edge, its label's text row, a row of room and its frame. Placed on an
 * even row, its label's row is whole cells. Its inks in each state: ready, off (it cannot act now), armed (white,
 * pressing it acts). */
export const BUTTON_H = 6
export type ButtonState = 'ready' | 'off' | 'armed'
/** The first row at or under y on a whole cell, where a button's top goes. */
export const onCell = (y: number) => y + (y % 2)
const BUTTON_BG = { ready: SURFACE.raised, off: SURFACE.sunken, armed: SURFACE.raised } as const
const BUTTON_EDGE = { ready: SURFACE.buttonEdge, off: SURFACE.tab, armed: CURSOR } as const
const BUTTON_LIT = SURFACE.buttonLit
const OFF_INK = INK.off

/** A button's price, upper case as every label of the chrome. */
const costText = (cost: number) => `${countText(cost)} GOLD`
/** A button's width in cells: its label and, when it costs, its price; a cell of room each side in its frame. Its key
 * is not drawn on it: the pane has the keys only after ctrl+x tab, and the line under the window says them. */
export const buttonW = (label: string, cost?: number) => 4 + label.length + (cost === undefined ? 0 : 1 + costText(cost).length)

/** A button's face, `w` wide at x, y, in its state's inks: for a button wider than its words. */
export const buttonFace = (c: Canvas, x: number, y: number, w: number, state: ButtonState) => {
  fill(c, x, y, w, BUTTON_H, BUTTON_BG[state])
  frame(c, x, y, w, BUTTON_H, BUTTON_EDGE[state])
  // A lit top edge, so it reads as raised.
  if (state !== 'off') fill(c, x + 1, y + 1, w - 2, 1, BUTTON_LIT)
}
/** The face a button's words are written on, in its state. */
export const buttonGround = (state: ButtonState) => BUTTON_BG[state]

/** A button's frame and face at x, y; its words are `buttonBox`'s. Returns its width. */
export const button = (c: Canvas, label: string, x: number, y: number, state: ButtonState, cost?: number) => {
  const w = buttonW(label, cost)
  buttonFace(c, x, y, w, state)
  return w
}

/** A button's words as terminal text on its face, for the button `button` draws at x, y in window pixels: its label,
 * bold, its price (grey when it cannot be paid); all grey when off. */
export const buttonBox = (label: string, x: number, y: number, state: ButtonState, cost?: number, canPay = true): OverlayBox<'button'> => {
  const isOff = state === 'off'
  const runs: Run[] = [
    { text: label, color: isOff ? OFF_INK : INK.text, bold: !isOff },
    ...(cost === undefined ? [] : [{ text: ` ${costText(cost)}`, color: canPay && !isOff ? GOLD_INK : UNPAID_INK }]),
  ]
  const bg = BUTTON_BG[state]
  return { role: 'button', x, y: y / 2, w: buttonW(label, cost), h: 3, border: bg, bg, pad: 1, lines: [runs] }
}

/** A button's words centred on a face `w` wide, for a button wider than its words (`buttonFace`); the odd cell of
 * room goes on the right. */
export const wideButtonBox = (label: string, x: number, y: number, w: number, state: ButtonState): OverlayBox<'button'> =>
  ({ ...buttonBox(label, x, y, state), w, pad: Math.floor((w - 2 - label.length) / 2) })

/** A portrait's size: an 8 by 8 sprite at three times its size, inside a two pixel frame. */
export const PORTRAIT = PX * 3 + 4
const PORTRAIT_BG = SURFACE.backdrop
const PORTRAIT_FLOOR = SURFACE.floor
const PORTRAIT_EDGE = SURFACE.frame

/** A portrait `size` pixels square at x, y: the sprite as many times its size as fits (an 8 by 8 three times in
 * PORTRAIT), centred on a lit backdrop with a floor, in a double frame. */
export const portrait = (c: Canvas, rows: readonly string[], x: number, y: number, size = PORTRAIT) => {
  fill(c, x, y, size, size, PORTRAIT_BG)
  fill(c, x + 2, y + size - 8, size - 4, 6, PORTRAIT_FLOOR)
  frame(c, x, y, size, size, PORTRAIT_EDGE)
  frame(c, x + 1, y + 1, size - 2, size - 2, GRID)
  const scale = Math.floor((size - 4) / rows.length)
  const inset = 2 + Math.floor((size - 4 - rows.length * scale) / 2)
  rows.forEach((row, dy) => [...row].forEach((k, dx) => {
    if (k !== '.') fill(c, x + inset + dx * scale, y + inset + dy * scale, scale, scale, PAL[k] ?? INK.missing)
  }))
}

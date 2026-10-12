// The pieces windows are built from: an item in its tier box with the marks that say what it means for this hero,
// an item grid, the belt. Each draws at a given place on a canvas; the windows say where.
import type { Game, Item, Rarity, Slot } from '../types'
import { CELL, CONSUMABLE_ICONS, ICONS } from './icons'
import { RARITY_COLOR, canWear, isUpgrade } from './items'
import { BELT_SLOT_W, GRID, SLOT, SLOT_BG, art, digits, fill, frame, put } from './canvas'
import type { Canvas } from './canvas'
import { PAL, PX, textMask } from './pixelart'
import type { Rect } from './window'

export const GHOST_INK = '#2a2732'
export const OFF_CLASS = '#ff4a4a'
export const UPGRADE = '#3ccf4e'
export const CURSOR = '#ffffff'
/** A locked item's mark in its bottom-right corner: a small padlock. */
export const LOCK_INK = '#e8e4dc'
const LOCK_MARK: readonly string[] = ['.w.', 'w.w', 'www', 'www']
export const BELT_STEP = BELT_SLOT_W + 1
export const GOLD_INK = '#ffd34d'
const COIN_RIM = '#c9971f'
/** A price that cannot be paid: the coin and its number in grey. */
export const UNPAID_INK = '#8a8494'
const UNPAID_RIM = '#4a4652'

export const mix = (a: string, b: string, t: number) =>
  `#${[1, 3, 5].map(i => Math.round(Number.parseInt(a.slice(i, i + 2), 16) * (1 - t) + Number.parseInt(b.slice(i, i + 2), 16) * t).toString(16).padStart(2, '0')).join('')}`

/** The tier on an item's box: a tinted background, then a frame whose shape names the tier without its color. */
export const tierBox = (c: Canvas, x: number, y: number, w: number, h: number, tier: Rarity) => {
  const color = RARITY_COLOR[tier]
  fill(c, x, y, w, h, tier === 'common' ? SLOT_BG : mix(SLOT_BG, color, 0.18))
  if (tier === 'common') return
  frame(c, x - 1, y - 1, w + 2, h + 2, color)
  const bright = mix(color, '#ffffff', 0.6)
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

/** An item grid at x, y with its items laid in it. */
export const itemGrid = (c: Canvas, g: Game, items: readonly Item[], x: number, y: number, cols: number, rows: number) => {
  gridLines(c, x, y, cols, rows)
  for (const item of items) {
    const b = cellBox(item, x, y)
    drawItem(c, g, item, b.x, b.y, b.w, b.h)
  }
}

/** A belt slot's place when the belt starts at x0, y: as drawn, BELT_SLOT_W by SLOT. */
export const beltSlotRect = (x0: number, y: number, i: number): Rect => ({ x: x0 + i * BELT_STEP, y, w: BELT_SLOT_W, h: SLOT })

/** The belt at x, y: each slot's icon, its count beside it. */
export const belt = (c: Canvas, g: Game, x0: number, y: number) =>
  g.belt.forEach((slot, i) => {
    const x = x0 + i * BELT_STEP
    fill(c, x + 1, y + 1, PX, PX, SLOT_BG)
    frame(c, x, y, BELT_SLOT_W, SLOT, GRID)
    fill(c, x + 1, y + 1, BELT_SLOT_W - 2, PX, SLOT_BG)
    if (slot === null) return
    art(c, CONSUMABLE_ICONS[slot.kind], x + 1, y + 1)
    digits(c, String(slot.count), x + BELT_SLOT_W - 2, y + SLOT / 2 + 2)
  })

/** A small coin, four pixels square, its top-left at x, y; grey when what it prices cannot be paid. */
export const coin = (c: Canvas, x: number, y: number, canPay = true) => {
  art(c, ['.ww.', 'wwww', 'wwww', '.ww.'], x, y, canPay ? COIN_RIM : UNPAID_RIM)
  fill(c, x + 1, y + 1, 2, 2, canPay ? GOLD_INK : UNPAID_INK)
}

const textW = (text: string) => textMask(text)[0]?.length ?? 0
const word = (c: Canvas, text: string, x: number, y: number, ink: string) =>
  textMask(text).forEach((row, dy) => [...row].forEach((k, dx) => k === '#' && put(c, x + dx, y + dy, ink)))

/** A price's width: the coin, a pixel and more of room, the number. */
export const priceW = (n: number) => 6 + textW(String(n))

/** A price at x, y (the top of its number): a coin, then the number; grey when it cannot be paid. */
export const price = (c: Canvas, n: number, x: number, y: number, canPay: boolean) => {
  coin(c, x, y + 1, canPay)
  word(c, String(n), x + 6, y, canPay ? GOLD_INK : UNPAID_INK)
}

/** A ware on a shelf: TAG_W wide, TAG_H tall; its icon in a slot, the price under it. */
export const TAG_W = 15
export const TAG_H = SLOT + 7

/** A ware at x, y: the icon centered in its slot, framed white when chosen; the price centered under it. */
export const wareTag = (c: Canvas, icon: readonly string[], cost: number, x: number, y: number, canPay: boolean, chosen: boolean) => {
  const sx = x + Math.floor((TAG_W - SLOT) / 2)
  fill(c, sx + 1, y + 1, SLOT - 2, SLOT - 2, SLOT_BG)
  frame(c, sx, y, SLOT, SLOT, chosen ? CURSOR : GRID)
  art(c, icon, sx + 1, y + 1)
  price(c, cost, x + Math.floor((TAG_W - priceW(cost)) / 2), y + SLOT + 2, canPay)
}

/** A bar, `share` of it filled, its rows toned top to bottom (lit, body, shaded); no frame. */
export const bar = (c: Canvas, x: number, y: number, w: number, h: number, share: number, tones: readonly string[], empty: string) => {
  const filled = Math.round(Math.max(0, Math.min(1, share)) * w)
  for (let dy = 0; dy < h; dy += 1) {
    const tone = (dy === 0 ? tones[0] : dy === h - 1 ? tones[2] : tones[1]) ?? empty
    for (let dx = 0; dx < w; dx += 1) put(c, x + dx, y + dy, dx < filled ? tone : empty)
  }
}

/** A button's height, and the inks of its states: ready, off (it cannot act now), armed (white, pressing it acts). */
export const BUTTON_H = 11
export type ButtonState = 'ready' | 'off' | 'armed'
const BUTTON_BG = { ready: '#1f1c27', off: '#141219', armed: '#1f1c27' } as const
const BUTTON_EDGE = { ready: '#4a4456', off: '#24212c', armed: CURSOR } as const
const BUTTON_LIT = '#2c2836'
const OFF_INK = '#5a5664'
const LABEL_INK = '#e8e4dc'

/** A button's width: its key, its label and, when it costs, a price; three pixels of room between and round them. */
export const buttonW = (key: string, label: string, cost?: number) => 3 + textW(key) + 3 + textW(label) + (cost === undefined ? 0 : 3 + priceW(cost)) + 3

/** A pixel button at x, y: its key in gold, its label, its price (grey when it cannot be paid); all grey when off. Returns its width. */
export const button = (c: Canvas, key: string, label: string, x: number, y: number, state: ButtonState, cost?: number, canPay = true) => {
  const w = buttonW(key, label, cost)
  fill(c, x, y, w, BUTTON_H, BUTTON_BG[state])
  frame(c, x, y, w, BUTTON_H, BUTTON_EDGE[state])
  // A lit top edge, so it reads as raised.
  if (state !== 'off') fill(c, x + 1, y + 1, w - 2, 1, BUTTON_LIT)
  word(c, key, x + 3, y + 3, state === 'off' ? OFF_INK : GOLD_INK)
  const lx = x + 3 + textW(key) + 3
  word(c, label, lx, y + 3, state === 'off' ? OFF_INK : LABEL_INK)
  if (cost !== undefined) price(c, cost, lx + textW(label) + 3, y + 3, canPay && state !== 'off')
  return w
}

/** A portrait's size: an 8 by 8 sprite at three times its size, inside a two pixel frame. */
export const PORTRAIT = PX * 3 + 4
const PORTRAIT_BG = '#1c2230'
const PORTRAIT_FLOOR = '#232a3a'
const PORTRAIT_EDGE = '#6b6258'

/** A portrait at x, y: the sprite three times its size on a lit backdrop with a floor, in a double frame. */
export const portrait = (c: Canvas, rows: readonly string[], x: number, y: number) => {
  fill(c, x, y, PORTRAIT, PORTRAIT, PORTRAIT_BG)
  fill(c, x + 2, y + PORTRAIT - 8, PORTRAIT - 4, 6, PORTRAIT_FLOOR)
  frame(c, x, y, PORTRAIT, PORTRAIT, PORTRAIT_EDGE)
  frame(c, x + 1, y + 1, PORTRAIT - 2, PORTRAIT - 2, GRID)
  rows.forEach((row, dy) => [...row].forEach((k, dx) => {
    if (k !== '.') fill(c, x + 2 + dx * 3, y + 2 + dy * 3, 3, 3, PAL[k] ?? '#ff00ff')
  }))
}

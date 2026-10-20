// The retire window: the pieces the hero wears to choose the heirloom from, Retire and Back, and in the box under them
// the chosen piece's name, what passing it down means and who the hero was. Pure: the click layer reports whole
// gestures, this decides the window's next state and the game actions they make.
import type { Game, Item, Slot } from '../types'
import type { Action, Run } from './game'
import { whyNotRetire } from './game'
import { BIG_EVERY } from './map'
import { CLASS_NAME, RARITY_COLOR, SLOTS } from './items'
import { ICONS } from './icons'
import { BUTTON_H, button, buttonW, tierBox } from './pieces'
import { art, canvas, fill, frame } from './canvas'
import { chosenSlot } from './forge'
import type { ForgeUi } from './forge'
import { INK, SURFACE } from './ui/tokens'
import { CLICK_SLOP, CLOSE_BOX, WINDOW_W, bodyTop, drawBox, isInside, pixel, windowPixels, word } from './window'
import type { Chrome, Gesture, OverlayBox, Rect } from './window'

const CHROME: Chrome = { title: 'RETIRE THE HERO', labels: [] }
const top = bodyTop(CHROME)
const PAD = 3
const RULE = '#2c2834'
const BOX_BG = '#141219'
/** A worn piece's box, and the step from one to the next. */
const BOX_W = 13
const BOX_H = 23
const BOX_STEP = 14
const BOXES_Y = 12
const RETIRE = { key: 'R', label: 'RETIRE' }
const BACK = { key: 'B', label: 'BACK' }
const ASK = 'CHOOSE AN HEIRLOOM'
const TELL = 'Every new hero starts wearing it, its power kept and its stats plain.'

/** The piece the window has chosen: the one picked, else the first worn. */
export type RetireUi = ForgeUi

const many = (n: number, one: string, more = `${one}s`) => `${n} ${n === 1 ? one : more}`
const worn = (g: Game) => SLOTS.filter(s => g.gear[s] !== undefined)

/** Where everything goes, in window pixels: the worn pieces, the buttons centered under them. */
const layout = (g: Game, ui: RetireUi) => {
  const slot = chosenSlot(g, ui)
  const item = slot === undefined ? undefined : g.gear[slot]
  const boxes = worn(g).map((s, i) => ({ slot: s, x: PAD + i * BOX_STEP, y: top + BOXES_Y }))
  const buttonsY = top + BOXES_Y + BOX_H + 4
  const [rw, bw] = [buttonW(RETIRE.key, RETIRE.label), buttonW(BACK.key, BACK.label)]
  const retire: Rect = { x: Math.floor((WINDOW_W - rw - 4 - bw) / 2), y: buttonsY, w: rw, h: BUTTON_H }
  const back: Rect = { x: retire.x + retire.w + 4, y: buttonsY, w: bw, h: BUTTON_H }
  return { slot, item, boxes, retire, back }
}

/** The lines the window says in pixels, where (window pixels) and in what ink: what it asks. */
export const retireLines = () => [{ text: ASK, x: PAD, y: top + 3, ink: INK.dim }]

/** The box under the buttons, in cells: the chosen piece's name in its tier's color, what passing it down means,
 * who the hero was. */
export const retireOverlay = (g: Game, ui: RetireUi): OverlayBox[] => {
  const l = layout(g, ui)
  const who = `Level ${g.level} ${CLASS_NAME[g.cls]}, deepest ${g.deepest}, ${many(Math.floor(g.bossSlain / BIG_EVERY), 'big boss', 'big bosses')}.`
  const lines: Run[][] = [
    ...(l.item === undefined ? [] : [[{ text: l.item.name, bold: true, color: RARITY_COLOR[l.item.rarity] }]]),
    [{ text: TELL }],
    [{ text: who, dim: true }],
  ]
  return [{ role: 'about', x: 2, y: Math.ceil((l.retire.y + BUTTON_H + 3) / 2), w: WINDOW_W - 4, h: lines.length + 2, border: SURFACE.frame, lines }]
}

/** The window's height in pixels, title bar and all. */
export const retireHeight = (g: Game, ui: RetireUi) => {
  const box = retireOverlay(g, ui)[0]!
  return 2 * (box.y + box.h) + 2
}

/** Where each worn piece's box is, in window pixels. */
export const retireBoxes = (g: Game, ui: RetireUi): { slot: Slot; x: number; y: number }[] => layout(g, ui).boxes

/** Where Retire and Back are, in window pixels. */
export const retireButtons = (g: Game, ui: RetireUi) => {
  const l = layout(g, ui)
  return { retire: l.retire, back: l.back }
}

const pieceBox = (c: ReturnType<typeof canvas>, item: Item, x: number, y: number, isChosen: boolean) => {
  if (item.rarity === 'common') {
    fill(c, x, y, BOX_W, BOX_H, BOX_BG)
    frame(c, x, y, BOX_W, BOX_H, RULE)
  } else tierBox(c, x + 1, y + 1, BOX_W - 2, BOX_H - 2, item.rarity)
  const icon = ICONS[item.base]?.art ?? []
  art(c, icon, x + Math.floor((BOX_W - (icon[0]?.length ?? 0)) / 2), y + Math.floor((BOX_H - icon.length) / 2))
  if (isChosen) frame(c, x - 1, y - 1, BOX_W + 2, BOX_H + 2, INK.focus)
}

/** The window's pixels: title bar, what it asks, the worn pieces with the chosen one framed, the buttons, the box. */
export const retirePixels = (g: Game, ui: RetireUi): string[][] => {
  const l = layout(g, ui)
  const body = canvas(WINDOW_W, retireHeight(g, ui) - top)
  for (const b of l.boxes) pieceBox(body, g.gear[b.slot]!, b.x, b.y - top, b.slot === l.slot)
  for (const line of retireLines()) word(body, line.text, line.x, line.y - top, line.ink)
  button(body, RETIRE.key, RETIRE.label, l.retire.x, l.retire.y - top, l.slot !== undefined && whyNotRetire(g, l.slot) === undefined ? 'ready' : 'off')
  button(body, BACK.key, BACK.label, l.back.x, l.back.y - top, 'ready')
  const c = windowPixels(CHROME, body.px)
  for (const b of retireOverlay(g, ui)) drawBox(c, b)
  return c.px
}

/** The window's next state and the game actions for one gesture: a piece chosen, Retire, Back to the sheet, the window closed. */
export const retireGesture = (g: Game, ui: RetireUi, gesture: Gesture): { ui: RetireUi; actions: Action[] } => {
  const none = { ui, actions: [] }
  if (gesture.type === 'drag') return none
  const from = pixel(gesture.from)
  const at = pixel(gesture.at)
  if (Math.max(Math.abs(at.x - from.x), Math.abs(at.y - from.y)) >= CLICK_SLOP) return none
  const l = layout(g, ui)
  const r = (b: Rect) => isInside(at, b.x, b.y, b.w, b.h)
  const picked = l.boxes.find(b => r({ x: b.x, y: b.y, w: BOX_W, h: BOX_H }))
  if (picked !== undefined) return { ui: { slot: picked.slot }, actions: [] }
  if (r(l.retire)) return l.slot !== undefined && whyNotRetire(g, l.slot) === undefined ? { ui, actions: [{ kind: 'retire', slot: l.slot }] } : none
  if (r(l.back)) return { ui, actions: [{ kind: 'panel', panel: 'sheet' }] }
  return isInside(at, ...CLOSE_BOX) ? { ui, actions: [{ kind: 'panel', panel: 'retire' }] } : none
}

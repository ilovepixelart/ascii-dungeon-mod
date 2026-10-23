// The retire window, laid out as the smith's: what the hero wears on the left, as in the inventory, to choose the
// heirloom from; on the right the box of what it asks with the chosen piece's name, what passing it down means and who
// the hero was, and Retire and Back under it. Pure: the click layer reports whole gestures, this decides the window's
// next state and the game actions they make.
import type { Game, Slot } from '../types'
import type { Action, Run } from './game'
import { whyNotRetire } from './game'
import { BIG_EVERY } from './map'
import { CLASS_NAME, RARITY_COLOR, SLOTS } from './items'
import { WORN_SLOTS, wornSlots } from './inventory'
import { BUTTON_H, CURSOR, button, buttonBox, buttonW } from './pieces'
import type { ButtonState } from './pieces'
import { GRID, canvas, frame } from './canvas'
import { WORK_X, chosenSlot } from './forge'
import type { ForgeUi } from './forge'
import { SURFACE } from './ui/tokens'
import { CLICK_SLOP, CLOSE_BOX, WINDOW_TOP, WINDOW_W, drawBox, isInside, pixel, windowPixels } from './window'
import type { Chrome, Gesture, OverlayBox, Rect } from './window'

const CHROME: Chrome = { title: 'RETIRE THE HERO' }
const top = WINDOW_TOP
const RETIRE = { key: 'R', label: 'RETIRE' }
const BACK = { key: 'B', label: 'BACK' }
const ASK = 'Choose an heirloom'
const TELL = ['Every new hero starts wearing it,', 'its power kept and its stats plain.']

/** The piece the window has chosen: the one picked, else the first worn. */
export type RetireUi = ForgeUi

const many = (n: number, one: string, more = `${one}s`) => `${n} ${n === 1 ? one : more}`
const worn = (g: Game) => SLOTS.filter(s => g.gear[s] !== undefined)
/** A worn slot in window pixels. */
const slotRect = (slot: Slot): Rect => {
  const [x, y, w, h] = WORN_SLOTS[slot]
  return { x, y: top + y, w, h }
}

/** What it asks with the chosen piece's name in its tier's color, on a line of its own, what passing it down means,
 * who the hero was. */
const aboutLines = (g: Game, slot: Slot | undefined): Run[][] => {
  const item = slot === undefined ? undefined : g.gear[slot]
  const who = `Level ${g.level} ${CLASS_NAME[g.cls]}, deepest ${g.deepest}, ${many(Math.floor(g.bossSlain / BIG_EVERY), 'big boss', 'big bosses')}.`
  return [
    [{ text: item === undefined ? `${ASK}.` : `${ASK}:` }],
    ...(item === undefined ? [] : [[{ text: item.name, bold: true, color: RARITY_COLOR[item.rarity] }]]),
    ...TELL.map(text => [{ text }]),
    [{ text: who, dim: true }],
  ]
}

/** Where everything goes, in window pixels: the box beside the worn slots, Retire and Back under it. */
const layout = (g: Game, ui: RetireUi) => {
  const slot = chosenSlot(g, ui)
  const lines = aboutLines(g, slot)
  const box: OverlayBox = { role: 'about', x: WORK_X, y: (top + 2) / 2, w: WINDOW_W - WORK_X - 1, h: lines.length + 2, border: SURFACE.frame, lines }
  const retire: Rect = { x: WORK_X, y: (box.y + box.h) * 2 + 2, w: buttonW(RETIRE.label), h: BUTTON_H }
  const back: Rect = { x: retire.x + retire.w + 4, y: retire.y, w: buttonW(BACK.label), h: BUTTON_H }
  const retireState: ButtonState = slot !== undefined && whyNotRetire(g, slot) === undefined ? 'armed' : 'off'
  const end = Math.max(top + 58, retire.y + BUTTON_H)
  return { slot, box, retire, back, retireState, height: Math.ceil((end + 3) / 2) * 2 }
}

/** The box beside the worn slots, in cells, then the buttons' words. */
export const retireOverlay = (g: Game, ui: RetireUi): OverlayBox[] => {
  const l = layout(g, ui)
  return [l.box, buttonBox(RETIRE.label, l.retire.x, l.retire.y, l.retireState), buttonBox(BACK.label, l.back.x, l.back.y, 'ready')]
}

/** The window's height in pixels, title bar and all. */
export const retireHeight = (g: Game, ui: RetireUi) => layout(g, ui).height

/** Where each worn piece's slot is, in window pixels. */
export const retireBoxes = (g: Game): ({ slot: Slot } & Rect)[] => worn(g).map(slot => ({ slot, ...slotRect(slot) }))

/** Where Retire and Back are, in window pixels. */
export const retireButtons = (g: Game, ui: RetireUi) => {
  const l = layout(g, ui)
  return { retire: l.retire, back: l.back }
}

/** The window's pixels: title bar, the worn slots with the chosen one framed white as the smith's, the buttons, the box. */
export const retirePixels = (g: Game, ui: RetireUi): string[][] => {
  const l = layout(g, ui)
  const body = canvas(WINDOW_W, l.height - top)
  wornSlots(body, g, slot => (slot === l.slot ? CURSOR : GRID))
  button(body, RETIRE.label, l.retire.x, l.retire.y - top, l.retireState)
  button(body, BACK.label, l.back.x, l.back.y - top, 'ready')
  const c = windowPixels(CHROME, body.px)
  for (const b of retireOverlay(g, ui)) if (b.role !== 'button') drawBox(c, b)
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
  const picked = retireBoxes(g).find(r)
  if (picked !== undefined) return { ui: { slot: picked.slot }, actions: [] }
  if (r(l.retire)) return l.slot !== undefined && whyNotRetire(g, l.slot) === undefined ? { ui, actions: [{ kind: 'retire', slot: l.slot }] } : none
  if (r(l.back)) return { ui, actions: [{ kind: 'panel', panel: 'sheet' }] }
  return isInside(at, ...CLOSE_BOX) ? { ui, actions: [{ kind: 'panel', panel: 'retire' }] } : none
}

/** What a click acts on, in window pixels: the worn pieces not chosen, Retire once it can, and Back. */
export const retireHot = (g: Game, ui: RetireUi): Rect[] => {
  const l = layout(g, ui)
  return [...worn(g).filter(s => s !== l.slot).map(slotRect), ...(l.slot !== undefined && whyNotRetire(g, l.slot) === undefined ? [l.retire] : []), l.back]
}

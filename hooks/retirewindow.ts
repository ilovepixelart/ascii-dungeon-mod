// The retire window: the hero's portrait and what they did, the pieces they wear to choose the heirloom from, its name,
// what passing it down means, Retire and Back. Pure: the click layer reports whole gestures, this decides the window's
// next state and the game actions they make.
import type { Game, Item, Slot } from '../types'
import type { Action } from './game'
import { whyNotRetire } from './game'
import { BIG_EVERY } from './map'
import { CLASS_NAME, RARITY_COLOR, SLOTS } from './items'
import { ICONS } from './icons'
import { heroArt } from './pixelart'
import { BUTTON_H, PORTRAIT, button, buttonW, portrait, tierBox } from './pieces'
import { art, canvas, fill, frame } from './canvas'
import { chosenSlot } from './forge'
import type { ForgeUi } from './forge'
import { wrap } from './recapwindow'
import { CLICK_SLOP, CLOSE_BOX, WINDOW_W, bodyTop, isInside, pixel, windowPixels, word } from './window'
import type { Chrome, Gesture, Rect } from './window'

const CHROME: Chrome = { title: 'RETIRE THE HERO', labels: [] }
const top = bodyTop(CHROME)
const PAD = 3
const SIDE_X = PAD + PORTRAIT + 4
const LINE = 7
const DIM = '#8a8494'
const SAY = '#e8e4dc'
const RULE = '#2c2834'
const BOX_BG = '#141219'
const CHOSEN = '#ffffff'
/** A worn piece's box, and the step from one to the next. */
const BOX_W = 13
const BOX_H = 23
const BOX_STEP = 14
const RETIRE = { key: 'R', label: 'RETIRE' }
const BACK = { key: 'B', label: 'BACK' }
const TELL = 'EVERY NEW HERO STARTS WEARING IT WITH ITS POWER KEPT AND ITS STATS PLAIN'

/** The piece the window has chosen: the one picked, else the first worn. */
export type RetireUi = ForgeUi

const many = (n: number, one: string, more = `${one}S`) => `${n} ${n === 1 ? one : more}`
const worn = (g: Game) => SLOTS.filter(s => g.gear[s] !== undefined)

/** Where everything goes, in window pixels: who the hero was, the worn pieces, the chosen one's name, what it means, the buttons. */
const layout = (g: Game, ui: RetireUi) => {
  const slot = chosenSlot(g, ui)
  const item = slot === undefined ? undefined : g.gear[slot]
  const ruleY = top + PORTRAIT + 5
  const boxesY = ruleY + 12
  const boxes = worn(g).map((s, i) => ({ slot: s, x: PAD + i * BOX_STEP, y: boxesY }))
  const name = item === undefined ? [] : wrap(item.name.toUpperCase(), WINDOW_W - 2 * PAD)
  const tell = wrap(TELL, WINDOW_W - 2 * PAD)
  const nameY = boxesY + BOX_H + 4
  const tellY = nameY + name.length * LINE + 2
  const buttonsY = tellY + tell.length * LINE + 3
  const retire: Rect = { x: PAD, y: buttonsY, w: buttonW(RETIRE.key, RETIRE.label), h: BUTTON_H }
  const back: Rect = { x: retire.x + retire.w + 4, y: buttonsY, w: buttonW(BACK.key, BACK.label), h: BUTTON_H }
  // Even, so the window ends on a whole cell.
  const height = Math.ceil((buttonsY + BUTTON_H + 3) / 2) * 2
  return { slot, item, ruleY, boxes, name, nameY, tell, tellY, retire, back, height }
}

/** The lines the window says, where (window pixels) and in what ink. */
export const retireLines = (g: Game, ui: RetireUi) => {
  const l = layout(g, ui)
  return [
    { text: `LEVEL ${g.level} ${CLASS_NAME[g.cls].toUpperCase()}`, x: SIDE_X, y: top + 4, ink: SAY },
    { text: `DEEPEST ${g.deepest}`, x: SIDE_X, y: top + 4 + LINE, ink: SAY },
    { text: many(Math.floor(g.bossSlain / BIG_EVERY), 'BIG BOSS', 'BIG BOSSES'), x: SIDE_X, y: top + 4 + 2 * LINE, ink: SAY },
    { text: 'CHOOSE AN HEIRLOOM', x: PAD, y: l.ruleY + 4, ink: DIM },
    ...l.name.map((text, i) => ({ text, x: PAD, y: l.nameY + i * LINE, ink: RARITY_COLOR[l.item!.rarity] })),
    ...l.tell.map((text, i) => ({ text, x: PAD, y: l.tellY + i * LINE, ink: DIM })),
  ]
}

/** The window's height in pixels, title bar and all. */
export const retireHeight = (g: Game, ui: RetireUi) => layout(g, ui).height

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
  if (isChosen) frame(c, x - 1, y - 1, BOX_W + 2, BOX_H + 2, CHOSEN)
}

/** The window's pixels: title bar, portrait, the rule, the worn pieces with the chosen one framed, the lines and the buttons. */
export const retirePixels = (g: Game, ui: RetireUi): string[][] => {
  const l = layout(g, ui)
  const body = canvas(WINDOW_W, l.height - top)
  portrait(body, heroArt(g), PAD, 2)
  fill(body, PAD, l.ruleY - top, WINDOW_W - 2 * PAD, 1, RULE)
  for (const b of l.boxes) pieceBox(body, g.gear[b.slot]!, b.x, b.y - top, b.slot === l.slot)
  for (const line of retireLines(g, ui)) word(body, line.text, line.x, line.y - top, line.ink)
  button(body, RETIRE.key, RETIRE.label, l.retire.x, l.retire.y - top, l.slot !== undefined && whyNotRetire(g, l.slot) === undefined ? 'ready' : 'off')
  button(body, BACK.key, BACK.label, l.back.x, l.back.y - top, 'ready')
  return windowPixels(CHROME, body.px).px
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

// The smith's window: what the hero wears on the left, as in the inventory; on the right the chosen piece's card,
// its tempering so far and what one more would make of it, and the two jobs with their prices or why not.
// Pure: the click layer reports whole gestures, this decides the window's next state and the game actions to apply.
import type { Game, Item, Slot } from '../types'
import type { Action, Run } from './game'
import { keptChoice, reforgeCost } from './game'
import { RARITY_COLOR, SLOTS, TEMPER_MAX, describe, temperCost, temperStat } from './items'
import { WORN_SLOTS, wornOutlines, wornSlots } from './inventory'
import { card } from './bagui'
import { BUTTON_H, CURSOR, OFF_CLASS, UNPAID_INK, button, buttonW } from './pieces'
import type { ButtonState } from './pieces'
import { GRID, canvas, fill, frame } from './canvas'
import { WINDOW_TOP, CLICK_SLOP, CLOSE_BOX, WINDOW_W, drawBox, isInside, pixel, windowPixels, word } from './window'
import type { Gesture, OverlayBox, Rect } from './window'
import type { Pos } from './map'
import { INK, SURFACE } from './ui/tokens'

/** What the window shows beyond the game: the worn piece chosen. */
export type ForgeUi = { slot: Slot | null }
export const FORGE_UI_IDLE: ForgeUi = { slot: null }

const WORK_X = 47
const WORK_W = WINDOW_W - WORK_X - 1
const PIP_ON = INK.xp
const PIP_OFF = SURFACE.cardEdge

/** The worn pieces in slot order. */
const worn = (g: Game) => SLOTS.filter(s => g.gear[s] !== undefined)

/** The piece being worked on: the one chosen while it is still worn, else the first worn. */
export const chosenSlot = (g: Game, ui: ForgeUi): Slot | undefined => (ui.slot !== null && g.gear[ui.slot] !== undefined ? ui.slot : worn(g)[0])

/** Why the smith cannot temper or reforge a piece now, or undefined when they can. */
export const whyNotTemper = (g: Game, item: Item) => ((item.temper ?? 0) >= TEMPER_MAX ? 'tempered as far as it goes' : g.gold < temperCost(item) ? 'not enough gold' : undefined)
export const whyNotReforge = (g: Game, item: Item) =>
  item.rarity === 'common' ? 'a Common has no affixes' : item.rarity === 'legendary' ? 'a Legendary stays as it was made' : g.gold < reforgeCost(g) ? 'not enough gold' : undefined

const cost = (label: string, price: number | undefined, why: string | undefined): Run[] =>
  why === undefined || why === 'not enough gold'
    ? [{ text: `${label} `, dim: true }, { text: String(price), color: why === undefined ? INK.gold : OFF_CLASS }, ...(why === undefined ? [] : [{ text: `  ${why}`, color: OFF_CLASS }])]
    : [{ text: `${label} `, dim: true }, { text: why, color: OFF_CLASS }]

/** The chosen piece's card: name, tier and stats, then what each job costs or why it cannot be done. */
const workCard = (g: Game, item: Item): Run[][] => {
  const lines = card(g, item, undefined, false)
  const isMaxed = (item.temper ?? 0) >= TEMPER_MAX
  const from = keptChoice(g)
  return [
    ...lines.slice(0, -1),
    ...(from !== undefined && from.item.id === item.id ? [[{ text: 'Before: ', dim: true }, { text: `${from.item.name}, ${describe(from.item)}`, color: RARITY_COLOR[from.item.rarity] }]] : []),
    cost('Temper', isMaxed ? undefined : temperCost(item), whyNotTemper(g, item)),
    cost('Reforge', reforgeCost(g), whyNotReforge(g, item)),
  ]
}

/** Whether the chosen piece's last reforge can be taken back: the old one is there to keep. */
const canKeepOld = (g: Game, slot: Slot | undefined) => slot !== undefined && keptChoice(g)?.slot === slot

/** Where things go, in window pixels: the card, the temper line, the two buttons. */
const layout = (g: Game, ui: ForgeUi) => {
  const slot = chosenSlot(g, ui)
  const item = slot === undefined ? undefined : g.gear[slot]
  const lines = item === undefined ? [[{ text: 'You wear nothing for the smith to work on.', dim: true }]] : workCard(g, item)
  const box: OverlayBox<'card'> = { role: 'card', x: WORK_X, y: (WINDOW_TOP + 2) / 2, w: WORK_W, h: lines.length + 2, border: item === undefined ? SURFACE.frame : RARITY_COLOR[item.rarity], lines }
  const temperY = (box.y + box.h) * 2 + 3
  const temperAt: Rect = { x: WORK_X, y: temperY + 8, w: buttonW('T', 'TEMPER'), h: BUTTON_H }
  const reforgeAt: Rect = { x: WORK_X, y: temperAt.y + BUTTON_H + 2, w: buttonW('R', 'REFORGE'), h: BUTTON_H }
  const keepAt: Rect | undefined = canKeepOld(g, slot) ? { x: WORK_X, y: reforgeAt.y + BUTTON_H + 2, w: buttonW('K', 'KEEP OLD'), h: BUTTON_H } : undefined
  const end = Math.max(WINDOW_TOP + 58, item === undefined ? (box.y + box.h) * 2 : (keepAt ?? reforgeAt).y + BUTTON_H)
  return { slot, item, box, temperY, temperAt, reforgeAt, keepAt, height: Math.ceil((end + 3) / 2) * 2 }
}

export const forgeHeight = (g: Game, ui: ForgeUi) => layout(g, ui).height
export const forgeOverlay = (g: Game, ui: ForgeUi): OverlayBox[] => [layout(g, ui).box]

/** The temper line: a pip a tempering, filled as far as done; then the stat now and after one more, or MAX. */
const temperLine = (c: ReturnType<typeof canvas>, item: Item, y: number) => {
  const done = item.temper ?? 0
  for (let i = 0; i < TEMPER_MAX; i += 1) {
    frame(c, WORK_X + i * 5, y, 4, 4, i < done ? PIP_ON : PIP_OFF)
    if (i < done) fill(c, WORK_X + i * 5 + 1, y + 1, 2, 2, PIP_ON)
  }
  const stat = temperStat(item)
  const now = item[stat]
  word(c, done >= TEMPER_MAX ? `${stat.toUpperCase()} ${now} MAX` : `${stat.toUpperCase()} ${now} > ${now + 1}`, WORK_X + TEMPER_MAX * 5 + 3, y, done >= TEMPER_MAX ? UNPAID_INK : INK.text)
}

const stateOf = (why: string | undefined): ButtonState => (why === undefined ? 'ready' : 'off')

/** The window's pixels: title and gold, the worn slots with the chosen one framed white, the work side. */
export const forgePixels = (g: Game, ui: ForgeUi): string[][] => {
  const l = layout(g, ui)
  const body = canvas(WINDOW_W, l.height - WINDOW_TOP)
  wornSlots(body, g, () => GRID)
  // White just outside the slot's frame, where a worn piece's tier frame cannot cover it.
  if (l.slot !== undefined) {
    const [x, y, w, h] = WORN_SLOTS[l.slot]
    frame(body, x - 2, y - 2, w + 4, h + 4, CURSOR)
  }
  if (l.item !== undefined) {
    temperLine(body, l.item, l.temperY - WINDOW_TOP)
    button(body, 'T', 'TEMPER', l.temperAt.x, l.temperAt.y - WINDOW_TOP, stateOf(whyNotTemper(g, l.item)))
    button(body, 'R', 'REFORGE', l.reforgeAt.x, l.reforgeAt.y - WINDOW_TOP, stateOf(whyNotReforge(g, l.item)))
    if (l.keepAt !== undefined) button(body, 'K', 'KEEP OLD', l.keepAt.x, l.keepAt.y - WINDOW_TOP, 'ready')
  }
  const c = windowPixels({ title: 'SMITH', gold: g.gold, labels: [] }, body.px)
  drawBox(c, l.box)
  return c.px
}

const wornAt = (g: Game, p: Pos) => SLOTS.find(s => g.gear[s] !== undefined && isInside({ x: p.x, y: p.y - WINDOW_TOP }, ...WORN_SLOTS[s]))

type Outcome = { ui: ForgeUi; actions: Action[] }

/** The window's next state and the game actions for one gesture: a worn piece chosen, a job done, the window closed. */
export const forgeGesture = (g: Game, ui: ForgeUi, gesture: Gesture): Outcome => {
  if (gesture.type === 'drag') return { ui, actions: [] }
  const from = pixel(gesture.from)
  const at = pixel(gesture.at)
  if (Math.max(Math.abs(at.x - from.x), Math.abs(at.y - from.y)) >= CLICK_SLOP) return { ui, actions: [] }
  const slot = wornAt(g, at)
  if (slot !== undefined) return { ui: { slot }, actions: [] }
  const l = layout(g, ui)
  const r = (b: Rect) => isInside(at, b.x, b.y, b.w, b.h)
  if (l.slot !== undefined && l.item !== undefined && r(l.temperAt) && whyNotTemper(g, l.item) === undefined) return { ui, actions: [{ kind: 'temper', slot: l.slot }] }
  if (l.slot !== undefined && l.item !== undefined && r(l.reforgeAt) && whyNotReforge(g, l.item) === undefined) return { ui, actions: [{ kind: 'reforge', slot: l.slot }] }
  if (l.keepAt !== undefined && r(l.keepAt)) return { ui, actions: [{ kind: 'keepOld' }] }
  if (isInside(at, ...CLOSE_BOX)) return { ui: FORGE_UI_IDLE, actions: [{ kind: 'panel', panel: 'forge' }] }
  return { ui, actions: [] }
}

/** The next worn piece after the chosen one, for the key that steps through them. */
export const nextWorn = (g: Game, ui: ForgeUi): ForgeUi => {
  const all = worn(g)
  const at = all.indexOf(chosenSlot(g, ui) ?? all[0]!)
  return { slot: all[(at + 1) % all.length] ?? null }
}

/** What a click acts on, in window pixels: the worn pieces not chosen, and the jobs that can be done. */
export const forgeHot = (g: Game, ui: ForgeUi): Rect[] => {
  const l = layout(g, ui)
  const jobs = l.item === undefined ? [] : [
    ...(whyNotTemper(g, l.item) === undefined ? [l.temperAt] : []),
    ...(whyNotReforge(g, l.item) === undefined ? [l.reforgeAt] : []),
    ...(l.keepAt === undefined ? [] : [l.keepAt]),
  ]
  return [...wornOutlines({ ...g, gear: Object.fromEntries(Object.entries(g.gear).filter(([s]) => s !== l.slot)) }, WINDOW_TOP), ...jobs]
}

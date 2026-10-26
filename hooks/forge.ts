// The smith's window: what the hero wears on the left, as in the inventory; on the right the chosen piece's card,
// its tempering so far and what one more would make of it, and the two jobs with their prices or why not.
// Pure: the click layer reports whole gestures, this decides the window's next state and the game actions to apply.
import type { Game, Item, Slot } from '../types'
import type { Action, Run } from './game'
import { keptChoice, reforgeCost } from './game'
import { POWERS, RARITY_COLOR, SETS, SET_COLOR, SLOTS, TEMPER_MAX, TRIGGERS, describe, setWorn, temperCost, temperStat } from './items'
import { WORN_END, WORN_SLOTS, wornOutlines, wornSlots } from './inventory'
import { card } from './bagui'
import { BUTTON_H, CURSOR, OFF_CLASS, buttonFace, buttonW, runX, wideButtonBox } from './pieces'
import type { ButtonState } from './pieces'
import { GRID, canvas, fill, frame } from './canvas'
import { WINDOW_TOP, CLICK_SLOP, CLOSE_BOX, WINDOW_W, drawBox, isInside, pixel, windowPixels } from './window'
import type { Gesture, OverlayBox, Rect } from './window'
import type { Pos } from './map'
import { INK, SURFACE } from './ui/tokens'
import { countText } from './names'

/** What the window shows beyond the game: the worn piece chosen. */
export type ForgeUi = { slot: Slot | null }
export const FORGE_UI_IDLE: ForgeUi = { slot: null }

/** Where the side beside the worn slots begins, here and in the retire window. */
export const WORK_X = 47
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
    ? [{ text: `${label} `, dim: true }, { text: price === undefined ? '' : countText(price), color: why === undefined ? INK.gold : OFF_CLASS }, ...(why === undefined ? [] : [{ text: `  ${why}`, color: OFF_CLASS }])]
    : [{ text: `${label} `, dim: true }, { text: why, color: OFF_CLASS }]

/** Tempering's line: its price or why not, and the stat it raises, now and after one more. */
const temperRuns = (g: Game, item: Item): Run[] => {
  const stat = temperStat(item)
  const now = item[stat]
  const why = whyNotTemper(g, item)
  if ((item.temper ?? 0) >= TEMPER_MAX) return [...cost('Temper', undefined, why), { text: `  ${stat.toUpperCase()} ${now}`, dim: true }]
  const [label, price, ...rest] = cost('Temper', temperCost(item), why)
  return [label!, price!, { text: `  ${stat.toUpperCase()} ${now} > ${now + 1}` }, ...rest]
}

/** What a piece carries beyond its stats, by name alone: its power, trigger or set. The bag's card says what each does. */
const traitLines = (g: Game, item: Item): Run[][] => [
  ...(item.power === undefined ? [] : [[{ text: POWERS[item.power] ?? item.power, color: RARITY_COLOR.legendary }]]),
  ...(item.trigger === undefined ? [] : [[{ text: TRIGGERS[item.trigger].name, color: RARITY_COLOR[item.rarity], bold: true }]]),
  ...(item.set === undefined ? [] : [[{ text: `${SETS[item.set].name}, ${setWorn(g, item.set)} of ${SETS[item.set].pieces.length} worn`, color: SET_COLOR }]]),
]

/** The piece as it was before its last reforge: its name in its tier's color, its stats under it. */
const beforeLines = (before: Item): Run[][] => [
  [{ text: 'Before: ', dim: true }, { text: before.name, color: RARITY_COLOR[before.rarity] }],
  [{ text: `        ${describe(before)}`, dim: true }],
]

/**
 * The chosen piece's card, what the smith works on: name, tier, stats on one line, what it carries by name, what it
 * was before a reforge, then what each job costs or why it cannot be done.
 */
const workCard = (g: Game, item: Item): Run[][] => {
  const [name, tier] = card(g, item, undefined, false)
  const from = keptChoice(g)
  return [
    name!,
    tier!,
    [{ text: describe(item) }],
    ...traitLines(g, item),
    ...(from !== undefined && from.item.id === item.id ? beforeLines(from.item) : []),
    temperRuns(g, item),
    cost('Reforge', reforgeCost(g), whyNotReforge(g, item)),
  ]
}

/** Whether the chosen piece's last reforge can be taken back: the old one is there to keep. */
const canKeepOld = (g: Game, slot: Slot | undefined) => slot !== undefined && keptChoice(g)?.slot === slot

const stateOf = (why: string | undefined): ButtonState => (why === undefined ? 'ready' : 'off')

/** Where things go, in window pixels: the card, the buttons under it, the temper pips beside Temper. */
const layout = (g: Game, ui: ForgeUi) => {
  const slot = chosenSlot(g, ui)
  const item = slot === undefined ? undefined : g.gear[slot]
  const lines = item === undefined ? [[{ text: 'You wear nothing for the smith to work on.', dim: true }]] : workCard(g, item)
  const box: OverlayBox<'card'> = { role: 'card', x: WORK_X, y: (WINDOW_TOP + 2) / 2, w: WORK_W, h: lines.length + 2, border: item === undefined ? SURFACE.frame : RARITY_COLOR[item.rarity], lines }
  // The jobs stand one under another, each as wide as the widest of them, the stack centred under the card.
  const w = Math.max(...['TEMPER', 'REFORGE', ...(canKeepOld(g, slot) ? ['KEEP OLD'] : [])].map(l => buttonW(l)))
  const x = runX(w, box.x, box.x + box.w)
  const temperAt: Rect = { x, y: (box.y + box.h) * 2 + 2, w, h: BUTTON_H }
  const reforgeAt: Rect = { x, y: temperAt.y + BUTTON_H + 2, w, h: BUTTON_H }
  const keepAt: Rect | undefined = canKeepOld(g, slot) ? { x, y: reforgeAt.y + BUTTON_H + 2, w, h: BUTTON_H } : undefined
  const end = Math.max(WINDOW_TOP + WORN_END, item === undefined ? (box.y + box.h) * 2 : (keepAt ?? reforgeAt).y + BUTTON_H)
  const buttons = item === undefined ? [] : [
    { key: 'T', label: 'TEMPER', at: temperAt, state: stateOf(whyNotTemper(g, item)) },
    { key: 'R', label: 'REFORGE', at: reforgeAt, state: stateOf(whyNotReforge(g, item)) },
    ...(keepAt === undefined ? [] : [{ key: 'K', label: 'KEEP OLD', at: keepAt, state: 'ready' as const }]),
  ]
  // A pixel of room under the last row, as the bag keeps under its belt, on a whole cell.
  return { slot, item, box, temperAt, reforgeAt, keepAt, buttons, height: Math.ceil((end + 1) / 2) * 2 }
}

export const forgeHeight = (g: Game, ui: ForgeUi) => layout(g, ui).height
/** The work card, then the buttons' words. */
export const forgeOverlay = (g: Game, ui: ForgeUi): OverlayBox[] => {
  const l = layout(g, ui)
  return [l.box, ...l.buttons.map(b => wideButtonBox(b.label, b.at.x, b.at.y, b.at.w, b.state))]
}

/** The temper pips, one a tempering, filled as far as done, from `x`, `y` their top left. */
const temperPips = (c: ReturnType<typeof canvas>, item: Item, x: number, y: number) => {
  const done = item.temper ?? 0
  for (let i = 0; i < TEMPER_MAX; i += 1) {
    frame(c, x + i * 5, y, 4, 4, i < done ? PIP_ON : PIP_OFF)
    if (i < done) fill(c, x + i * 5 + 1, y + 1, 2, 2, PIP_ON)
  }
}

/** The window's pixels: title and gold, the worn slots with the chosen one framed white, the work side. */
export const forgePixels = (g: Game, ui: ForgeUi): string[][] => {
  const l = layout(g, ui)
  const body = canvas(WINDOW_W, l.height - WINDOW_TOP)
  // The chosen slot's own frame white, as the bag frames the slot an item would fill.
  wornSlots(body, g, slot => (slot === l.slot ? CURSOR : GRID))
  if (l.item !== undefined) {
    // Beside Temper, on its middle.
    temperPips(body, l.item, l.temperAt.x + l.temperAt.w + 4, l.temperAt.y - WINDOW_TOP + Math.floor((BUTTON_H - 4) / 2))
    for (const b of l.buttons) buttonFace(body, b.at.x, b.at.y - WINDOW_TOP, b.at.w, b.state)
  }
  const c = windowPixels({ title: 'SMITH', gold: g.gold }, body.px)
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

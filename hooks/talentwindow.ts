// The talent window: while a talent is owed, the three offered as cards side by side, each its family's ribbon and its
// icon, the chosen one framed white, its name and line in the box below; a click chooses a card,
// again (or Take) takes it, Later leaves it owed. With none owed, the talents taken and the level of the next. Pure:
// the click layer reports whole gestures, this decides the window's next state and the game actions they make.
import type { Game, Talent } from '../types'
import type { Action, Run } from './game'
import { TALENTS, TALENT_EVERY, offer } from './talents'
import { BUTTON_H, button, buttonBox, buttonW, onCell } from './pieces'
import { canvas, fill, frame, put } from './canvas'
import { PAL, TALENT_ICON } from './pixelart'
import { flatCard, ribbon, ribbonLabel } from './ui/kit'
import { FAMILIES, INK, SURFACE } from './ui/tokens'
import type { FamilyName } from './ui/tokens'
import { heroChrome, heroTabAt } from './herotabs'
import { CLICK_SLOP, CLOSE_BOX, WINDOW_TOP, WINDOW_W, drawBox, isInside, pixel, windowPixels } from './window'
import type { Chrome, Gesture, OverlayBox, Rect } from './window'

const CHROME: Chrome = { title: 'TALENT' }
const top = WINDOW_TOP

/** The window's state beyond the game: the card chosen, by its place in the row. */
export type TalentUi = { chosen: number }
export const TALENT_UI: TalentUi = { chosen: 0 }

/** Coding's own talents work; those of blows fight; potions, prices and sight are the road's. */
const FAMILY_OF: Readonly<Record<Talent, FamilyName>> = {
  testDriven: 'work', cleanCommit: 'work', shipIt: 'work', rubberDucking: 'work',
  secondWind: 'fight', opener: 'fight', bloodletting: 'fight', grudge: 'fight',
  scavenger: 'road', ironStomach: 'road', haggler: 'road', pathfinder: 'road',
}
export const familyOf = (t: Talent) => FAMILY_OF[t]

const GAP = 6
const CARD_W = 26
const CARD_H = 31
const CARD_Y = 2
/** The ribbon's top, down a card's face. */
const RIBBON_Y = 4
/** The icon at its own size inside a pixel of backdrop and a frame. */
const ART = 14

const chosenOf = (g: Game, ui: TalentUi) => Math.min(Math.max(0, ui.chosen), Math.max(0, offer(g).length - 1))

/** Where the cards row and its parts go, in window pixels. */
const rowX = Math.floor((WINDOW_W - (3 * CARD_W + 2 * GAP)) / 2)
/** A card's place in its column: where a click on it acts and the hover lights it. */
export const cardRect = (i: number): Rect => ({ x: rowX + i * (CARD_W + GAP), y: top + CARD_Y, w: CARD_W, h: CARD_H })
const BUTTONS_Y = onCell(CARD_Y + CARD_H + 5)
export const takeRect = (): Rect => {
  const w = buttonW('TAKE')
  return { x: Math.floor((WINDOW_W - w - 4 - buttonW('LATER')) / 2), y: top + BUTTONS_Y, w, h: BUTTON_H }
}
export const laterRect = (): Rect => {
  const t = takeRect()
  return { x: t.x + t.w + 4, y: t.y, w: buttonW('LATER'), h: BUTTON_H }
}
/** The box under the buttons, in cells: the chosen talent's line; then Take's and Later's words, and each card's
 * ribbon's. */
export const talentOverlay = (g: Game, ui: TalentUi): OverlayBox[] => {
  const offered = offer(g)
  if (offered.length === 0) return [takenBox(g)]
  const t = offered[chosenOf(g, ui)]!
  const lines: Run[][] = [[{ text: `${TALENTS[t].name}: `, bold: true }, { text: TALENTS[t].does }]]
  return [
    { role: 'about', x: 2, y: Math.floor((takeRect().y + BUTTON_H + 3) / 2), w: WINDOW_W - 4, h: lines.length + 2, border: SURFACE.frame, lines },
    buttonBox('TAKE', takeRect().x, takeRect().y, 'armed'),
    buttonBox('LATER', laterRect().x, laterRect().y, 'ready'),
    ...offered.map((o, i) => ribbonLabel(FAMILIES[FAMILY_OF[o]], cardRect(i).x, CARD_W, top + CARD_Y + RIBBON_Y)),
  ]
}
const offerHeight = (g: Game, ui: TalentUi) => {
  const box = talentOverlay(g, ui)[0]!
  return 2 * (box.y + box.h) + 2
}

type Canvas = ReturnType<typeof canvas>

/** The icon at its own size, on a lit backdrop with a floor, framed, its top at ay. */
const drawArt = (body: Canvas, t: Talent, x: number, ay: number) => {
  const ax = x + Math.floor((CARD_W - ART) / 2)
  fill(body, ax, ay, ART, ART, SURFACE.backdrop)
  fill(body, ax + 1, ay + ART - 4, ART - 2, 3, SURFACE.floor)
  frame(body, ax, ay, ART, ART, SURFACE.frame)
  TALENT_ICON[t].forEach((row, iy) => [...row].forEach((k, ix) => k !== '.' && put(body, ax + 1 + ix, ay + 1 + iy, PAL[k] ?? INK.missing)))
}

/** A card: a flat face as the start screen's, framed white when chosen, its family's ribbon and the icon. */
const drawCard = (body: Canvas, t: Talent, i: number, isOn: boolean) => {
  const x = cardRect(i).x
  flatCard(body, { x, y: CARD_Y, w: CARD_W, h: CARD_H }, isOn)
  ribbon(body, FAMILIES[FAMILY_OF[t]], x, CARD_W, CARD_Y + RIBBON_Y)
  drawArt(body, t, x, CARD_Y + 13)
}

/** The offer as cards: the row, Take and Later, the box. */
const offerPixels = (g: Game, ui: TalentUi): string[][] => {
  const offered = offer(g)
  const chosen = chosenOf(g, ui)
  const height = offerHeight(g, ui)
  const body = canvas(WINDOW_W, height - top)
  offered.forEach((t, i) => drawCard(body, t, i, i === chosen))
  button(body, 'TAKE', takeRect().x, takeRect().y - top, 'armed')
  button(body, 'LATER', laterRect().x, laterRect().y - top, 'ready')
  const c = windowPixels(heroChrome(g, 'talent'), body.px)
  for (const b of talentOverlay(g, ui)) if (b.role === 'about') drawBox(c, b)
  return c.px
}
/** With none owed, the box under the tabs, in cells: when the next talent comes, then each talent taken and what it
 * does, coding's own in green. */
const takenBox = (g: Game): OverlayBox => {
  const taken = g.talents ?? []
  const head = taken.length === Object.keys(TALENTS).length ? 'Every talent is taken.' : `The next talent comes at level ${TALENT_EVERY * (taken.length + 1)}.`
  const lines: Run[][] = [
    [{ text: head, bold: true }],
    ...taken.map(t => [{ text: `${TALENTS[t].name}: `, bold: true, ...(TALENTS[t].work === true ? { color: INK.good } : {}) }, { text: TALENTS[t].does, dim: true }]),
  ]
  return { role: 'about', x: 2, y: top / 2 + 1, w: WINDOW_W - 4, h: lines.length + 2, border: SURFACE.frame, lines }
}

/** The window's height in pixels, title bar and all. */
export const talentHeight = (g: Game, ui: TalentUi = TALENT_UI) => {
  if (offer(g).length > 0) return offerHeight(g, ui)
  const box = takenBox(g)
  return 2 * (box.y + box.h) + 2
}

/** Each offered talent's card, in window pixels: what a click on it covers. */
export const talentCards = (g: Game): { talent: Talent; rect: Rect }[] => offer(g).map((talent, i) => ({ talent, rect: cardRect(i) }))

/** The window's pixels: the offer as cards, or with none owed the box of the talents taken. */
export const talentPixels = (g: Game, ui: TalentUi = TALENT_UI): string[][] => {
  if (offer(g).length > 0) return offerPixels(g, ui)
  const c = windowPixels(heroChrome(g, 'talent'), canvas(WINDOW_W, talentHeight(g) - top).px)
  drawBox(c, takenBox(g))
  return c.px
}

type Outcome = { ui: TalentUi; actions: Action[] }

/**
 * The window's next state and the game actions for one gesture: a card chooses its talent, the chosen one clicked
 * again takes it; Take takes the chosen; Later and the close box close, the talent still owed; anything else, nothing.
 */
export const talentGesture = (g: Game, ui: TalentUi, gesture: Gesture): Outcome => {
  const none = { ui, actions: [] }
  if (gesture.type === 'drag') return none
  const from = pixel(gesture.from)
  const at = pixel(gesture.at)
  if (Math.max(Math.abs(at.x - from.x), Math.abs(at.y - from.y)) >= CLICK_SLOP) return none
  const inside = (r: Rect) => isInside(at, r.x, r.y, r.w, r.h)
  const tab = heroTabAt(g, 'talent', at)
  if (tab !== undefined) return { ui, actions: tab }
  const close = { ui, actions: [{ kind: 'panel', panel: 'talent' } as Action] }
  const offered = offer(g)
  if (offered.length === 0) return isInside(at, ...CLOSE_BOX) ? close : none
  const chosen = chosenOf(g, ui)
  const card = offered.findIndex((_, i) => inside(cardRect(i)))
  if (card >= 0) return card === chosen ? { ui, actions: [{ kind: 'talent', talent: offered[card]! }] } : { ui: { chosen: card }, actions: [] }
  if (inside(takeRect())) return { ui, actions: [{ kind: 'talent', talent: offered[chosen]! }] }
  return inside(laterRect()) || isInside(at, ...CLOSE_BOX) ? close : none
}

/** What a click acts on, in window pixels, as drawn: each card, Take and Later; with none owed, nothing but the tabs. */
export const talentHot = (g: Game): Rect[] => {
  if (offer(g).length === 0) return []
  return [...offer(g).map((_, i) => cardRect(i)), takeRect(), laterRect()]
}

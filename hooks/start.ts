// The start screen: the three heroes each on a card (portrait in the class's starting kit, name), Start, Help and,
// with a game going on, Back, then the chosen one in words in the box under them.
// Pure: the click layer reports whole gestures, this decides the screen's next state and the game actions to apply.
import type { Game, HeroClass } from '../types'
import type { Action, Run } from './game'
import { classAbout } from './game'
import { canWear } from './items'
import { canvas } from './canvas'
import { PX, heroArt } from './pixelart'
import { BUTTON_H, artLabel, button, buttonBox, buttonW, portrait } from './pieces'
import { flatCard } from './ui/kit'
import { INK, SURFACE } from './ui/tokens'
import { CLICK_SLOP, CLOSE_BOX, WINDOW_TOP, WINDOW_W, drawBox, isInside, pixel, windowPixels } from './window'
import type { Chrome, Gesture, OverlayBox, Rect } from './window'
import { newGame } from './world'

export const CLASSES: readonly HeroClass[] = ['knight', 'mage', 'rogue']
const NAME: Readonly<Record<HeroClass, string>> = { knight: 'KNIGHT', mage: 'MAGE', rogue: 'ROGUE' }

/** What the screen shows beyond the game: the hero chosen. */
export type StartUi = { cls: HeroClass }

const CHROME: Chrome = { title: 'ASCII DUNGEON' }
/** A card: the portrait at twice the sprite's size, the name under it on a whole cell. */
const FACE = PX * 2 + 4
const CARD_W = 30
const CARD_GAP = 4
const NAME_Y = 3 + FACE + 2
const CARD_H = NAME_Y + 2 + 3
const CARD_Y = 3
const BUTTON_Y = CARD_Y + CARD_H + 3
/** The body over the box: the cards and the buttons, the box's top on a whole cell. */
const BODY_H = BUTTON_Y + BUTTON_H + 2

/** A game under way, worth going back to: anything won since a new game. */
export const isUnderWay = (g: Game) => g.level > 1 || g.xp > 0 || g.deepest > 1 || g.deaths > 0 || g.gold > 0

const top = WINDOW_TOP
/** Each card's place, in window pixels. */
const CARDS_X = Math.floor((WINDOW_W - 3 * CARD_W - 2 * CARD_GAP) / 2)
export const cardRect = (i: number): Rect => ({ x: CARDS_X + i * (CARD_W + CARD_GAP), y: top + CARD_Y, w: CARD_W, h: CARD_H })

/** A first game: nothing played, and no codex yet from an earlier hero. */
export const isFirstGame = (g: Game) => g.codex === undefined && !isUnderWay(g)

const BUTTON_GAP = 3
const START_KEY = ['S', 'START'] as const
const HELP_KEY = ['H', 'HELP'] as const
const BACK_KEY = ['B', 'BACK'] as const
/** The buttons' row, centered: Start, Help and, with a game under way, Back. */
const buttonKeys = (g: Game) => (isUnderWay(g) ? [START_KEY, HELP_KEY, BACK_KEY] : [START_KEY, HELP_KEY])
const buttonRects = (g: Game): Rect[] => {
  const ws = buttonKeys(g).map(([, label]) => buttonW(label))
  let x = Math.floor((WINDOW_W - ws.reduce((a, b) => a + b, 0) - BUTTON_GAP * (ws.length - 1)) / 2)
  return ws.map(w => {
    const rect = { x, y: top + BUTTON_Y, w, h: BUTTON_H }
    x += w + BUTTON_GAP
    return rect
  })
}
/** The buttons with their places and states: Start framed white, and Help beside it on a first game. */
const buttonsOf = (g: Game) => {
  const rects = buttonRects(g)
  return buttonKeys(g).map(([key, label], i) => ({ key, label, rect: rects[i]!, state: key === 'S' || (key === 'H' && isFirstGame(g)) ? 'armed' as const : 'ready' as const }))
}

/** The screen's height in pixels: the body, then the chosen hero's line in its box. */
export const startHeight = (g: Game, ui: StartUi) => top + BODY_H + 2 * (aboutLines(g, ui).length + 2) + 2

export const STATS_LINE = 'Might: harder hits. Focus: crits. Vigor: HP. Insight: XP.'

/** The last line: the heirloom a retired hero passed down, as the chosen class sets out with it (worn, or in the
 * bag); else, for a player new to it, what each attribute does. */
const lastLine = (g: Game, ui: StartUi): Run[] => {
  if (g.heirloom === undefined) return [{ text: STATS_LINE, dim: true }]
  const where = canWear(ui, g.heirloom) ? 'worn from the start' : 'in the bag from the start'
  return [{ text: `Heirloom: ${g.heirloom.name}, ${where}.` }]
}

/** The chosen hero in words: the ability; the lean and the kit; the last line. */
const aboutLines = (g: Game, ui: StartUi): Run[][] => {
  const [ability, ...rest] = classAbout(ui.cls).split('. ')
  return [[{ text: `${ability}.` }], [{ text: rest.join('. '), dim: true }], lastLine(g, ui)]
}

export const startOverlay = (g: Game, ui: StartUi): OverlayBox[] => {
  const lines = aboutLines(g, ui)
  return [
    { role: 'about', x: 2, y: (top + BODY_H) / 2, w: WINDOW_W - 4, h: lines.length + 2, border: SURFACE.frame, lines },
    ...buttonsOf(g).map(b => buttonBox(b.label, b.rect.x, b.rect.y, b.state)),
    ...nameBoxes(ui),
  ]
}

const card = (c: ReturnType<typeof canvas>, cls: HeroClass, i: number, isOn: boolean) => {
  const { x } = cardRect(i)
  const y = CARD_Y
  flatCard(c, { x, y, w: CARD_W, h: CARD_H }, isOn)
  portrait(c, heroArt(newGame(1, cls)), x + Math.floor((CARD_W - FACE) / 2), y + 3, FACE)
}

/** Each card's name under its portrait, centred: the chosen hero's in gold. */
const nameBoxes = (ui: StartUi) => CLASSES.map((cls, i) =>
  artLabel(NAME[cls], cardRect(i).x + Math.floor((CARD_W - NAME[cls].length) / 2), cardRect(i).y + NAME_Y, cls === ui.cls ? INK.gold : INK.text, SURFACE.card))

/** The screen's pixels: title bar, the three cards, the buttons, and the box. Help is framed white on a first game,
 * beside Start. */
export const startPixels = (g: Game, ui: StartUi): string[][] => {
  const body = canvas(WINDOW_W, startHeight(g, ui) - top)
  CLASSES.forEach((cls, i) => card(body, cls, i, cls === ui.cls))
  for (const b of buttonsOf(g)) button(body, b.label, b.rect.x, b.rect.y - top, b.state)
  const c = windowPixels(CHROME, body.px)
  for (const b of startOverlay(g, ui)) if (b.role === 'about') drawBox(c, b)
  return c.px
}

type Outcome = { ui: StartUi; actions: Action[]; isHelp?: true }

/** A new game as the chosen hero: the start screen closes with it. */
export const begin = (cls: HeroClass): Action => ({ kind: 'restart', cls })

/**
 * The screen's next state and the game actions for one gesture: a card chooses its hero (the chosen one, clicked
 * again, starts); Start starts; Help asks for the how-it-plays window; Back and the close box leave the game as it was.
 */
export const startGesture = (g: Game, ui: StartUi, gesture: Gesture): Outcome => {
  if (gesture.type === 'drag') return { ui, actions: [] }
  const from = pixel(gesture.from)
  const at = pixel(gesture.at)
  if (Math.max(Math.abs(at.x - from.x), Math.abs(at.y - from.y)) >= CLICK_SLOP) return { ui, actions: [] }
  const inside = (r: Rect) => isInside(at, r.x, r.y, r.w, r.h)
  const picked = CLASSES.find((_, i) => inside(cardRect(i)))
  if (picked !== undefined) return picked === ui.cls ? { ui, actions: [begin(picked)] } : { ui: { cls: picked }, actions: [] }
  const [start, help, back] = buttonRects(g)
  if (inside(start!)) return { ui, actions: [begin(ui.cls)] }
  if (inside(help!)) return { ui, actions: [], isHelp: true }
  if ((back !== undefined && inside(back)) || isInside(at, ...CLOSE_BOX)) return { ui, actions: [{ kind: 'panel', panel: 'start' }] }
  return { ui, actions: [] }
}

/** What a click acts on, in window pixels: the cards and the buttons. */
export const startHot = (g: Game): Rect[] => [...CLASSES.map((_, i) => cardRect(i)), ...buttonRects(g)]

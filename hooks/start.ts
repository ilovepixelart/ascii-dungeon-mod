// The start screen: the title, the three heroes each on a card (portrait in the class's starting kit, name, a pip a
// point of each attribute), the chosen one's line under them, Start and, with a game going on, Back.
// Pure: the click layer reports whole gestures, this decides the screen's next state and the game actions to apply.
import type { Attribute, Game, HeroClass } from '../types'
import type { Action, Run } from './game'
import { classAbout } from './game'
import { canvas, fill, frame, put } from './canvas'
import { heroArt, textMask } from './pixelart'
import { BUTTON_H, CURSOR, GOLD_INK, PORTRAIT, button, buttonW, portrait } from './pieces'
import { CLICK_SLOP, CLOSE_BOX, WINDOW_W, bodyTop, drawBox, isInside, pixel, windowPixels, word } from './window'
import type { Chrome, Gesture, OverlayBox, Rect } from './window'
import { CLASS_LEAN, newGame } from './world'

export const CLASSES: readonly HeroClass[] = ['knight', 'mage', 'rogue']
const NAME: Readonly<Record<HeroClass, string>> = { knight: 'KNIGHT', mage: 'MAGE', rogue: 'ROGUE' }

/** The attributes a card shows, a pip a point: what every hero starts with and the class's lean on top. */
const BASE: Readonly<Record<Attribute, number>> = { might: 1, focus: 1, vigor: 1, insight: 0 }
const STATS: readonly (readonly [Attribute, string, string])[] = [['might', 'MIG', '#f06a5a'], ['focus', 'FOC', '#ffd34d'], ['vigor', 'VIG', '#5ccf6a'], ['insight', 'INS', '#7fb8ff']]
const PIPS = 4

/** What the screen shows beyond the game: the hero chosen. */
export type StartUi = { cls: HeroClass }

const CHROME: Chrome = { title: 'NEW GAME', labels: [] }
const TITLE = 'DUNGEON'
const TITLE_SHADOW = '#5a3a10'
const SUBTITLE = 'CHOOSE YOUR HERO'
const DIM = '#8a8494'
const CARD_W = 33
const CARD_H = 64
const CARD_Y = 26
const CARD_BG = '#15131b'
const CARD_EDGE = '#3a3644'
const BUTTON_Y = 93
const BODY_H = 106

/** A game under way, worth going back to: anything won since a new game. */
export const isUnderWay = (g: Game) => g.level > 1 || g.xp > 0 || g.deepest > 1 || g.deaths > 0 || g.gold > 0

const textW = (text: string) => textMask(text)[0]?.length ?? 0

/** The pixel font at twice its size, a dark shadow a pixel down and right. */
const bigWord = (c: ReturnType<typeof canvas>, text: string, x: number, y: number) => {
  const mask = textMask(text)
  for (const [d, ink] of [[1, TITLE_SHADOW], [0, GOLD_INK]] as const) {
    mask.forEach((row, yy) => [...row].forEach((ch, xx) => ch === '#' && fill(c, x + xx * 2 + d * 2, y + yy * 2 + d * 2, 2, 2, ink)))
  }
}

const top = bodyTop(CHROME)
/** Each card's place, in window pixels. */
export const cardRect = (i: number): Rect => ({ x: 2 + i * (CARD_W + 1), y: top + CARD_Y, w: CARD_W, h: CARD_H })
const startRect = (g: Game): Rect => {
  const w = buttonW('S', 'START')
  return { x: isUnderWay(g) ? 2 : Math.floor((WINDOW_W - w) / 2), y: top + BUTTON_Y, w, h: BUTTON_H }
}
const backRect = (g: Game): Rect => ({ x: startRect(g).x + startRect(g).w + 3, y: top + BUTTON_Y, w: buttonW('B', 'BACK'), h: BUTTON_H })

/** The screen's height in pixels: the body, then the chosen hero's line in its box. */
export const startHeight = (ui: StartUi) => top + BODY_H + 2 * (aboutLines(ui).length + 2) + 2

/** The chosen hero in words: the ability, the lean, the kit, a line each. */
const aboutLines = (ui: StartUi): Run[][] => {
  const parts = classAbout(ui.cls).split('. ')
  return parts.map((t, k) => [{ text: k < parts.length - 1 ? `${t}.` : t, dim: k > 0 }])
}

export const startOverlay = (ui: StartUi): OverlayBox[] => {
  const lines = aboutLines(ui)
  return [{ role: 'about', x: 2, y: (top + BODY_H) / 2 + 1, w: WINDOW_W - 4, h: lines.length + 2, border: '#6b6258', lines }]
}

const card = (c: ReturnType<typeof canvas>, cls: HeroClass, i: number, isOn: boolean) => {
  const { x } = cardRect(i)
  const y = CARD_Y
  fill(c, x, y, CARD_W, CARD_H, CARD_BG)
  frame(c, x, y, CARD_W, CARD_H, isOn ? CURSOR : CARD_EDGE)
  portrait(c, heroArt(newGame(1, cls)), x + Math.floor((CARD_W - PORTRAIT) / 2), y + 3)
  word(c, NAME[cls], x + Math.floor((CARD_W - textW(NAME[cls])) / 2), y + 3 + PORTRAIT + 2, isOn ? GOLD_INK : '#e8e4dc')
  STATS.forEach(([key, label, ink], j) => {
    const sy = y + 3 + PORTRAIT + 9 + j * 6
    word(c, label, x + 3, sy, DIM)
    const n = BASE[key] + (CLASS_LEAN[cls][key] ?? 0)
    for (let p = 0; p < PIPS; p += 1) {
      frame(c, x + 16 + p * 4, sy + 1, 3, 3, p < n ? ink : CARD_EDGE)
      if (p < n) put(c, x + 17 + p * 4, sy + 2, ink)
    }
  })
}

/** The screen's pixels: title bar, the title and its line, the three cards, the buttons, and the line's box. */
export const startPixels = (g: Game, ui: StartUi): string[][] => {
  const body = canvas(WINDOW_W, startHeight(ui) - top)
  bigWord(body, TITLE, Math.floor((WINDOW_W - textW(TITLE) * 2) / 2), 2)
  word(body, SUBTITLE, Math.floor((WINDOW_W - textW(SUBTITLE)) / 2), 17, DIM)
  CLASSES.forEach((cls, i) => card(body, cls, i, cls === ui.cls))
  button(body, 'S', 'START', startRect(g).x, BUTTON_Y, 'armed')
  if (isUnderWay(g)) button(body, 'B', 'BACK', backRect(g).x, BUTTON_Y, 'ready')
  const c = windowPixels(CHROME, body.px)
  for (const b of startOverlay(ui)) drawBox(c, b)
  return c.px
}

type Outcome = { ui: StartUi; actions: Action[] }

/** A new game as the chosen hero: the start screen closes with it. */
export const begin = (cls: HeroClass): Action => ({ kind: 'restart', cls })

/**
 * The screen's next state and the game actions for one gesture: a card chooses its hero (the chosen one, clicked
 * again, starts); Start starts; Back and the close box leave the game as it was.
 */
export const startGesture = (g: Game, ui: StartUi, gesture: Gesture): Outcome => {
  if (gesture.type === 'drag') return { ui, actions: [] }
  const from = pixel(gesture.from)
  const at = pixel(gesture.at)
  if (Math.max(Math.abs(at.x - from.x), Math.abs(at.y - from.y)) >= CLICK_SLOP) return { ui, actions: [] }
  const inside = (r: Rect) => isInside(at, r.x, r.y, r.w, r.h)
  const picked = CLASSES.find((_, i) => inside(cardRect(i)))
  if (picked !== undefined) return picked === ui.cls ? { ui, actions: [begin(picked)] } : { ui: { cls: picked }, actions: [] }
  if (inside(startRect(g))) return { ui, actions: [begin(ui.cls)] }
  if ((isUnderWay(g) && inside(backRect(g))) || isInside(at, ...CLOSE_BOX)) return { ui, actions: [{ kind: 'panel', panel: 'start' }] }
  return { ui, actions: [] }
}

// The character sheet's window, the hero's windows' first tab: the hero's portrait in what they wear and beside it
// who they are, how they stand and what they have to spend; their XP toward the next level; the four attributes two to
// a row, each its value and a + to train it; Retire. The other tabs open the talents, the deep and the codex; New game
// is in settings. Pure: the click layer reports whole gestures, this decides the game actions they make.
import type { Game } from '../types'
import type { Action, Run } from './game'
import { attackBonus, canRetire, critChance, defense, xpToLevel } from './game'
import { CLASS_NAME } from './items'
import { canvas, fill, frame } from './canvas'
import { ATTRIBUTES } from './panels'
import { PX, heroArt } from './pixelart'
import { BUTTON_H, barLabel, button, buttonBox, buttonW, flatBar, onCell, portrait } from './pieces'
import type { ButtonState } from './pieces'
import { MARK, NUM_INK, mark } from './hud'
import { heroChrome, heroTabAt } from './herotabs'
import { INK, SPACE, SURFACE } from './ui/tokens'
import { CLICK_SLOP, CLOSE_BOX, WINDOW_TOP, WINDOW_W, drawBox, isInside, pixel, windowPixels } from './window'
import type { Chrome, Gesture, OverlayBox, Rect } from './window'

const CHROME: Chrome = { title: 'HERO' }
const top = WINDOW_TOP
const PAD = 2
/** The portrait at twice the sprite's size; the head box and the XP bar beside it. */
const FACE = PX * 2 + 4
const SIDE_X = PAD + FACE + 3
const XP_TONES = [INK.xpLight, INK.xp, INK.xpShade] as const
const XP_EMPTY = SURFACE.xpEmpty
const NAMES = ['MIGHT', 'FOCUS', 'VIGOR', 'INSIGHT'] as const
/** The attributes two to a row under the portrait, each a framed row as tall as its + button, the button SPACE.gap past its end. */
const ROWS_Y = onCell(top + 2 + FACE + 2)
const ROW_W = Math.floor((WINDOW_W - 2 * PAD - SPACE.gap) / 2)

/** Each attribute's place, two to a row, and its + button's at its right end, in window pixels. */
const rowRect = (i: number): Rect => ({ x: PAD + (i % 2) * (ROW_W + SPACE.gap), y: ROWS_Y + Math.floor(i / 2) * (BUTTON_H + 2), w: ROW_W, h: BUTTON_H })
export const plusRect = (i: number): Rect => {
  const r = rowRect(i)
  const w = buttonW('+')
  return { x: r.x + r.w - w, y: r.y, w, h: BUTTON_H }
}

/** The Retire button, centered under the attributes: lit once the hero has slain a big boss, when it opens the retire window. */
export const RETIRE_KEY = { key: 'R', label: 'RETIRE' }
export const RETIRE_RECT: Rect = { x: Math.floor((WINDOW_W - buttonW(RETIRE_KEY.label)) / 2), y: rowRect(3).y + BUTTON_H + 2, w: buttonW(RETIRE_KEY.label), h: BUTTON_H }

/** The window's height in pixels. */
export const SHEET_H = RETIRE_RECT.y + RETIRE_RECT.h + 2

const plural = (n: number, word: string) => `${n} ${word}${n === 1 ? '' : 's'}`

/** Who the hero is, how they stand, what Vigor and Insight give (Might's and Focus's are the attack and the crit), what
 * they have to spend. */
const headLines = (g: Game): Run[][] => [
  [{ text: `Level ${g.level} ${CLASS_NAME[g.cls]}`, bold: true }, { text: `   HP ${Math.max(0, g.hp)}/${g.maxHp}`, dim: true }],
  [{ text: `Attack +${attackBonus(g)}  Defense ${defense(g)}  Crit ${critChance(g)}%`, dim: true }],
  [{ text: `Vigor +3 max HP a point, Insight +${g.stats.insight * 10}% XP`, dim: true }],
  g.points > 0 ? [{ text: `${plural(g.points, 'point')} to spend`, color: INK.easy, bold: true }] : [{ text: 'Level up for points to spend', dim: true }],
]

/** The XP bar under the head box, in window pixels: beside the star, on an odd row (its number on its middle), to the window's edge. */
const xpBar = (g: Game) => {
  const headEnd = top + 2 + 2 * (headLines(g).length + 2)
  return { markY: headEnd + 2, x: SIDE_X + 7, y: Math.floor((headEnd + 2) / 2) * 2 + 1, w: WINDOW_W - SIDE_X - 7 - PAD }
}

/** An attribute's row in words, on its face up to its + button: its name, its value at the right. */
const attributeBox = (g: Game, i: number): OverlayBox<'attribute'> => {
  const r = rowRect(i)
  const w = plusRect(i).x - SPACE.gap - r.x
  const value = String(g.stats[ATTRIBUTES[i]!.stat])
  const room = w - 4 - NAMES[i]!.length - value.length
  return { role: 'attribute', x: r.x, y: r.y / 2, w, h: 3, border: SURFACE.card, bg: SURFACE.card, pad: 1, lines: [[{ text: `${NAMES[i]}${' '.repeat(room)}`, color: INK.text }, { text: value, color: NUM_INK, bold: true }]] }
}

const plusState = (g: Game): ButtonState => (g.points > 0 ? 'ready' : 'off')
const retireState = (g: Game): ButtonState => (canRetire(g) ? 'ready' : 'off')

/** The boxes over the window: who the hero is, the XP on its bar, the attributes, and the buttons' words. */
export const sheetOverlay = (g: Game): OverlayBox[] => {
  const head = headLines(g)
  const xp = xpBar(g)
  return [
    { role: 'head', x: SIDE_X, y: (top + 2) / 2, w: WINDOW_W - SIDE_X - 2, h: head.length + 2, border: SURFACE.frame, lines: head },
    barLabel(xp.x, xp.y, xp.w, g.xp / xpToLevel(g.level), XP_TONES[1], XP_EMPTY, `${g.xp}/${xpToLevel(g.level)}`),
    ...ATTRIBUTES.flatMap((_, i) => [attributeBox(g, i), buttonBox('+', plusRect(i).x, plusRect(i).y, plusState(g))]),
    buttonBox(RETIRE_KEY.label, RETIRE_RECT.x, RETIRE_RECT.y, retireState(g)),
  ]
}

/** The window's pixels: the hero's tabs, portrait, XP bar, the attribute rows and their + buttons, Retire. */
export const sheetPixels = (g: Game): string[][] => {
  const body = canvas(WINDOW_W, SHEET_H - top)
  portrait(body, heroArt(g), PAD, 2, FACE)
  // XP toward the next level, under the head box: a flat bar, its numbers text on it.
  const xp = xpBar(g)
  mark(body, MARK.xp, SIDE_X, xp.y - top)
  flatBar(body, xp.x, xp.y - top, xp.w, g.xp / xpToLevel(g.level), XP_TONES[1], XP_EMPTY)
  ATTRIBUTES.forEach((_, i) => {
    const r = rowRect(i)
    const p = plusRect(i)
    const w = p.x - SPACE.gap - r.x
    fill(body, r.x, r.y - top, w, r.h, SURFACE.card)
    frame(body, r.x, r.y - top, w, r.h, SURFACE.cardEdge)
    button(body, '+', p.x, p.y - top, plusState(g))
  })
  button(body, RETIRE_KEY.label, RETIRE_RECT.x, RETIRE_RECT.y - top, retireState(g))
  const c = windowPixels(heroChrome(g, 'sheet'), body.px)
  // The head box alone has a frame of its own: the bar's numbers lie on the bar, the rest on their faces.
  for (const b of sheetOverlay(g)) if (b.role === 'head') drawBox(c, b)
  return c.px
}

/** The game actions for one gesture: a tab opens its window; a + trains its attribute while there are points; Retire
 * opens the retire window once a big boss is slain; the close box closes. */
export const sheetGesture = (g: Game, gesture: Gesture): Action[] => {
  if (gesture.type === 'drag') return []
  const from = pixel(gesture.from)
  const at = pixel(gesture.at)
  if (Math.max(Math.abs(at.x - from.x), Math.abs(at.y - from.y)) >= CLICK_SLOP) return []
  const tab = heroTabAt(g, 'sheet', at)
  if (tab !== undefined) return tab
  const inside = (r: Rect) => isInside(at, r.x, r.y, r.w, r.h)
  const trained = ATTRIBUTES.findIndex((_, i) => inside(plusRect(i)))
  if (trained >= 0) return g.points > 0 ? [{ kind: 'train', stat: ATTRIBUTES[trained]!.stat }] : []
  if (inside(RETIRE_RECT)) return canRetire(g) ? [{ kind: 'panel', panel: 'retire' }] : []
  return isInside(at, ...CLOSE_BOX) ? [{ kind: 'panel', panel: 'sheet' }] : []
}

/** What a click acts on, in window pixels: the + buttons while there are points, Retire once it can. */
export const sheetHot = (g: Game): Rect[] => [...(g.points > 0 ? ATTRIBUTES.map((_, i) => plusRect(i)) : []), ...(canRetire(g) ? [RETIRE_RECT] : [])]

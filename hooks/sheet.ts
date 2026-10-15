// The character sheet's window: the hero's portrait in what they wear, who they are and what they have to spend,
// their XP toward the next level, a row an attribute (its value, a + to train it, what it does), and Codex. New game is in settings.
// Pure: the click layer reports whole gestures, this decides the game actions they make.
import type { Game } from '../types'
import type { Action, Run } from './game'
import { attackBonus, critChance, defense, xpToLevel } from './game'
import { CLASS_NAME } from './items'
import { canvas, digits, fill, frame } from './canvas'
import { ATTRIBUTES } from './panels'
import { heroArt } from './pixelart'
import { BUTTON_H, PORTRAIT, barLabel, button, buttonW, flatBar, portrait } from './pieces'
import { MARK, NUM_INK, mark } from './hud'
import { CLICK_SLOP, CLOSE_BOX, WINDOW_W, bodyTop, drawBox, isInside, pixel, windowPixels, word } from './window'
import type { Chrome, Gesture, OverlayBox, Rect } from './window'

const CHROME: Chrome = { title: 'CHARACTER', labels: [] }
const top = bodyTop(CHROME)
const PAD = 3
const SIDE_X = PAD + PORTRAIT + 4
const ROW_H = 12
const ROWS_Y = 34
const ROW_BG = '#15131b'
const ROW_EDGE = '#3a3644'
const LABEL_INK = '#e8e4dc'
const XP_TONES = ['#f0d070', '#d9b54a', '#a88430'] as const
const XP_EMPTY = '#2a2618'
/** The effects' box: right of the + buttons, over the rows, a line at each row's middle. */
const EFFECT_X = 62
const NAMES = ['MIGHT', 'FOCUS', 'VIGOR', 'INSIGHT'] as const

/** Each attribute row's place, and its + button's, in window pixels. */
const rowRect = (i: number): Rect => ({ x: PAD, y: top + ROWS_Y + i * ROW_H, w: WINDOW_W - 2 * PAD, h: ROW_H - 1 })
export const plusRect = (i: number): Rect => ({ x: 44, y: rowRect(i).y, w: buttonW(String(i + 1), '+'), h: BUTTON_H })

/** The Codex button, under the attribute rows: it opens the codex. */
export const CODEX_KEY = { key: 'X', label: 'CODEX' }
export const CODEX_RECT: Rect = { x: PAD, y: top + ROWS_Y + ATTRIBUTES.length * ROW_H + 2, w: buttonW(CODEX_KEY.key, CODEX_KEY.label), h: BUTTON_H }

/** The window's height in pixels. */
export const SHEET_H = (() => {
  const end = CODEX_RECT.y + CODEX_RECT.h + 3
  return Math.ceil(end / 2) * 2
})()

const plural = (n: number, word: string) => `${n} ${word}${n === 1 ? '' : 's'}`

/** Who the hero is, what they have to spend, how they stand. */
const headLines = (g: Game): Run[][] => [
  [{ text: `Level ${g.level} ${CLASS_NAME[g.cls]}`, bold: true }, { text: `   HP ${Math.max(0, g.hp)}/${g.maxHp}`, dim: true }],
  [{ text: `Attack +${attackBonus(g)}  Defense ${defense(g)}  Crit ${critChance(g)}%`, dim: true }],
  g.points > 0 ? [{ text: `${plural(g.points, 'point')} to spend`, color: '#5ccf6a', bold: true }] : [{ text: 'Level up for points to spend', dim: true }],
]

/** The XP bar under the head box, in window pixels: beside the star, on an odd row (its number on its middle), to the window's edge. */
const xpBar = (g: Game) => {
  const markY = 2 + 2 * (headLines(g).length + 2) + 3
  return { markY, x: SIDE_X + 7, y: Math.floor((top + markY + 2) / 2) * 2 + 1, w: WINDOW_W - SIDE_X - 7 - 3 }
}

/** The boxes over the window: who the hero is, what each attribute does beside its row, and the XP on its bar. */
export const sheetOverlay = (g: Game): OverlayBox[] => {
  const head = headLines(g)
  const xp = xpBar(g)
  const rowsTop = (top + ROWS_Y) / 2
  const effects: Run[][] = Array.from({ length: (ATTRIBUTES.length * ROW_H) / 2 - 2 }, () => [{ text: '' }])
  ATTRIBUTES.forEach((a, i) => {
    effects[(i * ROW_H) / 2 + 1] = [{ text: a.effect(g), dim: true }]
  })
  return [
    { role: 'head', x: SIDE_X, y: (top + 2) / 2, w: WINDOW_W - SIDE_X - 2, h: head.length + 2, border: '#6b6258', lines: head },
    { role: 'effects', x: EFFECT_X, y: rowsTop, w: WINDOW_W - EFFECT_X - PAD, h: (ATTRIBUTES.length * ROW_H) / 2, border: ROW_EDGE, lines: effects },
    barLabel(xp.x, xp.y, xp.w, g.xp / xpToLevel(g.level), XP_TONES[1], XP_EMPTY, `${g.xp}/${xpToLevel(g.level)}`),
  ]
}

/** The window's pixels: title bar, portrait, XP bar, the attribute rows and their + buttons. */
export const sheetPixels = (g: Game): string[][] => {
  const body = canvas(WINDOW_W, SHEET_H - top)
  portrait(body, heroArt(g), PAD, 2)
  // XP toward the next level, under the head box: a flat bar, its numbers text on it.
  const xp = xpBar(g)
  mark(body, MARK.xp, SIDE_X, xp.y - top)
  flatBar(body, xp.x, xp.y - top, xp.w, g.xp / xpToLevel(g.level), XP_TONES[1], XP_EMPTY)
  ATTRIBUTES.forEach((a, i) => {
    const r = rowRect(i)
    fill(body, r.x, r.y - top, r.w, r.h, ROW_BG)
    frame(body, r.x, r.y - top, r.w, r.h, ROW_EDGE)
    word(body, NAMES[i]!, r.x + 3, r.y - top + 3, LABEL_INK)
    digits(body, String(g.stats[a.stat]), 41, r.y - top + 8, NUM_INK)
    const p = plusRect(i)
    button(body, String(i + 1), '+', p.x, p.y - top, g.points > 0 ? 'ready' : 'off')
  })
  button(body, CODEX_KEY.key, CODEX_KEY.label, CODEX_RECT.x, CODEX_RECT.y - top, 'ready')
  const c = windowPixels(CHROME, body.px)
  // A bar's numbers lie on the bar: no frame of their own.
  for (const b of sheetOverlay(g)) if (b.role !== 'label') drawBox(c, b)
  return c.px
}

/** The game actions for one gesture: a + trains its attribute while there are points; Codex opens the codex; the close box closes. */
export const sheetGesture = (g: Game, gesture: Gesture): Action[] => {
  if (gesture.type === 'drag') return []
  const from = pixel(gesture.from)
  const at = pixel(gesture.at)
  if (Math.max(Math.abs(at.x - from.x), Math.abs(at.y - from.y)) >= CLICK_SLOP) return []
  const inside = (r: Rect) => isInside(at, r.x, r.y, r.w, r.h)
  const trained = ATTRIBUTES.findIndex((_, i) => inside(plusRect(i)))
  if (trained >= 0) return g.points > 0 ? [{ kind: 'train', stat: ATTRIBUTES[trained]!.stat }] : []
  if (inside(CODEX_RECT)) return [{ kind: 'panel', panel: 'codex' }]
  return isInside(at, ...CLOSE_BOX) ? [{ kind: 'panel', panel: 'sheet' }] : []
}

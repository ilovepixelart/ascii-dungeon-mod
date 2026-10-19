// The codex window: the uniques, the big bosses and the Legendaries, each lit once slain or found and a dark shape
// until then, a row each with its count; under them the records, and Card, which shares the hero. Pure: the click
// layer reports whole gestures, this decides the game actions they make and whether the card is asked for.
import type { Codex, Game } from '../types'
import type { Action } from './game'
import { BIG_BOSSES, UNIQUES, firstCodex } from './game'
import { LEGENDARIES } from './items'
import { ICONS } from './icons'
import { BOSS_ART, PAL, foeArtOf } from './pixelart'
import { BUTTON_H, button, buttonW, tierBox } from './pieces'
import { art, canvas, fill, frame } from './canvas'
import type { Canvas } from './canvas'
import { CLICK_SLOP, CLOSE_BOX, WINDOW_W, bodyTop, isInside, pixel, windowPixels, word } from './window'
import type { Chrome, Gesture, Rect } from './window'

const CHROME: Chrome = { title: 'CODEX', labels: [] }
const PAD = 3
const COL2 = 56
const LINE = 7
const DIM = '#8a8494'
const SAY = '#e8e4dc'
const GOLD = '#ffd34d'
const RULE = '#2c2834'
const BOX_BG = '#141219'
const EDGE = '#3a3440'
/** What is not yet slain or found: its shape alone, in one dark ink. */
const SHADE = '#2e2a38'
/** A foe's box, and the step from one to the next; a Legendary's narrower, taller box and step. */
const FOE_BOX = 19
const FOE_STEP = 20
const LEG_W = 13
const LEG_H = 23
const LEG_STEP = 14

/** One codex row: its name and count, then its boxes. */
type Row = { label: string; found: number; of: number; y: number }

/** Art at `scale` pixels a dot, in its own colours or all in `ink`. */
const scaled = (c: Canvas, rows: readonly string[], x: number, y: number, scale: number, ink?: string) =>
  rows.forEach((row, dy) =>
    [...row].forEach((k, dx) => {
      if (k !== '.') fill(c, x + dx * scale, y + dy * scale, scale, scale, ink ?? PAL[k] ?? SHADE)
    }),
  )

const box = (c: Canvas, x: number, y: number, w: number, h: number, isLit: boolean) => {
  fill(c, x, y, w, h, BOX_BG)
  frame(c, x, y, w, h, isLit ? EDGE : RULE)
}

const codexOf = (g: Game): Codex => g.codex ?? firstCodex(g)
const uniques = Object.entries(UNIQUES)
const bigs = Object.entries(BIG_BOSSES)

/** Where the rows and the records go, in body pixels, and the body's height. */
const layout = (c: Codex) => {
  const rows: Row[] = [
    { label: 'UNIQUES', found: c.uniques.length, of: uniques.length, y: 2 },
    { label: 'BIG BOSSES', found: c.bigs.length, of: bigs.length, y: 33 },
    { label: 'LEGENDARIES', found: c.legendaries.filter(n => LEGENDARIES.some(l => l.name === n)).length, of: LEGENDARIES.length, y: 64 },
  ]
  const rule = 97
  // Even, so the window ends on a whole cell; four lines of records end it on the map's height.
  return { rows, rule, records: rule + 3, height: Math.ceil((rule + 3 + 4 * LINE + 1) / 2) * 2 }
}

/** The Card button, beside the last line of records: it saves the hero card and copies it as text. */
export const CARD_KEY = { key: 'K', label: 'CARD' }
const cardRect = (c: Codex): Rect => {
  const y = layout(c).records + 3 * LINE - 2
  return { x: COL2, y: bodyTop(CHROME) + y, w: buttonW(CARD_KEY.key, CARD_KEY.label), h: BUTTON_H }
}
/** The Card button's place, in window pixels. */
export const codexCardRect = (g: Game) => cardRect(codexOf(g))

/** The records, two to a line: where each goes and its ink. */
const recordLines = (c: Codex, y: number) => [
  { text: `DEEPEST ${c.deepest}`, x: PAD, y, ink: SAY },
  { text: `KILLS ${c.kills}`, x: COL2, y, ink: SAY },
  { text: `LEVEL ${c.level}`, x: PAD, y: y + LINE, ink: SAY },
  { text: `BOSSES ${c.bosses}`, x: COL2, y: y + LINE, ink: SAY },
  { text: `DEATHS ${c.deaths}`, x: PAD, y: y + 2 * LINE, ink: DIM },
  { text: `GOLD ${c.gold}`, x: COL2, y: y + 2 * LINE, ink: GOLD },
  { text: `RETIRED ${c.retired ?? 0}`, x: PAD, y: y + 3 * LINE, ink: DIM },
]

/** Every line the window says: each row's name and count, then the records. */
export const codexLines = (g: Game) => {
  const c = codexOf(g)
  const l = layout(c)
  return [...l.rows.map(r => ({ text: `${r.label} ${r.found}/${r.of}`, x: PAD, y: r.y, ink: DIM })), ...recordLines(c, l.records)]
}

/** The window's height in pixels, title bar and all. */
export const codexHeight = (g: Game) => bodyTop(CHROME) + layout(codexOf(g)).height

/** Whether each of a row's entries is lit: the uniques, the big bosses and the Legendaries, in their order. */
export const codexLit = (g: Game) => {
  const c = codexOf(g)
  return {
    uniques: uniques.map(([, u]) => c.uniques.includes(u.key)),
    bigs: bigs.map(([, b]) => c.bigs.includes(b.key)),
    legendaries: LEGENDARIES.map(l => c.legendaries.includes(l.name)),
  }
}

/** The window's pixels: title bar, the three rows of boxes, the rule and the records. */
export const codexPixels = (g: Game): string[][] => {
  const c = codexOf(g)
  const l = layout(c)
  const lit = codexLit(g)
  const body = canvas(WINDOW_W, l.height)
  const [u, b, legs] = l.rows.map(r => r.y + 8) as [number, number, number]
  uniques.forEach(([theme, one], i) => {
    const x = PAD + i * FOE_STEP
    box(body, x, u, FOE_BOX, FOE_BOX, lit.uniques[i]!)
    scaled(body, foeArtOf({ glyph: one.glyph, unique: one.key }, theme), x + 2, u + 2, 2, lit.uniques[i] ? undefined : SHADE)
  })
  bigs.forEach(([, one], i) => {
    const x = PAD + i * FOE_STEP
    box(body, x, b, FOE_BOX, FOE_BOX, lit.bigs[i]!)
    scaled(body, BOSS_ART[one.key], x + 1, b + 1, 1, lit.bigs[i] ? undefined : SHADE)
  })
  LEGENDARIES.forEach((one, i) => {
    const x = PAD + i * LEG_STEP
    // A Legendary found sits in its tier's box, as in the bag; one not yet found is a shape in a plain one.
    if (lit.legendaries[i]) tierBox(body, x + 1, legs + 1, LEG_W - 2, LEG_H - 2, 'legendary')
    else box(body, x, legs, LEG_W, LEG_H, false)
    const icon = ICONS[one.base]?.art ?? []
    const w = icon[0]?.length ?? 0
    art(body, icon, x + Math.floor((LEG_W - w) / 2), legs + Math.floor((LEG_H - icon.length) / 2), lit.legendaries[i] ? undefined : SHADE)
  })
  fill(body, PAD, l.rule, WINDOW_W - 2 * PAD, 1, RULE)
  for (const line of codexLines(g)) word(body, line.text, line.x, line.y, line.ink)
  const card = cardRect(c)
  button(body, CARD_KEY.key, CARD_KEY.label, card.x, card.y - bodyTop(CHROME), 'ready')
  return windowPixels(CHROME, body.px).px
}

/** What a gesture on the codex comes to: the game actions, and whether the hero card is asked for. */
export type CodexOutcome = { actions: Action[]; isCard: boolean }

/** Card asks for the hero card; the close box closes; anything else, nothing. */
export const codexGesture = (g: Game, gesture: Gesture): CodexOutcome => {
  const none = { actions: [], isCard: false }
  if (gesture.type === 'drag') return none
  const from = pixel(gesture.from)
  const at = pixel(gesture.at)
  if (Math.max(Math.abs(at.x - from.x), Math.abs(at.y - from.y)) >= CLICK_SLOP) return none
  const card = codexCardRect(g)
  if (isInside(at, card.x, card.y, card.w, card.h)) return { actions: [], isCard: true }
  return isInside(at, ...CLOSE_BOX) ? { actions: [{ kind: 'panel', panel: 'codex' }], isCard: false } : none
}

// The deep window: the depth and its tier, the last tiers reached with their marks (the one the hero is in framed),
// and while a fork waits, the next tier's two marks as cards, a click (or its letter) choosing one. Pure: the click
// layer reports whole gestures, this decides the game actions they make.
import type { Game, Mark } from '../types'
import type { Action } from './game'
import { DEEP_FROM, MARKS, TIER_DEPTHS, forkTier, markOf, pairOf, roman, tierOf, tierStart } from './deep'
import { button } from './pieces'
import { canvas, fill, frame } from './canvas'
import { wrap } from './recapwindow'
import { CLICK_SLOP, CLOSE_BOX, WINDOW_W, bodyTop, drawable, isInside, pixel, windowPixels, word } from './window'
import type { Chrome, Gesture, Rect } from './window'

const CHROME: Chrome = { title: 'THE DEEP', labels: [] }
const top = bodyTop(CHROME)
const PAD = 3
const LINE = 7
const ROW = 9
const DIM = '#8a8494'
const SAY = '#e8e4dc'
const GOLD = '#ffd34d'
const EASY = '#5ccf6a'
const HARD = '#ff7a59'
const NOW = '#ffffff'
const NOW_BG = '#1f1c27'
const RULE = '#2c2834'
const CARD_BG = '#15131b'
const CARD_EDGE = '#3a3644'
/** The tiers the window lists, the deepest reached last: fewer while a fork's cards need the room. */
const SHOWN = 3
const SHOWN_AT_FORK = 2
/** A row's columns: the tier, its depths, its mark. */
const DEPTHS_X = PAD + 20
const MARK_X = PAD + 52
/** A card's text: its name beside the letter key, what it does under both. */
const NAME_X = PAD + 16
const TEXT_X = PAD + 3
const TEXT_W = WINDOW_W - 2 * PAD - 6
/** The letter keys of the two cards, the easier first. */
export const CARD_KEYS = ['A', 'B'] as const

export type DeepLine = { text: string; x: number; y: number; ink: string }
type Row = { tier: number; y: number; isHere: boolean }
type Card = { mark: Mark; rect: Rect; lines: string[]; isChosen: boolean }

const inkOf = (mark: Mark) => (MARKS[mark].hard === true ? HARD : EASY)

/** Where everything goes, in window pixels: the head, a row a tier reached, the fork's cards and its note. */
const layout = (g: Game) => {
  const reached = tierOf(g.deepest)
  const here = g.where === 'dungeon' ? tierOf(g.depth) : 0
  const fork = forkTier(g)
  const shown = fork === undefined ? SHOWN : SHOWN_AT_FORK
  let y = top + 12
  const rows: Row[] = []
  for (let tier = Math.max(1, reached - shown + 1); tier <= reached; tier += 1) {
    rows.push({ tier, y, isHere: tier === here })
    y += ROW
  }
  // Above the tiers, a line saying where they begin.
  if (rows.length === 0) y += LINE + 2
  const rule = y + 1
  const cards: Card[] = []
  let chooseY = 0
  if (fork !== undefined) {
    chooseY = rule + 4
    y = chooseY + ROW
    for (const mark of pairOf(g.world, fork)) {
      const lines = wrap(drawable(MARKS[mark].does.toUpperCase()), TEXT_W)
      const rect = { x: PAD, y, w: WINDOW_W - 2 * PAD, h: 15 + lines.length * LINE + 1 }
      cards.push({ mark, rect, lines, isChosen: g.marks?.[fork] === mark })
      y += rect.h + 3
    }
  } else y = rule + 4
  const note = wrap(fork === undefined ? noteOf(g) : g.marks?.[fork] === undefined ? 'NONE CHOSEN MEANS A' : 'A CLICK CHANGES IT', WINDOW_W - 2 * PAD)
  const noteY = y
  y += note.length * LINE
  // Even, so the window ends on a whole cell.
  return { rows, fork, rule, chooseY, cards, note, noteY, height: Math.ceil((y + 1) / 2) * 2 }
}

/** With no fork waiting: where the next one opens. */
const noteOf = (g: Game) => {
  return `NEXT FORK AT DEPTH ${DEEP_FROM + tierOf(g.deepest) * TIER_DEPTHS}`
}

/** What the head says: the depth, and its tier if it has one. */
const headOf = (g: Game) => {
  if (g.where !== 'dungeon') return 'IN TOWN'
  const tier = tierOf(g.depth)
  return tier === 0 ? `DEPTH ${g.depth}` : `DEPTH ${g.depth}  TIER ${roman(tier)}`
}

const rowLines = (g: Game, r: Row): DeepLine[] => {
  const mark = markOf(g, r.tier)
  const start = tierStart(r.tier)
  const ink = r.isHere ? SAY : DIM
  return [
    { text: roman(r.tier), x: PAD + 3, y: r.y, ink },
    { text: `${start} ${start + TIER_DEPTHS - 1}`, x: DEPTHS_X, y: r.y, ink },
    { text: MARKS[mark].name.toUpperCase(), x: MARK_X, y: r.y, ink: r.isHere ? inkOf(mark) : DIM },
  ]
}

/** The lines the window says, where (window pixels) and in what ink. */
export const deepLines = (g: Game): DeepLine[] => {
  const l = layout(g)
  return [
    { text: headOf(g), x: PAD, y: top + 3, ink: GOLD },
    ...(l.rows.length === 0 ? [{ text: `THE TIERS BEGIN PAST DEPTH ${DEEP_FROM}`, x: PAD, y: top + 12, ink: DIM }] : []),
    ...l.rows.flatMap(r => rowLines(g, r)),
    ...(l.fork === undefined ? [] : [{ text: `CHOOSE TIER ${roman(l.fork)}`, x: PAD, y: l.chooseY, ink: GOLD }]),
    ...l.cards.flatMap(c => [
      { text: MARKS[c.mark].name.toUpperCase(), x: NAME_X, y: c.rect.y + 5, ink: inkOf(c.mark) },
      ...c.lines.map((text, i) => ({ text, x: TEXT_X, y: c.rect.y + 15 + i * LINE, ink: DIM })),
    ]),
    ...l.note.map((text, i) => ({ text, x: PAD, y: l.noteY + i * LINE, ink: DIM })),
  ]
}

/** The window's height in pixels, title bar and all. */
export const deepHeight = (g: Game) => layout(g).height

/** Each card of the fork, in window pixels, with the mark it chooses. */
export const deepCards = (g: Game): { mark: Mark; rect: Rect; isChosen: boolean }[] => layout(g).cards.map(({ mark, rect, isChosen }) => ({ mark, rect, isChosen }))

/** The window's pixels: title bar, the tier the hero is in framed, the rule, the cards with their letters, the lines. */
export const deepPixels = (g: Game): string[][] => {
  const l = layout(g)
  const body = canvas(WINDOW_W, l.height - top)
  for (const r of l.rows.filter(r => r.isHere)) {
    fill(body, PAD, r.y - top - 2, WINDOW_W - 2 * PAD, ROW, NOW_BG)
    frame(body, PAD, r.y - top - 2, WINDOW_W - 2 * PAD, ROW, NOW)
  }
  fill(body, PAD, l.rule - top, WINDOW_W - 2 * PAD, 1, RULE)
  l.cards.forEach((c, i) => {
    fill(body, c.rect.x, c.rect.y - top, c.rect.w, c.rect.h, CARD_BG)
    frame(body, c.rect.x, c.rect.y - top, c.rect.w, c.rect.h, c.isChosen ? NOW : CARD_EDGE)
    button(body, CARD_KEYS[i]!, '', c.rect.x + 2, c.rect.y - top + 2, 'ready')
  })
  for (const line of deepLines(g)) word(body, line.text, line.x, line.y - top, line.ink)
  return windowPixels(CHROME, body.px).px
}

/** A card clicked chooses its mark; the close box closes; anything else, nothing. */
export const deepGesture = (g: Game, gesture: Gesture): Action[] => {
  if (gesture.type === 'drag') return []
  const from = pixel(gesture.from)
  const at = pixel(gesture.at)
  if (Math.max(Math.abs(at.x - from.x), Math.abs(at.y - from.y)) >= CLICK_SLOP) return []
  const card = layout(g).cards.find(c => isInside(at, c.rect.x, c.rect.y, c.rect.w, c.rect.h))
  if (card !== undefined) return [{ kind: 'mark', mark: card.mark }]
  return isInside(at, ...CLOSE_BOX) ? [{ kind: 'panel', panel: 'deep' }] : []
}

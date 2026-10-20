// The deep window: the depth and its tier, the last tiers reached with their marks (the one the hero is in framed),
// and while a fork waits, the next tier's two marks as cards side by side, a click (or its letter) choosing one; what
// each does, and where the next fork opens, in the box under them. Pure: the click layer reports whole gestures, this
// decides the game actions they make.
import type { Game, Mark } from '../types'
import type { Action, Run } from './game'
import { DEEP_FROM, MARKS, TIER_DEPTHS, forkTier, markOf, pairOf, roman, tierOf, tierStart } from './deep'
import { canvas, fill, frame } from './canvas'
import { heroChrome, heroTabAt } from './herotabs'
import { flatCard } from './ui/kit'
import { INK, SPACE, SURFACE } from './ui/tokens'
import { CLICK_SLOP, CLOSE_BOX, WINDOW_W, bodyTop, drawBox, isInside, pixel, windowPixels, word } from './window'
import type { Chrome, Gesture, OverlayBox, Rect } from './window'

const CHROME: Chrome = { title: 'THE DEEP', labels: [] }
const top = bodyTop(CHROME)
const PAD = 3
const LINE = 7
const ROW = 9
const EASY = INK.easy
const HARD = INK.hard
const NOW_BG = SURFACE.raised
/** The tiers the window lists, the deepest reached last: fewer while a fork's cards need the room. */
const SHOWN = 3
const SHOWN_AT_FORK = 2
/** A row's columns: the tier, its depths, its mark. */
const DEPTHS_X = PAD + 20
const MARK_X = PAD + 52
/** The fork's two cards side by side: the letter key in gold, the mark's name beside it. */
const CARD_W = Math.floor((WINDOW_W - 2 * PAD - SPACE.gap) / 2)
const CARD_H = 13
const KEY_X = 5
const NAME_X = 12
/** The letter keys of the two cards, the easier first. */
export const CARD_KEYS = ['A', 'B'] as const

export type DeepLine = { text: string; x: number; y: number; ink: string }
type Row = { tier: number; y: number; isHere: boolean }
type Card = { mark: Mark; rect: Rect; isChosen: boolean }

const inkOf = (mark: Mark) => (MARKS[mark].hard === true ? HARD : EASY)

/** Where everything goes, in window pixels: the head, a row a tier reached, the fork's cards, the box's top. */
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
  const cardsY = rule + 4
  const cards: Card[] = fork === undefined ? [] : pairOf(g.world, fork).map((mark, i) => ({
    mark,
    rect: { x: PAD + i * (CARD_W + SPACE.gap), y: cardsY, w: CARD_W, h: CARD_H },
    isChosen: g.marks?.[fork] === mark,
  }))
  const boxY = Math.ceil(((cards.length > 0 ? cardsY + CARD_H : rule) + 3) / 2)
  return { rows, fork, rule, cards, boxY }
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
  const ink = r.isHere ? INK.text : INK.dim
  return [
    { text: roman(r.tier), x: PAD + 3, y: r.y, ink },
    { text: `${start} ${start + TIER_DEPTHS - 1}`, x: DEPTHS_X, y: r.y, ink },
    { text: MARKS[mark].name.toUpperCase(), x: MARK_X, y: r.y, ink: r.isHere ? inkOf(mark) : INK.dim },
  ]
}

/** The lines the window says in pixels, where (window pixels) and in what ink: the head, the tiers, the cards' names. */
export const deepLines = (g: Game): DeepLine[] => {
  const l = layout(g)
  return [
    { text: headOf(g), x: PAD, y: top + 3, ink: INK.gold },
    ...(l.rows.length === 0 ? [{ text: `THE TIERS BEGIN PAST DEPTH ${DEEP_FROM}`, x: PAD, y: top + 12, ink: INK.dim }] : []),
    ...l.rows.flatMap(r => rowLines(g, r)),
    ...l.cards.flatMap((c, i) => [
      { text: CARD_KEYS[i]!, x: c.rect.x + KEY_X, y: c.rect.y + 4, ink: INK.gold },
      { text: MARKS[c.mark].name.toUpperCase(), x: c.rect.x + NAME_X, y: c.rect.y + 4, ink: inkOf(c.mark) },
    ]),
  ]
}

/** The note under the cards: how the fork is chosen, or with none waiting where the next opens. */
const noteOf = (g: Game, fork: number | undefined) => {
  if (fork === undefined) return `Next fork at depth ${DEEP_FROM + tierOf(g.deepest) * TIER_DEPTHS}.`
  return `Choose tier ${roman(fork)}: ${g.marks?.[fork] === undefined ? 'none chosen means A' : 'a click changes it'}.`
}

/** The box, in cells: what each card's mark does, its name in its ink, then the note. */
export const deepOverlay = (g: Game): OverlayBox[] => {
  const l = layout(g)
  const lines: Run[][] = [
    ...l.cards.map((c, i) => [{ text: `${CARD_KEYS[i]} ` }, { text: `${MARKS[c.mark].name}: `, bold: true, color: inkOf(c.mark) }, { text: MARKS[c.mark].does }]),
    [{ text: noteOf(g, l.fork), dim: true }],
  ]
  return [{ role: 'about', x: 2, y: l.boxY, w: WINDOW_W - 4, h: lines.length + 2, border: SURFACE.frame, lines }]
}

/** The window's height in pixels, title bar and all. */
export const deepHeight = (g: Game) => {
  const box = deepOverlay(g)[0]!
  return 2 * (box.y + box.h) + 2
}

/** Each card of the fork, in window pixels, with the mark it chooses. */
export const deepCards = (g: Game): Card[] => layout(g).cards

/** The window's pixels: title bar, the tier the hero is in framed, the rule, the cards, the lines, the box. */
export const deepPixels = (g: Game): string[][] => {
  const l = layout(g)
  const body = canvas(WINDOW_W, deepHeight(g) - top)
  for (const r of l.rows.filter(r => r.isHere)) {
    fill(body, PAD, r.y - top - 2, WINDOW_W - 2 * PAD, ROW, NOW_BG)
    frame(body, PAD, r.y - top - 2, WINDOW_W - 2 * PAD, ROW, INK.focus)
  }
  fill(body, PAD, l.rule - top, WINDOW_W - 2 * PAD, 1, SURFACE.line)
  for (const c of l.cards) flatCard(body, { ...c.rect, y: c.rect.y - top }, c.isChosen)
  for (const line of deepLines(g)) word(body, line.text, line.x, line.y - top, line.ink)
  const c = windowPixels(heroChrome(g, 'deep'), body.px)
  for (const b of deepOverlay(g)) drawBox(c, b)
  return c.px
}

/** A card clicked chooses its mark; the close box closes; anything else, nothing. */
export const deepGesture = (g: Game, gesture: Gesture): Action[] => {
  if (gesture.type === 'drag') return []
  const from = pixel(gesture.from)
  const at = pixel(gesture.at)
  if (Math.max(Math.abs(at.x - from.x), Math.abs(at.y - from.y)) >= CLICK_SLOP) return []
  const tab = heroTabAt(g, 'deep', at)
  if (tab !== undefined) return tab
  const card = layout(g).cards.find(c => isInside(at, c.rect.x, c.rect.y, c.rect.w, c.rect.h))
  if (card !== undefined) return [{ kind: 'mark', mark: card.mark }]
  return isInside(at, ...CLOSE_BOX) ? [{ kind: 'panel', panel: 'deep' }] : []
}

/** What a click acts on, in window pixels: the fork's cards. */
export const deepHot = (g: Game): Rect[] => deepCards(g).map(c => c.rect)

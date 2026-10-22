// The deep window: while a fork waits, the next tier's two marks as cards side by side, a click (or its letter)
// choosing one; under them a box with the depth and its tier, the last tiers reached with their marks (the one the
// hero is in marked), what each card does, and where the next fork opens. Pure: the click layer reports whole
// gestures, this decides the game actions they make.
import type { Game, Mark } from '../types'
import type { Action, Run } from './game'
import { DEEP_FROM, MARKS, TIER_DEPTHS, forkTier, markOf, pairOf, roman, tierOf, tierStart } from './deep'
import { canvas } from './canvas'
import { heroChrome, heroTabAt } from './herotabs'
import { BUTTON_H, buttonFace, wideButtonBox } from './pieces'
import type { ButtonState } from './pieces'
import { INK, SPACE, SURFACE } from './ui/tokens'
import { CLICK_SLOP, CLOSE_BOX, WINDOW_TOP, WINDOW_W, drawBox, isInside, pixel, windowPixels } from './window'
import type { Chrome, Gesture, OverlayBox, Rect } from './window'

const CHROME: Chrome = { title: 'THE DEEP' }
const top = WINDOW_TOP
const PAD = 3
const EASY = INK.easy
const HARD = INK.hard
/** The tiers the window lists, the deepest reached last. */
const SHOWN = 3
/** The fork's two choices side by side, each a button: the mark's name in its ink. */
const CARD_W = Math.floor((WINDOW_W - 2 * PAD - SPACE.gap) / 2)
const CARD_H = BUTTON_H
/** The letter keys of the two cards, the easier first. */
export const CARD_KEYS = ['A', 'B'] as const

type Card = { mark: Mark; rect: Rect; isChosen: boolean }

const inkOf = (mark: Mark) => (MARKS[mark].hard === true ? HARD : EASY)

/** Where everything goes, in window pixels: the fork's cards, then the box's top, in cells. */
const layout = (g: Game) => {
  const fork = forkTier(g)
  const cardsY = top + 2
  const cards: Card[] = fork === undefined ? [] : pairOf(g.world, fork).map((mark, i) => ({
    mark,
    rect: { x: PAD + i * (CARD_W + SPACE.gap), y: cardsY, w: CARD_W, h: CARD_H },
    isChosen: g.marks?.[fork] === mark,
  }))
  const boxY = cards.length > 0 ? Math.ceil((cardsY + CARD_H + 3) / 2) : top / 2 + 1
  return { fork, cards, boxY }
}

/** What the head says: the depth, and its tier if it has one. */
const headOf = (g: Game) => {
  if (g.where !== 'dungeon') return 'In town'
  const tier = tierOf(g.depth)
  return tier === 0 ? `Depth ${g.depth}` : `Depth ${g.depth}, tier ${roman(tier)}`
}

/** A tier reached: its depths and its mark; the one the hero is in marked, its mark in its ink. */
const tierLine = (g: Game, tier: number): Run[] => {
  const mark = markOf(g, tier)
  const start = tierStart(tier)
  const text = `Tier ${roman(tier)}, depths ${start} to ${start + TIER_DEPTHS - 1}: `
  const isHere = g.where === 'dungeon' && tierOf(g.depth) === tier
  if (!isHere) return [{ text: '  ' }, { text: `${text}${MARKS[mark].name}`, dim: true }]
  return [{ text: '> ', color: INK.gold, bold: true }, { text }, { text: MARKS[mark].name, color: inkOf(mark) }]
}

const cardState = (c: Card): ButtonState => (c.isChosen ? 'armed' : 'ready')

/** A choice's words centred on its face, as a wide button's: its mark's name in the mark's ink. */
const cardBox = (c: Card): OverlayBox<'button'> => {
  const name = MARKS[c.mark].name.toUpperCase()
  return { ...wideButtonBox(name, c.rect.x, c.rect.y, c.rect.w, cardState(c)), lines: [[{ text: name, color: inkOf(c.mark), bold: true }]] }
}

/** The note under the cards: how the fork is chosen, or with none waiting where the next opens. */
const noteOf = (g: Game, fork: number | undefined) => {
  if (fork === undefined) return `Next fork at depth ${DEEP_FROM + tierOf(g.deepest) * TIER_DEPTHS}.`
  return `Choose tier ${roman(fork)}: ${g.marks?.[fork] === undefined ? 'none chosen means A' : 'a click changes it'}.`
}

/** The box, in cells: the head, the last tiers reached, what each card's mark does, then the note. Then the choices'
 * words. */
export const deepOverlay = (g: Game): OverlayBox[] => {
  const l = layout(g)
  const reached = tierOf(g.deepest)
  const tiers = Array.from({ length: Math.min(SHOWN, reached) }, (_, i) => reached - Math.min(SHOWN, reached) + 1 + i)
  const lines: Run[][] = [
    [{ text: headOf(g), bold: true, color: INK.gold }],
    ...(tiers.length === 0 ? [[{ text: `The tiers begin past depth ${DEEP_FROM}.`, dim: true }]] : tiers.map(t => tierLine(g, t))),
    ...l.cards.map((c, i) => [{ text: `${CARD_KEYS[i]} ` }, { text: `${MARKS[c.mark].name}: `, bold: true, color: inkOf(c.mark) }, { text: MARKS[c.mark].does }]),
    [{ text: noteOf(g, l.fork), dim: true }],
  ]
  return [{ role: 'about', x: 2, y: l.boxY, w: WINDOW_W - 4, h: lines.length + 2, border: SURFACE.frame, lines }, ...l.cards.map(cardBox)]
}

/** The window's height in pixels, title bar and all. */
export const deepHeight = (g: Game) => {
  const box = deepOverlay(g)[0]!
  return 2 * (box.y + box.h) + 2
}

/** Each card of the fork, in window pixels, with the mark it chooses. */
export const deepCards = (g: Game): Card[] => layout(g).cards

/** The window's pixels: title bar, the fork's cards, the box. */
export const deepPixels = (g: Game): string[][] => {
  const l = layout(g)
  const body = canvas(WINDOW_W, deepHeight(g) - top)
  for (const c of l.cards) buttonFace(body, c.rect.x, c.rect.y - top, c.rect.w, cardState(c))
  const c = windowPixels(heroChrome(g, 'deep'), body.px)
  for (const b of deepOverlay(g)) if (b.role === 'about') drawBox(c, b)
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
  if (card !== undefined) return card.isChosen ? [] : [{ kind: 'mark', mark: card.mark }]
  return isInside(at, ...CLOSE_BOX) ? [{ kind: 'panel', panel: 'deep' }] : []
}

/** What a click acts on, in window pixels: the fork's card not chosen. */
export const deepHot = (g: Game): Rect[] => deepCards(g).filter(c => !c.isChosen).map(c => c.rect)

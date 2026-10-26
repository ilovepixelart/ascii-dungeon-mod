// The Abyss window: past DEEP_FROM every TIER_DEPTHS depths are a circle, named, its warden the big boss at its end.
// While a fork waits, the next circle's two fates as cards side by side, its blessing and its curse, a click (or its
// letter) choosing one; under them a box with the circle, its depths and its warden, what each fate does, the fates
// chosen so far, and where to choose or where the next fork opens. Pure: the click layer reports whole gestures, this
// decides the game actions they make.
import type { Game, Mark } from '../types'
import type { Action, Run } from './game'
import { DEEP_FROM, MARKS, TIER_DEPTHS, circleName, fateOf, forkTier, markOf, pairOf, roman, tierOf, tierStart } from './deep'
import { BIG_BOSSES } from './game'
import { themeOf } from './map'
import { canvas } from './canvas'
import { heroChrome, heroTabAt } from './herotabs'
import { BUTTON_H, buttonFace, wideButtonBox } from './pieces'
import type { ButtonState } from './pieces'
import { INK, SPACE, SURFACE } from './ui/tokens'
import { CLICK_SLOP, CLOSE_BOX, WINDOW_TOP, WINDOW_W, drawBox, isInside, pixel, windowPixels } from './window'
import type { Chrome, Gesture, OverlayBox, Rect } from './window'

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
  const boxY = cards.length > 0 ? Math.ceil((cardsY + CARD_H + 2) / 2) : top / 2 + 1
  return { fork, cards, boxY }
}

/** A circle's warden: the big boss on its last depth, its theme's. */
const wardenOf = (tier: number) => BIG_BOSSES[themeOf(tierStart(tier) + TIER_DEPTHS - 1)].name

/** The circle the box is about: the fork's while one waits, else the one the hero is in or last reached. */
const circleShown = (g: Game, fork: number | undefined) => fork ?? (g.where === 'dungeon' && tierOf(g.depth) > 0 ? tierOf(g.depth) : tierOf(g.deepest))

/** The box's head: the circle by number and name, then its depths and its warden. */
const circleLines = (tier: number): Run[][] => {
  const start = tierStart(tier)
  return [
    [{ text: `Circle ${roman(tier)}: ${circleName(tier)}`, bold: true, color: INK.gold }],
    [{ text: `Depths ${start} to ${start + TIER_DEPTHS - 1}, its warden the ${wardenOf(tier)}.`, dim: true }],
  ]
}

/** The fates chosen so far, a circle each, the last three: the one the hero is in in its ink. */
const fatesLine = (g: Game): Run[] => {
  const reached = tierOf(g.deepest)
  const tiers = Array.from({ length: Math.min(SHOWN, reached) }, (_, i) => reached - Math.min(SHOWN, reached) + 1 + i)
  const here = g.where === 'dungeon' ? tierOf(g.depth) : 0
  return [{ text: 'Fates chosen: ', dim: true }, ...tiers.flatMap((t, i) => [
    ...(i > 0 ? [{ text: ', ', dim: true }] : []),
    t === here ? { text: `${roman(t)} ${MARKS[markOf(g, t)].name}`, color: inkOf(markOf(g, t)) } : { text: `${roman(t)} ${MARKS[markOf(g, t)].name}`, dim: true },
  ])]
}

const cardState = (c: Card): ButtonState => (c.isChosen ? 'armed' : 'ready')

/** A choice's words centred on its face, as a wide button's: the fate it is and its mark's name, in the mark's ink. */
const cardBox = (c: Card): OverlayBox<'button'> => {
  const words = `${fateOf(c.mark).toUpperCase()}: ${MARKS[c.mark].name.toUpperCase()}`
  return { ...wideButtonBox(words, c.rect.x, c.rect.y, c.rect.w, cardState(c)), lines: [[{ text: words, color: inkOf(c.mark), bold: true }]] }
}

/** The note under the fates: how the fork is chosen, or with none waiting where the next opens. */
const noteOf = (g: Game, fork: number | undefined) => {
  if (fork === undefined) return `The next fork opens at depth ${DEEP_FROM + tierOf(g.deepest) * TIER_DEPTHS}, when its warden falls.`
  return `Choose its fate: ${g.marks?.[fork] === undefined ? 'none chosen, the blessing holds' : 'a click changes it'}.`
}

/** The box, in cells: the head, the last tiers reached, what each card's mark does, then the note. Then the choices'
 * words. */
export const deepOverlay = (g: Game): OverlayBox[] => {
  const l = layout(g)
  const tier = circleShown(g, l.fork)
  const lines: Run[][] = tier === 0
    ? [
        [{ text: 'The Abyss', bold: true, color: INK.gold }],
        [{ text: `It opens past depth ${DEEP_FROM}: every ${TIER_DEPTHS} depths a circle, a warden at its end, its fate yours to choose.`, dim: true }],
      ]
    : [
        ...circleLines(tier),
        ...l.cards.map((c, i) => [{ text: `${CARD_KEYS[i]} ` }, { text: `${MARKS[c.mark].name}, a ${fateOf(c.mark)}: `, bold: true, color: inkOf(c.mark) }, { text: MARKS[c.mark].does }]),
        ...(tierOf(g.deepest) > 0 ? [fatesLine(g)] : []),
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

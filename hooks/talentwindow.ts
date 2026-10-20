// The talent window: while a talent is owed, the three offered as cards side by side, each its family's ribbon and its
// icon, the chosen one lifted, its name and line in the box below; a click chooses a card,
// again (or Take) takes it, Later leaves it owed. With none owed, the talents taken and the level of the next. Pure:
// the click layer reports whole gestures, this decides the window's next state and the game actions they make.
import type { Game, Talent } from '../types'
import type { Action, Run } from './game'
import { TALENTS, TALENT_EVERY, offer, owed } from './talents'
import { button, buttonW } from './pieces'
import { canvas, fill, frame, put } from './canvas'
import { PAL, TALENT_ICON } from './pixelart'
import { asIs, bevelCard, flatCard, gem, recede, ribbon, sparkles } from './ui/kit'
import type { Tone } from './ui/kit'
import { FAMILIES, INK, SURFACE } from './ui/tokens'
import type { FamilyName } from './ui/tokens'
import { heroChrome, heroTabAt } from './herotabs'
import { wrap } from './recapwindow'
import { CLICK_SLOP, CLOSE_BOX, WINDOW_W, bodyTop, drawBox, drawable, isInside, pixel, windowPixels, word } from './window'
import type { Chrome, Gesture, OverlayBox, Rect } from './window'

const CHROME: Chrome = { title: 'TALENT', labels: [] }
const top = bodyTop(CHROME)

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
const CARD_H = 34
const CARD_Y = 6
const LIFT = 2
/** The icon at its own size inside a pixel of backdrop and a frame. */
const ART = 14

const chosenOf = (g: Game, ui: TalentUi) => Math.min(Math.max(0, ui.chosen), Math.max(0, offer(g).length - 1))

/** Where the cards row and its parts go, in window pixels. */
const rowX = Math.floor((WINDOW_W - (3 * CARD_W + 2 * GAP)) / 2)
/** A card's place: its column, lifted when chosen; what a click on it covers, lifted or not. */
export const cardRect = (i: number): Rect => ({ x: rowX + i * (CARD_W + GAP), y: top + CARD_Y - LIFT, w: CARD_W, h: CARD_H + LIFT })
const BUTTONS_Y = CARD_Y + CARD_H + 5
export const takeRect = (): Rect => {
  const w = buttonW('T', 'TAKE')
  return { x: Math.floor((WINDOW_W - w - 4 - buttonW('L', 'LATER')) / 2), y: top + BUTTONS_Y, w, h: 11 }
}
export const laterRect = (): Rect => {
  const t = takeRect()
  return { x: t.x + t.w + 4, y: t.y, w: buttonW('L', 'LATER'), h: 11 }
}
/** The box under the buttons, in cells: the chosen talent's line. */
export const talentOverlay = (g: Game, ui: TalentUi): OverlayBox[] => {
  const offered = offer(g)
  if (offered.length === 0) return []
  const t = offered[chosenOf(g, ui)]!
  const lines: Run[][] = [[{ text: `${TALENTS[t].name}: `, bold: true }, { text: TALENTS[t].does }]]
  return [{ role: 'about', x: 2, y: Math.floor((takeRect().y + 11 + 3) / 2), w: WINDOW_W - 4, h: lines.length + 2, border: SURFACE.frame, lines }]
}
const offerHeight = (g: Game, ui: TalentUi) => {
  const box = talentOverlay(g, ui)[0]!
  return 2 * (box.y + box.h) + 2
}

type Canvas = ReturnType<typeof canvas>

/** The icon at its own size, on a lit backdrop with a floor, framed, its top at ay. */
const drawArt = (body: Canvas, t: Talent, x: number, ay: number, tone: Tone) => {
  const ax = x + Math.floor((CARD_W - ART) / 2)
  fill(body, ax, ay, ART, ART, tone(SURFACE.backdrop))
  fill(body, ax + 1, ay + ART - 4, ART - 2, 3, tone(SURFACE.floor))
  frame(body, ax, ay, ART, ART, tone(SURFACE.frame))
  TALENT_ICON[t].forEach((row, iy) => [...row].forEach((k, ix) => k !== '.' && put(body, ax + 1 + ix, ay + 1 + iy, tone(PAL[k] ?? '#ff00ff'))))
}

/** A card: its family's beveled face, the ribbon, the icon, the gem; lifted with sparkles when chosen, else receded. */
const drawCard = (body: Canvas, t: Talent, i: number, isOn: boolean) => {
  const f = FAMILIES[FAMILY_OF[t]]
  const tone = isOn ? asIs : recede
  const x = cardRect(i).x
  const y = CARD_Y - (isOn ? LIFT : 0)
  bevelCard(body, { x, y: CARD_Y, w: CARD_W, h: CARD_H }, f, isOn, LIFT, tone)
  ribbon(body, f, x, CARD_W, y + 4, tone)
  drawArt(body, t, x, y + 13, tone)
  gem(body, f, x + Math.floor(CARD_W / 2), y + CARD_H - 4, isOn, tone)
  if (isOn) sparkles(body, { x, y, w: CARD_W, h: CARD_H })
}

/** The offer as cards: the row, Take and Later, the box. */
const offerPixels = (g: Game, ui: TalentUi): string[][] => {
  const offered = offer(g)
  const chosen = chosenOf(g, ui)
  const height = offerHeight(g, ui)
  const body = canvas(WINDOW_W, height - top)
  offered.forEach((t, i) => drawCard(body, t, i, i === chosen))
  button(body, 'T', 'TAKE', takeRect().x, takeRect().y - top, 'armed')
  button(body, 'L', 'LATER', laterRect().x, laterRect().y - top, 'ready')
  const c = windowPixels(heroChrome(g, 'talent'), body.px)
  for (const b of talentOverlay(g, ui)) drawBox(c, b)
  return c.px
}
const PAD = 3
const LINE = 7
const WORK = '#3ccf4e'
/** A card's text: its name beside the number key, what it does under both. */
const NAME_X = PAD + 16
const TEXT_X = PAD + 3
const TEXT_W = WINDOW_W - 2 * PAD - 6

export type TalentLine = { text: string; x: number; y: number; ink: string }
type Card = { talent: Talent; rect: Rect; lines: string[] }

const inkOf = (t: Talent) => (TALENTS[t].work === true ? WORK : INK.text)

/** Where everything goes, in window pixels: the head, a card each offered talent, or the list of those taken. */
const layout = (g: Game) => {
  const offered = offer(g)
  let y = top + 11
  const cards: Card[] = offered.map(talent => {
    const lines = wrap(drawable(TALENTS[talent].does.toUpperCase()), TEXT_W)
    const rect = { x: PAD, y, w: WINDOW_W - 2 * PAD, h: 15 + lines.length * LINE + 1 }
    y += rect.h + 3
    return { talent, rect, lines }
  })
  const taken = offered.length > 0 ? [] : (g.talents ?? [])
  const takenY = y
  y += taken.length * LINE
  // Even, so the window ends on a whole cell.
  return { offered, cards, taken, takenY, height: Math.ceil((y + LINE + 1) / 2) * 2 }
}

/** What the head says: the level that earned the talent, or the next level that will, or that all are taken. */
const headOf = (g: Game) => {
  const taken = g.talents?.length ?? 0
  if (owed(g) > 0) return `LEVEL ${TALENT_EVERY * (taken + 1)}  CHOOSE ONE`
  return taken === Object.keys(TALENTS).length ? 'EVERY TALENT TAKEN' : `NEXT AT LEVEL ${TALENT_EVERY * (taken + 1)}`
}

/** The lines the window says, where (window pixels) and in what ink. */
export const talentLines = (g: Game): TalentLine[] => {
  const l = layout(g)
  return [
    { text: headOf(g), x: PAD, y: top + 3, ink: owed(g) > 0 ? INK.gold : INK.dim },
    ...l.cards.flatMap(c => [
      { text: TALENTS[c.talent].name.toUpperCase(), x: NAME_X, y: c.rect.y + 5, ink: inkOf(c.talent) },
      ...c.lines.map((text, i) => ({ text, x: TEXT_X, y: c.rect.y + 15 + i * LINE, ink: INK.dim })),
    ]),
    ...l.taken.map((t, i) => ({ text: TALENTS[t].name.toUpperCase(), x: PAD, y: l.takenY + i * LINE, ink: inkOf(t) })),
    ...(l.cards.length > 0 ? [{ text: 'CLICK ONE TO TAKE IT', x: PAD, y: l.height - LINE - 1, ink: INK.dim }] : []),
  ]
}

/** The window's height in pixels, title bar and all. */
export const talentHeight = (g: Game, ui: TalentUi = TALENT_UI) => (offer(g).length > 0 ? offerHeight(g, ui) : layout(g).height)

/** Each offered talent's card, in window pixels: what a click on it covers. */
export const talentCards = (g: Game): { talent: Talent; rect: Rect }[] => offer(g).map((talent, i) => ({ talent, rect: cardRect(i) }))

/** The window's pixels: the offer as cards, or with none owed the talents taken. */
export const talentPixels = (g: Game, ui: TalentUi = TALENT_UI): string[][] => {
  if (offer(g).length > 0) return offerPixels(g, ui)
  const l = layout(g)
  const body = canvas(WINDOW_W, l.height - top)
  l.cards.forEach((c, i) => {
    flatCard(body, { ...c.rect, y: c.rect.y - top }, false)
    button(body, String(i + 1), '', c.rect.x + 2, c.rect.y - top + 2, 'ready')
  })
  for (const line of talentLines(g)) word(body, line.text, line.x, line.y - top, line.ink)
  return windowPixels(heroChrome(g, 'talent'), body.px).px
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

/** What a click acts on, in window pixels, as drawn: each card's face (the chosen one lifted), Take and Later; with
 * none owed, nothing but the tabs. */
export const talentHot = (g: Game, ui: TalentUi): Rect[] => {
  if (offer(g).length === 0) return []
  const chosen = chosenOf(g, ui)
  const faces = offer(g).map((_, i) => ({ ...cardRect(i), y: top + CARD_Y - (i === chosen ? LIFT : 0), h: CARD_H }))
  return [...faces, takeRect(), laterRect()]
}

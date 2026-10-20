// The talent window: while a talent is owed, the three offered as cards side by side, each its family's ribbon and its
// icon, the chosen one lifted, its name and line in the box below; a click chooses a card,
// again (or Take) takes it, Later leaves it owed. With none owed, the talents taken and the level of the next. Pure:
// the click layer reports whole gestures, this decides the window's next state and the game actions they make.
import type { Game, Talent } from '../types'
import type { Action, Run } from './game'
import { TALENTS, TALENT_EVERY, offer, owed } from './talents'
import { CURSOR, GOLD_INK, button, buttonW } from './pieces'
import { canvas, fill, frame, put } from './canvas'
import { PAL, TALENT_ICON, textMask } from './pixelart'
import { wrap } from './recapwindow'
import { CLICK_SLOP, CLOSE_BOX, WINDOW_W, bodyTop, drawBox, drawable, isInside, pixel, windowPixels, word } from './window'
import type { Chrome, Gesture, OverlayBox, Rect } from './window'

const CHROME: Chrome = { title: 'TALENT', labels: [] }
const top = bodyTop(CHROME)

/** The window's state beyond the game: the card chosen, by its place in the row. */
export type TalentUi = { chosen: number }
export const TALENT_UI: TalentUi = { chosen: 0 }

/** A talent's family: what it plays on, its ribbon's word and its colors, light and dark for the card's bevel. */
type Family = { label: string; ink: string; light: string; dark: string; top: string; bottom: string }
const FAMILIES: Readonly<Record<'work' | 'fight' | 'road', Family>> = {
  work: { label: 'WORK', ink: '#5ccf6a', light: '#a8f0b0', dark: '#2c6a36', top: '#1a2a20', bottom: '#0f1612' },
  fight: { label: 'FIGHT', ink: '#f06a5a', light: '#ffb0a6', dark: '#7a2a24', top: '#2c1820', bottom: '#160d11' },
  road: { label: 'ROAD', ink: '#ffd34d', light: '#fff0b0', dark: '#8a6a1a', top: '#2a2416', bottom: '#15120b' },
}
/** Coding's own talents work; those of blows fight; potions, prices and sight are the road's. */
const FAMILY_OF: Readonly<Record<Talent, keyof typeof FAMILIES>> = {
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
const SHADOW = '#06050a'

const textW = (t: string) => textMask(t)[0]?.length ?? 0
const mix = (a: string, b: string, t: number) => {
  const ch = (h: string, i: number) => Number.parseInt(h.slice(1 + 2 * i, 3 + 2 * i), 16)
  return `#${[0, 1, 2].map(i => Math.round(ch(a, i) * (1 - t) + ch(b, i) * t).toString(16).padStart(2, '0')).join('')}`
}

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
  return [{ role: 'about', x: 2, y: Math.floor((takeRect().y + 11 + 3) / 2), w: WINDOW_W - 4, h: lines.length + 2, border: '#6b6258', lines }]
}
const offerHeight = (g: Game, ui: TalentUi) => {
  const box = talentOverlay(g, ui)[0]!
  return 2 * (box.y + box.h) + 2
}

type Canvas = ReturnType<typeof canvas>
type Tone = (ink: string) => string

/** A card's face fading in its family's tint, its shadow, and a beveled rim: light top and left, dark bottom and right. */
const drawFace = (body: Canvas, f: Family, x: number, y: number, isOn: boolean, dim: Tone) => {
  fill(body, x + 2, CARD_Y + CARD_H, CARD_W - 2, isOn ? 3 : 2, SHADOW)
  for (let yy = 0; yy < CARD_H; yy += 1) fill(body, x, y + yy, CARD_W, 1, dim(mix(f.top, f.bottom, yy / CARD_H)))
  const rim = isOn ? { light: CURSOR, dark: '#9a96a4' } : { light: dim(f.light), dark: dim(f.dark) }
  fill(body, x + 1, y, CARD_W - 2, 1, rim.light)
  fill(body, x, y + 1, 1, CARD_H - 2, rim.light)
  fill(body, x + 1, y + CARD_H - 1, CARD_W - 2, 1, rim.dark)
  fill(body, x + CARD_W - 1, y + 1, 1, CARD_H - 2, rim.dark)
  frame(body, x + 1, y + 1, CARD_W - 2, CARD_H - 2, '#0c0a10')
}

/** The pennant: the family's ribbon across the card at ry, its ends notched, its word on it. */
const drawPennant = (body: Canvas, f: Family, x: number, ry: number, dim: Tone) => {
  fill(body, x + 2, ry, CARD_W - 4, 7, dim(f.ink))
  fill(body, x + 2, ry + 6, CARD_W - 4, 1, dim(f.dark))
  for (const nx of [x + 2, x + CARD_W - 3]) for (const ny of [ry + 2, ry + 3, ry + 4]) put(body, nx, ny, dim(f.top))
  word(body, f.label, x + Math.floor((CARD_W - textW(f.label)) / 2), ry + 1, '#14101a')
}

/** The icon at its own size, on a lit backdrop with a floor, framed, its top at ay. */
const drawArt = (body: Canvas, t: Talent, x: number, ay: number, dim: Tone) => {
  const ax = x + Math.floor((CARD_W - ART) / 2)
  fill(body, ax, ay, ART, ART, dim('#1c2230'))
  fill(body, ax + 1, ay + ART - 4, ART - 2, 3, dim('#232a3a'))
  frame(body, ax, ay, ART, ART, dim('#6b6258'))
  TALENT_ICON[t].forEach((row, iy) => [...row].forEach((k, ix) => k !== '.' && put(body, ax + 1 + ix, ay + 1 + iy, dim(PAL[k] ?? '#ff00ff'))))
}

/** A diamond gem at the card's foot, lit when chosen; and the chosen card's sparkles at its top corners. */
const drawGem = (body: Canvas, f: Family, x: number, y: number, isOn: boolean, dim: Tone) => {
  const gx = x + Math.floor(CARD_W / 2)
  const gy = y + CARD_H - 4
  for (const [dx, dy] of [[0, -1], [-1, 0], [1, 0], [0, 1]] as const) put(body, gx + dx, gy + dy, isOn ? f.ink : f.dark)
  put(body, gx, gy, isOn ? CURSOR : dim(f.ink))
  if (!isOn) return
  for (const sx of [x - 2, x + CARD_W + 1]) {
    put(body, sx, y - 2, CURSOR)
    put(body, sx, y - 1, GOLD_INK)
    put(body, sx + (sx < x ? 1 : -1), y - 2, GOLD_INK)
  }
}

/** A card: its face, the pennant, the icon, the gem; the cards not chosen dimmed by a quarter. */
const drawCard = (body: Canvas, t: Talent, i: number, isOn: boolean) => {
  const f = FAMILIES[FAMILY_OF[t]]
  const dim: Tone = ink => (isOn ? ink : mix(ink, '#0b0a0f', 0.28))
  const x = cardRect(i).x
  const y = CARD_Y - (isOn ? LIFT : 0)
  drawFace(body, f, x, y, isOn, dim)
  drawPennant(body, f, x, y + 4, dim)
  drawArt(body, t, x, y + 13, dim)
  drawGem(body, f, x, y, isOn, dim)
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
  const c = windowPixels({ ...CHROME, title: `TALENT  LEVEL ${TALENT_EVERY * ((g.talents?.length ?? 0) + 1)}` }, body.px)
  for (const b of talentOverlay(g, ui)) drawBox(c, b)
  return c.px
}
const PAD = 3
const LINE = 7
const DIM = '#8a8494'
const SAY = '#e8e4dc'
const GOLD = '#ffd34d'
const WORK = '#3ccf4e'
const CARD_BG = '#15131b'
const CARD_EDGE = '#3a3644'
/** A card's text: its name beside the number key, what it does under both. */
const NAME_X = PAD + 16
const TEXT_X = PAD + 3
const TEXT_W = WINDOW_W - 2 * PAD - 6

export type TalentLine = { text: string; x: number; y: number; ink: string }
type Card = { talent: Talent; rect: Rect; lines: string[] }

const inkOf = (t: Talent) => (TALENTS[t].work === true ? WORK : SAY)

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
    { text: headOf(g), x: PAD, y: top + 3, ink: owed(g) > 0 ? GOLD : DIM },
    ...l.cards.flatMap(c => [
      { text: TALENTS[c.talent].name.toUpperCase(), x: NAME_X, y: c.rect.y + 5, ink: inkOf(c.talent) },
      ...c.lines.map((text, i) => ({ text, x: TEXT_X, y: c.rect.y + 15 + i * LINE, ink: DIM })),
    ]),
    ...l.taken.map((t, i) => ({ text: TALENTS[t].name.toUpperCase(), x: PAD, y: l.takenY + i * LINE, ink: inkOf(t) })),
    ...(l.cards.length > 0 ? [{ text: 'CLICK ONE TO TAKE IT', x: PAD, y: l.height - LINE - 1, ink: DIM }] : []),
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
    fill(body, c.rect.x, c.rect.y - top, c.rect.w, c.rect.h, CARD_BG)
    frame(body, c.rect.x, c.rect.y - top, c.rect.w, c.rect.h, CARD_EDGE)
    button(body, String(i + 1), '', c.rect.x + 2, c.rect.y - top + 2, 'ready')
  })
  for (const line of talentLines(g)) word(body, line.text, line.x, line.y - top, line.ink)
  return windowPixels(CHROME, body.px).px
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
  const close = { ui, actions: [{ kind: 'panel', panel: 'talent' } as Action] }
  const offered = offer(g)
  if (offered.length === 0) return isInside(at, ...CLOSE_BOX) ? close : none
  const chosen = chosenOf(g, ui)
  const card = offered.findIndex((_, i) => inside(cardRect(i)))
  if (card >= 0) return card === chosen ? { ui, actions: [{ kind: 'talent', talent: offered[card]! }] } : { ui: { chosen: card }, actions: [] }
  if (inside(takeRect())) return { ui, actions: [{ kind: 'talent', talent: offered[chosen]! }] }
  return inside(laterRect()) || isInside(at, ...CLOSE_BOX) ? close : none
}

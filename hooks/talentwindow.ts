// The talent window: while a talent is owed, the three offered as cards, a click (or its number) taking one; with
// none owed, the talents taken and the level of the next. Pure: the click layer reports whole gestures, this decides
// the game actions they make.
import type { Game, Talent } from '../types'
import type { Action } from './game'
import { TALENTS, TALENT_EVERY, offer, owed } from './talents'
import { button } from './pieces'
import { canvas, fill, frame } from './canvas'
import { wrap } from './recapwindow'
import { CLICK_SLOP, CLOSE_BOX, WINDOW_W, bodyTop, drawable, isInside, pixel, windowPixels, word } from './window'
import type { Chrome, Gesture, Rect } from './window'

const CHROME: Chrome = { title: 'TALENT', labels: [] }
const top = bodyTop(CHROME)
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
export const talentHeight = (g: Game) => layout(g).height

/** Each offered talent's card, in window pixels. */
export const talentCards = (g: Game): { talent: Talent; rect: Rect }[] => layout(g).cards.map(c => ({ talent: c.talent, rect: c.rect }))

/** The window's pixels: title bar, the cards with their number keys, the lines. */
export const talentPixels = (g: Game): string[][] => {
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

/** A card clicked takes its talent; the close box closes; anything else, nothing. */
export const talentGesture = (g: Game, gesture: Gesture): Action[] => {
  if (gesture.type === 'drag') return []
  const from = pixel(gesture.from)
  const at = pixel(gesture.at)
  if (Math.max(Math.abs(at.x - from.x), Math.abs(at.y - from.y)) >= CLICK_SLOP) return []
  const card = layout(g).cards.find(c => isInside(at, c.rect.x, c.rect.y, c.rect.w, c.rect.h))
  if (card !== undefined) return [{ kind: 'talent', talent: card.talent }]
  return isInside(at, ...CLOSE_BOX) ? [{ kind: 'panel', panel: 'talent' }] : []
}

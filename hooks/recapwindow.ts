// The recap window: the hero's portrait, what the tool calls came to, the work done, the best find and Play on. Pure:
// the click layer reports whole gestures, this decides the game actions they make.
import type { Game, Recap } from '../types'
import type { Action } from './game'
import { heroArt, textMask } from './pixelart'
import { BUTTON_H, PORTRAIT, button, buttonW, drawItem, portrait } from './pieces'
import { RARITY_COLOR } from './items'
import { CLICK_SLOP, CLOSE_BOX, WINDOW_W, bodyTop, isInside, pixel, windowPixels, word } from './window'
import type { Chrome, Gesture } from './window'
import { canvas, fill } from './canvas'
import { begun } from './recap'

const CHROME: Chrome = { title: 'WHILE YOU WORKED', labels: [] }
const PAD = 3
const SIDE_X = PAD + PORTRAIT + 4
const COL2 = 56
const LINE = 7
const RULE = '#2c2834'
const DIM = '#8a8494'
const SAY = '#e8e4dc'
const GOOD = '#3ccf4e'
const GOLD = '#ffd34d'
const SLAIN = '#ff5a4f'
const PLAY = { key: 'P', label: 'PLAY ON' }
/** The find's name wraps beside its box, within the window. */
const NAME_X = PAD + 23
const NAME_W = WINDOW_W - NAME_X - PAD
const FIND_BOX = 17

export type RecapLine = { text: string; x: number; y: number; ink: string }

const textW = (text: string) => textMask(text)[0]?.length ?? 0
const many = (n: number, one: string, more = `${one}S`) => `${n} ${n === 1 ? one : more}`
const fromTo = (what: string, from: number, to: number) => (from === to ? `${what} ${to}` : `${what} ${from} TO ${to}`)

/** Words wrapped greedily to lines no wider than `width` pixels. */
const greedy = (text: string, width: number) =>
  text.split(' ').reduce<string[]>((lines, w) => {
    const last = lines.at(-1)
    if (last !== undefined && textW(`${last} ${w}`) <= width) lines[lines.length - 1] = `${last} ${w}`
    else lines.push(w)
    return lines
  }, [])

/** Words wrapped to as few lines as fit `width` pixels, as even as those lines can be: the narrowest width that needs no more of them. */
export const wrap = (text: string, width: number) => {
  const count = greedy(text, width).length
  let w = width
  while (w > 1 && greedy(text, w - 1).length === count) w -= 1
  return greedy(text, w)
}

/** The work done as lines: green test runs, then commits, pushes and pull requests on one. */
const workLines = (r: Recap) => {
  const shipped = [r.commits > 0 ? many(r.commits, 'COMMIT') : '', r.pushes > 0 ? many(r.pushes, 'PUSH', 'PUSHES') : '', r.prs > 0 ? many(r.prs, 'PR') : ''].filter(s => s !== '')
  return [...(r.tests > 0 ? [{ text: many(r.tests, 'GREEN TEST RUN'), ink: GOOD }] : []), ...(shipped.length > 0 ? [{ text: shipped.join('  '), ink: SAY }] : [])]
}

/** Where everything goes, in body pixels: the lines, the rules between sections, the find's box and Play on. */
const layout = (g: Game, r: Recap) => {
  const lines: RecapLine[] = [
    { text: `${r.calls} TOOL CALLS`, x: SIDE_X, y: 4, ink: DIM },
    { text: fromTo('DEPTH', r.depth, g.depth), x: SIDE_X, y: 4 + LINE, ink: SAY },
    { text: fromTo('LEVEL', r.level, g.level), x: SIDE_X, y: 4 + 2 * LINE, ink: g.level > r.level ? GOOD : SAY },
    { text: `KILLS ${r.kills}`, x: PAD, y: 34, ink: SAY },
    { text: `GOLD +${r.gold}`, x: COL2, y: 34, ink: GOLD },
    ...(r.champions > 0 ? [{ text: many(r.champions, 'CHAMPION'), x: PAD, y: 34 + LINE, ink: SAY }] : []),
    { text: `DEATHS ${r.deaths}`, x: COL2, y: 34 + LINE, ink: r.deaths > 0 ? SLAIN : DIM },
  ]
  const rules = [30]
  let y = 50
  const work = workLines(r)
  if (work.length > 0) {
    rules.push(y)
    work.forEach((l, i) => lines.push({ ...l, x: PAD, y: y + 4 + i * LINE }))
    y += 4 + work.length * LINE + 2
  }
  const find = r.best === undefined ? undefined : { item: r.best, y: y + 4 }
  if (find !== undefined) {
    rules.push(y)
    lines.push({ text: 'BEST FIND', x: NAME_X, y: find.y, ink: DIM })
    const name = wrap(find.item.name.toUpperCase(), NAME_W)
    name.forEach((text, i) => lines.push({ text, x: NAME_X, y: find.y + (i + 1) * LINE, ink: RARITY_COLOR[find.item.rarity] }))
    y = find.y + Math.max(FIND_BOX, (name.length + 1) * LINE) + 1
  }
  const play = { x: PAD, y, w: buttonW(PLAY.key, PLAY.label), h: BUTTON_H }
  // Even, so the window ends on a whole cell.
  const height = Math.ceil((y + BUTTON_H + 3) / 2) * 2
  return { lines, rules, find, play, height }
}

const recapOf = (g: Game): Recap => g.recap ?? begun(g)

/** The lines the window says, where and in what ink. */
export const recapLines = (g: Game): RecapLine[] => layout(g, recapOf(g)).lines

/** The window's height in pixels, title bar and all. */
export const recapHeight = (g: Game) => bodyTop(CHROME) + layout(g, recapOf(g)).height

/** The window's pixels: title bar, the hero's portrait, the lines, the rules, the find and Play on. */
export const recapPixels = (g: Game): string[][] => {
  const l = layout(g, recapOf(g))
  const body = canvas(WINDOW_W, l.height)
  portrait(body, heroArt(g), PAD, 2)
  for (const y of l.rules) fill(body, PAD, y, WINDOW_W - 2 * PAD, 1, RULE)
  for (const line of l.lines) word(body, line.text, line.x, line.y, line.ink)
  if (l.find !== undefined) drawItem(body, { ...g, cursor: null }, l.find.item, PAD, l.find.y, FIND_BOX, FIND_BOX)
  button(body, PLAY.key, PLAY.label, l.play.x, l.play.y, 'ready')
  return windowPixels(CHROME, body.px).px
}

/** Play on, by its button or the close box: the window closes. Anything else, nothing. */
export const recapGesture = (g: Game, gesture: Gesture): Action[] => {
  if (gesture.type === 'drag') return []
  const from = pixel(gesture.from)
  const at = pixel(gesture.at)
  if (Math.max(Math.abs(at.x - from.x), Math.abs(at.y - from.y)) >= CLICK_SLOP) return []
  const r = layout(g, recapOf(g)).play
  return isInside(at, r.x, r.y + bodyTop(CHROME), r.w, r.h) || isInside(at, ...CLOSE_BOX) ? [{ kind: 'panel', panel: 'recap' }] : []
}

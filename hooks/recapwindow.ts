// The recap window: the hero's portrait with what the tool calls came to beside it, the best find with its name, and
// Play on. Pure: the click layer reports whole gestures, this decides the game actions they make.
import type { Game, Recap } from '../types'
import type { Action, Run } from './game'
import { PX, heroArt } from './pixelart'
import { BUTTON_H, button, buttonBox, buttonW, drawItem, onCell, portrait } from './pieces'
import { RARITY_COLOR } from './items'
import { INK, SURFACE } from './ui/tokens'
import { CLICK_SLOP, CLOSE_BOX, WINDOW_TOP, WINDOW_W, drawBox, isInside, pixel, windowPixels } from './window'
import type { Chrome, Gesture, OverlayBox, Rect } from './window'
import { canvas } from './canvas'
import { begun } from './recap'

const CHROME: Chrome = { title: 'WHILE YOU WORKED' }
const top = WINDOW_TOP
const PAD = 3
/** The portrait at twice the sprite's size, the find's box under it; the text beside each. */
const FACE = PX * 2 + 4
const FIND_BOX = 17
const SIDE_X = PAD + FACE + 3
const FIND_X = PAD + Math.floor((FACE - FIND_BOX) / 2)
const SLAIN = INK.danger
const PLAY = { key: 'P', label: 'PLAY ON' }
const FIND_Y = top + 2 + FACE + 3

const many = (n: number, one: string, more = `${one}s`) => `${n} ${n === 1 ? one : more}`
const fromTo = (what: string, from: number, to: number) => (from === to ? `${what} ${to}` : `${what} ${from} to ${to}`)


/** The work done, on one line: green test runs, commits, pushes and pull requests; none, no line. */
const workLine = (r: Recap): Run[][] => {
  const done = [r.tests > 0 ? many(r.tests, 'green test run') : '', r.commits > 0 ? many(r.commits, 'commit') : '', r.pushes > 0 ? many(r.pushes, 'push', 'pushes') : '', r.prs > 0 ? many(r.prs, 'PR') : ''].filter(t => t !== '')
  return done.length > 0 ? [[{ text: `${done.join(', ')}.`, color: INK.good }]] : []
}

const recapOf = (g: Game): Recap => g.recap ?? begun(g)

/** What happened, beside the portrait: the calls, the depth and level, the fighting, the work. */
const toldLines = (g: Game, r: Recap): Run[][] => [
  [{ text: `${r.calls} tool calls`, bold: true }],
  [{ text: `${fromTo('Depth', r.depth, g.depth)}, ${fromTo('level', r.level, g.level)}.`, ...(g.level > r.level ? { color: INK.good } : {}) }],
  [
    { text: `${many(r.kills, 'kill')}${r.champions > 0 ? `, ${many(r.champions, 'champion')}` : ''}, ` },
    { text: `+${r.gold} gold`, color: INK.gold },
    { text: ', ' },
    { text: many(r.deaths, 'death'), ...(r.deaths > 0 ? { color: SLAIN } : { dim: true }) },
    { text: '.' },
  ],
  ...workLine(r),
]

/** Play on, centered under the find (under the portrait without one). */
const playRect = (r: Recap): Rect => {
  const y = onCell(r.best === undefined ? FIND_Y : FIND_Y + FIND_BOX + 3)
  const w = buttonW(PLAY.key, PLAY.label)
  return { x: Math.floor((WINDOW_W - w) / 2), y, w, h: BUTTON_H }
}

/** The boxes, in cells: what happened beside the portrait; with a find, its name beside its box; Play on's words. */
export const recapOverlay = (g: Game): OverlayBox[] => {
  const r = recapOf(g)
  const told = toldLines(g, r)
  const play = playRect(r)
  const box = (lines: Run[][], y: number): OverlayBox => ({ role: 'about', x: SIDE_X, y, w: WINDOW_W - SIDE_X - 2, h: lines.length + 2, border: SURFACE.frame, lines })
  return [
    box(told, (top + 2) / 2),
    ...(r.best === undefined ? [] : [box([[{ text: 'Best find', dim: true }], [{ text: r.best.name, bold: true, color: RARITY_COLOR[r.best.rarity] }]], Math.ceil(FIND_Y / 2))]),
    buttonBox(PLAY.key, PLAY.label, play.x, play.y, 'armed'),
  ]
}

/** The lines the window says, a line a row of its boxes. */
export const recapLines = (g: Game): string[] => recapOverlay(g).filter(b => b.role !== 'button').flatMap(b => b.lines.map(l => l.map(r => r.text).join('')))

/** The window's height in pixels, title bar and all. */
export const recapHeight = (g: Game) => {
  const play = playRect(recapOf(g))
  return play.y + play.h + 2
}

/** The window's pixels: title bar, the hero's portrait, the find, Play on, the boxes. */
export const recapPixels = (g: Game): string[][] => {
  const r = recapOf(g)
  const body = canvas(WINDOW_W, recapHeight(g) - top)
  portrait(body, heroArt(g), PAD, 2, FACE)
  if (r.best !== undefined) drawItem(body, { ...g, cursor: null }, r.best, FIND_X, FIND_Y - top, FIND_BOX, FIND_BOX)
  const play = playRect(r)
  button(body, PLAY.key, PLAY.label, play.x, play.y - top, 'armed')
  const c = windowPixels(CHROME, body.px)
  for (const b of recapOverlay(g)) if (b.role !== 'button') drawBox(c, b)
  return c.px
}

/** Play on, by its button or the close box: the window closes. Anything else, nothing. */
export const recapGesture = (g: Game, gesture: Gesture): Action[] => {
  if (gesture.type === 'drag') return []
  const from = pixel(gesture.from)
  const at = pixel(gesture.at)
  if (Math.max(Math.abs(at.x - from.x), Math.abs(at.y - from.y)) >= CLICK_SLOP) return []
  const r = playRect(recapOf(g))
  return isInside(at, r.x, r.y, r.w, r.h) || isInside(at, ...CLOSE_BOX) ? [{ kind: 'panel', panel: 'recap' }] : []
}

/** What a click acts on, in window pixels: Play on. */
export const recapHot = (g: Game): Rect[] => [playRect(recapOf(g))]

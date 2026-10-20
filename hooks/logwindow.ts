// The log window: the lines the game keeps, oldest first, in one text box, the latest action's at full strength and
// the rest faded, as the dashboard shows its last few. Opened over whatever is open, it closes back to it. Pure: the
// click layer reports whole gestures, this says whether one closes the window.
import type { Game } from '../types'
import type { Run } from './game'
import { LOG_KEPT } from './game'
import { logRuns } from './panels'
import { canvas } from './canvas'
import { SURFACE } from './ui/tokens'
import { CLICK_SLOP, CLOSE_BOX, WINDOW_TOP, WINDOW_W, drawBox, isInside, pixel, windowPixels } from './window'
import type { Chrome, Gesture, OverlayBox } from './window'

const CHROME: Chrome = { title: 'LOG' }

/** The box's width, and the characters a row of it holds: its frame and a cell of room each side. */
const BOX_W = WINDOW_W - 4
export const LOG_ROW = BOX_W - 4

/** A word cut into pieces no longer than a row: a word longer than a row wraps, every character kept. */
const piecesOf = (word: string): string[] =>
  word.length <= LOG_ROW ? [word] : Array.from({ length: Math.ceil(word.length / LOG_ROW) }, (_, i) => word.slice(i * LOG_ROW, (i + 1) * LOG_ROW))

/** A line broken at its spaces into rows no longer than LOG_ROW. */
const rowsOf = (text: string): string[] =>
  text.split(' ').flatMap(piecesOf).reduce<string[]>((rows, word) => {
    const last = rows.at(-1)
    if (last !== undefined && `${last} ${word}`.length <= LOG_ROW) rows[rows.length - 1] = `${last} ${word}`
    else rows.push(word)
    return rows
  }, [])

/**
 * The newest lines whole, as many as fit in `budget` rows, each as its rows: never a line begun part way. A newest
 * line too long for the box alone shows as far as it fits.
 */
const newestWhole = (lines: readonly Run[][][], budget: number): Run[][][] => {
  const kept: Run[][][] = []
  let used = 0
  for (let i = lines.length - 1; i >= 0 && used + lines[i]!.length <= budget; i -= 1) {
    kept.unshift(lines[i]!)
    used += lines[i]!.length
  }
  return kept.length > 0 ? kept : lines.slice(-1).map(rows => rows.slice(0, budget))
}

/**
 * The box, in cells: the lines kept, each broken into rows to fit. Too many rows for its LOG_KEPT, the newest lines
 * whole, under a row saying how many earlier ones do not fit; none yet, a word that there is none.
 */
export const logOverlay = (g: Game): OverlayBox[] => {
  // A click layer's props hold no undefined: a line not faded carries no dim at all.
  const all = logRuns(g, LOG_KEPT).map(r => rowsOf(r.text).map((text): Run[] => [r.dim === true ? { text, dim: true } : { text }]))
  const fits = all.reduce((n, rows) => n + rows.length, 0) <= LOG_KEPT
  const shown = fits ? all : newestWhole(all, LOG_KEPT - 1)
  const left = all.length - shown.length
  const note: Run[][] = left === 0 ? [] : [[{ text: left === 1 ? '1 earlier line does not fit here.' : `${left} earlier lines do not fit here.`, dim: true }]]
  const lines = all.length === 0 ? [[{ text: 'Nothing has happened yet.', dim: true }]] : [...note, ...shown.flat()]
  return [{ role: 'about', x: 2, y: WINDOW_TOP / 2 + 1, w: BOX_W, h: lines.length + 2, border: SURFACE.frame, lines }]
}

/** The window's height in pixels, title bar and all. */
export const logHeight = (g: Game) => {
  const box = logOverlay(g)[0]!
  return 2 * (box.y + box.h) + 2
}

/** The window's pixels: the title bar and the box's frame. */
export const logPixels = (g: Game): string[][] => {
  const c = windowPixels(CHROME, canvas(WINDOW_W, logHeight(g) - WINDOW_TOP).px)
  for (const b of logOverlay(g)) drawBox(c, b)
  return c.px
}

/** Whether a gesture closes the window: a click on its close box. */
export const logGesture = (gesture: Gesture): boolean => {
  if (gesture.type === 'drag') return false
  const from = pixel(gesture.from)
  const at = pixel(gesture.at)
  if (Math.max(Math.abs(at.x - from.x), Math.abs(at.y - from.y)) >= CLICK_SLOP) return false
  return isInside(at, ...CLOSE_BOX)
}

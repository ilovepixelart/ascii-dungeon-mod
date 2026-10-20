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

/** The box, in cells: every line kept, or a word that there is none yet. */
export const logOverlay = (g: Game): OverlayBox[] => {
  const runs = logRuns(g, LOG_KEPT)
  // A click layer's props hold no undefined: a line not faded carries no dim at all.
  const lines: Run[][] = runs.length === 0 ? [[{ text: 'Nothing has happened yet.', dim: true }]] : runs.map(r => [r.dim === true ? { text: r.text, dim: true } : { text: r.text }])
  return [{ role: 'about', x: 2, y: WINDOW_TOP / 2 + 1, w: WINDOW_W - 4, h: lines.length + 2, border: SURFACE.frame, lines }]
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

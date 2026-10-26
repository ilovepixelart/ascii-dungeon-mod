// The strip under the map, as the pane's width draws it: the dash (dash.ts) on a pane DASH_COLUMNS wide or more, the
// strip of bars (hud.ts) on a narrower one. What the pane asks of the strip, the same whichever it is.
import type { Game } from '../types'
import type { Action } from './game'
import type { Canvas } from './canvas'
import { clearOf } from './pieces'
import { DASH_H, DASH_OVER, OVER_ROWS, dashBeltMenu, isOverMap, dashGesture, dashHot, dashLabels, dashOverGesture, dashOverMap, dashStrip, isDash, orbPhase, overLabels } from './dash'
import { beltMenuBox, hudBoxes, hudGesture, hudHot, hudLayout, hudPixels } from './hud'
import { drawBox, uncovered } from './window'
import type { Gesture, OverlayBox } from './window'

export { DASH_OVER, OVER_ROWS, isDash, orbPhase }

/** The strip's height in pixels on a pane `columns` wide. */
export const stripHeight = (columns: number) => (isDash(columns) ? DASH_H : hudLayout(columns).height)

/** The strip's pixels, the boxes over it (a belt menu) framed on them, the orbs' ripple at `phase`. */
export const stripPixels = (g: Game, columns: number, boxes: readonly OverlayBox[] = [], phase = 0): Canvas => {
  if (!isDash(columns)) return hudPixels(g, columns, boxes)
  const c = dashStrip(g, columns, phase)
  for (const b of boxes) drawBox(c, b)
  return c
}

/** The strip's text boxes: its numbers, less any a box over it covers, then those boxes on top. */
export const stripBoxes = (g: Game, columns: number, over: readonly OverlayBox[]): OverlayBox[] =>
  isDash(columns) ? [...clearOf(dashLabels(g, columns), over), ...over] : hudBoxes(g, columns, over)

/** What a click on the strip acts on, in its pixels; what an open belt menu covers left out. */
export const stripHot = (g: Game, columns: number, boxes: readonly OverlayBox[] = []) =>
  isDash(columns) ? uncovered(dashHot(g, columns), boxes.filter(b => b.role === 'belt')) : hudHot(g, columns, boxes)

/** A gesture on the strip: the belt menu as it now is, the game actions, and whether the log is asked for. */
export const stripGesture = (g: Game, menu: number | null, gesture: Gesture, columns: number): { menu: number | null; actions: Action[]; isLog?: true } =>
  isDash(columns) ? dashGesture(g, menu, gesture, columns) : hudGesture(g, menu, gesture, columns)

/** A belt slot's menu on the strip, or none for an empty slot. */
export const stripBeltMenu = (g: Game, slot: number, columns: number) => (isDash(columns) ? dashBeltMenu(g, slot, columns) : beltMenuBox(g, slot, columns))

/** What the strip paints over a map `columns` wide: the dash's plaque, crests and the orbs' upper parts; nothing for
 * the strip of bars. */
export const stripOverMap = (g: Game, columns: number, phase: number) => (isDash(columns) ? dashOverMap(g, columns, phase) : undefined)

/** The dash's words over the map, for its layer there: the orbs' numbers and the plaque's words. */
export const overMapBoxes = (g: Game, columns: number) => overLabels(g, columns)

/** The map's pixels the dash hides at its bottom, standing over a map `columns` by `rows` cells: the camera keeps the
 * hero above them and lets the map run past the level's bottom by them. None without the dash, or on a map too short
 * for it to stand over. */
export const mapCovered = (columns: number, rows: number) => (isDash(columns) && rows > OVER_ROWS ? DASH_OVER : 0)

/** A gesture on the dash's layer over the map. */
export const overMapGesture = dashOverGesture

/** Whether a point of the dash's layer over the map shows the map, not the dash. */
export const isMapUnder = isOverMap

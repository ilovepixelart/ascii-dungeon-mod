// The death window, open once the hero's fall has played: what slew them, drawn, and where; their level and deaths,
// the gold lost; the depth they wake on; and one button, Wake. Pure: the click layer reports whole gestures, this
// decides the game actions they make.
import type { Fallen, Game } from '../types'
import type { Action, Run } from './game'
import { themeOf } from './map'
import { THING_ART, foeArtOf } from './pixelart'
import { BUTTON_H, PORTRAIT, button, buttonW, portrait } from './pieces'
import { CLICK_SLOP, CLOSE_BOX, WINDOW_W, bodyTop, drawBox, isInside, pixel, windowPixels } from './window'
import type { Chrome, Gesture, OverlayBox, Rect } from './window'
import { canvas } from './canvas'
import { theFoe } from './names'
import { INK, SURFACE } from './ui/tokens'

const CHROME: Chrome = { title: 'YOU DIED', labels: [] }
const PAD = 3
const SIDE_X = PAD + PORTRAIT + 4
const SLAIN = INK.danger
const WAKE = { key: 'W', label: 'WAKE' }

/** What slew the hero, as the portrait draws it: the foe as it stood on its depth's theme, or the trap. */
export const killerArt = (f: Fallen): readonly string[] => (f.foe === undefined ? THING_ART['^']! : foeArtOf(f.foe, themeOf(f.depth)))

/** What slew the hero, named: a unique by its own name (it carries any article), any other foe as "the" its name, else as the log said it. */
export const killerName = (f: Fallen) => (f.foe === undefined ? f.by : theFoe(f.foe))

/** Where everything goes, in window pixels: who and where beside the portrait, then the toll, then Wake. */
const layout = (g: Game, f: Fallen) => {
  const top = bodyTop(CHROME)
  const who: Run[][] = [[{ text: 'Slain by', color: INK.dim }], [{ text: killerName(f), color: SLAIN, bold: true }], [{ text: `on depth ${f.depth}.`, color: INK.text }]]
  const whoBox: OverlayBox<'who'> = { role: 'who', x: SIDE_X, y: (top + 2) / 2, w: WINDOW_W - SIDE_X - PAD, h: who.length + 2, border: SURFACE.frame, lines: who }
  const toll: Run[][] = [
    [{ text: `Level ${g.level}, deaths ${g.deaths}. Lost ${f.lost} gold.`, color: INK.dim }],
    [{ text: `You wake on depth ${f.wake}.`, color: INK.text }],
  ]
  const tollY = Math.max(top + 2 + PORTRAIT, (whoBox.y + whoBox.h) * 2) + 2
  const tollBox: OverlayBox<'toll'> = { role: 'toll', x: PAD, y: tollY / 2, w: WINDOW_W - 2 * PAD, h: toll.length + 2, border: SURFACE.frame, lines: toll }
  const wake: Rect = { x: Math.floor((WINDOW_W - buttonW(WAKE.key, WAKE.label)) / 2), y: (tollBox.y + tollBox.h) * 2 + 3, w: buttonW(WAKE.key, WAKE.label), h: BUTTON_H }
  // Even, so the window ends on a whole cell.
  const height = Math.ceil((wake.y + BUTTON_H + 3) / 2) * 2
  return { top, whoBox, tollBox, wake, height }
}

/** The window's height in pixels, for the pane to size its drawing; 0 with no fall to tell. */
export const deathHeight = (g: Game) => (g.fallen === undefined ? 0 : layout(g, g.fallen).height)

/** The text boxes over the window. */
export const deathOverlay = (g: Game): OverlayBox[] => {
  if (g.fallen === undefined) return []
  const l = layout(g, g.fallen)
  return [l.whoBox, l.tollBox]
}

/** The window's pixels: title bar, the killer's portrait, the boxes' frames and the Wake button. */
export const deathPixels = (g: Game): string[][] => {
  const f = g.fallen
  if (f === undefined) return windowPixels(CHROME, []).px
  const l = layout(g, f)
  const body = canvas(WINDOW_W, l.height - l.top)
  portrait(body, killerArt(f), PAD, 2)
  button(body, WAKE.key, WAKE.label, l.wake.x, l.wake.y - l.top, 'armed')
  const c = windowPixels(CHROME, body.px)
  drawBox(c, l.whoBox)
  drawBox(c, l.tollBox)
  return c.px
}

/** Wake, by its button or the close box: the window closes. Anything else, nothing. */
export const deathGesture = (g: Game, gesture: Gesture): Action[] => {
  if (gesture.type === 'drag' || g.fallen === undefined) return []
  const from = pixel(gesture.from)
  const at = pixel(gesture.at)
  if (Math.max(Math.abs(at.x - from.x), Math.abs(at.y - from.y)) >= CLICK_SLOP) return []
  const r = layout(g, g.fallen).wake
  return isInside(at, r.x, r.y, r.w, r.h) || isInside(at, ...CLOSE_BOX) ? [{ kind: 'panel', panel: 'death' }] : []
}

/** What a click acts on, in window pixels: Wake. */
export const deathHot = (g: Game): Rect[] => (g.fallen === undefined ? [] : [layout(g, g.fallen).wake])

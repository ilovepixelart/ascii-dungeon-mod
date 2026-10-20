// The interface kit: the pieces windows share beyond the frame and the button (window.ts, pieces.ts), each drawn on a
// canvas at a place the window gives: a card flat or beveled with its ribbon and gem. Pure.
import type { Canvas } from '../canvas'
import { fill, frame, put } from '../canvas'
import { textMask } from '../pixelart'
import { mix } from '../pieces'
import { word } from '../window'
import type { Rect } from '../window'
import { INK, SURFACE } from './tokens'
import type { Family } from './tokens'

/** A color as drawn: itself, or receded for what is not chosen. */
export type Tone = (ink: string) => string
export const asIs: Tone = ink => ink
/** What is not chosen: a quarter of the way into the dark. */
export const recede: Tone = ink => mix(ink, SURFACE.veil, 0.28)

export const textW = (text: string) => textMask(text)[0]?.length ?? 0

/** A flat card: its face, framed white when chosen. */
export const flatCard = (c: Canvas, r: Rect, isOn: boolean) => {
  fill(c, r.x, r.y, r.w, r.h, SURFACE.card)
  frame(c, r.x, r.y, r.w, r.h, isOn ? INK.focus : SURFACE.cardEdge)
}

/**
 * A beveled card of its family resting at `r`, lifted `lift` pixels when chosen: its shadow where it rests, a face
 * fading in the family's tint, a rim lit top and left and dark bottom and right (white when chosen), and an inset line.
 */
export const bevelCard = (c: Canvas, r: Rect, f: Family, isOn: boolean, lift: number, tone: Tone) => {
  const y = r.y - (isOn ? lift : 0)
  fill(c, r.x + 2, r.y + r.h, r.w - 2, isOn ? 3 : 2, SURFACE.shadow)
  for (let yy = 0; yy < r.h; yy += 1) fill(c, r.x, y + yy, r.w, 1, tone(mix(f.top, f.bottom, yy / r.h)))
  const rim = isOn ? { light: INK.focus, dark: INK.focusShade } : { light: tone(f.light), dark: tone(f.dark) }
  fill(c, r.x + 1, y, r.w - 2, 1, rim.light)
  fill(c, r.x, y + 1, 1, r.h - 2, rim.light)
  fill(c, r.x + 1, y + r.h - 1, r.w - 2, 1, rim.dark)
  fill(c, r.x + r.w - 1, y + 1, 1, r.h - 2, rim.dark)
  frame(c, r.x + 1, y + 1, r.w - 2, r.h - 2, SURFACE.inset)
}

/** The family's ribbon across a card from x, `w` wide, at y: its ends notched, its word on it. */
export const ribbon = (c: Canvas, f: Family, x: number, w: number, y: number, tone: Tone) => {
  fill(c, x + 2, y, w - 4, 7, tone(f.ink))
  fill(c, x + 2, y + 6, w - 4, 1, tone(f.dark))
  for (const nx of [x + 2, x + w - 3]) for (const ny of [y + 2, y + 3, y + 4]) put(c, nx, ny, tone(f.top))
  word(c, f.label, x + Math.floor((w - textW(f.label)) / 2), y + 1, INK.onRibbon)
}

/** A diamond gem centered at x, y in the family's colors, its heart white when chosen. */
export const gem = (c: Canvas, f: Family, x: number, y: number, isOn: boolean, tone: Tone) => {
  for (const [dx, dy] of [[0, -1], [-1, 0], [1, 0], [0, 1]] as const) put(c, x + dx, y + dy, isOn ? f.ink : f.dark)
  put(c, x, y, isOn ? INK.focus : tone(f.ink))
}

/** The chosen card's sparkles: a white point and two gold at each top corner of `r`, clear of it. */
export const sparkles = (c: Canvas, r: Rect) => {
  for (const sx of [r.x - 2, r.x + r.w + 1]) {
    put(c, sx, r.y - 2, INK.focus)
    put(c, sx, r.y - 1, INK.gold)
    put(c, sx + (sx < r.x ? 1 : -1), r.y - 2, INK.gold)
  }
}

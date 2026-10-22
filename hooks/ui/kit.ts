// The interface kit: the pieces windows share beyond the frame and the button (window.ts, pieces.ts), each drawn on a
// canvas at a place the window gives: a card flat or beveled with its ribbon and gem; and the hover, lighting the
// outline of the clickable place under the pointer. Pure.
import type { Canvas } from '../canvas'
import { fill, frame, put } from '../canvas'
import { artLabel, mix, onCell } from '../pieces'
import type { Rect } from '../window'
import { INK, SURFACE } from './tokens'
import { GLOW } from './glow'
import type { Family } from './tokens'

/** A color as drawn: itself, or receded for what is not chosen. */
export type Tone = (ink: string) => string
export const asIs: Tone = ink => ink
/** What is not chosen: a quarter of the way into the dark. */
export const recede: Tone = ink => mix(ink, SURFACE.veil, 0.28)


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

/** The family's ribbon across a card from x, `w` wide, at y: its ends notched; its word is `ribbonLabel`'s. */
export const ribbon = (c: Canvas, f: Family, x: number, w: number, y: number, tone: Tone) => {
  fill(c, x + 2, y, w - 4, 7, tone(f.ink))
  fill(c, x + 2, y + 6, w - 4, 1, tone(f.dark))
  for (const nx of [x + 2, x + w - 3]) for (const ny of [y + 2, y + 3, y + 4]) put(c, nx, ny, tone(f.top))
}

/** A ribbon's word, for the ribbon `ribbon` draws at x, y (window pixels), `w` wide: centred, on the first whole cell
 * two pixels down, on the ribbon's own ink. */
export const ribbonLabel = (f: Family, x: number, w: number, y: number, tone: Tone) =>
  artLabel(f.label, x + Math.floor((w - f.label.length) / 2), onCell(y + 2), INK.onRibbon, tone(f.ink))

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

/** What the pointer is over among a window's clickable places (window pixels): the smallest holding `at`, if any. */
export const hoveredRect = (rects: readonly Rect[], at: { x: number; y: number }): Rect | undefined =>
  rects.filter(r => at.x >= r.x && at.x < r.x + r.w && at.y >= r.y && at.y < r.y + r.h).sort((a, b) => a.w * a.h - b.w * b.h)[0]

/** Lights `r` on the canvas in place, through what is drawn there: its outline `GLOW.edge` of the way to `ink`, its
 * inside `GLOW.inside` (so a place framed in the ink already lights too). The one glow every highlight uses. */
export const glow = (c: Canvas, r: Rect, ink: string) => {
  for (let y = Math.max(0, r.y); y < Math.min(c.h, r.y + r.h); y += 1) {
    for (let x = Math.max(0, r.x); x < Math.min(c.w, r.x + r.w); x += 1) {
      const isEdge = x === r.x || x === r.x + r.w - 1 || y === r.y || y === r.y + r.h - 1
      c.px[y]![x] = mix(c.px[y]![x]!, ink, isEdge ? GLOW.edge : GLOW.inside)
    }
  }
}

/** A window's pixels with `r` lit for the hover, in white; the rest as it was. */
export const lightUp = (px: readonly (readonly string[])[], r: Rect): string[][] => {
  const c = { w: px[0]?.length ?? 0, h: px.length, px: px.map(row => [...row]) }
  glow(c, r, INK.focus)
  return c.px
}

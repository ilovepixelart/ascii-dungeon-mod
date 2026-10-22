// The interface kit: the pieces windows share beyond the frame and the button (window.ts, pieces.ts), each drawn on a
// canvas at a place the window gives: a flat card and its family's ribbon; and the hover, lighting the
// outline of the clickable place under the pointer. Pure.
import type { Canvas } from '../canvas'
import { fill, frame, put } from '../canvas'
import { artLabel, mix, onCell } from '../pieces'
import type { Rect } from '../window'
import { INK, SURFACE } from './tokens'
import { GLOW } from './glow'
import type { Family } from './tokens'

/** A flat card: its face, framed white when chosen. */
export const flatCard = (c: Canvas, r: Rect, isOn: boolean) => {
  fill(c, r.x, r.y, r.w, r.h, SURFACE.card)
  frame(c, r.x, r.y, r.w, r.h, isOn ? INK.focus : SURFACE.cardEdge)
}

/** The family's ribbon across a flat card from x, `w` wide, at y: its ends notched to the card's face; its word is
 * `ribbonLabel`'s. */
export const ribbon = (c: Canvas, f: Family, x: number, w: number, y: number) => {
  fill(c, x + 2, y, w - 4, 7, f.ink)
  fill(c, x + 2, y + 6, w - 4, 1, f.dark)
  for (const nx of [x + 2, x + w - 3]) for (const ny of [y + 2, y + 3, y + 4]) put(c, nx, ny, SURFACE.card)
}

/** A ribbon's word, for the ribbon `ribbon` draws at x, y (window pixels), `w` wide: centred, on the first whole cell
 * two pixels down, on the ribbon's own ink. */
export const ribbonLabel = (f: Family, x: number, w: number, y: number) =>
  artLabel(f.label, x + Math.floor((w - f.label.length) / 2), onCell(y + 2), INK.onRibbon, f.ink)

/** What the pointer is over among a window's clickable places (window pixels): the smallest holding `at`, if any. */
export const hoveredRect = (rects: readonly Rect[], at: { x: number; y: number }): Rect | undefined =>
  rects.filter(r => at.x >= r.x && at.x < r.x + r.w && at.y >= r.y && at.y < r.y + r.h).sort((a, b) => a.w * a.h - b.w * b.h)[0]

/** Lights `r` on the canvas in place, through what is drawn there: its outline `GLOW.edge` of the way to `ink`, its
 * inside `GLOW.inside` (so a place framed in the ink already lights too); a `fill` place, all of it `GLOW.fill`. The
 * one glow every highlight uses. */
export const glow = (c: Canvas, r: Rect, ink: string) => {
  for (let y = Math.max(0, r.y); y < Math.min(c.h, r.y + r.h); y += 1) {
    for (let x = Math.max(0, r.x); x < Math.min(c.w, r.x + r.w); x += 1) {
      const isEdge = x === r.x || x === r.x + r.w - 1 || y === r.y || y === r.y + r.h - 1
      c.px[y]![x] = mix(c.px[y]![x]!, ink, r.look === 'fill' ? GLOW.fill : isEdge ? GLOW.edge : GLOW.inside)
    }
  }
}

/** A window's pixels with `r` lit for the hover, in white; the rest as it was. */
export const lightUp = (px: readonly (readonly string[])[], r: Rect): string[][] => {
  const c = { w: px[0]?.length ?? 0, h: px.length, px: px.map(row => [...row]) }
  glow(c, r, INK.focus)
  return c.px
}

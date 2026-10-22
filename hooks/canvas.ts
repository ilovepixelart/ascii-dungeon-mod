// A small pixel canvas the interface panels draw on: '#rrggbb' cells, and the frames, fills and art they share.
import { PAL, PX } from './pixelart'
import { hexToInt, rasterCells } from './pixels'
import { INK, SURFACE } from './ui/tokens'

export type Canvas = { w: number; h: number; px: string[][] }

export const BG = SURFACE.ground
export const SLOT_BG = SURFACE.slot
export const GRID = SURFACE.line
/** An icon slot: a PX by PX icon inside a 1 px frame. */
export const SLOT = PX + 2
/** A belt slot: the icon on the left, its count (or key) beside it, so nothing is drawn over the icon. */
export const BELT_SLOT_W = SLOT + 5

export const canvas = (w: number, h: number): Canvas => ({ w, h, px: Array.from({ length: h }, () => Array<string>(w).fill(BG)) })

export const put = (c: Canvas, x: number, y: number, color: string) => {
  const row = c.px[y]
  if (row !== undefined && x >= 0 && x < c.w) row[x] = color
}

export const fill = (c: Canvas, x: number, y: number, w: number, h: number, color: string) => {
  for (let dy = 0; dy < h; dy += 1) for (let dx = 0; dx < w; dx += 1) put(c, x + dx, y + dy, color)
}

export const frame = (c: Canvas, x: number, y: number, w: number, h: number, color: string) => {
  for (let dx = 0; dx < w; dx += 1) {
    put(c, x + dx, y, color)
    put(c, x + dx, y + h - 1, color)
  }
  for (let dy = 0; dy < h; dy += 1) {
    put(c, x, y + dy, color)
    put(c, x + w - 1, y + dy, color)
  }
}

/** Sprite rows over the canvas; '.' leaves what is below, `ink` paints every pixel one color (a ghost). */
export const art = (c: Canvas, rows: readonly string[], x: number, y: number, ink?: string) =>
  rows.forEach((row, dy) => [...row].forEach((k, dx) => k !== '.' && put(c, x + dx, y + dy, ink ?? PAL[k] ?? INK.missing)))

/** The canvas as Raster cells, a half block a cell: c.w columns by c.h / 2 rows. */
export const canvasCells = (c: Canvas) => {
  const frameInts = new Uint32Array(c.w * c.h)
  c.px.forEach((row, y) => row.forEach((hex, x) => (frameInts[y * c.w + x] = hexToInt(hex))))
  return rasterCells(frameInts, c.w, c.h / 2)
}

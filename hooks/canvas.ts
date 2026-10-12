// A small pixel canvas the interface panels draw on: '#rrggbb' cells, and the frames, fills, art and digits they share.
import { PAL, POPUP_OUTLINE, PX, textMask } from './pixelart'
import { hexToInt, rasterCells } from './pixels'

export type Canvas = { w: number; h: number; px: string[][] }

export const BG = '#0b0b10'
export const SLOT_BG = '#1a1820'
export const GRID = '#2c2834'
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
  rows.forEach((row, dy) => [...row].forEach((k, dx) => k !== '.' && put(c, x + dx, y + dy, ink ?? PAL[k] ?? '#ff00ff')))

/** Outlined digits in the pixel font, their bottom-right corner at `right`, `bottom`. */
export const digits = (c: Canvas, text: string, right: number, bottom: number, ink = '#ffffff') => {
  const mask = textMask(text)
  const x0 = right - (mask[0]?.length ?? 0)
  const y0 = bottom - mask.length
  const on = (x: number, y: number) => mask[y]?.[x] === '#'
  mask.forEach((row, y) => [...row].forEach((_, x) => {
    if (!on(x, y)) return
    for (const [ox, oy] of [[-1, 0], [1, 0], [0, -1], [0, 1]] as const) if (!on(x + ox, y + oy)) put(c, x0 + x + ox, y0 + y + oy, POPUP_OUTLINE)
  }))
  mask.forEach((row, y) => [...row].forEach((ch, x) => ch === '#' && put(c, x0 + x, y0 + y, ink)))
}

/** The canvas as Raster cells, a half block a cell: c.w columns by c.h / 2 rows. */
export const canvasCells = (c: Canvas) => {
  const frameInts = new Uint32Array(c.w * c.h)
  c.px.forEach((row, y) => row.forEach((hex, x) => (frameInts[y * c.w + x] = hexToInt(hex))))
  return rasterCells(frameInts, c.w, c.h / 2)
}

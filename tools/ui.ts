// The interface kit's gallery: every token as a swatch, and every piece of the kit in each of its states, on one sheet.
// Usage: bun tools/ui.ts <out-dir>   writes ui.png
import { mkdirSync } from 'node:fs'
import { join } from 'node:path'

import { canvas, fill, put } from '../hooks/canvas'
import type { Canvas } from '../hooks/canvas'
import { BUTTON_H, button, buttonW } from '../hooks/pieces'
import { asIs, bevelCard, flatCard, gem, recede, ribbon, sparkles } from '../hooks/ui/kit'
import { FAMILIES, INK, SURFACE } from '../hooks/ui/tokens'
import { WINDOW_W, drawBox, windowPixels, word } from '../hooks/window'
import { png } from './png'

const out = process.argv[2]
if (out === undefined) throw new Error('usage: bun tools/ui.ts <out-dir>')
mkdirSync(out, { recursive: true })

const CARD = { w: 30, h: 40 }
/** Wide enough for the row of cards: two flat, then each family receded and chosen. */
const W = 8 * (CARD.w + 3) + 14
const sheet = canvas(W, 330)
const blit = (src: Canvas, x: number, y: number) => src.px.forEach((row, dy) => row.forEach((p, dx) => put(sheet, x + dx, y + dy, p)))
let y = 4
const heading = (text: string) => {
  word(sheet, text, 4, y, INK.dim)
  fill(sheet, 4, y + 7, W - 8, 1, SURFACE.rule)
  y += 11
}

heading('TOKENS')
const swatches = [
  ...Object.entries(INK).map(([name, ink]) => [`INK ${name}`, ink] as const),
  ...Object.entries(SURFACE).map(([name, ink]) => [`SURFACE ${name}`, ink] as const),
  ...Object.entries(FAMILIES).map(([name, f]) => [`FAMILY ${name}`, f.ink] as const),
]
const half = Math.ceil(swatches.length / 2)
swatches.forEach(([name, ink], i) => {
  const sx = 4 + Math.floor(i / half) * (W / 2)
  const sy = y + (i % half) * 8
  fill(sheet, sx, sy, 10, 6, ink)
  word(sheet, name.toUpperCase(), sx + 14, sy, INK.text)
})
y += half * 8 + 4

heading('BUTTONS  READY  OFF  ARMED  PRICED')
let bx = 4
for (const state of ['ready', 'off', 'armed'] as const) bx += button(sheet, 'T', 'TAKE', bx, y, state) + 4
button(sheet, 'B', 'BUY', bx, y, 'ready', 120)
bx += buttonW('B', 'BUY', 120) + 4
button(sheet, 'B', 'BUY', bx, y, 'ready', 120, false)
y += BUTTON_H + 6

heading('CARDS  FLAT  BEVELED BY FAMILY  RECEDED AND CHOSEN')
flatCard(sheet, { x: 4, y: y + 3, w: CARD.w, h: CARD.h }, false)
flatCard(sheet, { x: 4 + CARD.w + 3, y: y + 3, w: CARD.w, h: CARD.h }, true)
Object.values(FAMILIES).forEach((f, i) => [false, true].forEach((isOn, j) => {
  const x = 4 + (2 + 2 * i + j) * (CARD.w + 3) + 6
  const tone = isOn ? asIs : recede
  const top = y + 3 - (isOn ? 3 : 0)
  bevelCard(sheet, { x, y: y + 3, w: CARD.w, h: CARD.h }, f, isOn, 3, tone)
  ribbon(sheet, f, x, CARD.w, top + 4, tone)
  gem(sheet, f, x + Math.floor(CARD.w / 2), top + CARD.h - 7, isOn, tone)
  if (isOn) sparkles(sheet, { x, y: top, w: CARD.w, h: CARD.h })
}))
y += CARD.h + 12

heading('WINDOW  TEXT BOX')
const body = canvas(WINDOW_W, 40)
button(body, 'C', 'CLOSE', 4, 26, 'armed')
const win = windowPixels({ title: 'WINDOW', labels: [] }, body.px)
drawBox(win, { x: 2, y: 8, w: WINDOW_W - 4, h: 4, border: SURFACE.frame })
blit(win, 4, y)
y += win.h + 4

await Bun.write(join(out, 'ui.png'), png(sheet.px.slice(0, y), 4))
console.log(join(out, 'ui.png'))

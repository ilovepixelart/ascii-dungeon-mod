// Window preview: each window the screens list draws (hooks/screens.ts) as the pane shows it, its text boxes' lines
// written in over the pixels, for review. A cell is one pixel wide and two tall; its text is drawn in the pixel font,
// upper case, so lengths and rows are true.
// Usage: bun tools/windows.ts <out-dir> [prefix...]   writes <name>.png for each window whose name starts with a prefix, all when none
import { mkdirSync } from 'node:fs'
import { join } from 'node:path'

import type { Run } from '../hooks/game'
import { mix } from '../hooks/pieces'
import { textMask } from '../hooks/pixelart'
import { shots } from '../hooks/screens'
import type { OverlayBox } from '../hooks/window'
import { POPOVER_BG } from '../hooks/window'
import { png } from './png'

const [out, ...prefixes] = process.argv.slice(2)
if (out === undefined) throw new Error('usage: bun tools/windows.ts <out-dir> [prefix...]')
mkdirSync(out, { recursive: true })

/** Pixels per window pixel: a cell is ZOOM wide and 2 * ZOOM tall. */
const ZOOM = 8
const TEXT_INK = '#e8e4dc'

/** A run's ink as the terminal writes it: its color or the default, dimmed toward the box's fill. */
const inkOf = (r: Run, ground: string) => {
  const ink = r.color ?? TEXT_INK
  return r.dim === true ? mix(ink, ground, 0.45) : ink
}

/** The window blown up, each box's lines written cell by cell inside its frame and padding, cut at its edge. */
const preview = (px: string[][], boxes: readonly OverlayBox[]) => {
  const big = px.flatMap(row => Array.from({ length: ZOOM }, () => row.flatMap(p => Array<string>(ZOOM).fill(p))))
  const glyph = (ch: string, cx: number, cy: number, ink: string) => textMask(ch.toUpperCase()).forEach((row, gy) => [...row].forEach((k, gx) => {
    if (k !== '#') return
    for (let dy = 0; dy < 2; dy += 1) for (let dx = 0; dx < 2; dx += 1) {
      const line = big[cy * 2 * ZOOM + 3 + gy * 2 + dy]
      if (line !== undefined) line[cx * ZOOM + 1 + gx * 2 + dx] = ink
    }
  }))
  for (const b of boxes) {
    const pad = b.pad ?? 1
    const ground = b.bg ?? POPOVER_BG
    const width = b.w - 2 - 2 * pad
    b.lines.slice(0, b.h - 2).forEach((line, li) => {
      let col = 0
      for (const r of line) for (const ch of r.text) {
        if (col < width) glyph(ch, b.x + 1 + pad + col, b.y + 1 + li, inkOf(r, ground))
        col += 1
      }
    })
  }
  return big
}

for (const s of shots().filter(s => prefixes.length === 0 || prefixes.some(p => s.name.startsWith(p)))) {
  await Bun.write(join(out, `${s.name}.png`), png(preview(s.px, s.boxes), 1))
  console.log(`${s.name}: ${s.px.length / 2} rows`)
}

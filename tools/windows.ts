// Window preview: each pixel window as the pane shows it, its text boxes' lines written in over the pixels, for review.
// A cell is one pixel wide and two tall; its text is drawn in the pixel font, upper case, so lengths and rows are true.
// Usage: bun tools/windows.ts <out-dir> [name...]   writes <name>.png for each window, all when none are named
import { mkdirSync } from 'node:fs'
import { join } from 'node:path'

import type { Game } from '../types'
import type { Run } from '../hooks/game'
import { deepOverlay, deepPixels } from '../hooks/deepwindow'
import { pairOf } from '../hooks/deep'
import { helpOverlay, helpPixels } from '../hooks/helpwindow'
import { mix } from '../hooks/pieces'
import { textMask } from '../hooks/pixelart'
import { retireOverlay, retirePixels } from '../hooks/retirewindow'
import { startOverlay, startPixels } from '../hooks/start'
import { TALENT_EVERY } from '../hooks/talents'
import { talentOverlay, talentPixels } from '../hooks/talentwindow'
import type { OverlayBox } from '../hooks/window'
import { POPOVER_BG } from '../hooks/window'
import { newGame } from '../hooks/world'
import { png } from './png'

const [out, ...names] = process.argv.slice(2)
if (out === undefined) throw new Error('usage: bun tools/windows.ts <out-dir> [name...]')
mkdirSync(out, { recursive: true })

/** Pixels per window pixel: a cell is ZOOM wide and 2 * ZOOM tall. */
const ZOOM = 8
const TEXT_INK = '#e8e4dc'

const hero: Game = { ...newGame(3, 'knight'), level: TALENT_EVERY, talents: [] }
const WINDOWS: Record<string, () => { px: string[][]; boxes: OverlayBox[] }> = {
  help: () => ({ px: helpPixels(), boxes: helpOverlay() }),
  talent: () => ({ px: talentPixels(hero, { chosen: 1 }), boxes: talentOverlay(hero, { chosen: 1 }) }),
  deep: () => {
    const g = { ...hero, depth: 100, deepest: 100, bossSlain: 100, marks: { 4: pairOf(hero.world, 4)[0], 5: pairOf(hero.world, 5)[1] } }
    return { px: deepPixels(g), boxes: deepOverlay(g) }
  },
  retire: () => {
    const g = { ...hero, bossSlain: 10, deepest: 12, gear: { ...hero.gear, ring: { ...hero.gear.weapon!, rarity: 'rare' as const, name: 'Band of Old Days', base: 'ring' } } }
    return { px: retirePixels(g, { slot: 'ring' }), boxes: retireOverlay(g, { slot: 'ring' }) }
  },
  start: () => ({ px: startPixels(hero, { cls: 'mage' }), boxes: startOverlay(hero, { cls: 'mage' }) }),
}

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

for (const name of names.length > 0 ? names : Object.keys(WINDOWS)) {
  const make = WINDOWS[name]
  if (make === undefined) throw new Error(`no window ${name}: ${Object.keys(WINDOWS).join(', ')}`)
  const { px, boxes } = make()
  await Bun.write(join(out, `${name}.png`), png(preview(px, boxes), 1))
  console.log(`${name}: ${px.length / 2} rows`)
}

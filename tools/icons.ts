// Icon gallery: every item icon at actual size in its footprint box, a silhouette row under it, then the belt icons.
// Usage: bun tools/icons.ts <out-dir> <icons-file>   writes icons.ans, icons.png
import { mkdirSync } from 'node:fs'
import { join, resolve } from 'node:path'

import { PAL, PX } from '../hooks/pixelart'
import { png } from './png'

const [out, iconsArg] = [process.argv[2], process.argv[3]]
if (out === undefined || iconsArg === undefined) throw new Error('usage: bun tools/icons.ts <out-dir> <icons-file>')
mkdirSync(out, { recursive: true })
const { CELL, ICONS, CONSUMABLE_ICONS } = await import(resolve(iconsArg))

type Px = string[][]
const BG = '#0b0b10'
const BOX = '#1a1820'
const SILHOUETTE_BG = '#8a8a8a'
const GAP = 3
const entries: [string, readonly string[], number, number][] = [
  ...Object.entries(ICONS as Record<string, { cells: [number, number]; art: readonly string[] }>).map(
    ([n, i]) => [n, i.art, CELL * i.cells[0] - 1, CELL * i.cells[1] - 1] as [string, readonly string[], number, number],
  ),
  ...Object.entries(CONSUMABLE_ICONS as Record<string, readonly string[]>).map(([n, a]) => [n, a, PX, PX] as [string, readonly string[], number, number]),
]
const rowH = Math.max(...entries.map(e => e[3])) + GAP * 2
const width = entries.reduce((w, e) => w + e[2] + GAP, GAP)
const px: Px = Array.from({ length: rowH * 2 }, () => Array(width).fill(BG))
let x = GAP
for (const [, art, w, h] of entries) {
  for (const [band, isSilhouette] of [[0, false], [1, true]] as const) {
    const top = band * rowH + GAP
    for (let dy = 0; dy < h; dy += 1) for (let dx = 0; dx < w; dx += 1) px[top + dy]![x + dx] = isSilhouette ? SILHOUETTE_BG : BOX
    const ox = x + Math.floor((w - (art[0]?.length ?? 0)) / 2)
    const oy = top + Math.floor((h - art.length) / 2)
    art.forEach((row, ry) => [...row].forEach((k, rx) => {
      if (k !== '.') px[oy + ry]![ox + rx] = isSilhouette ? '#000000' : (PAL[k] ?? '#ff00ff')
    }))
  }
  x += w + GAP
}
const rgb = (hex: string) => [1, 3, 5].map(i => Number.parseInt(hex.slice(i, i + 2), 16)).join(';')
const lines: string[] = []
for (let y = 0; y < px.length; y += 2) lines.push(`${(px[y] ?? []).map((t, i) => `\x1b[38;2;${rgb(t)}m\x1b[48;2;${rgb(px[y + 1]?.[i] ?? BG)}m▀`).join('')}\x1b[0m`)
await Bun.write(join(out, 'icons.ans'), `${lines.join('\n')}\n${entries.map(e => e[0]).join(' ')}\n`)
await Bun.write(join(out, 'icons.png'), png(px, 6))
console.log(`icons, left to right: ${entries.map(e => e[0]).join(' ')}`)

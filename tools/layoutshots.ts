// Renders one whole level of each layout in pixels, fully explored, the hero at the start: <out>/<layout>.ans.
// Usage: bun tools/layoutshots.ts <out-dir>
import { mkdirSync } from 'node:fs'
import { join } from 'node:path'
import { MAP_H, MAP_W, generate, layoutOf } from '../hooks/map'
import type { Layout } from '../hooks/map'
import { PX } from '../hooks/pixelart'
import { frameOf } from '../hooks/pixels'
import { newGame } from '../hooks/world'

const out = process.argv[2]
if (out === undefined) throw new Error('usage: bun tools/layoutshots.ts <out-dir>')
mkdirSync(out, { recursive: true })
const rgb = (n: number) => [16, 8, 0].map(s => (n >> s) & 255).join(';')
const W = MAP_W * PX
const H = MAP_H * PX
const picks: Partial<Record<Layout, [number, number]>> = {}
for (let world = 1; world < 60; world += 1) for (let depth = 2; depth < 15; depth += 1) picks[layoutOf(world, depth)] ??= [world, depth]
for (const [layout, [world, depth]] of Object.entries(picks) as [Layout, [number, number]][]) {
  const level = generate(world, depth)
  const g = { ...newGame(world, 'knight'), world, depth, x: level.start.x, y: level.start.y, seen: '1'.repeat(MAP_W * MAP_H), taken: [] }
  const frame = frameOf(g, W, H)
  const rows = Array.from({ length: H / 2 }, (_, y) => `${Array.from({ length: W }, (_, x) => `\x1b[38;2;${rgb(frame[2 * y * W + x] ?? 0)}m\x1b[48;2;${rgb(frame[(2 * y + 1) * W + x] ?? 0)}m▀`).join('')}\x1b[0m`)
  await Bun.write(join(out, `${layout}.ans`), `${rows.join('\n')}\n`)
  console.log(`${layout}: world ${world} depth ${depth}`)
}

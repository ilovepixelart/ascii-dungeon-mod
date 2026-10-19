// Level lab: generates random levels, holds each to the rules every level must keep (`levelProblems`), reports how
// their layouts, room shapes and themed rooms are spread, and renders samples as pictures to look at.
// Usage: bun tools/levellab.ts [count] [--seed N] [--depths 1-150] [--png <out-dir> [--shots K]]
// A level that breaks a rule is printed as world:depth, so `--only world:depth` renders and checks just that one.
import { mkdirSync } from 'node:fs'
import { join } from 'node:path'

import { MAP_H, MAP_W, generate, layoutOf, themedRoomOf } from '../hooks/map'
import { levelProblems } from '../hooks/levelcheck'
import { frameOf } from '../hooks/pixels'
import { PX } from '../hooks/pixelart'
import { arrive, newGame } from '../hooks/world'
import { png } from './png'

const args = process.argv.slice(2)
const flag = (name: string) => {
  const at = args.indexOf(`--${name}`)
  return at < 0 ? undefined : args[at + 1]
}
const count = Number(args[0] !== undefined && !args[0].startsWith('--') ? args[0] : 500)
const [lo, hi] = (flag('depths') ?? '1-150').split('-').map(Number) as [number, number]
const out = flag('png')
const shots = Number(flag('shots') ?? 6)
const only = flag('only')

/** A seeded draw, so a run with the same seed draws the same levels. */
let s = Number(flag('seed') ?? Date.now() % 1_000_000) >>> 0
const seedShown = s
const draw = (n: number) => {
  s = (Math.imul(s ^ (s >>> 15), 0x2c1b3c6d) + 0x9e3779b9) >>> 0
  return s % n
}

const levels = only !== undefined
  ? [only.split(':').map(Number) as [number, number]]
  : Array.from({ length: count }, () => [1 + draw(2_000_000_000), lo + draw(hi - lo + 1)] as [number, number])

const tally = (into: Map<string, number>, key: string) => into.set(key, (into.get(key) ?? 0) + 1)
const layouts = new Map<string, number>()
const shapes = new Map<string, number>()
const themed = new Map<string, number>()
let rooms = 0
const broken: string[] = []
for (const [world, depth] of levels) {
  const level = generate(world, depth)
  tally(layouts, layoutOf(world, depth))
  for (const r of level.rooms) {
    rooms += 1
    tally(shapes, r.shape ?? 'plain')
  }
  tally(themed, themedRoomOf(world, depth, level)?.kind ?? 'none')
  for (const p of levelProblems(world, depth)) broken.push(`${world}:${depth}  ${p}`)
}

const shares = (m: Map<string, number>, of: number) => [...m].sort((a, b) => b[1] - a[1]).map(([k, n]) => `${k} ${Math.round((n * 100) / of)}%`).join(', ')
console.log(`${levels.length} levels, seed ${seedShown}, depths ${lo} to ${hi}`)
console.log(`layouts:      ${shares(layouts, levels.length)}`)
console.log(`room shapes:  ${shares(shapes, rooms)}  (${(rooms / levels.length).toFixed(1)} rooms a level)`)
console.log(`themed rooms: ${shares(themed, levels.length)}`)
console.log(broken.length === 0 ? 'every level keeps every rule' : `${broken.length} broken rules:\n  ${broken.slice(0, 20).join('\n  ')}`)

if (out !== undefined) {
  mkdirSync(out, { recursive: true })
  // The whole level, seen, from above: the camera at the map's middle shows every tile at once.
  for (const [world, depth] of levels.slice(0, only === undefined ? shots : 1)) {
    const g0 = newGame(world)
    const g = { ...g0, world, ...arrive(world, depth), depth, seen: '1'.repeat(MAP_W * MAP_H), foe: null }
    const w = MAP_W * PX
    const h = MAP_H * PX
    const frame = frameOf(g, w, h, { camera: { x: w / 2, y: h / 2 } })
    const px = Array.from({ length: h }, (_, y) => Array.from({ length: w }, (_, x) => `#${(frame[y * w + x] ?? 0).toString(16).padStart(6, '0')}`))
    const file = join(out, `level-${world}-${depth}-${layoutOf(world, depth)}.png`)
    await Bun.write(file, png(px, 2))
    console.log(`wrote ${file}`)
  }
}
process.exit(broken.length === 0 ? 0 : 1)

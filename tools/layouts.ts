// Prints sample levels of each layout as text, with how they measure: rooms, walk to the stairs, dead ends, floor.
// Usage: bun tools/layouts.ts [samples]
import { analyze, generate, layoutOf } from '../hooks/map'
import type { Layout } from '../hooks/map'

const samples = Number(process.argv[2] ?? 2)
const LAYOUTS: readonly Layout[] = ['rooms', 'hall', 'ring', 'warrens', 'caverns']
const found: Record<string, [number, number][]> = {}
for (let world = 1; world < 400; world += 1) for (let depth = 2; depth <= 15; depth += 1) (found[layoutOf(world, depth)] ??= []).push([world, depth])
for (const layout of LAYOUTS) {
  const all = found[layout] ?? []
  const stats = all.slice(0, 300).map(([w, d]) => ({ level: generate(w, d), a: analyze(generate(w, d)) }))
  const avg = (f: (s: (typeof stats)[number]) => number) => (stats.reduce((n, s) => n + f(s), 0) / stats.length).toFixed(1)
  const broken = stats.filter(s => s.a.reachable !== s.a.floor || s.a.pathLength <= 0).length
  console.log(`== ${layout}: ${all.length} of ${Object.values(found).flat().length} depths; rooms ${avg(s => s.level.rooms.length)}, walk to stairs ${avg(s => s.a.pathLength)}, dead ends ${avg(s => s.a.deadEnds.length)}, floor ${avg(s => s.a.floor)}, unreachable levels ${broken}`)
  for (const [w, d] of all.slice(0, samples)) {
    const lv = generate(w, d)
    console.log(`-- world ${w} depth ${d}`)
    lv.tiles.forEach((row, y) => console.log([...row].map((c, x) => (x === lv.start.x && y === lv.start.y ? '@' : x === lv.stairs.x && y === lv.stairs.y ? '>' : c === '#' ? '█' : ' ')).join('')))
  }
}

// Level statistics: generates many levels and reports, on average, what playing them is like: the walk to the stairs,
// how far apart start and stairs lie, dead ends, loops between rooms, floor area.
// Usage: bun tools/levels.ts [worlds] [depths]
import { MAP_H, MAP_W, analyze, generate } from '../hooks/map'
import type { Room } from '../hooks/map'

const WORLDS = Number(process.argv[2] ?? 40)
const DEPTHS = Number(process.argv[3] ?? 10)

/**
 * Loops a player can run around: the map as a graph whose nodes are the rooms and the corridor stretches between them
 * (floor outside any room, joined 4-way), an edge where a corridor touches a room; cycles = edges - nodes + parts.
 */
const loops = (tiles: readonly string[], rooms: readonly Room[]) => {
  const inRoom = (x: number, y: number) => rooms.findIndex(r => x >= r.x && x < r.x + r.w && y >= r.y && y < r.y + r.h)
  const isCorridor = (x: number, y: number) => tiles[y]?.[x] === '.' && inRoom(x, y) < 0
  const part = new Map<number, number>()
  let corridors = 0
  const edges = new Set<string>()
  for (let y = 0; y < MAP_H; y += 1) {
    for (let x = 0; x < MAP_W; x += 1) {
      if (!isCorridor(x, y) || part.has(y * MAP_W + x)) continue
      const c = corridors++
      const stack = [[x, y] as const]
      part.set(y * MAP_W + x, c)
      while (stack.length > 0) {
        const [cx, cy] = stack.pop()!
        for (const [dx, dy] of [[1, 0], [-1, 0], [0, 1], [0, -1]] as const) {
          const nx = cx + dx
          const ny = cy + dy
          const room = tiles[ny]?.[nx] === '.' ? inRoom(nx, ny) : -1
          if (room >= 0) edges.add(`${c}:${room}`)
          else if (isCorridor(nx, ny) && !part.has(ny * MAP_W + nx)) {
            part.set(ny * MAP_W + nx, c)
            stack.push([nx, ny])
          }
        }
      }
    }
  }
  // Rooms that touch each other directly are joined too.
  rooms.forEach((a, i) => rooms.forEach((b, j) => {
    if (i < j && a.x <= b.x + b.w && b.x <= a.x + a.w && a.y <= b.y + b.h && b.y <= a.y + a.h) edges.add(`r${i}:${j}`)
  }))
  return edges.size - (corridors + rooms.length) + 1
}

const rows: number[][] = []
for (let world = 1; world <= WORLDS; world += 1) {
  for (let depth = 1; depth <= DEPTHS; depth += 1) {
    const level = generate(world, depth)
    const a = analyze(level)
    rows.push([a.pathLength, level.stairs.x - level.start.x, a.deadEnds.length, a.floor, a.reachable === a.floor ? 1 : 0, level.rooms.length, loops(level.tiles, level.rooms)])
  }
}
const mean = (i: number) => rows.reduce((s, r) => s + r[i]!, 0) / rows.length
const share = (i: number, test: (v: number) => boolean) => (100 * rows.filter(r => test(r[i]!)).length) / rows.length
console.log(`${rows.length} levels (${WORLDS} worlds x ${DEPTHS} depths)`)
console.log(`walk to the stairs: ${mean(0).toFixed(1)} steps; stairs ${mean(1).toFixed(1)} columns right of the start on average; stairs right of start: ${share(1, v => v > 0).toFixed(0)}%`)
console.log(`dead ends: ${mean(2).toFixed(2)} a level (${share(2, v => v > 0).toFixed(0)}% of levels have one); rooms: ${mean(5).toFixed(1)}`)
console.log(`floor: ${mean(3).toFixed(0)} cells; all floor reachable: ${share(4, v => v === 1).toFixed(0)}%; loops: ${mean(6).toFixed(2)} a level (${share(6, v => v > 0).toFixed(0)}% of levels have one)`)

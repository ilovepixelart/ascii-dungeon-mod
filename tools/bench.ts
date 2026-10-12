// Frame bench: builds every frame of a long walk the way the pane does (the camera following, the torch moving) and
// reports the spread of frame times.
// Usage: bun tools/bench.ts [columns] [rows] [tiles]
import type { Pos } from '../hooks/map'
import { apply, routeToStairs } from '../hooks/game'
import { summarize } from '../hooks/frames'
import { FRAMES_PER_TILE, pixelMap, tileCamera, walkPosition, walkingGame } from '../hooks/pixels'
import { PX } from '../hooks/pixelart'
import { newGame } from '../hooks/world'

const COLUMNS = Number(process.argv[2] ?? 110)
const ROWS = Number(process.argv[3] ?? 50)
const TILES = Number(process.argv[4] ?? 24)

const start = newGame(21, 'knight')
const path = (routeToStairs(start) ?? []).slice(0, TILES + 1)
// The rules settle the walk at once; the frames play it out.
const end = path.slice(1).reduce((g, p) => apply(g, { kind: 'goto', x: p.x, y: p.y }), start)
let camera: Pos = { x: start.x * PX + PX / 2, y: start.y * PX + PX / 2 }
const times: number[] = []
for (let frame = 0; frame <= (path.length - 1) * FRAMES_PER_TILE; frame += 1) {
  const t0 = performance.now()
  const at = walkPosition(path, frame)
  camera = tileCamera(camera, at, COLUMNS, ROWS * 2)
  pixelMap(walkingGame(end, start, path, frame), COLUMNS, ROWS, at, camera)
  times.push(performance.now() - t0)
}
const s = summarize(times.slice(FRAMES_PER_TILE))
const ms = (n: number) => n.toFixed(2)
console.log(`${COLUMNS}x${ROWS} cells, ${path.length - 1} tiles, ${s.count} frames (after ${FRAMES_PER_TILE} warm-up): mean ${ms(s.mean)}  p50 ${ms(s.p50)}  p99 ${ms(s.p99)}  max ${ms(s.max)} ms`)

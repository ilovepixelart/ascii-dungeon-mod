// What each frame of the bench walk costs the terminal, offline: the walk /dungeon-bench plays, with the pane's own
// camera, each frame against the one before. Cells changed, and the bytes a terminal stream would carry for them: a
// cursor move to start each run of changed cells, a color escape where a cell's color differs from the cell sent
// before it on the row (colors as the host sends them, each channel on the step of 17), and the character.
// Usage: bun tools/frames.ts [columns] [rows]   (200 and 44 by default)
import { MAP_H, MAP_W } from '../hooks/map'
import { FRAMES_PER_TILE, benchRoute, isStrideFrame, pixelMap, tileCamera, walkPosition, walkingGame } from '../hooks/pixels'
import { newGame, normalize } from '../hooks/game'
import type { Pos } from '../hooks/map'

const COLUMNS = Number(process.argv[2] ?? 200)
const ROWS = Number(process.argv[3] ?? 44)
/** The bench's seed and length, as `register.tsx` plays it. */
const BENCH_SEED = 21
const BENCH_TILES = 40
const CURSOR_MOVE = 8
const COLOR_ESCAPE = 19

const snap = (n: number) => [16, 8, 0].reduce((out, s) => out | (Math.round(((n >>> s) & 255) / 17) * 17) << s, 0)
const decode = (cells: string) => new Uint32Array(Uint8Array.from(atob(cells), c => c.charCodeAt(0)).buffer)

/** The changed cells of `now` against `before` and the bytes sending them takes. */
export const frameCost = (before: Uint32Array, now: Uint32Array, columns: number) => {
  let cells = 0
  let bytes = 0
  for (let y = 0; y < now.length / 3 / columns; y += 1) {
    let isInRun = false
    let fg = -1
    let bg = -1
    for (let x = 0; x < columns; x += 1) {
      const at = (y * columns + x) * 3
      const same = now[at] === before[at] && snap(now[at + 1]!) === snap(before[at + 1]!) && snap(now[at + 2]!) === snap(before[at + 2]!)
      if (same) {
        isInRun = false
        continue
      }
      cells += 1
      if (!isInRun) bytes += CURSOR_MOVE
      isInRun = true
      if (snap(now[at + 1]!) !== fg) bytes += COLOR_ESCAPE
      if (snap(now[at + 2]!) !== bg) bytes += COLOR_ESCAPE
      fg = snap(now[at + 1]!)
      bg = snap(now[at + 2]!)
      bytes += now[at]! < 0x80 ? 1 : 3
    }
  }
  return { cells, bytes }
}

if (import.meta.main) {
  const bench = normalize({ ...newGame(BENCH_SEED), seen: '1'.repeat(MAP_W * MAP_H) })
  const path = benchRoute(bench, BENCH_TILES)
  let camera: Pos | null = null
  let before: Uint32Array | null = null
  const rows: { cells: number; bytes: number; moved: boolean }[] = []
  for (let f = 0; f < (path.length - 1) * FRAMES_PER_TILE; f += 1) {
    const at = walkPosition(path, f)
    const next = tileCamera(camera, at, COLUMNS, ROWS * 2)
    const moved = camera !== null && (next.x !== camera.x || next.y !== camera.y)
    camera = next
    const now = decode(pixelMap(walkingGame(bench, bench, path, f), COLUMNS, ROWS, at, camera, [], 0, isStrideFrame(f)))
    if (before !== null) rows.push({ ...frameCost(before, now, COLUMNS), moved })
    before = now
  }
  const sum = (xs: typeof rows, k: 'cells' | 'bytes') => xs.reduce((n, r) => n + r[k], 0)
  const moves = rows.filter(r => r.moved)
  const still = rows.filter(r => !r.moved)
  const avg = (xs: typeof rows, k: 'cells' | 'bytes') => Math.round(sum(xs, k) / Math.max(1, xs.length))
  console.log(`${COLUMNS}x${ROWS}, ${rows.length} frames: ${Math.round(sum(rows, 'bytes') / 1024)} KiB in all`)
  console.log(`camera moved: ${moves.length} frames, ${avg(moves, 'cells')} cells and ${avg(moves, 'bytes')} bytes each, ${Math.round((100 * sum(moves, 'bytes')) / Math.max(1, sum(rows, 'bytes')))}% of the bytes`)
  console.log(`camera still: ${still.length} frames, ${avg(still, 'cells')} cells and ${avg(still, 'bytes')} bytes each`)
}

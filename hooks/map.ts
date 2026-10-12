import { hash } from './rng'

export const MAP_W = 64
export const MAP_H = 18

export type Pos = { x: number; y: number }
/** A room's floor: `w` by `h` cells from its top-left `x`, `y`, less what its shape gives back to rock. */
export type Room = Pos & { w: number; h: number; shape?: RoomShape }
/** A room not a plain rectangle: corners cut (cross), one quarter cut (L), or two rows of pillars along an aisle (pillars). */
export type RoomShape = 'cross' | 'L' | 'pillars' | 'ragged'
/**
 * How a level is laid out. Rooms: rooms joined as a branching tree. Hall: one great pillared hall, the other rooms each
 * joined straight to it. Ring: the rooms joined round in a circle, so every walk has two ways. Warrens: many small
 * rooms, cramped, with more dead ends. Caverns: rooms with ragged walls joined by winding passages.
 */
export type Layout = 'rooms' | 'hall' | 'ring' | 'warrens' | 'caverns'
export type Level = { tiles: string[]; rooms: Room[]; start: Pos; stairs: Pos }

const MAX_ROOMS = 8
/** The steps a path may take: the four straight ones, then the four diagonals. */
const STEPS: readonly Pos[] = [
  { x: 1, y: 0 },
  { x: -1, y: 0 },
  { x: 0, y: 1 },
  { x: 0, y: -1 },
  { x: 1, y: 1 },
  { x: -1, y: 1 },
  { x: 1, y: -1 },
  { x: -1, y: -1 },
]

const seeded = (seed: number) => {
  let s = seed >>> 0
  return (sides: number) => {
    s = (s + 0x6d2b79f5) >>> 0
    let t = s
    t = Math.imul(t ^ (t >>> 15), t | 1)
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61)
    return ((t ^ (t >>> 14)) >>> 0) % sides
  }
}

const overlaps = (a: Room, b: Room) =>
  a.x - 1 <= b.x + b.w && b.x - 1 <= a.x + a.w && a.y - 1 <= b.y + b.h && b.y - 1 <= a.y + a.h

const center = (r: Room): Pos => ({ x: r.x + Math.floor(r.w / 2), y: r.y + Math.floor(r.h / 2) })

const carve = (grid: string[][], x: number, y: number) => {
  const row = grid[y]
  if (row !== undefined && x > 0 && x < MAP_W - 1 && y > 0 && y < MAP_H - 1) row[x] = '.'
}

/** The room sizes and count a layout places: width and height as a least and a spread, at most how many, in how many tries. */
type Sizes = { w: [number, number]; h: [number, number]; most: number; tries: number }
const ROOM_SIZES: Sizes = { w: [4, 8], h: [3, 4], most: MAX_ROOMS, tries: 80 }
const WARREN_SIZES: Sizes = { w: [3, 4], h: [3, 2], most: 13, tries: 200 }

const placeRooms = (r: (n: number) => number, sizes: Sizes = ROOM_SIZES, placed: readonly Room[] = [], keepOut?: Room) => {
  const rooms: Room[] = [...placed]
  for (let attempt = 0; attempt < sizes.tries && rooms.length < sizes.most; attempt += 1) {
    const w = sizes.w[0] + r(sizes.w[1])
    const h = sizes.h[0] + r(sizes.h[1])
    // Any room that fits inside the outer wall: its last floor row and column may be the ones just inside it.
    const room = { x: 1 + r(MAP_W - w - 1), y: 1 + r(MAP_H - h - 1), w, h }
    if (!rooms.some(other => overlaps(room, other)) && (keepOut === undefined || !overlaps(room, keepOut))) rooms.push(room)
  }
  if (rooms.length < 2) return [{ x: 2, y: 2, w: 6, h: 4 }, { x: MAP_W - 10, y: MAP_H - 7, w: 6, h: 4 }]
  return rooms
}

/**
 * A ragged room's cut: its corners and about half its edge cells, none on or beside a middle row or column where
 * corridors meet, and any edge cell left standing alone between two cuts, so a ragged wall never leaves a dead end.
 */
const raggedCut = (room: Room, mid: Pos): Pos[] => {
  const isEdge = (x: number, y: number) => x === room.x || y === room.y || x === room.x + room.w - 1 || y === room.y + room.h - 1
  const isCorner = (x: number, y: number) => (x === room.x || x === room.x + room.w - 1) && (y === room.y || y === room.y + room.h - 1)
  const nearMid = (x: number, y: number) => Math.abs(x - mid.x) <= 1 || Math.abs(y - mid.y) <= 1
  const rolled = (x: number, y: number) => isEdge(x, y) && !nearMid(x, y) && (isCorner(x, y) || hash(room.x * 3 + room.y, x, y) < 45)
  const along = (x: number, y: number): [Pos, Pos] => (y === room.y || y === room.y + room.h - 1 ? [{ x: x - 1, y }, { x: x + 1, y }] : [{ x, y: y - 1 }, { x, y: y + 1 }])
  const cells: Pos[] = []
  for (let y = room.y; y < room.y + room.h; y += 1) for (let x = room.x; x < room.x + room.w; x += 1) {
    if (x === mid.x || y === mid.y || !isEdge(x, y)) continue
    const [a, b] = along(x, y)
    if (rolled(x, y) || (rolled(a.x, a.y) && rolled(b.x, b.y))) cells.push({ x, y })
  }
  return cells
}

/** The cells of a room its shape gives back to rock; never on its middle row or column, so corridors still meet there. */
export const shapeCut = (room: Room): Pos[] => {
  const mid = center(room)
  if (room.shape === 'ragged') return raggedCut(room, mid)
  const cells: Pos[] = []
  for (let y = room.y; y < room.y + room.h; y += 1) for (let x = room.x; x < room.x + room.w; x += 1) {
    if (x === mid.x || y === mid.y) continue
    const dx = Math.min(x - room.x, room.x + room.w - 1 - x)
    const dy = Math.min(y - room.y, room.y + room.h - 1 - y)
    const isCut =
      room.shape === 'cross' ? dx < Math.floor(room.w / 3) && dy < Math.floor(room.h / 3)
      : room.shape === 'L' ? x > mid.x && y < mid.y
      : room.shape === 'pillars' ? dy === 1 && dx % 2 === 1
      : false
    if (isCut) cells.push({ x, y })
  }
  return cells
}

/** About one room in three big enough for a shape gets one, chosen by its place alone, so corridors stay as they were. */
const shapeOf = (world: number, depth: number, room: Room): RoomShape | undefined => {
  const n = hash(world * 11 + depth * 5, room.x, room.y)
  const isBig = room.w >= 7 && room.h >= 5
  if (n < 12 && isBig) return 'cross'
  if (n < 24 && room.w >= 6 && room.h >= 4) return 'L'
  if (n < 34 && isBig) return 'pillars'
  return undefined
}

/**
 * A tunnel that winds: two tunnels through a point a random way between its ends on each axis, so it bends twice where
 * a tunnel bends once, and never doubles back to leave a spur.
 */
const windingTunnel = (grid: string[][], from: Pos, to: Pos, r: (n: number) => number) => {
  const between = (a: number, b: number) => a + Math.round(((b - a) * (1 + r(3))) / 4)
  const via = { x: between(from.x, to.x), y: between(from.y, to.y) }
  tunnel(grid, from, via, r(2) === 0)
  tunnel(grid, via, to, r(2) === 0)
}

const tunnel = (grid: string[][], from: Pos, to: Pos, isHorizontalFirst: boolean) => {
  const corner = isHorizontalFirst ? { x: to.x, y: from.y } : { x: from.x, y: to.y }
  for (const [a, b] of [[from, corner], [corner, to]] as const) {
    for (let x = Math.min(a.x, b.x); x <= Math.max(a.x, b.x); x += 1) carve(grid, x, a.y)
    for (let y = Math.min(a.y, b.y); y <= Math.max(a.y, b.y); y += 1) carve(grid, b.x, y)
  }
}

/** Joins the rooms as a tree that branches: from a random first room, each joins the nearest room already joined. */
const joinRooms = (grid: string[][], rooms: readonly Room[], r: (n: number) => number, dig = (from: Pos, to: Pos) => tunnel(grid, from, to, r(2) === 0)) => {
  const joined = [r(rooms.length)]
  const apart = (a: Room, b: Room) => Math.abs(center(a).x - center(b).x) + Math.abs(center(a).y - center(b).y)
  while (joined.length < rooms.length) {
    let best: [number, number] | null = null
    for (const i of joined) {
      for (let j = 0; j < rooms.length; j += 1) {
        if (joined.includes(j)) continue
        if (best === null || apart(rooms[i]!, rooms[j]!) < apart(rooms[best[0]]!, rooms[best[1]]!)) best = [i, j]
      }
    }
    const [i, j] = best!
    dig(center(rooms[i]!), center(rooms[j]!))
    joined.push(j)
  }
  return joined[0]!
}

/** The branching tree of `joinRooms`, dug as winding passages. */
const joinWinding = (grid: string[][], rooms: readonly Room[], r: (n: number) => number) => joinRooms(grid, rooms, r, (from, to) => windingTunnel(grid, from, to, r))

/** Fills any dead end a passage left in a ragged room's wall by digging through a cut, so the wall stays without one. */
const fillRaggedEnds = (grid: string[][], rooms: readonly Room[]) => {
  for (const room of rooms.filter(rm => rm.shape === 'ragged')) {
    for (const c of shapeCut(room)) {
      const open = STEPS.slice(0, 4).filter(d => grid[c.y + d.y]?.[c.x + d.x] === '.').length
      if (grid[c.y]![c.x] === '.' && open === 1) grid[c.y]![c.x] = '#'
    }
  }
}

/** At most this many loops a level, each a tunnel between two rooms near on the map but far apart by walking. */
const MAX_LOOPS = 2
/** Two rooms are far apart by walking when the walk is over this many times the straight distance. */
const DETOUR = 1.5

/**
 * Tunnels between rooms that lie near each other but are far apart by walking, nearest such pair first, up to
 * MAX_LOOPS: shortcuts that give a level ways round, without filling it with corridors.
 */
const addLoops = (grid: string[][], rooms: readonly Room[], r: (n: number) => number) => {
  for (let cut = 0; cut < MAX_LOOPS; cut += 1) {
    const tiles = grid.map(row => row.join(''))
    let best: { a: Room; b: Room; apart: number } | null = null
    for (let i = 0; i < rooms.length; i += 1) {
      const { dist } = walkDistances(tiles, center(rooms[i]!))
      for (let j = i + 1; j < rooms.length; j += 1) {
        const a = center(rooms[i]!)
        const b = center(rooms[j]!)
        const apart = Math.abs(a.x - b.x) + Math.abs(a.y - b.y)
        if (dist[cellId(b)]! > DETOUR * apart && (best === null || apart < best.apart)) best = { a: rooms[i]!, b: rooms[j]!, apart }
      }
    }
    if (best === null) return
    tunnel(grid, center(best.a), center(best.b), r(2) === 0)
  }
}

/**
 * Short corridors off rooms that end in rock: 1 to 3 a level, 3 to 6 cells long, never touching other floor, so each
 * ends in a dead end worth the detour.
 */
const addBranches = (grid: string[][], rooms: readonly Room[], r: (n: number) => number) => {
  const isRock = (x: number, y: number) => x >= 1 && y >= 1 && x < MAP_W - 1 && y < MAP_H - 1 && grid[y]![x] === '#'
  const wanted = 1 + r(3)
  let made = 0
  for (let attempt = 0; attempt < 40 && made < wanted; attempt += 1) {
    const room = rooms[r(rooms.length)]!
    const side = r(4)
    const d = [{ x: -1, y: 0 }, { x: 1, y: 0 }, { x: 0, y: -1 }, { x: 0, y: 1 }][side]!
    const along = d.x === 0 ? room.x + 1 + r(Math.max(1, room.w - 2)) : room.y + r(room.h)
    const from = d.x === -1 ? { x: room.x - 1, y: along } : d.x === 1 ? { x: room.x + room.w, y: along } : d.y === -1 ? { x: along, y: room.y - 1 } : { x: along, y: room.y + room.h }
    const length = 3 + r(4)
    const cells = Array.from({ length }, (_, k) => ({ x: from.x + d.x * k, y: from.y + d.y * k }))
    const end = cells.at(-1)!
    // Rock all round: each cell's two sides (beyond the first, which leaves the room), and the cell past the end.
    // It leaves from room floor: a shape may have given the edge cell back to rock.
    const isFromFloor = grid[from.y - d.y]?.[from.x - d.x] === '.'
    const isClear = isFromFloor && cells.every((c, k) => isRock(c.x, c.y) && (k === 0 || (isRock(c.x + d.y, c.y + d.x) && isRock(c.x - d.y, c.y - d.x)))) && isRock(end.x + d.x, end.y + d.y)
    if (!isClear) continue
    for (const c of cells) carve(grid, c.x, c.y)
    made += 1
  }
}

const levels = new Map<string, Level>()

/** Depth 1 and boss depths are plain rooms; otherwise about half of depths take another layout, each theme leaning its own way. */
const LEANS: Readonly<Record<Theme, readonly Layout[]>> = {
  crypt: ['warrens', 'warrens', 'hall', 'ring', 'caverns'],
  flooded: ['caverns', 'caverns', 'ring', 'hall', 'warrens'],
  forge: ['hall', 'hall', 'ring', 'caverns', 'warrens'],
}
export const layoutOf = (world: number, depth: number): Layout => {
  if (depth <= 1 || depth % 5 === 0) return 'rooms'
  const n = hash(world * 19 + depth * 11, 7, 2)
  if (n < 50) return 'rooms'
  const leans = LEANS[themeOf(depth)]
  return leans[Math.floor(((n - 50) * leans.length) / 50)] ?? 'rooms'
}

/** The great hall: wide and tall, pillared, about the middle of the map. */
const greatHall = (r: (n: number) => number): Room => {
  const w = 18 + r(9)
  const h = 7 + r(3)
  return { x: Math.floor((MAP_W - w) / 2) + r(11) - 5, y: Math.floor((MAP_H - h) / 2) + r(3) - 1, w, h, shape: 'pillars' }
}

/** Joins every room straight to the first, the hall; returns the room the hero starts in, never the hall. */
const joinToHall = (grid: string[][], rooms: readonly Room[], r: (n: number) => number) => {
  for (let i = 1; i < rooms.length; i += 1) tunnel(grid, center(rooms[i]!), center(rooms[0]!), r(2) === 0)
  return rooms.length > 1 ? 1 + r(rooms.length - 1) : 0
}

/** The rock a ring's rooms stand around, so the circle reads on the map. */
const RING_CORE: Room = { x: 20, y: 6, w: 24, h: 6 }

/** Joins the rooms round in a circle, in the order of their angle about the map's middle. */
const joinInRing = (grid: string[][], rooms: readonly Room[], r: (n: number) => number) => {
  const angle = (room: Room) => Math.atan2((center(room).y - MAP_H / 2) * 3, center(room).x - MAP_W / 2)
  const order = rooms.map((_, i) => i).sort((a, b) => angle(rooms[a]!) - angle(rooms[b]!))
  order.forEach((i, k) => tunnel(grid, center(rooms[i]!), center(rooms[order[(k + 1) % order.length]!]!), r(2) === 0))
  return order[r(order.length)]!
}

/**
 * The level of `depth` in the world `world`: the same arguments always build the same map. Rooms joined as a branching
 * tree, a few loops knocked through, a few dead-end branches; the hero starts in a random room and the stairs lie in
 * the room farthest from it by walking.
 */
export const generate = (world: number, depth: number): Level => {
  const key = `${world}:${depth}`
  const cached = levels.get(key)
  if (cached !== undefined) return cached
  const r = seeded(Math.imul(world, 7919) + Math.imul(depth, 104729))
  const grid = Array.from({ length: MAP_H }, () => Array<string>(MAP_W).fill('#'))
  const layout = layoutOf(world, depth)
  const rooms =
    layout === 'hall' ? placeRooms(r, { ...ROOM_SIZES, most: 7 }, [greatHall(r)]).map((room, i) => (i === 0 ? room : { ...room, shape: shapeOf(world, depth, room) }))
    : layout === 'warrens' ? placeRooms(r, WARREN_SIZES)
    : layout === 'ring' ? placeRooms(r, { ...ROOM_SIZES, tries: 160 }, [], RING_CORE)
    : layout === 'caverns' ? placeRooms(r).map(room => (room.w >= 6 && room.h >= 5 ? { ...room, shape: 'ragged' as const } : room))
    : placeRooms(r).map(room => ({ ...room, shape: shapeOf(world, depth, room) }))
  for (const room of rooms) {
    for (let y = room.y; y < room.y + room.h; y += 1) for (let x = room.x; x < room.x + room.w; x += 1) carve(grid, x, y)
    for (const c of shapeCut(room)) grid[c.y]![c.x] = '#'
  }
  const first =
    layout === 'hall' ? joinToHall(grid, rooms, r)
    : layout === 'ring' ? joinInRing(grid, rooms, r)
    : layout === 'caverns' ? joinWinding(grid, rooms, r)
    : joinRooms(grid, rooms, r)
  if (layout === 'rooms' || layout === 'warrens') addLoops(grid, rooms, r)
  addBranches(grid, rooms, r)
  if (layout === 'warrens') addBranches(grid, rooms, r)
  if (layout === 'caverns') fillRaggedEnds(grid, rooms)
  const tiles = grid.map(row => row.join(''))
  const start = center(rooms[first]!)
  const { dist } = walkDistances(tiles, start)
  const far = rooms.reduce((best, room) => (dist[cellId(center(room))]! > dist[cellId(center(best))]! ? room : best), rooms[first]!)
  const level = { tiles, rooms, start, stairs: center(far) }
  levels.set(key, level)
  return level
}

export const isFloor = (tiles: readonly string[], p: Pos) => tiles[p.y]?.[p.x] === '.'

export const same = (a: Pos, b: Pos) => a.x === b.x && a.y === b.y

/**
 * Shortest 8-way path over floor from `from` to `to`, both ends included; null when cut off. A diagonal step needs
 * both cells beside it open, so no wall corner is cut. `blocked` is never entered, not even as `to`.
 */
export const bfs = (tiles: readonly string[], from: Pos, to: Pos, blocked?: Pos): Pos[] | null => {
  const width = tiles[0]?.length ?? 0
  const id = (p: Pos) => p.y * width + p.x
  const came = new Map<number, number>([[id(from), -1]])
  const queue: Pos[] = [from]
  for (let head = 0; head < queue.length; head += 1) {
    const at = queue[head] as Pos
    if (same(at, to)) break
    for (const d of STEPS) {
      const next = { x: at.x + d.x, y: at.y + d.y }
      const isCornerFree = (d.x === 0 || d.y === 0) || (isFloor(tiles, { x: at.x + d.x, y: at.y }) && isFloor(tiles, { x: at.x, y: at.y + d.y }))
      const isOpen = isFloor(tiles, next) && isCornerFree && !came.has(id(next)) && (blocked === undefined || !same(next, blocked))
      if (isOpen) {
        came.set(id(next), id(at))
        queue.push(next)
      }
    }
  }
  if (!came.has(id(to))) return null
  const path: Pos[] = []
  for (let cur = id(to); cur !== -1; cur = came.get(cur) ?? -1) path.unshift({ x: cur % width, y: Math.floor(cur / width) })
  return path
}

/**
 * Steps from `from` to every cell of `tiles` the way the hero walks (8-way, no wall corner cut), row-major at the
 * grid's width, -1 where it cannot reach; and how many cells it reached. Typed arrays, no objects: levels are built
 * with it many times over.
 */
export const walkDistances = (tiles: readonly string[], from: Pos) => {
  const width = tiles[0]?.length ?? 0
  const height = tiles.length
  const open = new Uint8Array(width * height)
  for (let y = 0; y < height; y += 1) for (let x = 0; x < width; x += 1) if (tiles[y]![x] === '.') open[y * width + x] = 1
  const dist = new Int32Array(width * height).fill(-1)
  const queue = new Int32Array(width * height)
  let tail = 0
  if (open[from.y * width + from.x] === 1) {
    dist[from.y * width + from.x] = 0
    queue[tail++] = from.y * width + from.x
  }
  for (let head = 0; head < tail; head += 1) {
    const at = queue[head]!
    const x = at % width
    const y = (at - x) / width
    for (const d of STEPS) {
      const nx = x + d.x
      const ny = y + d.y
      if (nx < 0 || ny < 0 || nx >= width || ny >= height) continue
      const next = ny * width + nx
      if (open[next] !== 1 || dist[next] !== -1) continue
      if (d.x !== 0 && d.y !== 0 && (open[y * width + nx] !== 1 || open[ny * width + x] !== 1)) continue
      dist[next] = dist[at]! + 1
      queue[tail++] = next
    }
  }
  return { dist, reached: tail }
}

/** A level measured: steps from the start to every cell (-1 where none), to the stairs, floor reached, dead ends. */
export type Analysis = { dist: number[]; pathLength: number; floor: number; reachable: number; deadEnds: Pos[] }

/**
 * Measures a level the way the hero walks it: `dist` by cell (row-major at the grid's own width), `pathLength` the
 * steps to the stairs, `deadEnds` the floor cells with a single straight floor neighbour, in cell order.
 */
export const analyze = (level: Pick<Level, 'tiles' | 'start' | 'stairs'>): Analysis => {
  const { tiles } = level
  const width = tiles[0]?.length ?? 0
  const { dist, reached } = walkDistances(tiles, level.start)
  const deadEnds: Pos[] = []
  let floor = 0
  tiles.forEach((row, y) => [...row].forEach((t, x) => {
    if (t !== '.') return
    floor += 1
    const straight = STEPS.slice(0, 4).filter(d => isFloor(tiles, { x: x + d.x, y: y + d.y })).length
    if (straight === 1) deadEnds.push({ x, y })
  }))
  return { dist: [...dist], pathLength: dist[level.stairs.y * width + level.stairs.x]!, floor, reachable: reached, deadEnds }
}

export const roomAt = (level: Level, p: Pos) =>
  level.rooms.find(r => p.x >= r.x && p.x < r.x + r.w && p.y >= r.y && p.y < r.y + r.h)

/** How far the hero sees down a corridor leaving the room he stands in: as far as a branch runs. */
export const CORRIDOR_SIGHT = 6

/**
 * What the hero sees from `p`: a whole room with its walls when inside one, and straight down each corridor leaving
 * it, CORRIDOR_SIGHT cells and their walls, so what lies at the end of a branch shows from the room; else the cells
 * around.
 */
export const visibleFrom = (level: Level, p: Pos): Pos[] => {
  const room = roomAt(level, p)
  const box = room === undefined ? { x: p.x - 1, y: p.y - 1, w: 3, h: 3 } : { x: room.x - 1, y: room.y - 1, w: room.w + 2, h: room.h + 2 }
  const cells: Pos[] = []
  for (let y = box.y; y < box.y + box.h; y += 1) for (let x = box.x; x < box.x + box.w; x += 1) cells.push({ x, y })
  if (room !== undefined) {
    // Openings in the wall ring, each looking outward from its side of the room.
    const openings = cells.flatMap(c => {
      const out = c.x === box.x ? { x: -1, y: 0 } : c.x === box.x + box.w - 1 ? { x: 1, y: 0 } : c.y === box.y ? { x: 0, y: -1 } : c.y === box.y + box.h - 1 ? { x: 0, y: 1 } : null
      const isCorner = (c.x === box.x || c.x === box.x + box.w - 1) && (c.y === box.y || c.y === box.y + box.h - 1)
      return out !== null && !isCorner && isFloor(level.tiles, c) ? [{ c, out }] : []
    })
    for (const { c, out } of openings) {
      for (let k = 1; k <= CORRIDOR_SIGHT; k += 1) {
        const q = { x: c.x + out.x * k, y: c.y + out.y * k }
        if (!isFloor(level.tiles, q)) break
        cells.push(q, { x: q.x + out.y, y: q.y + out.x }, { x: q.x - out.y, y: q.y - out.x })
      }
    }
  }
  return cells.filter(c => c.x >= 0 && c.y >= 0 && c.x < MAP_W && c.y < MAP_H)
}

export type ChestKind = 'wooden' | 'iron' | 'gilded'
/** A chest's glyph on the map, by kind; opened, every chest is 'c'. */
export const CHEST_GLYPH: Readonly<Record<ChestKind, string>> = { wooden: 'C', iron: 'H', gilded: 'G' }

const deadEndsOf = new WeakMap<Level, Set<number>>()

/**
 * The chest at a cell, if any: every dead end holds one, the reward for the detour. Its kind by depth: wooden, iron
 * from depth 2, gilded from depth 4, a deeper kind more likely the deeper the level.
 */
export const chestAt = (world: number, depth: number, level: Level, p: Pos): ChestKind | undefined => {
  let ends = deadEndsOf.get(level)
  if (ends === undefined) {
    ends = new Set(analyze(level).deadEnds.map(cellId))
    deadEndsOf.set(level, ends)
  }
  if (!ends.has(cellId(p))) return undefined
  const n = hash(world + depth * 104729, p.x, p.y)
  if (depth >= 4 && n < 10 + 2 * Math.min(depth, 15)) return 'gilded'
  if (depth >= 2 && n < 55) return 'iron'
  return 'wooden'
}

/** The look of a stretch of depths: the same tiles, their ground recolored. */
export type Theme = 'crypt' | 'flooded' | 'forge'
const THEMES: readonly Theme[] = ['crypt', 'flooded', 'forge']
/** Depths a theme lasts, then the next, and round again. */
export const THEME_DEPTHS = 5
export const themeOf = (depth: number): Theme => THEMES[Math.floor((depth - 1) / THEME_DEPTHS) % THEMES.length]!

export type RoomKind = 'shrine' | 'library' | 'spring' | 'anvil' | 'vault'
/** The themed rooms each theme can have: the crypt's two, and a third of the flooded halls' and the forge's own. */
const KINDS: Readonly<Record<Theme, readonly RoomKind[]>> = { crypt: ['shrine', 'library', 'vault'], flooded: ['shrine', 'library', 'spring', 'vault'], forge: ['shrine', 'library', 'anvil', 'vault'] }
const themedOf = new WeakMap<Level, { room: Room; kind: RoomKind } | null>()

/**
 * The level's themed room, if any: one room, neither the start's nor the stairs', at least 5 wide, laid out to its
 * kind's recipe: a shrine (an altar in the middle, a brazier two cells each side) or a library (a lectern in the
 * middle, shelves along the top).
 */
const kindOf = (world: number, depth: number): RoomKind => {
  const kinds = KINDS[themeOf(depth)]
  return kinds[Math.floor((hash(world * 17 + depth * 3, 3, 4) * kinds.length) / 100)] ?? kinds[0]!
}

export const themedRoomOf = (world: number, depth: number, level: Level): { room: Room; kind: RoomKind } | undefined => {
  const known = themedOf.get(level)
  if (known !== undefined) return known ?? undefined
  const candidates = level.rooms.filter(r => r.w >= 5 && r.shape === undefined && r !== roomAt(level, level.start) && r !== roomAt(level, level.stairs))
  const themed = candidates.length === 0 ? null : { room: candidates[hash(world * 13 + depth * 7, 1, 2) % candidates.length]!, kind: kindOf(world, depth) }
  themedOf.set(level, themed)
  return themed ?? undefined
}

/** The fires of a level's themed room that light it: a shrine's braziers or an old forge's embers, two cells each side of the middle. */
export const braziersOf = (world: number, depth: number, level: Level): Pos[] => {
  const themed = themedRoomOf(world, depth, level)
  if (themed?.kind !== 'shrine' && themed?.kind !== 'anvil') return []
  const r = themed.room
  const mid = { x: r.x + Math.floor(r.w / 2), y: r.y + Math.floor(r.h / 2) }
  return [{ x: mid.x - 2, y: mid.y }, { x: mid.x + 2, y: mid.y }]
}

/** What stands in the themed room at a cell: A an altar, B a brazier, R a lectern, L a shelf; ' ' elsewhere in it. */
const themedThing = (themed: { room: Room; kind: RoomKind }, p: Pos) => {
  const r = themed.room
  const mid = { x: r.x + Math.floor(r.w / 2), y: r.y + Math.floor(r.h / 2) }
  if (themed.kind === 'shrine') {
    if (same(p, mid)) return 'A'
    if (p.y === mid.y && Math.abs(p.x - mid.x) === 2) return 'B'
    return ' '
  }
  if (themed.kind === 'spring' || themed.kind === 'anvil') {
    if (same(p, mid)) return themed.kind === 'spring' ? 'S' : 'N'
    if (p.y === mid.y && Math.abs(p.x - mid.x) === 2) return themed.kind === 'spring' ? 'Q' : 'F'
    return ' '
  }
  // A vault: three piles of gold across the middle, a trap on each side of them, for whoever clicks in.
  if (themed.kind === 'vault') {
    if (p.y === mid.y && Math.abs(p.x - mid.x) <= 2 && (p.x - mid.x) % 2 === 0) return '$'
    if (p.y === mid.y && Math.abs(p.x - mid.x) === 1) return '^'
    return ' '
  }
  if (same(p, mid)) return 'R'
  if (p.y === r.y && (p.x - r.x) % 2 === 0) return 'L'
  return ' '
}

/**
 * What lies on a floor cell before anyone takes it: a chest at a dead end; the themed room's furnishings; in a room
 * gold, a potion, a trap or nothing.
 */
export const floorThing = (world: number, depth: number, level: Level, p: Pos) => {
  const isInside = p.x >= 0 && p.y >= 0 && p.x < MAP_W && p.y < MAP_H
  if (!isInside) return workedThing(world, depth, level, p)
  let known = thingsOf.get(level)
  if (known === undefined || known.world !== world || known.depth !== depth) {
    known = { world, depth, cells: [] }
    thingsOf.set(level, known)
  }
  return (known.cells[cellId(p)] ??= workedThing(world, depth, level, p))
}
/** Each level's things as worked out, by cell: they are fixed by the world and depth (what is taken is the game's). */
const thingsOf = new WeakMap<Level, { world: number; depth: number; cells: string[] }>()

const workedThing = (world: number, depth: number, level: Level, p: Pos) => {
  const chest = chestAt(world, depth, level, p)
  if (chest !== undefined) return CHEST_GLYPH[chest]
  const themed = themedRoomOf(world, depth, level)
  if (themed !== undefined && roomAt(level, p) === themed.room) return themedThing(themed, p)
  if (roomAt(level, p) === undefined || !isFloor(level.tiles, p) || same(p, level.stairs) || same(p, level.start)) return ' '
  const n = hash(world + depth * 7919, p.x, p.y)
  if (n < 3) return '$'
  if (n < 4) return '!'
  if (n < 6) return '^'
  return ' '
}

export const cellId = (p: Pos) => p.y * MAP_W + p.x

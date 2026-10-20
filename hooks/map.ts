import { hash } from './rng'

export const MAP_W = 64
export const MAP_H = 18

export type Pos = { x: number; y: number }
/** A room's floor: `w` by `h` cells from its top-left `x`, `y`, less what its shape gives back to rock. */
export type Room = Pos & { w: number; h: number; shape?: RoomShape }
/**
 * A room not a plain rectangle: corners cut (cross), one quarter cut (L), two rows of pillars along an aisle (pillars),
 * its corner cells cut (rounded), one cell in three cut along its long walls (alcoves), a bar of rock either side of its
 * middle row (island), or a ragged edge (ragged, the caverns').
 */
export type RoomShape = 'cross' | 'L' | 'pillars' | 'rounded' | 'alcoves' | 'island' | 'ragged'
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
/** Each shape's cut, by a cell (`dx`, `dy` its distance in from the nearer wall) of a room off its middle row and column. */
const SHAPE_CUTS: Readonly<Record<Exclude<RoomShape, 'ragged'>, (c: { x: number; y: number; dx: number; dy: number }, room: Room, mid: Pos) => boolean>> = {
  cross: (c, room) => c.dx < Math.floor(room.w / 3) && c.dy < Math.floor(room.h / 3),
  L: (c, _room, mid) => c.x > mid.x && c.y < mid.y,
  pillars: c => c.dy === 1 && c.dx % 2 === 1,
  rounded: c => c.dx === 0 && c.dy === 0,
  // Never the cell next to the far end: it would leave that end cell standing alone, a dead end.
  alcoves: (c, room) => c.dy === 0 && (c.x - room.x) % 3 === 0 && c.x - room.x !== room.w - 2,
  island: c => c.dx >= 2 && c.dy >= 1,
}

export const shapeCut = (room: Room): Pos[] => {
  const mid = center(room)
  if (room.shape === 'ragged') return raggedCut(room, mid)
  const isCut = room.shape === undefined ? undefined : SHAPE_CUTS[room.shape]
  if (isCut === undefined) return []
  const cells: Pos[] = []
  for (let y = room.y; y < room.y + room.h; y += 1) for (let x = room.x; x < room.x + room.w; x += 1) {
    const c = { x, y, dx: Math.min(x - room.x, room.x + room.w - 1 - x), dy: Math.min(y - room.y, room.y + room.h - 1 - y) }
    if (x !== mid.x && y !== mid.y && isCut(c, room, mid)) cells.push({ x, y })
  }
  return cells
}

/**
 * Most rooms big enough for a shape get one, chosen by its place alone, so corridors stay as they were: the big
 * shapes for rooms of 7 by 5 and more, the small ones for the ordinary rooms most levels are made of.
 */
const shapeOf = (world: number, depth: number, room: Room): RoomShape | undefined => {
  const n = hash(world * 11 + depth * 5, room.x, room.y)
  const isBig = room.w >= 7 && room.h >= 5
  if (n < 12 && isBig) return 'cross'
  if (n < 24 && room.w >= 6 && room.h >= 4) return 'L'
  if (n < 34 && isBig) return 'pillars'
  // Four rows at least: in three, the corners cut leave each end of the middle row a dead end.
  if (n < 54 && room.w >= 4 && room.h >= 4) return 'rounded'
  if (n < 68 && room.w >= 6 && room.h >= 4) return 'alcoves'
  if (n < 78 && room.w >= 8 && room.h >= 5) return 'island'
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
const SIDES: readonly Pos[] = [{ x: -1, y: 0 }, { x: 1, y: 0 }, { x: 0, y: -1 }, { x: 0, y: 1 }]

/** The first cell of a branch out of a room's side `d`, at `along` that side: just outside the wall. */
const branchStart = (room: Room, d: Pos, along: number): Pos => {
  if (d.x === -1) return { x: room.x - 1, y: along }
  if (d.x === 1) return { x: room.x + room.w, y: along }
  return d.y === -1 ? { x: along, y: room.y - 1 } : { x: along, y: room.y + room.h }
}

/**
 * Whether a branch can be dug there: it leaves from room floor (a shape may have given the edge cell back to rock),
 * and is rock all round, each cell's two sides (beyond the first, which leaves the room) and the cell past its end.
 */
const isClearBranch = (grid: string[][], cells: readonly Pos[], from: Pos, d: Pos) => {
  const isRock = (x: number, y: number) => x >= 1 && y >= 1 && x < MAP_W - 1 && y < MAP_H - 1 && grid[y]![x] === '#'
  const end = cells.at(-1)!
  const isFromFloor = grid[from.y - d.y]?.[from.x - d.x] === '.'
  const isWalled = (c: Pos, k: number) => isRock(c.x, c.y) && (k === 0 || (isRock(c.x + d.y, c.y + d.x) && isRock(c.x - d.y, c.y - d.x)))
  return isFromFloor && cells.every(isWalled) && isRock(end.x + d.x, end.y + d.y)
}

const addBranches = (grid: string[][], rooms: readonly Room[], r: (n: number) => number) => {
  const wanted = 1 + r(3)
  let made = 0
  for (let attempt = 0; attempt < 40 && made < wanted; attempt += 1) {
    const room = rooms[r(rooms.length)]!
    const d = SIDES[r(4)]!
    const along = d.x === 0 ? room.x + 1 + r(Math.max(1, room.w - 2)) : room.y + r(room.h)
    const from = branchStart(room, d, along)
    const cells = Array.from({ length: 3 + r(4) }, (_, k) => ({ x: from.x + d.x * k, y: from.y + d.y * k }))
    if (!isClearBranch(grid, cells, from, d)) continue
    for (const c of cells) carve(grid, c.x, c.y)
    made += 1
  }
}

const levels = new Map<string, Level>()

/** Every tenth depth a big boss guards the stairs, in an arena. */
export const BIG_EVERY = 10
/** The arena's least size: room for a boss twice a foe's size to move and the hero to step round it. */
const ARENA_W = 14
const ARENA_H = 8

/**
 * The stairs room grown into an arena: at least ARENA_W by ARENA_H about its middle, inside the map, plain (its shape
 * gone). Growing only adds floor, so every way through still stands. A room that would take in the hero's start stays as
 * it was, so the arena is never where a level begins.
 */
const arenaOf = (grid: string[][], rooms: Room[], room: Room, start: Pos): Room => {
  const w = Math.min(MAP_W - 2, Math.max(room.w, ARENA_W))
  const h = Math.min(MAP_H - 2, Math.max(room.h, ARENA_H))
  const mid = center(room)
  const x = Math.max(1, Math.min(MAP_W - 1 - w, mid.x - Math.floor(w / 2)))
  const y = Math.max(1, Math.min(MAP_H - 1 - h, mid.y - Math.floor(h / 2)))
  const arena: Room = { x, y, w, h }
  const holdsStart = start.x >= x && start.x < x + w && start.y >= y && start.y < y + h
  if (holdsStart) return room
  for (let yy = y; yy < y + h; yy += 1) for (let xx = x; xx < x + w; xx += 1) carve(grid, xx, yy)
  rooms[rooms.indexOf(room)] = arena
  return arena
}

/** Depth 1 and boss depths are plain rooms; otherwise about half of depths take another layout, each theme leaning its own way. */
const LEANS: Readonly<Record<Theme, readonly Layout[]>> = {
  crypt: ['warrens', 'warrens', 'hall', 'ring', 'caverns'],
  flooded: ['caverns', 'caverns', 'ring', 'hall', 'warrens'],
  fungal: ['caverns', 'warrens', 'caverns', 'ring', 'warrens'],
  frozen: ['hall', 'ring', 'hall', 'ring', 'caverns'],
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
type Rng = (n: number) => number

/** Each layout's plan: its rooms, how they are joined (the room the level starts in), and what is dug after. */
const LAYOUT_PLANS: Readonly<Record<Layout, { rooms: (r: Rng, world: number, depth: number) => Room[]; join: (grid: string[][], rooms: Room[], r: Rng) => number; after: (grid: string[][], rooms: Room[], r: Rng) => void }>> = {
  rooms: {
    rooms: (r, world, depth) => placeRooms(r).map(room => ({ ...room, shape: shapeOf(world, depth, room) })),
    join: joinRooms,
    after: (grid, rooms, r) => {
      addLoops(grid, rooms, r)
      addBranches(grid, rooms, r)
    },
  },
  hall: {
    rooms: (r, world, depth) => placeRooms(r, { ...ROOM_SIZES, most: 7 }, [greatHall(r)]).map((room, i) => (i === 0 ? room : { ...room, shape: shapeOf(world, depth, room) })),
    join: joinToHall,
    after: addBranches,
  },
  warrens: {
    rooms: r => placeRooms(r, WARREN_SIZES),
    join: joinRooms,
    after: (grid, rooms, r) => {
      addLoops(grid, rooms, r)
      addBranches(grid, rooms, r)
      addBranches(grid, rooms, r)
    },
  },
  ring: {
    rooms: r => placeRooms(r, { ...ROOM_SIZES, tries: 160 }, [], RING_CORE),
    join: joinInRing,
    after: addBranches,
  },
  caverns: {
    rooms: r => placeRooms(r).map(room => (room.w >= 6 && room.h >= 5 ? { ...room, shape: 'ragged' as const } : room)),
    join: joinWinding,
    after: (grid, rooms, r) => {
      addBranches(grid, rooms, r)
      fillRaggedEnds(grid, rooms)
    },
  },
}

/** Each room dug out of the rock, less the cuts of its shape. */
const carveRooms = (grid: string[][], rooms: readonly Room[]) => {
  for (const room of rooms) {
    for (let y = room.y; y < room.y + room.h; y += 1) for (let x = room.x; x < room.x + room.w; x += 1) carve(grid, x, y)
    for (const c of shapeCut(room)) grid[c.y]![c.x] = '#'
  }
}

/** The room farthest from the start by walking: where the stairs go. */
const farthestRoom = (grid: string[][], rooms: readonly Room[], first: Room, start: Pos) => {
  const { dist } = walkDistances(grid.map(row => row.join('')), start)
  return rooms.reduce((best, room) => (dist[cellId(center(room))]! > dist[cellId(center(best))]! ? room : best), first)
}

export const generate = (world: number, depth: number): Level => {
  const key = `${world}:${depth}`
  const cached = levels.get(key)
  if (cached !== undefined) return cached
  const r = seeded(Math.imul(world, 7919) + Math.imul(depth, 104729))
  const grid = Array.from({ length: MAP_H }, () => Array<string>(MAP_W).fill('#'))
  const plan = LAYOUT_PLANS[layoutOf(world, depth)]
  const rooms = plan.rooms(r, world, depth)
  carveRooms(grid, rooms)
  const first = plan.join(grid, rooms, r)
  plan.after(grid, rooms, r)
  const start = center(rooms[first]!)
  const far = farthestRoom(grid, rooms, rooms[first]!, start)
  const stairsRoom = depth % BIG_EVERY === 0 ? arenaOf(grid, rooms, far, start) : far
  const level = { tiles: grid.map(row => row.join('')), rooms, start, stairs: center(stairsRoom) }
  levels.set(key, level)
  return level
}

export const isFloor = (tiles: readonly string[], p: Pos) => tiles[p.y]?.[p.x] === '.'

export const same = (a: Pos, b: Pos) => a.x === b.x && a.y === b.y

/** The open cells of `tiles` (floor), row-major at the grid's width. */
const openCells = (tiles: readonly string[], width: number) => {
  const open = new Uint8Array(width * tiles.length)
  for (let y = 0; y < tiles.length; y += 1) for (let x = 0; x < width; x += 1) if (tiles[y]![x] === '.') open[y * width + x] = 1
  return open
}

/** The cell a step `d` from (x, y) lands on, the way the hero walks: open floor, no wall corner cut; -1 where it cannot. */
const stepFrom = (open: Uint8Array, width: number, height: number, x: number, y: number, d: Pos) => {
  const nx = x + d.x
  const ny = y + d.y
  if (nx < 0 || ny < 0 || nx >= width || ny >= height || open[ny * width + nx] !== 1) return -1
  if (d.x !== 0 && d.y !== 0 && (open[y * width + nx] !== 1 || open[ny * width + x] !== 1)) return -1
  return ny * width + nx
}

const UNSEEN = -2

/**
 * Breadth first from `from` the way the hero walks (8-way, no wall corner cut), over typed arrays, cells row-major at
 * the grid's width: where each cell was reached from (-1 the start, UNSEEN none) and its steps away (-1 none); stopped
 * at `stop` once reached; `blocked` never entered; from a start off the floor only when `isAnyStart`.
 */
const search = (tiles: readonly string[], from: Pos, { stop, blocked, isAnyStart = false }: { stop?: Pos; blocked?: Pos; isAnyStart?: boolean } = {}) => {
  const width = tiles[0]?.length ?? 0
  const height = tiles.length
  const open = openCells(tiles, width)
  const came = new Int32Array(width * height).fill(UNSEEN)
  const dist = new Int32Array(width * height).fill(-1)
  const queue = new Int32Array(width * height)
  const start = from.y * width + from.x
  const skip = blocked === undefined ? -1 : blocked.y * width + blocked.x
  let tail = 0
  if (isAnyStart || open[start] === 1) {
    came[start] = -1
    dist[start] = 0
    queue[tail++] = start
  }
  for (let head = 0; head < tail; head += 1) {
    const at = queue[head]!
    const x = at % width
    const y = (at - x) / width
    if (stop !== undefined && x === stop.x && y === stop.y) break
    for (const d of STEPS) {
      const next = stepFrom(open, width, height, x, y, d)
      if (next === -1 || came[next] !== UNSEEN || next === skip) continue
      came[next] = at
      dist[next] = dist[at]! + 1
      queue[tail++] = next
    }
  }
  return { came, dist, reached: tail, width }
}

/**
 * Shortest 8-way path over floor from `from` to `to`, both ends included; null when cut off. A diagonal step needs
 * both cells beside it open, so no wall corner is cut. `blocked` is never entered, not even as `to`.
 */
export const bfs = (tiles: readonly string[], from: Pos, to: Pos, blocked?: Pos): Pos[] | null => {
  const { came, width } = search(tiles, from, { stop: to, blocked, isAnyStart: true })
  const goal = to.y * width + to.x
  if (goal < 0 || goal >= came.length || came[goal] === UNSEEN) return null
  const path: Pos[] = []
  for (let cur = goal; cur !== -1; cur = came[cur]!) path.push({ x: cur % width, y: Math.floor(cur / width) })
  return path.reverse()
}

/**
 * Steps from `from` to every cell of `tiles` the way the hero walks (8-way, no wall corner cut), row-major at the
 * grid's width, -1 where it cannot reach; and how many cells it reached. Typed arrays, no objects: levels are built
 * with it many times over.
 */
export const walkDistances = (tiles: readonly string[], from: Pos) => {
  const { dist, reached } = search(tiles, from)
  return { dist, reached }
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

/** A room's box with its wall ring: what is seen of it from inside or from its door. */
type Box = { x: number; y: number; w: number; h: number }

/** The way a cell of a room's wall ring looks out of the room, its side's; none for a corner or a cell inside. */
const outwardOf = (c: Pos, box: Box): Pos | null => {
  const isLeft = c.x === box.x
  const isRight = c.x === box.x + box.w - 1
  const isTop = c.y === box.y
  const isBottom = c.y === box.y + box.h - 1
  if ((isLeft || isRight) && (isTop || isBottom)) return null
  if (isLeft) return { x: -1, y: 0 }
  if (isRight) return { x: 1, y: 0 }
  if (isTop) return { x: 0, y: -1 }
  return isBottom ? { x: 0, y: 1 } : null
}

/**
 * Down a corridor from an opening of `room`: up to CORRIDOR_SIGHT cells out while it is corridor floor, each with the
 * rock either side of it; short of a dead end (a chest), of a door into another room and of any room's floor, each of
 * which shows only once the hero is beside it or on it.
 */
const corridorSight = (level: Level, space: readonly Room[], c: Pos, out: Pos): Pos[] => {
  const cells: Pos[] = []
  for (let k = 1; k <= CORRIDOR_SIGHT; k += 1) {
    const q = { x: c.x + out.x * k, y: c.y + out.y * k }
    if (!isCorridor(level, q) || isDeadEnd(level, q) || roomsBeside(level, q).some(r => !space.includes(r))) break
    cells.push(q, ...[{ x: q.x + out.y, y: q.y + out.x }, { x: q.x - out.y, y: q.y - out.x }].filter(s => !isFloor(level.tiles, s)))
  }
  return cells
}

const STEPS4: readonly Pos[] = [{ x: 1, y: 0 }, { x: -1, y: 0 }, { x: 0, y: 1 }, { x: 0, y: -1 }]
const isCorridor = (level: Level, p: Pos) => isFloor(level.tiles, p) && roomAt(level, p) === undefined
/** The rooms a cell is beside, by its four sides: the rooms a corridor cell is the door of. */
const roomsBeside = (level: Level, p: Pos) => [...new Set(STEPS4.flatMap(d => roomAt(level, { x: p.x + d.x, y: p.y + d.y }) ?? []))]
const touchesRoom = (level: Level, p: Pos) => roomsBeside(level, p).length > 0
/** A dead end, where a chest stands. */
const isDeadEnd = (level: Level, p: Pos) => chestAt(1, 1, level, p) !== undefined

const sharesFloor = (a: Room, b: Room) => a.x < b.x + b.w && b.x < a.x + a.w && a.y < b.y + b.h && b.y < a.y + a.h

/**
 * The rooms one space on the map with `room`, itself first: the rooms that share floor with it, and theirs. Rooms are
 * placed apart; only a big boss's arena, grown over the rooms beside the stairs, shares floor with another.
 */
const spaceOf = (level: Level, room: Room): Room[] => {
  const space = [room]
  for (let i = 0; i < space.length; i += 1) for (const r of level.rooms) if (!space.includes(r) && sharesFloor(space[i]!, r)) space.push(r)
  return space
}

/** One room's box with its wall ring, and straight down each corridor leaving it, from each opening in that ring. */
const boxSight = (level: Level, room: Room, space: readonly Room[]): Pos[] => {
  const box = { x: room.x - 1, y: room.y - 1, w: room.w + 2, h: room.h + 2 }
  const cells: Pos[] = []
  for (let y = box.y; y < box.y + box.h; y += 1) for (let x = box.x; x < box.x + box.w; x += 1) cells.push({ x, y })
  const openings = cells.flatMap(c => {
    const out = outwardOf(c, box)
    return out !== null && isFloor(level.tiles, c) ? [{ c, out }] : []
  })
  for (const { c, out } of openings) cells.push(...corridorSight(level, space, c, out))
  return cells
}

/** A room seen whole with its walls, with every room one space with it, and straight down each corridor leaving them. */
const roomSight = (level: Level, room: Room): Pos[] => {
  const space = spaceOf(level, room)
  // A dead end right off the room's wall holds its chest back too, until the hero is beside it; a room touching this
  // one is seen only from its own door or floor.
  return space.flatMap(r => boxSight(level, r, space)).filter(c => !isDeadEnd(level, c) && space.includes(roomAt(level, c) ?? room))
}

/**
 * What the hero sees from `p`: in a room, or on a door into one (a corridor cell beside it), the whole room as
 * `roomSight` has it; in a corridor elsewhere the cells `reach` around.
 */
export const visibleFrom = (level: Level, p: Pos, reach = 1): Pos[] => {
  const room = roomAt(level, p)
  const doorOf = room === undefined && isCorridor(level, p) ? roomsBeside(level, p) : []
  const around: Pos[] = []
  for (let y = p.y - reach; y <= p.y + reach; y += 1) for (let x = p.x - reach; x <= p.x + reach; x += 1) around.push({ x, y })
  const cells = room !== undefined ? roomSight(level, room) : [...around, ...doorOf.flatMap(r => roomSight(level, r))]
  return cells.filter(c => c.x >= 0 && c.y >= 0 && c.x < MAP_W && c.y < MAP_H)
}


/**
 * The corridor a hero standing in it learns at once, with its walls: from `p` along corridor floor, through a junction
 * (a cell with three ways or more) but no further, short of the next door (a cell beside a room) and of a dead end
 * (a chest), each of which shows only once the hero is beside it. Nothing in a room.
 */
export const corridorAhead = (level: Level, p: Pos): Pos[] => {
  let known = aheadOf.get(level)
  if (known === undefined) {
    known = new Map()
    aheadOf.set(level, known)
  }
  let cells = known.get(cellId(p))
  if (cells === undefined) {
    cells = workedAhead(level, p)
    known.set(cellId(p), cells)
  }
  return cells
}
/** Each level's corridors as learnt, by cell: fixed by the level alone. */
const aheadOf = new WeakMap<Level, Map<number, Pos[]>>()

const workedAhead = (level: Level, p: Pos): Pos[] => {
  if (!isCorridor(level, p)) return []
  const known = new Set([cellId(p)])
  const queue: Pos[] = [p]
  const out: Pos[] = []
  while (queue.length > 0) {
    const q = queue.shift()!
    out.push(...[-1, 0, 1].flatMap(dy => [-1, 0, 1].map(dx => ({ x: q.x + dx, y: q.y + dy }))))
    const ways = STEPS4.filter(d => isFloor(level.tiles, { x: q.x + d.x, y: q.y + d.y })).length
    if (q !== p && ways >= 3) continue
    for (const d of STEPS4) {
      const n = { x: q.x + d.x, y: q.y + d.y }
      if (known.has(cellId(n)) || !isCorridor(level, n) || touchesRoom(level, n) || isDeadEnd(level, n)) continue
      known.add(cellId(n))
      queue.push(n)
    }
  }
  return out.filter(c => c.x >= 0 && c.y >= 0 && c.x < MAP_W && c.y < MAP_H && (known.has(cellId(c)) || !isFloor(level.tiles, c)))
}

export type ChestKind = 'wooden' | 'iron' | 'gilded'
/** A chest's glyph on the map, by kind, closed and opened (`g` is the goblin's, so the opened gilded chest is `j`). */
export const CHEST_GLYPH: Readonly<Record<ChestKind, string>> = { wooden: 'C', iron: 'H', gilded: 'G' }
export const OPENED_GLYPH: Readonly<Record<string, string>> = { C: 'c', H: 'h', G: 'j' }

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
export type Theme = 'crypt' | 'flooded' | 'fungal' | 'frozen' | 'forge'
/** In this order a big boss, every tenth depth, meets each theme once in fifty depths. */
const THEMES: readonly Theme[] = ['crypt', 'flooded', 'fungal', 'frozen', 'forge']
/** Depths a theme lasts, then the next, and round again. */
export const THEME_DEPTHS = 5
export const themeOf = (depth: number): Theme => THEMES[Math.floor((depth - 1) / THEME_DEPTHS) % THEMES.length]!

/**
 * Each theme's thing to gather, by its glyph: the crypt's warding stone (U), the flooded halls' reeds (V), the fungal
 * deep's glowing caps (P), the frozen caverns' rime crystal (X), the forge's powder keg (K).
 */
export const GATHERABLE: Readonly<Record<Theme, string>> = { crypt: 'U', flooded: 'V', fungal: 'P', frozen: 'X', forge: 'K' }

/** How many of a cell's four sides are rock. */
const rockSides = (level: Level, p: Pos) => [[1, 0], [-1, 0], [0, 1], [0, -1]].filter(([dx, dy]) => !isFloor(level.tiles, { x: p.x + dx!, y: p.y + dy! })).length

export type RoomKind = 'shrine' | 'library' | 'spring' | 'anvil' | 'vault'
/** The themed rooms each theme can have: the crypt's two, and a third of the flooded halls' and the forge's own. */
const KINDS: Readonly<Record<Theme, readonly RoomKind[]>> = {
  crypt: ['shrine', 'library', 'vault'],
  flooded: ['shrine', 'library', 'spring', 'vault'],
  fungal: ['shrine', 'spring', 'vault'],
  frozen: ['shrine', 'library', 'vault'],
  forge: ['shrine', 'library', 'anvil', 'vault'],
}
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
  // A rounded room loses only its corners, which no kind's furnishings stand on.
  const candidates = level.rooms.filter(r => r.w >= 5 && (r.shape === undefined || r.shape === 'rounded') && r !== roomAt(level, level.start) && r !== roomAt(level, level.stairs))
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
/** Two furnishings either side of a themed room's centrepiece, on its middle row. */
const isFlanking = (p: Pos, mid: Pos) => p.y === mid.y && Math.abs(p.x - mid.x) === 2

/** A corner a rounded room gave back to rock. */
const isCutCorner = (p: Pos, room: Room) => room.shape === 'rounded' && (p.x === room.x || p.x === room.x + room.w - 1) && (p.y === room.y || p.y === room.y + room.h - 1)

/** What each themed room holds, by cell: its centrepiece in the middle and its furnishings. */
const THEMED: Readonly<Record<RoomKind, (p: Pos, mid: Pos, room: Room) => string>> = {
  shrine: (p, mid) => (same(p, mid) ? 'A' : isFlanking(p, mid) ? 'B' : ' '),
  spring: (p, mid) => (same(p, mid) ? 'S' : isFlanking(p, mid) ? 'Q' : ' '),
  anvil: (p, mid) => (same(p, mid) ? 'N' : isFlanking(p, mid) ? 'F' : ' '),
  // A vault: three piles of gold across the middle, a trap on each side of them, for whoever clicks in.
  vault: (p, mid) => {
    if (p.y !== mid.y) return ' '
    const off = Math.abs(p.x - mid.x)
    return off <= 2 && off % 2 === 0 ? '$' : off === 1 ? '^' : ' '
  },
  // Shelves along the top row, but never on a corner a rounded room gave back to rock.
  library: (p, mid, room) => (same(p, mid) ? 'R' : p.y === room.y && (p.x - room.x) % 2 === 0 && !isCutCorner(p, room) ? 'L' : ' '),
}

const themedThing = (themed: { room: Room; kind: RoomKind }, p: Pos) => {
  const r = themed.room
  return THEMED[themed.kind](p, { x: r.x + Math.floor(r.w / 2), y: r.y + Math.floor(r.h / 2) }, r)
}

/**
 * What lies on a floor cell before anyone takes it: a chest at a dead end; the themed room's furnishings; in a room
 * gold, a potion, a trap, by a wall the theme's thing to gather, or nothing.
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
  if (n < 7 && rockSides(level, p) > 0) return GATHERABLE[themeOf(depth)]
  return ' '
}

export const cellId = (p: Pos) => p.y * MAP_W + p.x

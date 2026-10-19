import { describe, expect, test } from 'claude-code/testing'

import { MAP_H, MAP_W, analyze, bfs, braziersOf, chestAt, floorThing, generate, isFloor, layoutOf, roomAt, shapeCut, themedRoomOf, visibleFrom } from './map'
import type { Layout } from './map'

const GRID = [
  '#######',
  '#...#.#',
  '#.#.#.#',
  '#.#...#',
  '#######',
]

describe('shortest paths', () => {
  test('follows the only corridor, both ends included', async () => {
    const path = bfs(GRID, { x: 1, y: 3 }, { x: 5, y: 1 })
    expect(path?.length).toBe(11)
    expect(path?.[0]).toEqual({ x: 1, y: 3 })
    expect(path?.at(-1)).toEqual({ x: 5, y: 1 })
  })

  test('a blocked cell on the only way cuts the path', async () => {
    expect(bfs(GRID, { x: 1, y: 3 }, { x: 5, y: 1 }, { x: 3, y: 2 })).toBeNull()
  })

  test('a blocked target is never entered', async () => {
    expect(bfs(GRID, { x: 1, y: 1 }, { x: 3, y: 1 }, { x: 3, y: 1 })).toBeNull()
  })

  test('rock is never walked', async () => {
    expect(bfs(GRID, { x: 1, y: 1 }, { x: 2, y: 2 })).toBeNull()
  })
})

describe('generated levels', () => {
  test('every level is enclosed, and its stairs are reachable from its start', async () => {
    for (let world = 1; world <= 40; world += 1) {
      for (let depth = 1; depth <= 5; depth += 1) {
        const level = generate(world, depth)
        expect(level.tiles.length).toBe(MAP_H)
        expect(level.tiles.every(row => row.length === MAP_W)).toBe(true)
        expect(level.tiles[0]).toBe('#'.repeat(MAP_W))
        expect(level.tiles.at(-1)).toBe('#'.repeat(MAP_W))
        expect(level.tiles.every(row => row[0] === '#' && row.at(-1) === '#')).toBe(true)
        expect(isFloor(level.tiles, level.start) && isFloor(level.tiles, level.stairs)).toBe(true)
        expect(bfs(level.tiles, level.start, level.stairs)).not.toBeNull()
      }
    }
  })

  test('the same world and depth build the same map; another depth builds another', async () => {
    expect(JSON.stringify(generate(77, 3))).toBe(JSON.stringify(generate(77, 3)))
    expect(generate(77, 3).tiles).not.toEqual(generate(77, 4).tiles)
  })

  test('inside a room the hero sees all of it and its walls', async () => {
    const level = generate(5, 1)
    const room = roomAt(level, level.start)
    const seen = visibleFrom(level, level.start)
    expect(room).toBeDefined()
    if (room === undefined) return
    const has = new Set(seen.map(c => `${c.x},${c.y}`))
    for (let y = room.y - 1; y <= room.y + room.h; y += 1) for (let x = room.x - 1; x <= room.x + room.w; x += 1) expect(has.has(`${x},${y}`)).toBe(true)
  })
})

describe('diagonal steps', () => {
  const OPEN = ['#####', '#...#', '#...#', '#...#', '#####']
  const CORNER = ['#####', '#..##', '#.#.#', '##..#', '#####']

  test('across open floor a diagonal destination takes the longer of the two distances, not their sum', async () => {
    const path = bfs(OPEN, { x: 1, y: 1 }, { x: 3, y: 3 })
    expect(path?.length).toBe(3)
    expect(path?.[1]).toEqual({ x: 2, y: 2 })
  })

  test('a wall corner is never cut: a diagonal step needs both side cells open', async () => {
    const path = bfs(CORNER, { x: 2, y: 1 }, { x: 3, y: 2 })
    expect(path).toBeNull()
    const steps = bfs(OPEN, { x: 1, y: 1 }, { x: 2, y: 2 })
    expect(steps?.length).toBe(2)
  })
})

describe('level analysis', () => {
  test('counts steps from the start along a corridor, and finds its two dead ends', async () => {
    const tiles = ['#######', '#.....#', '#######']
    const a = analyze({ tiles, start: { x: 1, y: 1 }, stairs: { x: 5, y: 1 } })
    expect(a.dist.slice(7, 14)).toEqual([-1, 0, 1, 2, 3, 4, -1])
    expect(a.pathLength).toBe(4)
    expect({ floor: a.floor, reachable: a.reachable }).toEqual({ floor: 5, reachable: 5 })
    expect(a.deadEnds).toEqual([{ x: 1, y: 1 }, { x: 5, y: 1 }])
  })

  test('steps as the hero does: a diagonal never cuts a wall corner, so floor past one is out of reach', async () => {
    const tiles = ['#####', '#..##', '#.#.#', '##..#', '#####']
    const a = analyze({ tiles, start: { x: 2, y: 1 }, stairs: { x: 3, y: 3 } })
    expect({ floor: a.floor, reachable: a.reachable, pathLength: a.pathLength }).toEqual({ floor: 6, reachable: 3, pathLength: -1 })
    expect(a.dist[2 * 5 + 1]).toBe(2)
    expect(a.dist[2 * 5 + 3]).toBe(-1)
  })

  test('a lone floor cell is no dead end: a dead end has exactly one straight neighbour', async () => {
    expect(analyze({ tiles: ['###', '#.#', '###'], start: { x: 1, y: 1 }, stairs: { x: 1, y: 1 } }).deadEnds).toEqual([])
  })

  test('a ring of floor has no dead ends', async () => {
    const a = analyze({ tiles: ['#####', '#...#', '#.#.#', '#...#', '#####'], start: { x: 1, y: 1 }, stairs: { x: 3, y: 3 } })
    expect(a.deadEnds).toEqual([])
    expect(a.pathLength).toBe(4)
  })

  test('agrees with the shortest path on generated levels: the same length to the stairs, all floor reachable', async () => {
    for (let world = 1; world <= 40; world += 1) {
      for (let depth = 1; depth <= 5; depth += 1) {
        const level = generate(world, depth)
        const a = analyze(level)
        expect(a.pathLength).toBe((bfs(level.tiles, level.start, level.stairs)?.length ?? 0) - 1)
        expect(a.reachable).toBe(a.floor)
      }
    }
  })
})

describe('level structure', () => {
  const all = Array.from({ length: 60 }, (_, i) => generate(1 + (i % 20), 1 + Math.floor(i / 20)))
  const centerOf = (r: { x: number; y: number; w: number; h: number }) => ({ x: r.x + Math.floor(r.w / 2), y: r.y + Math.floor(r.h / 2) })

  test('the stairs lie in the room farthest from the start by walking', async () => {
    for (const level of all) {
      const a = analyze(level)
      const farthest = Math.max(...level.rooms.map(r => a.dist[centerOf(r).y * MAP_W + centerOf(r).x]!))
      expect(a.pathLength).toBe(farthest)
    }
  })

  test('levels branch: most have dead ends to explore, and the stairs are not always on the same side', async () => {
    const withDeadEnds = all.filter(l => analyze(l).deadEnds.length > 0).length
    expect(withDeadEnds).toBeGreaterThanOrEqual(all.length * 0.8)
    const sides = new Set(all.map(l => Math.sign(l.stairs.x - l.start.x)))
    expect(sides.has(1) && sides.has(-1)).toBe(true)
  })

  test('a dead end is a corridor, not a nook of a room: no room floor touches its far side', async () => {
    for (const level of all) {
      for (const d of analyze(level).deadEnds) expect(roomAt(level, d)).toBeUndefined()
    }
  })

  test('levels loop: some walls are knocked through, so a good share have a way round', async () => {
    // A loop: some floor cell whose straight neighbours are two floor cells far apart by walking around (over 14 steps).
    const hasLoop = (level: ReturnType<typeof generate>) =>
      level.tiles.some((row, y) =>
        [...row].some((t, x) => {
          if (t !== '.') return false
          const pairs = [[[x - 1, y], [x + 1, y]], [[x, y - 1], [x, y + 1]]] as const
          return pairs.some(([a, b]) => {
            if (!isFloor(level.tiles, { x: a[0], y: a[1] }) || !isFloor(level.tiles, { x: b[0], y: b[1] })) return false
            const without = level.tiles.map((r, ry) => (ry === y ? r.slice(0, x) + '#' + r.slice(x + 1) : r))
            const path = bfs(without, { x: a[0], y: a[1] }, { x: b[0], y: b[1] })
            return path !== null && path.length - 1 > 14
          })
        }),
      )
    expect(all.filter(hasLoop).length).toBeGreaterThanOrEqual(all.length * 0.5)
  })

  test('the floor reaches the last row and column inside the walls on some level', async () => {
    expect(all.some(l => l.tiles[MAP_H - 2]!.includes('.'))).toBe(true)
    expect(all.some(l => l.tiles.some(row => row[MAP_W - 2] === '.'))).toBe(true)
  })
})

describe('chests', () => {
  test('every dead end holds a chest, and nothing else does', async () => {
    for (let world = 1; world <= 20; world += 1) {
      const level = generate(world, 3)
      const ends = new Set(analyze(level).deadEnds.map(p => `${p.x},${p.y}`))
      level.tiles.forEach((row, y) => [...row].forEach((t, x) => {
        if (t !== '.') return
        const isEnd = ends.has(`${x},${y}`)
        expect(chestAt(world, 3, level, { x, y }) !== undefined).toBe(isEnd)
        if (isEnd) expect(floorThing(world, 3, level, { x, y })).toBe({ wooden: 'C', iron: 'H', gilded: 'G' }[chestAt(world, 3, level, { x, y })!])
      }))
    }
  })

  test('their kind grows with depth: only wooden at depth 1, iron from depth 2, gilded from depth 4', async () => {
    const kinds = (depth: number) => {
      const found = new Set<string>()
      for (let world = 1; world <= 60; world += 1) {
        const level = generate(world, depth)
        for (const p of analyze(level).deadEnds) found.add(chestAt(world, depth, level, p)!)
      }
      return [...found].sort()
    }
    expect(kinds(1)).toEqual(['wooden'])
    expect(kinds(3)).toEqual(['iron', 'wooden'])
    expect(kinds(6)).toEqual(['gilded', 'iron', 'wooden'])
  })
})

describe('sight down corridors', () => {
  test('from a room the hero sees straight down each corridor leaving it, up to 6 cells, and its walls', async () => {
    // A 3 by 3 room with a corridor of 7 leaving to the right; the room's cells and walls, then 6 corridor cells.
    const tiles = ['#############', '#...#########', '#..........##', '#...#########', '#############']
    const level = { tiles, rooms: [{ x: 1, y: 1, w: 3, h: 3 }], start: { x: 2, y: 2 }, stairs: { x: 10, y: 2 } }
    const seen = new Set(visibleFrom(level, { x: 2, y: 2 }).map(p => `${p.x},${p.y}`))
    // The wall ring holds the corridor's first cell (4,2); then 6 more: 5 to 10.
    for (let x = 4; x <= 10; x += 1) expect(seen.has(`${x},2`)).toBe(true)
    expect(seen.has('11,2')).toBe(false)
    expect(seen.has('7,1') && seen.has('7,3')).toBe(true)
  })

  test('sight down a corridor stops at the first rock, even with floor past it', async () => {
    const tiles = ['#############', '#...#########', '#.....#....##', '#...#########', '#############']
    const level = { tiles, rooms: [{ x: 1, y: 1, w: 3, h: 3 }], start: { x: 2, y: 2 }, stairs: { x: 2, y: 2 } }
    const seen = new Set(visibleFrom(level, { x: 2, y: 2 }).map(p => `${p.x},${p.y}`))
    expect(seen.has('5,2')).toBe(true)
    expect(seen.has('7,2')).toBe(false)
  })

  test('every chest can be seen from the room its branch leaves', async () => {
    for (let world = 1; world <= 30; world += 1) {
      const level = generate(world, 2)
      for (const end of analyze(level).deadEnds) {
        const fromSomeRoom = level.rooms.some(r => visibleFrom(level, { x: r.x, y: r.y }).some(p => p.x === end.x && p.y === end.y))
        expect(fromSomeRoom ? 'seen' : `${world}: ${end.x},${end.y} hidden`).toBe('seen')
      }
    }
  })
})

describe('the themed room', () => {
  test('most levels have one, never the start room or the stairs room, a shrine, a library or a vault', async () => {
    let found = 0
    const kinds = new Set<string>()
    for (let world = 1; world <= 60; world += 1) {
      const level = generate(world, 3)
      const themed = themedRoomOf(world, 3, level)
      if (themed === undefined) continue
      found += 1
      kinds.add(themed.kind)
      expect(roomAt(level, level.start)).not.toBe(themed.room)
      expect(roomAt(level, level.stairs)).not.toBe(themed.room)
      expect(themedRoomOf(world, 3, level)).toEqual(themed)
    }
    expect(found).toBeGreaterThan(45)
    expect([...kinds].sort()).toEqual(['library', 'shrine', 'vault'])
  })

  test('a shrine: an altar in the middle, a brazier two cells each side of it; a library: a lectern in the middle, shelves along the top; a vault: three piles of gold across the middle, a trap each side of the middle one', async () => {
    const want = { shrine: false, library: false, vault: false }
    for (let world = 1; world <= 120 && !(want.shrine && want.library && want.vault); world += 1) {
      const level = generate(world, 3)
      const themed = themedRoomOf(world, 3, level)
      if (themed === undefined) continue
      const r = themed.room
      const mid = { x: r.x + Math.floor(r.w / 2), y: r.y + Math.floor(r.h / 2) }
      const thing = (x: number, y: number) => floorThing(world, 3, level, { x, y })
      if (themed.kind === 'shrine') {
        expect([thing(mid.x, mid.y), thing(mid.x - 2, mid.y), thing(mid.x + 2, mid.y)]).toEqual(['A', 'B', 'B'])
        want.shrine = true
      } else if (themed.kind === 'vault') {
        expect([-2, -1, 0, 1, 2].map(dx => thing(mid.x + dx, mid.y))).toEqual(['$', '^', '$', '^', '$'])
        want.vault = true
      } else {
        expect(thing(mid.x, mid.y)).toBe('R')
        // A rounded library keeps its corners bare: they are rock.
        const isCorner = (x: number) => r.shape === 'rounded' && (x === r.x || x === r.x + r.w - 1)
        for (let x = r.x; x < r.x + r.w; x += 2) expect(thing(x, r.y)).toBe(isCorner(x) ? ' ' : 'L')
        want.library = true
      }
    }
    expect(want).toEqual({ shrine: true, library: true, vault: true })
  })
})

describe('room shapes', () => {
  const cut = (shape: 'cross' | 'L' | 'pillars' | 'rounded' | 'alcoves' | 'island', w: number, h: number) => shapeCut({ x: 0, y: 0, w, h, shape }).map(c => `${c.x},${c.y}`).sort()
  const cells = (xs: number[], ys: number[]) => ys.flatMap(y => xs.map(x => `${x},${y}`)).sort()

  test('a 10 by 5 cross loses a 3 by 1 block at each corner', async () => {
    expect(cut('cross', 10, 5)).toEqual(cells([0, 1, 2, 7, 8, 9], [0, 4]))
  })
  test('an 8 by 4 L loses its top-right quarter, short of the middle row and column', async () => {
    expect(cut('L', 8, 4)).toEqual(cells([5, 6, 7], [0, 1]))
  })
  test('an 8 by 6 pillared hall has a pillar row one in from each long wall, the same spacing from either end', async () => {
    expect(cut('pillars', 8, 6)).toEqual(cells([1, 3, 6], [1, 4]))
  })
  test('a 6 by 4 rounded room loses its four corners', async () => {
    expect(cut('rounded', 6, 4)).toEqual(cells([0, 5], [0, 3]))
  })
  test('a 9 by 4 room with alcoves loses one cell in three along its top and bottom walls, never its middle column', async () => {
    expect(cut('alcoves', 9, 4)).toEqual(cells([0, 3, 6], [0, 3]))
  })
  test('a 10 by 5 island room has a bar of rock either side of its middle row, two in from each end, split at its middle column', async () => {
    expect(cut('island', 10, 5)).toEqual(cells([2, 3, 4, 6, 7], [1, 3]))
  })
  test('a plain room loses nothing', async () => {
    expect(shapeCut({ x: 0, y: 0, w: 8, h: 6 })).toEqual([])
  })

  const all = Array.from({ length: 400 }, (_, i) => ({ world: 1 + (i % 40), depth: 1 + Math.floor(i / 40) }))
  test('every shape shows up over many levels; a shaped room keeps its middle row and column open, and a themed room is plain or rounded', async () => {
    const seen = new Set<string>()
    for (const { world, depth } of all) {
      const level = generate(world, depth)
      for (const room of level.rooms) {
        if (room.shape === undefined) continue
        seen.add(room.shape)
        const mid = { x: room.x + Math.floor(room.w / 2), y: room.y + Math.floor(room.h / 2) }
        for (let x = room.x; x < room.x + room.w; x += 1) expect(isFloor(level.tiles, { x, y: mid.y })).toBe(true)
        for (let y = room.y; y < room.y + room.h; y += 1) expect(isFloor(level.tiles, { x: mid.x, y })).toBe(true)
        // Its shape stands in the map: rock where it was cut, bar a corridor dug through afterwards.
        expect(shapeCut(room).some(c => !isFloor(level.tiles, c))).toBe(true)
      }
      expect([undefined, 'rounded']).toContain(themedRoomOf(world, depth, level)?.room.shape)
    }
    expect([...seen].sort()).toEqual(['L', 'alcoves', 'cross', 'island', 'pillars', 'ragged', 'rounded'])
  })

  test('at least a third of the rooms of a rooms level are shaped', async () => {
    const rooms = all.filter(({ world, depth }) => layoutOf(world, depth) === 'rooms').flatMap(({ world, depth }) => generate(world, depth).rooms)
    expect(rooms.filter(r => r.shape !== undefined).length / rooms.length).toBeGreaterThan(1 / 3)
  })

  test('no shape leaves a dead end inside a room, where a chest would stand', async () => {
    for (const { world, depth } of all) {
      const level = generate(world, depth)
      // A side branch dug for a chest may end in a cut corner: that cell is rock to the room, not its floor.
      const onFloor = (p: { x: number; y: number }) => {
        const room = roomAt(level, p)
        return room !== undefined && !shapeCut(room).some(c => c.x === p.x && c.y === p.y)
      }
      expect(analyze(level).deadEnds.filter(onFloor)).toEqual([])
    }
  })

  test('nothing lies on a cell a shape gave back to rock', async () => {
    for (const { world, depth } of all.slice(0, 100)) {
      const level = generate(world, depth)
      for (const room of level.rooms) for (const c of shapeCut(room)) if (!isFloor(level.tiles, c)) expect(floorThing(world, depth, level, c)).toBe(' ')
    }
  })
})

describe('the themed room by theme', () => {
  const kindsOn = (depths: number[]) => {
    const kinds = new Set<string>()
    for (let world = 1; world <= 80; world += 1) for (const depth of depths) {
      const t = themedRoomOf(world, depth, generate(world, depth))
      if (t !== undefined) kinds.add(t.kind)
    }
    return [...kinds].sort()
  }
  test('each theme its own rooms: springs in the flooded halls and the fungal deep, old anvils in the forge', async () => {
    expect(kindsOn([1, 2, 3, 4, 5])).toEqual(['library', 'shrine', 'vault'])
    expect(kindsOn([6, 7, 8, 9, 10])).toEqual(['library', 'shrine', 'spring', 'vault'])
    expect(kindsOn([11, 12, 13, 14, 15])).toEqual(['shrine', 'spring', 'vault'])
    expect(kindsOn([16, 17, 18, 19, 20])).toEqual(['library', 'shrine', 'vault'])
    expect(kindsOn([21, 22, 23, 24, 25])).toEqual(['anvil', 'library', 'shrine', 'vault'])
  })

  test('a spring in the middle with reeds two cells each side; an anvil in the middle with embers two cells each side, the embers lit', async () => {
    const want = { spring: false, anvil: false }
    for (let world = 1; world <= 120 && !(want.spring && want.anvil); world += 1) for (const depth of [7, 22]) {
      const level = generate(world, depth)
      const t = themedRoomOf(world, depth, level)
      if (t?.kind !== 'spring' && t?.kind !== 'anvil') continue
      const r = t.room
      const mid = { x: r.x + Math.floor(r.w / 2), y: r.y + Math.floor(r.h / 2) }
      const at = (x: number) => floorThing(world, depth, level, { x, y: mid.y })
      expect([at(mid.x - 2), at(mid.x), at(mid.x + 2)]).toEqual(t.kind === 'spring' ? ['Q', 'S', 'Q'] : ['F', 'N', 'F'])
      if (t.kind === 'anvil') expect(braziersOf(world, depth, level)).toEqual([{ x: mid.x - 2, y: mid.y }, { x: mid.x + 2, y: mid.y }])
      want[t.kind] = true
    }
    expect(want).toEqual({ spring: true, anvil: true })
  })
})

describe('layouts', () => {
  const depths = Array.from({ length: 300 }, (_, i) => ({ world: 1 + (i % 60), depth: 2 + Math.floor(i / 60) })).concat(
    Array.from({ length: 600 }, (_, i) => ({ world: 1 + (i % 100), depth: 6 + Math.floor(i / 100) })),
  )
  const of = (layout: Layout) => depths.filter(({ world, depth }) => layoutOf(world, depth) === layout)

  test('depth 1 and every boss depth are plain rooms', async () => {
    for (let world = 1; world <= 50; world += 1) for (const depth of [1, 5, 10, 15, 20]) expect(layoutOf(world, depth)).toBe('rooms')
  })

  test('about half of other depths take another layout, and a theme takes its favorite two times in five of those', async () => {
    const crypt = Array.from({ length: 3000 }, (_, i) => layoutOf(1 + i, 2 + (i % 3)))
    const other = crypt.filter(l => l !== 'rooms')
    expect(Math.abs(other.length / crypt.length - 0.5)).toBeLessThan(0.04)
    expect(Math.abs(other.filter(l => l === 'warrens').length / other.length - 0.4)).toBeLessThan(0.05)
    const flooded = Array.from({ length: 3000 }, (_, i) => layoutOf(1 + i, 6 + (i % 4))).filter(l => l !== 'rooms')
    expect(Math.abs(flooded.filter(l => l === 'caverns').length / flooded.length - 0.4)).toBeLessThan(0.05)
  })

  test('every layout shows up, and every level of every layout can be walked from end to end', async () => {
    for (const layout of ['rooms', 'hall', 'ring', 'warrens', 'caverns'] as const) {
      const levels = of(layout)
      expect(levels.length).toBeGreaterThan(20)
      for (const { world, depth } of levels) {
        const a = analyze(generate(world, depth))
        expect(a.reachable).toBe(a.floor)
        expect(a.pathLength).toBeGreaterThan(0)
      }
    }
  })

  test('a hall level has one great pillared hall, at least 18 by 7, and every room reaches it as straight as it lies', async () => {
    for (const { world, depth } of of('hall')) {
      const level = generate(world, depth)
      const hall = level.rooms[0]!
      expect(hall.w >= 18 && hall.h >= 7 && hall.shape === 'pillars').toBe(true)
      const mid = { x: hall.x + Math.floor(hall.w / 2), y: hall.y + Math.floor(hall.h / 2) }
      for (const room of level.rooms.slice(1)) {
        const from = { x: room.x + Math.floor(room.w / 2), y: room.y + Math.floor(room.h / 2) }
        expect(bfs(level.tiles, from, mid)!.length - 1).toBeLessThanOrEqual(Math.abs(from.x - mid.x) + Math.abs(from.y - mid.y))
      }
    }
  })

  /** The share of levels where one corridor cell on the walk to the stairs, blocked, cuts the hero off from them. */
  const cutOffShare = (layout: Layout) => {
    const levels = of(layout).slice(0, 60)
    const cut = levels.filter(({ world, depth }) => {
      const level = generate(world, depth)
      return bfs(level.tiles, level.start, level.stairs)!.some(c => roomAt(level, c) === undefined && bfs(level.tiles, level.start, level.stairs, c) === null)
    })
    return cut.length / levels.length
  }

  test('a ring level\'s rooms stand around a middle of rock', async () => {
    for (const { world, depth } of of('ring')) {
      const level = generate(world, depth)
      for (let y = 6; y < 12; y += 1) for (let x = 20; x < 44; x += 1) expect(roomAt(level, { x, y })).toBeUndefined()
    }
  })

  test('a ring nearly always leaves a second way to the stairs, where a tree of rooms nearly never does', async () => {
    expect(cutOffShare('ring')).toBeLessThan(0.3)
    expect(cutOffShare('rooms')).toBeGreaterThan(0.8)
  })

  test('warrens are many small rooms: ten or more, none wider than 6 or taller than 4', async () => {
    for (const { world, depth } of of('warrens')) {
      const rooms = generate(world, depth).rooms
      expect(rooms.length).toBeGreaterThanOrEqual(10)
      for (const room of rooms) expect(room.w <= 6 && room.h <= 4).toBe(true)
    }
  })

  test('a ragged wall leaves no dead end inside a room, so caverns hold no more chests than corridors earn', async () => {
    const levels = of('caverns').map(({ world, depth }) => generate(world, depth))
    expect(levels.filter(level => level.rooms.some(r => r.shape === 'ragged')).length / levels.length).toBeGreaterThan(0.9)
    for (const level of levels) for (const end of analyze(level).deadEnds) expect(roomAt(level, end)).toBeUndefined()
  })

  test('a ragged cut takes only edge cells, never on or beside a middle row or column', async () => {
    const room = { x: 3, y: 2, w: 11, h: 7, shape: 'ragged' as const }
    const mid = { x: 8, y: 5 }
    const cut = shapeCut(room)
    expect(cut.length).toBeGreaterThan(0)
    for (const c of cut) {
      expect(c.x === room.x || c.y === room.y || c.x === room.x + room.w - 1 || c.y === room.y + room.h - 1).toBe(true)
      expect(Math.abs(c.x - mid.x) > 1 && Math.abs(c.y - mid.y) > 1).toBe(true)
    }
  })
})

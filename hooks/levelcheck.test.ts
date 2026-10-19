import { describe, expect, test } from 'claude-code/testing'

import { LEVEL_RULES, levelProblems, problemsOf } from './levelcheck'
import { MAP_H, MAP_W, floorThing, generate, themedRoomOf } from './map'
import type { Level, Room } from './map'

/** A level drawn by hand on the map's grid: `rows` at its top-left, rock everywhere else. */
const drawn = (rows: string[], rooms: Room[], start = { x: 1, y: 1 }, stairs = { x: 2, y: 1 }): Level => ({
  tiles: Array.from({ length: MAP_H }, (_, y) => (rows[y] ?? '').padEnd(MAP_W, '#').slice(0, MAP_W)),
  rooms,
  start,
  stairs,
})
const broke = (level: Level) => problemsOf(level, 1, 1).map(p => p.slice(0, p.indexOf(':')))

describe('the rules a level keeps', () => {
  const room = { x: 1, y: 1, w: 4, h: 3 }
  const sound = drawn(['######', '#....#', '#....#', '#....#', '######'], [room])

  test('a sound level breaks none', async () => {
    expect(broke(sound)).toEqual([])
  })

  test('floor the start cannot reach', async () => {
    expect(broke(drawn(['########', '#....#.#', '#....###', '#....#.#', '########'], [room]))).toContain(LEVEL_RULES[0])
  })

  test('stairs the start cannot reach', async () => {
    const level = drawn(['########', '#....#.#', '#....###', '#....###', '########'], [room], { x: 1, y: 1 }, { x: 6, y: 1 })
    expect(broke(level)).toContain(LEVEL_RULES[1])
  })

  test('a dead end on a room\'s floor', async () => {
    // A notch in the room's top wall: the cell left between two cut cells has one way out.
    const level = drawn(['######', '#.#.##', '#....#', '#....#', '######'], [{ x: 1, y: 1, w: 4, h: 3 }])
    expect(broke(level)).toContain(LEVEL_RULES[2])
  })

  test('a shaped room whose middle row is blocked', async () => {
    const level = drawn(['######', '#....#', '#.#..#', '#....#', '######'], [{ x: 1, y: 1, w: 4, h: 3, shape: 'L' }])
    expect(broke(level)).toContain(LEVEL_RULES[3])
  })

  test('something lying on rock: the themed room\'s centrepiece on a cell that is not floor', async () => {
    // Three rooms, the third 5 wide and neither the start's nor the stairs': the themed one, its middle cell rock.
    const rooms = [{ x: 1, y: 1, w: 3, h: 3 }, { x: 12, y: 1, w: 3, h: 3 }, { x: 1, y: 6, w: 5, h: 3 }]
    const level = drawn(['################', '#...#######...##', '#...........#.##', '#...#######...##', '###.############', '###.############', '#.....##########', '#..#..##########', '#.....##########'], rooms, { x: 2, y: 2 }, { x: 13, y: 2 })
    expect(broke(level)).toContain(LEVEL_RULES[4])
  })

  test('the reports name where, a level by world and depth', async () => {
    const said = problemsOf(drawn(['########', '#....#.#', '#....###', '#....#.#', '########'], [room]), 1, 1)
    expect(said[0]).toBe(`${LEVEL_RULES[0]}: 6,1 6,3`)
  })
})

describe('generated levels', () => {
  // A fixed spread of worlds and depths, every layout among them, deep tiers too.
  const sample = Array.from({ length: 240 }, (_, i) => ({ world: 1 + ((i * 7919) % 100000), depth: 1 + ((i * 37) % 150) }))

  test('every one keeps every rule', async () => {
    const broken = sample.flatMap(({ world, depth }) => levelProblems(world, depth).map(p => `${world}:${depth} ${p}`))
    expect(broken).toEqual([])
  })

  test('a rounded room may be the themed one; a library there puts no shelf on a cut corner', async () => {
    let found = 0
    for (let world = 1; world < 4000 && found < 3; world += 1) for (const depth of [3, 8, 13]) {
      const level = generate(world, depth)
      const t = themedRoomOf(world, depth, level)
      if (t?.kind !== 'library' || t.room.shape !== 'rounded') continue
      found += 1
      const r = t.room
      for (const c of [{ x: r.x, y: r.y }, { x: r.x + r.w - 1, y: r.y }]) expect(floorThing(world, depth, level, c)).toBe(' ')
    }
    expect(found).toBe(3)
  })
})

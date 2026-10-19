import { describe, expect, test } from 'claude-code/testing'

import type { Game } from '../types'
import { apply } from './game'
import { MAP_H, MAP_W, cellId, corridorAhead, generate, isFloor, roomAt, visibleFrom } from './map'
import type { Level, Pos, Room } from './map'
import { newGame, reveal } from './world'

const STEPS: readonly Pos[] = [{ x: 1, y: 0 }, { x: -1, y: 0 }, { x: 0, y: 1 }, { x: 0, y: -1 }]
/** The ring of cells just outside a room's sides, corners left out. */
const cellsAround = (r: Room): Pos[] => [
  ...Array.from({ length: r.w }, (_, i) => [{ x: r.x + i, y: r.y - 1 }, { x: r.x + i, y: r.y + r.h }]).flat(),
  ...Array.from({ length: r.h }, (_, i) => [{ x: r.x - 1, y: r.y + i }, { x: r.x + r.w, y: r.y + i }]).flat(),
]

// Two rooms joined by a corridor along row 2, with a junction at x 8 and a branch down to a dead end at (8, 5).
//   0123456789012345
// 0 #################
// 1 #...#########...#
// 2 #...............#
// 3 #...####.####...#
// 4 ########.########
// 5 ########.########
const ROWS = ['#################', '#...#########...#', '#...............#', '#...####.####...#', '########.########', '########.########', '#################']
const LEVEL: Level = {
  tiles: Array.from({ length: MAP_H }, (_, y) => (ROWS[y] ?? '').padEnd(MAP_W, '#').slice(0, MAP_W)),
  rooms: [{ x: 1, y: 1, w: 3, h: 3 }, { x: 13, y: 1, w: 3, h: 3 }],
  start: { x: 1, y: 1 },
  stairs: { x: 14, y: 2 },
}
/** The floor cells learnt from `p`, as "x,y", sorted. */
const floorFrom = (p: Pos) => [...new Set(corridorAhead(LEVEL, p).filter(c => LEVEL.tiles[c.y]![c.x] === '.').map(c => `${c.x},${c.y}`))].sort()
const row2 = (...xs: number[]) => xs.map(x => `${x},2`)

describe('the corridor a hero in it learns at once', () => {
  test('from just inside it, every cell up to the junction and the junction, no further', async () => {
    expect(floorFrom({ x: 5, y: 2 })).toEqual(row2(5, 6, 7, 8).sort())
  })

  test('past the junction, up to the cell beside the next room, that door kept back, and the room unseen', async () => {
    expect(floorFrom({ x: 9, y: 2 })).toEqual(row2(8, 9, 10, 11).sort())
  })

  test('down a branch, the dead end\'s chest kept back; from the junction itself every way out of it', async () => {
    expect(floorFrom({ x: 8, y: 3 })).toEqual(['8,2', '8,3', '8,4'])
    expect(floorFrom({ x: 8, y: 2 })).toEqual([...row2(5, 6, 7, 8, 9, 10, 11), '8,3', '8,4'].sort())
  })

  test('with its walls: the rock either side of a learnt cell', async () => {
    const cells = corridorAhead(LEVEL, { x: 5, y: 2 }).map(c => `${c.x},${c.y}`)
    expect([cells.includes('6,1'), cells.includes('6,3')]).toEqual([true, true])
  })

  test('nothing in a room', async () => {
    expect(corridorAhead(LEVEL, { x: 2, y: 2 })).toEqual([])
  })
})

describe('a room', () => {
  test('is seen whole from its door, and not from a cell before it', async () => {
    // (12, 2) is the door into the right room; (11, 2) the cell before it.
    const fromDoor = new Set(visibleFrom(LEVEL, { x: 12, y: 2 }).map(c => `${c.x},${c.y}`))
    const room = ['13,1', '14,1', '15,1', '13,2', '14,2', '15,2', '13,3', '14,3', '15,3']
    expect(room.every(c => fromDoor.has(c))).toBe(true)
    const before = new Set(visibleFrom(LEVEL, { x: 11, y: 2 }).map(c => `${c.x},${c.y}`))
    expect(room.filter(c => before.has(c))).toEqual([])
    // The door's own ring around it, too, as from any corridor cell.
    expect(['11,1', '11,3'].every(c => fromDoor.has(c))).toBe(true)
  })
})

describe('in play', () => {
  test('a step into a corridor learns it, and one click then walks the hero to its far learnt end', async () => {
    let checked = 0
    for (let world = 1; world <= 20 && checked < 5; world += 1) {
      const level = generate(world, 1)
      // A corridor cell beside a room cell, the way into it from that room, and a long stretch ahead.
      for (const room of level.rooms) {
        const door = cellsAround(room).find(c => isFloor(level.tiles, c) && roomAt(level, c) === undefined)
        if (door === undefined) continue
        const inRoom = STEPS.map(d => ({ x: door.x + d.x, y: door.y + d.y })).find(c => roomAt(level, c) === room)!
        const ahead = corridorAhead(level, door).filter(c => isFloor(level.tiles, c) && roomAt(level, c) === undefined)
        const far = ahead.sort((a, b) => Math.abs(b.x - door.x) + Math.abs(b.y - door.y) - (Math.abs(a.x - door.x) + Math.abs(a.y - door.y)))[0]
        if (far === undefined || Math.abs(far.x - door.x) + Math.abs(far.y - door.y) < 4) continue
        const g0 = { ...newGame(world), world, depth: 1, foe: null }
        const g: Game = { ...g0, x: inRoom.x, y: inRoom.y, seen: reveal(g0.seen, visibleFrom(level, inRoom)) }
        const stepped = apply(g, { kind: 'move', dx: door.x - inRoom.x, dy: door.y - inRoom.y })
        expect([stepped.x, stepped.y]).toEqual([door.x, door.y])
        for (const c of ahead) expect(stepped.seen[cellId(c)]).toBe('1')
        const walked = apply(stepped, { kind: 'goto', ...far })
        expect([walked.x, walked.y]).toEqual([far.x, far.y])
        checked += 1
        break
      }
    }
    expect(checked).toBe(5)
  })
})

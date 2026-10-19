import { describe, expect, test } from 'claude-code/testing'

import { TERRAIN, PX } from './pixelart'
import { isPillar, terrainOf } from './pixels'
import { generate, isFloor, layoutOf, MAP_H, MAP_W } from './map'
import { surfaceOf } from './panels'
import type { Tile } from './panels'

/** A hall level: one great pillared hall. */
const hallLevel = () => {
  for (let world = 1; world < 400; world += 1) for (let depth = 2; depth < 40; depth += 1) if (layoutOf(world, depth) === 'hall') return generate(world, depth)
  throw new Error('no hall level')
}
const cells = Array.from({ length: MAP_W * MAP_H }, (_, i) => ({ x: i % MAP_W, y: Math.floor(i / MAP_W) }))

describe('pillars', () => {
  const level = hallLevel()
  const pillars = cells.filter(p => isPillar(level, p))

  test('a hall has them: rock with floor on all four sides, each a wall to the rules', async () => {
    expect(pillars.length).toBeGreaterThan(3)
    for (const p of pillars) expect(surfaceOf(level, p)).toBe('wall')
  })

  test('a wall along a room is no pillar, nor is floor with floor all round it', async () => {
    const edge = cells.find(p => surfaceOf(level, p) === 'wall' && !isPillar(level, p))
    expect(edge).toBeDefined()
    const open = cells.find(p => [[0, 0], [1, 0], [-1, 0], [0, 1], [0, -1]].every(([dx, dy]) => isFloor(level.tiles, { x: p.x + dx!, y: p.y + dy! })))!
    expect(isPillar(level, open)).toBe(false)
  })

  test('rock needs floor on all four sides: floor only left and right, or only above and below, is a wall', async () => {
    const tiles = (rows: string[]) => ({ tiles: rows } as unknown as Parameters<typeof isPillar>[0])
    expect(isPillar(tiles(['...', '.#.', '...']), { x: 1, y: 1 })).toBe(true)
    expect(isPillar(tiles(['###', '.#.', '...']), { x: 1, y: 1 })).toBe(false)
    expect(isPillar(tiles(['.#.', '.#.', '.#.']), { x: 1, y: 1 })).toBe(false)
  })

  test('the map draws a pillar with the pillar texture, and a wall along a room with the wall\'s', async () => {
    const as = (p: { x: number; y: number }) => terrainOf(level, { surface: surfaceOf(level, p) } as Tile, p)
    expect(pillars.map(as).every(k => k === 'pillar')).toBe(true)
    const edge = cells.find(p => surfaceOf(level, p) === 'wall' && !isPillar(level, p))!
    expect(as(edge)).toBe('wall')
  })

  test('drawn as a column on the floor: the floor shows at its corners, its shaft lit left and shaded right, and no wall brick', async () => {
    const at = (lx: number, ly: number) => TERRAIN.pillar(3 * PX + lx, 2 * PX + ly)
    const floorAt = (lx: number, ly: number) => TERRAIN.floor(3 * PX + lx, 2 * PX + ly)
    expect([at(0, 3), at(7, 3), at(0, 0)]).toEqual([floorAt(0, 3), floorAt(7, 3), floorAt(0, 0)])
    expect(at(2, 3)).not.toBe(at(5, 3))
    const tile = Array.from({ length: PX * PX }, (_, i) => TERRAIN.pillar(3 * PX + (i % PX), 2 * PX + Math.floor(i / PX)))
    const wall = Array.from({ length: PX * PX }, (_, i) => TERRAIN.wall(3 * PX + (i % PX), 2 * PX + Math.floor(i / PX)))
    expect(tile.filter((c, i) => c === wall[i]).length).toBeLessThan(PX * 2)
  })
})

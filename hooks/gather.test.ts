import { describe, expect, test } from 'claude-code/testing'

import type { Game } from '../types'
import { apply } from './game'
import { plainHero } from './fixtures'
import { GATHERABLE, MAP_H, MAP_W, floorThing, generate, isFloor, roomAt, same, themeOf } from './map'
import type { Pos } from './map'
import { CONSUMABLES, KINDS, STACK_MAX, slotOf } from './consumables'
import { arrive } from './world'

const cells = Array.from({ length: MAP_W * MAP_H }, (_, i) => ({ x: i % MAP_W, y: Math.floor(i / MAP_W) }))
const STEPS = [[1, 0], [-1, 0], [0, 1], [0, -1]] as const
const rock = (level: ReturnType<typeof generate>, p: Pos) => STEPS.filter(([dx, dy]) => !isFloor(level.tiles, { x: p.x + dx, y: p.y + dy })).length
const DEPTHS = { crypt: 2, flooded: 7, fungal: 12, frozen: 17, forge: 22 } as const

/** A hero on `depth` of `world` beside the first thing to gather there, and the step onto it; none if the level has none. */
const besideOne = (world: number, depth: number): { g: Game; dx: number; dy: number } | undefined => {
  const g0 = { ...plainHero(world), world }
  const g: Game = { ...g0, ...arrive(world, depth), depth, deepest: depth, foe: null }
  const level = generate(world, depth)
  for (const p of cells) {
    if (floorThing(world, depth, level, p) !== GATHERABLE[themeOf(depth)]) continue
    const from = STEPS.map(([dx, dy]) => ({ x: p.x - dx, y: p.y - dy, dx, dy })).find(q => isFloor(level.tiles, q) && floorThing(world, depth, level, q) === ' ' && !same(q, level.stairs))
    if (from !== undefined) return { g: { ...g, x: from.x, y: from.y }, dx: from.dx, dy: from.dy }
  }
  return undefined
}
const firstBeside = (depth: number) => Array.from({ length: 30 }, (_, i) => besideOne(i + 1, depth)).find(b => b !== undefined)!

describe('things to gather', () => {
  test('each theme has its own, lying only in rooms, by a wall, about one a level', async () => {
    let found = 0
    let levels = 0
    for (const [theme, depth] of Object.entries(DEPTHS)) {
      for (let world = 1; world <= 40; world += 1) {
        const level = generate(world, depth)
        levels += 1
        for (const p of cells) {
          const thing = floorThing(world, depth, level, p)
          if (!Object.values(GATHERABLE).includes(thing)) continue
          expect(thing).toBe(GATHERABLE[theme as keyof typeof DEPTHS])
          expect([roomAt(level, p) !== undefined, rock(level, p) > 0]).toEqual([true, true])
          found += 1
        }
      }
    }
    expect(new Set(Object.values(GATHERABLE)).size).toBe(5)
    expect(found / levels).toBeGreaterThan(0.7)
    expect(found / levels).toBeLessThan(1.6)
  })

  test('stepped onto, it goes onto the belt as its theme\'s kind at a tier for the depth, is said, and is gone', async () => {
    const kinds = { crypt: 'ward', flooded: 'regen', fungal: 'regen', frozen: 'ward', forge: 'smoke' } as const
    const from = { crypt: 'the warding stone', flooded: 'the reeds', fungal: 'the glowing caps', frozen: 'the rime crystal', forge: 'the powder keg' } as const
    for (const [theme, depth] of Object.entries(DEPTHS) as [keyof typeof DEPTHS, number][]) {
      const { g, dx, dy } = firstBeside(depth)
      const next = apply(g, { kind: 'move', dx, dy })
      const slot = next.belt[slotOf(kinds[theme])]
      expect(slot?.kind).toBe(kinds[theme])
      const tier = slot!.tiers.findIndex(n => n > 0) + 1
      expect(next.log.at(-1)).toMatch(new RegExp(`^You gather an? ${CONSUMABLES[kinds[theme]][tier as 1 | 2 | 3].name} from ${from[theme]}\\.$`))
      // Walked away and back, there is nothing left to take.
      const back = apply(apply(next, { kind: 'move', dx: -dx, dy: -dy }), { kind: 'move', dx, dy })
      expect(back.belt[slotOf(kinds[theme])]).toEqual(slot)
    }
  })

  test('a deep one is likelier the better tier: over depths 2 and 47 of many worlds, tier III only deep', async () => {
    const tiers = (depth: number) => Array.from({ length: 30 }, (_, i) => besideOne(i + 1, depth)).flatMap(b => {
      if (b === undefined) return []
      const next = apply(b.g, { kind: 'move', dx: b.dx, dy: b.dy })
      return KINDS.flatMap(k => next.belt[slotOf(k)]?.tiers.findIndex(n => n > 0) ?? -1).filter(t => t >= 0).map(t => t + 1)
    })
    const shallow = tiers(2)
    const deep = tiers(47)
    expect(shallow.filter(t => t === 3).length / shallow.length).toBeLessThan(0.15)
    expect(deep.filter(t => t === 3).length / deep.length).toBeGreaterThan(0.15)
  })

  test('an Aegis Rune is gathered with "an", a Ward Rune with "a"', async () => {
    // Depth 42 is the frozen caverns, deep enough for tier III.
    const lines = Array.from({ length: 30 }, (_, i) => besideOne(i + 1, 42)).flatMap(b => (b === undefined ? [] : [apply(b.g, { kind: 'move', dx: b.dx, dy: b.dy }).log.at(-1)!]))
    expect(lines).toContain('You gather an Aegis Rune from the rime crystal.')
    expect(lines.some(l => l === 'You gather a Ward Rune from the rime crystal.' || l === 'You gather a Greater Ward Rune from the rime crystal.')).toBe(true)
  })

  test('with its tier full on the belt, it is left where it lies, said, and taken later once there is room', async () => {
    const { g, dx, dy } = firstBeside(DEPTHS.forge)
    const full: Game = { ...g, belt: g.belt.map((s, i) => (i === slotOf('smoke') ? { kind: 'smoke', tiers: [STACK_MAX, STACK_MAX, STACK_MAX] } : s)) }
    const refused = apply(full, { kind: 'move', dx, dy })
    expect(refused.log.at(-1)).toMatch(/^Your belt has no room for the .+ the powder keg offers\.$/)
    expect(refused.belt[slotOf('smoke')]?.tiers).toEqual([STACK_MAX, STACK_MAX, STACK_MAX])
    const roomy: Game = { ...refused, belt: g.belt }
    const away = apply(roomy, { kind: 'move', dx: -dx, dy: -dy })
    expect(apply(away, { kind: 'move', dx, dy }).log.at(-1)).toMatch(/^You gather an? .+ from the powder keg\.$/)
  })
})

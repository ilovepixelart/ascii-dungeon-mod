import { describe, expect, test } from 'claude-code/testing'

import { apply, newGame } from './game'
import type { Consumable, Game } from '../types'
import { KINDS } from './consumables'
import { foeAhead, plainHero } from './fixtures'
import { beltAid, drawnVsTold, isJump, simulate } from './sim'
import { MARKS, tierOf } from './deep'
import { bfs } from './map'
import { TOWN_SPOTS, pathBeside } from './town'
import { levelOf } from './world'

describe('what the map draws against what the strip and log tell', () => {
  test('a walk over gold and a potion: on every tile the map and the strip agree', async () => {
    // On depth 1 of world 1, the row y 4 holds gold at x 50 and a potion at x 51.
    const g = { ...newGame(), seen: '1'.repeat(64 * 18), x: 48, y: 4 }
    const plan = apply(g, { kind: 'goto', x: 55, y: 4 })
    expect(drawnVsTold(g, plan)).toBe(0)
  })

  test('over simulated games of every class, not one walk tile where they disagree', { timeoutMs: 20000 }, async () => {
    for (const cls of ['knight', 'mage', 'rogue'] as const) for (const seed of [1, 2]) expect(simulate(seed, 600, cls).stats).toMatchObject({ drawnUntold: 0, cutsAstray: 0, jumps: 0, sightBreaks: 0 })
  })
})

/** The first of a few seeds whose run gets as far as `reached` says: any one shows what the player does there. */
const firstRun = (steps: number, reached: (run: ReturnType<typeof simulate>) => boolean) =>
  [1, 2, 3, 4, 5, 6].map(seed => simulate(seed, steps, 'knight')).find(reached)

test('the simulated player picks a talent once one is owed', { timeoutMs: 20000 }, async () => {
  const run = firstRun(1500, r => r.final.level >= 10)!
  expect(run).toBeDefined()
  expect(run.final.talents?.length).toBe(Math.floor(run.final.level / 10))
})

test('the simulated player chooses a mark at every fork it reaches', { timeoutMs: 60000 }, async () => {
  // A run that reached a second tier and took a harder mark there: the stairs alone take only the easier.
  const run = firstRun(8000, r => tierOf(r.final.deepest) >= 2 && Object.values(r.final.marks ?? {}).some(m => MARKS[m].hard === true))!
  expect(run).toBeDefined()
  expect(Object.keys(run.final.marks ?? {}).map(Number)).toEqual(Array.from({ length: tierOf(run.final.deepest) }, (_, i) => i + 1))
  // The stairs take only the easier: a harder one was chosen.
  expect(Object.values(run.final.marks ?? {}).some(m => MARKS[m].hard === true)).toBe(true)
})

describe('the rest of the belt, as the simulated player reaches for it', () => {
  const belt = (...kinds: Consumable[]) => KINDS.map(k => (kinds.includes(k) ? { kind: k, tiers: [1, 0, 0] as [number, number, number] } : null))
  /** A hero of 20 HP at `hp`, holding `kinds`, facing a foe of attack `atk` (none at 0); its defense is 0. */
  const at = (hp: number, atk: number, ...kinds: Consumable[]): Game => {
    const g = { ...plainHero(), hp, belt: belt(...kinds) }
    return { ...g, foe: atk === 0 ? null : foeAhead(g, 1, { atk }) }
  }
  const smoke = { kind: 'use', slot: 4 }
  const ward = { kind: 'use', slot: 3 }
  const herb = { kind: 'use', slot: 1 }

  test('smoke out of a fight under a quarter of max HP with no healing; not with healing, nor at a quarter', async () => {
    expect(beltAid(at(4, 2, 'smoke'))).toEqual(smoke)
    expect(beltAid(at(4, 2, 'smoke', 'health'))).toBeUndefined()
    expect(beltAid(at(5, 2, 'smoke'))).toBeUndefined()
  })

  test('a ward against a foe that is not easy, once: not while one is up, nor against an easy foe', async () => {
    // 20 HP against an attack of 4 is 5 hits, tough; against 3, 7 hits, easy.
    expect(beltAid(at(20, 4, 'ward'))).toEqual(ward)
    expect(beltAid({ ...at(20, 4, 'ward'), effects: { ...plainHero().effects, ward: 1 } })).toBeUndefined()
    expect(beltAid(at(20, 3, 'ward'))).toBeUndefined()
  })

  test('herbs with no foe about, under 70% of max HP, none already working', async () => {
    expect(beltAid(at(13, 0, 'regen'))).toEqual(herb)
    expect(beltAid(at(14, 0, 'regen'))).toBeUndefined()
    expect(beltAid({ ...at(13, 0, 'regen'), effects: { ...plainHero().effects, regen: 2 } })).toBeUndefined()
    expect(beltAid(at(13, 2, 'regen'))).toBeUndefined()
  })
})

test('the simulated player uses herbs, scrolls and runes as well as potions', { timeoutMs: 60000 }, async () => {
  const runs = (['knight', 'mage', 'rogue'] as const).flatMap(cls => [1, 2, 3].map(seed => simulate(seed, 2000, cls).stats))
  const used = (key: 'potionsUsed' | 'herbsUsed' | 'scrollsUsed' | 'wardsUsed' | 'bombsUsed') => runs.reduce((n, s) => n + s[key], 0)
  // Bombs only once healing has run out, which few runs reach; their rule is held above.
  expect([used('potionsUsed') > 0, used('herbsUsed') > 0, used('scrollsUsed') > 0, used('wardsUsed') > 0]).toEqual([true, true, true, true])
})

describe('moves the pane can play', () => {
  const seen = (g: Game): Game => ({ ...g, seen: '1'.repeat(g.seen.length) })

  test('a click on the stairs from four tiles off walks there before the descent: no jump', async () => {
    const g0 = seen(newGame())
    const level = levelOf(g0)
    const way = bfs(level.tiles, g0, level.stairs)!
    const from = way[way.length - 5]!
    const g = { ...g0, x: from.x, y: from.y }
    const action = { kind: 'goto', ...level.stairs } as const
    const next = apply(g, action)
    expect(next.depth).toBe(2)
    expect(isJump(g, next, action)).toBe(false)
    // The same descent with its walk dropped is the jump.
    expect(isJump(g, { ...next, walked: [] }, action)).toBe(true)
  })

  test('a click on the stairs while on them, or on the portal while beside it, needs no walk', async () => {
    const g0 = seen(newGame())
    const level = levelOf(g0)
    const onStairs = { ...g0, ...level.stairs }
    const down = { kind: 'goto', ...level.stairs } as const
    expect(isJump(onStairs, apply(onStairs, down), down)).toBe(false)
    const town = apply(g0, { kind: 'portal' })
    const spot = pathBeside(town, TOWN_SPOTS.portal)!.at(-1)!
    const beside = { ...town, x: spot.x, y: spot.y }
    const out = { kind: 'goto', ...TOWN_SPOTS.portal } as const
    const back = apply(beside, out)
    expect([beside.where, back.where]).toEqual(['town', 'dungeon'])
    expect(isJump(beside, back, out)).toBe(false)
  })

  test('a step within a level is a jump only when no walk ends where the hero stands', async () => {
    const g = seen(newGame())
    const action = { kind: 'explore', steps: 3 } as const
    const next = apply(g, action)
    expect(isJump(g, next, action)).toBe(false)
    expect(isJump(g, { ...next, walked: next.walked.slice(0, -1) }, action)).toBe(true)
  })
})

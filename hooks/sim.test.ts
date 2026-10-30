import { describe, expect, test } from 'claude-code/testing'

import { apply, gambleCost, newGame } from './game'
import type { Consumable, Game } from '../types'
import { KINDS } from './consumables'
import { foeAhead, fullTab, plainHero } from './fixtures'
import { beltAid, drawnVsTold, isJump, isUnexplainedClick, sightBreaks, simulate, townMove } from './sim'
import { forkTier, MARKS, tierOf } from './deep'
import { bfs, isFloor, roomAt, visibleFrom } from './map'
import { TOWN_SPOTS, pathBeside } from './town'
import { FOG, arrive, levelOf, reveal } from './world'

describe('what the map draws against what the strip and log tell', () => {
  test('a walk over gold and a potion: on every tile the map and the strip agree', async () => {
    // On depth 1 of world 1, the row y 4 holds gold at x 50 and a potion at x 51.
    const g = { ...newGame(), seen: '1'.repeat(64 * 18), x: 48, y: 4 }
    const plan = apply(g, { kind: 'goto', x: 55, y: 4 })
    expect(drawnVsTold(g, plan)).toBe(0)
  })

  test('over simulated games of every class, not one walk tile where they disagree', { timeoutMs: 20000 }, async () => {
    for (const cls of ['knight', 'mage', 'rogue'] as const) for (const seed of [1, 2]) expect(simulate(seed, 600, cls).stats).toMatchObject({ drawnUntold: 0, cutsAstray: 0, jumps: 0, sightBreaks: 0, blowsUntold: 0, outOfView: 0 })
  })
})

/** The first of a few seeds whose run gets as far as `reached` says: any one shows what the player does there. */
/** The first of six knights' games to reach a state: only played (`checks: false`), the walk test above holding them to the rules. */
const firstRun = (steps: number, reached: (run: ReturnType<typeof simulate>) => boolean) =>
  [1, 2, 3, 4, 5, 6].map(seed => simulate(seed, steps, 'knight', { checks: false })).find(reached)

test('the simulated player picks a talent once one is owed', { timeoutMs: 20000 }, async () => {
  const run = firstRun(1500, r => r.final.level >= 5)!
  expect(run).toBeDefined()
  // One every fifth level.
  expect(run.final.talents?.length).toBe(Math.floor(run.final.level / 5))
})

test('the simulated player chooses a mark at every fork it reaches', { timeoutMs: 60000 }, async () => {
  // A run that reached a second tier and took a harder mark there: the stairs alone take only the easier.
  const run = firstRun(8000, r => tierOf(r.final.deepest) >= 2 && Object.values(r.final.marks ?? {}).some(m => MARKS[m].hard === true))!
  expect(run).toBeDefined()
  // Every circle reached has its mark, and so has the next when its fork opened, the deepest circle's warden slain.
  const reached = Math.max(tierOf(run.final.deepest), forkTier(run.final) ?? 0)
  expect(Object.keys(run.final.marks ?? {}).map(Number)).toEqual(Array.from({ length: reached }, (_, i) => i + 1))
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

  test('fury against a deadly foe, none already burning; not against a tough one', async () => {
    // 20 HP against an attack of 7 is 3 hits, deadly; against 4, 5 hits, tough.
    const fury = { kind: 'use', slot: 2 }
    expect(beltAid(at(20, 7, 'fury'))).toEqual(fury)
    expect(beltAid({ ...at(20, 7, 'fury'), effects: { ...plainHero().effects, fury: 3 } })).toBeUndefined()
    expect(beltAid(at(20, 4, 'fury'))).toBeUndefined()
  })

  test('herbs with no foe about, under 70% of max HP, none already working', async () => {
    expect(beltAid(at(13, 0, 'regen'))).toEqual(herb)
    expect(beltAid(at(14, 0, 'regen'))).toBeUndefined()
    expect(beltAid({ ...at(13, 0, 'regen'), effects: { ...plainHero().effects, regen: 2 } })).toBeUndefined()
    expect(beltAid(at(13, 2, 'regen'))).toBeUndefined()
  })
})

test('the simulated player uses herbs and runes as well as potions', { timeoutMs: 60000 }, async () => {
  const runs = (['knight', 'mage', 'rogue'] as const).flatMap(cls => [1, 2, 3].map(seed => simulate(seed, 2000, cls, { checks: false }).stats))
  const used = (key: 'potionsUsed' | 'herbsUsed' | 'scrollsUsed' | 'wardsUsed' | 'bombsUsed') => runs.reduce((n, s) => n + s[key], 0)
  // Bombs only once healing has run out and fury only against a deadly foe, which short runs may not meet; both rules are held above.
  expect([used('potionsUsed') > 0, used('herbsUsed') > 0, used('wardsUsed') > 0]).toEqual([true, true, true])
})

test('in town with a full bag and gold for packs, the simulated player still goes back down', async () => {
  // Every cell of the bag holds a locked ring, so no pack fits and the guard takes none; no gear, so the smith has no
  // work; a fortune already read, a quest under way and healing enough. What is left is the villager, who refuses a
  // pack to a full bag every time.
  const town = apply(newGame(4), { kind: 'portal' })
  const bag = fullTab(500).map(i => ({ ...i, locked: true as const }))
  const belt = town.belt.map((s, i) => (i === 0 ? { kind: 'health' as const, tiers: [5, 0, 0] as [number, number, number] } : s))
  let g: Game = {
    ...town,
    bag,
    belt,
    gear: {},
    gold: 3 * gambleCost(town) + 1,
    panel: 'villager',
    fortune: { kind: 'luck', depth: town.depth },
    quest: { kind: 'slay', depth: 1, need: 5, have: 0 },
  }
  let seed = 7
  const d = (n: number) => {
    seed = (seed * 1103515245 + 12345) % 2147483648
    return (seed % n) + 1
  }
  for (let move = 0; move < 300 && g.where === 'town'; move += 1) g = apply(g, townMove(g, d)!)
  expect(g.where).toBe('dungeon')
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

test('a click on a foe that comes to nothing is explained by what the blow did; one that ends short and says nothing is not', async () => {
  const click = (said: string[]) => ({
    step: 1, action: { kind: 'goto' as const, x: 5, y: 3 }, from: { x: 4, y: 3 }, hero: { x: 4, y: 3, hp: 9, maxHp: 20, depth: 3, level: 2 },
    foe: { name: 'rat', hp: 4, x: 5, y: 3 }, said, broke: [],
  })
  for (const line of ['The rat darts aside.', 'The goblin\'s shield turns your blow.', 'You swing at the darkness.', 'The wraith fades into the dark; your blow passes through.']) {
    expect(isUnexplainedClick(click([line]))).toBe(false)
  }
  expect(isUnexplainedClick(click([]))).toBe(true)
  expect(isUnexplainedClick(click(['Loot: Health Potion.']))).toBe(true)
})

test('the sight check takes an arena and the rooms it grew over as one space: stepping in, all of it shows, no break', async () => {
  const g = plainHero(1)
  let checked = 0
  for (const depth of [10, 20, 30, 40, 50, 60]) {
    const level = levelOf({ world: g.world, depth })
    for (const room of level.rooms) for (let y = room.y; y < room.y + room.h; y += 1) for (let x = room.x; x < room.x + room.w; x += 1) {
      // A cell counted in this room though it lies in another too: where an arena meets a room it grew over.
      const p = { x, y }
      if (!isFloor(level.tiles, p) || roomAt(level, p) !== room || !level.rooms.some(r => r !== room && x >= r.x && x < r.x + r.w && y >= r.y && y < r.y + r.h)) continue
      const before = { ...g, ...arrive(g.world, depth), depth, ...p, walked: [] }
      const next = { ...before, seen: reveal(before.seen, visibleFrom(level, p)) }
      expect(sightBreaks(before, next)).toEqual([])
      checked += 1
    }
  }
  expect(checked).toBeGreaterThan(0)
})

describe('the sight check catches what sight must not show', () => {
  // World 147926526 depth 15: the corridor on row 3 passes the cut top right corner of a cross room at 10,4, rock
  // between; a chest stands at 48,3, far off. The hero walks from 20,3 to 18,3.
  const world = 147926526
  const depth = 15
  const level = levelOf({ world, depth })
  const before = { ...plainHero(1), world, depth, where: 'dungeon' as const, x: 20, y: 3, walked: [], taken: [], seen: reveal(FOG, visibleFrom(level, { x: 20, y: 3 })) }
  const walk = { ...before, x: 18, y: 3, walked: [{ x: 19, y: 3 }, { x: 18, y: 3 }] }
  const honest = { ...walk, seen: reveal(before.seen, visibleFrom(level, { x: 18, y: 3 })) }
  const box = (r: { x: number; y: number; w: number; h: number }) => Array.from({ length: r.w * r.h }, (_, i) => ({ x: r.x + (i % r.w), y: r.y + Math.floor(i / r.w) }))

  test('the walk as sight has it breaks nothing', async () => {
    expect(sightBreaks(before, honest)).toEqual([])
  })

  test('a room shown from beside its cut corner, rock between, is a break', async () => {
    const cross = level.rooms.find(r => r.x === 10 && r.y === 4)!
    expect(sightBreaks(before, { ...honest, seen: reveal(honest.seen, box(cross)) }).length).toBeGreaterThan(0)
  })

  test('a far chest shown while the hero stands in a room is a break', async () => {
    const inRoom = { ...before, x: 14, y: 6, seen: reveal(FOG, visibleFrom(level, { x: 14, y: 6 })) }
    expect(roomAt(level, { x: 14, y: 6 })?.x).toBe(10)
    expect(sightBreaks(inRoom, { ...inRoom, seen: reveal(inRoom.seen, [{ x: 48, y: 3 }]) })).toEqual([{ x: 48, y: 3 }])
  })
})

describe('the simulator played another way', () => {
  test('with a build, every point the hero trains goes to that attribute', { timeoutMs: 20000 }, async () => {
    const start = newGame(3, 'knight').stats
    const { final } = simulate(3, 1500, 'knight', { build: 'might' })
    expect(final.level).toBeGreaterThan(3)
    expect({ focus: final.stats.focus, vigor: final.stats.vigor, insight: final.stats.insight }).toEqual({ focus: start.focus, vigor: start.vigor, insight: start.insight })
    expect(final.stats.might).toBeGreaterThan(start.might)
  })

  test('by hand, the game is set to hand play and no tool call or answer comes, yet the hero goes down', { timeoutMs: 20000 }, async () => {
    const { records, final } = simulate(5, 1500, 'rogue', { byHand: true })
    const session = records.filter(r => ['explore', 'summon', 'ally', 'outcome', 'descend', 'answer', 'quest'].includes(r.action.kind))
    expect(session).toEqual([])
    expect(final.orders?.play).toBe('hand')
    expect(final.deepest).toBeGreaterThan(1)
  })

  test('given talents, the hero has them from the first step', async () => {
    const { final } = simulate(2, 5, 'mage', { talents: ['secondWind', 'opener'] })
    expect(final.talents).toEqual(['secondWind', 'opener'])
  })

  test('with calls per answer set, each answer has that many tool calls', { timeoutMs: 20000 }, async () => {
    const { records } = simulate(4, 600, 'knight', { calls: { least: 2, most: 2 } })
    const perAnswer: number[] = []
    let calls = 0
    for (const r of records) {
      if (r.action.kind === 'outcome') calls += 1
      if (r.action.kind === 'answer') {
        perAnswer.push(calls)
        calls = 0
      }
    }
    expect(perAnswer.length).toBeGreaterThan(5)
    expect(new Set(perAnswer)).toEqual(new Set([2]))
  })
})

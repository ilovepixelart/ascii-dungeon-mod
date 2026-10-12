import { describe, expect, test } from 'claude-code/testing'

import type { Game } from '../types'
import { DEPTH_MODS, MOD_SAID, apply, bandOf, depthMod, isBossDepth, levelOf } from './game'
import { chestAt, floorThing, generate, isFloor } from './map'
import type { DepthMod } from './game'
import { foeAtk, foeHp } from './balance'
import { foeAhead, plainHero } from './fixtures'
import { arrive } from './world'

const WORLD = 4
/** The first depth past `from` with this twist, in WORLD. */
const depthWith = (mod: DepthMod, from = 2) => {
  for (let d = from; d < 500; d += 1) if (depthMod(WORLD, d) === mod) return d
  throw new Error(`no ${mod} depth`)
}
const plainDepth = (from = 2) => {
  for (let d = from; d < 500; d += 1) if (depthMod(WORLD, d) === undefined && !isBossDepth(d)) return d
  throw new Error('no plain depth')
}
/** The plain hero at the start of `depth` in WORLD, on its floor. */
// Every band's unique slain: on its depth it would come before any foe these tests count.
const at = (depth: number, over: Partial<Game> = {}): Game => ({ ...plainHero(WORLD), world: WORLD, ...arrive(WORLD, depth), deepest: depth, uniquesSlain: Array.from({ length: 100 }, (_, i) => i), ...over })
const BESTIARY = 'rgkosTWD'
/** Many foes summoned on a depth, each from a fresh fight. */
const foesOn = (depth: number, n: number) => {
  let g = at(depth)
  return Array.from({ length: n }, () => {
    g = apply({ ...g, foe: null, tension: 0, calm: 0 }, { kind: 'summon', name: 'ls' })
    return g.foe!
  })
}

describe('which depths have a twist', () => {
  test('none on depth 1 or a boss depth; about 40 in 100 of the rest; each twist turns up; a depth keeps its own', async () => {
    expect(depthMod(WORLD, 1)).toBeUndefined()
    for (const d of [5, 10, 15, 20, 50]) expect(depthMod(WORLD, d)).toBeUndefined()
    const depths = Array.from({ length: 400 }, (_, i) => i + 2).filter(d => !isBossDepth(d))
    const twisted = depths.filter(d => depthMod(WORLD, d) !== undefined)
    expect(twisted.length / depths.length).toBeGreaterThan(0.33)
    expect(twisted.length / depths.length).toBeLessThan(0.47)
    for (const mod of DEPTH_MODS) expect(twisted.some(d => depthMod(WORLD, d) === mod)).toBe(true)
    for (const d of twisted.slice(0, 20)) expect(depthMod(WORLD, d)).toBe(depthMod(WORLD, d))
  })

  test('another world draws its twists elsewhere', async () => {
    const of = (w: number) => Array.from({ length: 60 }, (_, i) => depthMod(w, i + 2) ?? '-').join(',')
    expect(of(WORLD)).not.toBe(of(WORLD + 1))
  })

  test('waking on a twisted depth after a death says what it does; the toast stays the death\'s', async () => {
    let wake = 6
    while (depthMod(WORLD, wake) === undefined) wake += 5
    const g = at(wake + 2, { hp: 1 })
    const dead = apply({ ...g, foe: foeAhead(g, 1, { glyph: 'o', atk: 999, opened: true }) }, { kind: 'outcome', ok: false, what: 'Bash' })
    expect(dead.depth).toBe(wake)
    expect(dead.log).toContain(`${MOD_SAID[depthMod(WORLD, wake)!]}.`)
    expect(dead.toast).toMatch(/^Slain by /)
  })

  test('arriving on a twisted depth says what it does, and toasts its name', async () => {
    const d = depthWith('gloom')
    const g = apply({ ...at(d - 1), bossSlain: d - 1 }, { kind: 'descend' })
    expect(g.depth).toBe(d)
    expect(g.log).toContain(`${MOD_SAID.gloom}.`)
    expect(g.toast).toBe(`Depth ${d}: Gloom.`)
  })
})

describe('what each does', () => {
  test('gloom: every foe hits a fifth harder than its kind would, rounded', async () => {
    const d = depthWith('gloom')
    for (const foe of foesOn(d, 30).filter(f => f.champion === undefined)) {
      const tier = BESTIARY.indexOf(foe.glyph)
      expect([1, 2].map(d2 => Math.round(foeAtk(d, tier, d2) * 1.2))).toContain(foe.atk)
    }
  })

  test('horde: every foe has a quarter more HP than its kind would, rounded', async () => {
    const d = depthWith('horde')
    for (const foe of foesOn(d, 30).filter(f => f.champion === undefined)) {
      const tier = BESTIARY.indexOf(foe.glyph)
      expect([1, 2, 3, 4].map(d4 => Math.round(foeHp(d, tier, d4) * 1.25))).toContain(foe.maxHp)
    }
  })

  test('champions\' den: about one foe in four is a champion, against one in ten elsewhere', async () => {
    const share = (d: number) => foesOn(d, 400).filter(f => f.champion !== undefined).length / 400
    expect(share(depthWith('den'))).toBeGreaterThan(0.18)
    expect(share(depthWith('den'))).toBeLessThan(0.32)
    expect(share(plainDepth(3))).toBeLessThan(0.15)
  })

  test('barren: no kill leaves a potion', async () => {
    const d = depthWith('barren')
    let g = at(d, { potionChance: 90 })
    let potions = 0
    for (let i = 0; i < 60; i += 1) {
      g = apply({ ...g, hp: g.maxHp, foe: foeAhead(g, 1, { hp: 1, maxHp: 1, glyph: 'o' }), belt: [null, null, null, null, null], bag: [] }, { kind: 'attack' })
      potions += g.log.filter(l => /^Loot: .*(Potion|Draught|Scroll|Bomb)\.$/.test(l)).length
    }
    expect(potions).toBe(0)
  })

  test('gloom pays half again the gold of a kill, horde half again its XP', async () => {
    // A kill's gold is a d3 times the depth: on gloom each of those, half again, rounded down.
    const gd = depthWith('gloom')
    const gold = apply(at(gd, { gold: 0 }), { kind: 'attack' } as never)
    expect(gold.gold).toBe(0)
    const kill = apply({ ...at(gd, { gold: 0 }), foe: foeAhead(at(gd), 1, { hp: 1, maxHp: 1, glyph: 'o' }) }, { kind: 'attack' })
    expect([1, 2, 3].map(k => Math.floor(k * gd * 1.5))).toContain(kill.gold)
    const hd = depthWith('horde')
    const g = at(hd, { xp: 0, level: 30 })
    const won = apply({ ...g, foe: foeAhead(g, 1, { hp: 1, maxHp: 1, glyph: 'o', xp: 20 }) }, { kind: 'attack' })
    // The plain hero's Insight adds nothing at 0: 20 XP, half again 30.
    expect(won.xp).toBe(30)
  })

  test('bloodlust: a blow taken lands a quarter harder; one dealt too', async () => {
    const d = depthWith('bloodlust')
    const p = plainDepth(d + 1)
    // A rat's 8 against the plain hero's 1 defense from nothing: 8 at home, 8 times 1.25 is 10 here.
    const taken = (depth: number) => {
      const g = at(depth, { cls: 'mage', gear: {}, hp: 100, maxHp: 100 })
      return 100 - apply({ ...g, foe: foeAhead(g, 1, { glyph: 'o', atk: 8, opened: true }) }, { kind: 'outcome', ok: false, what: 'Bash' }).hp
    }
    expect([taken(p), taken(d)]).toEqual([8, 10])
    const dealt = (depth: number) => {
      const g = at(depth, { seed: 3 })
      const after = apply({ ...g, foe: foeAhead(g, 1, { glyph: 'o', hp: 500, maxHp: 500 }) }, { kind: 'attack' })
      return 500 - after.foe!.hp
    }
    // The same seed rolls the same blow: here it is a quarter harder, rounded.
    expect(dealt(d)).toBe(Math.round(dealt(p) * 1.25))
  })

  test('hoard: a gold pile or a chest pays double; foes hit a sixth harder than their kind', async () => {
    const d = depthWith('hoard')
    for (const foe of foesOn(d, 30).filter(f => f.champion === undefined)) {
      const tier = BESTIARY.indexOf(foe.glyph)
      expect([1, 2].map(d2 => Math.round(foeAtk(d, tier, d2) * 1.15))).toContain(foe.atk)
    }
    const level = levelOf(at(d))
    const pile = level.tiles.flatMap((row, y) => [...row].flatMap((_, x) => (floorThing(WORLD, d, level, { x, y }) === '$' ? [{ x, y }] : [])))[0]
    if (pile !== undefined) {
      const g = { ...at(d, { gold: 0 }), x: pile.x, y: pile.y }
      const took = apply(g, { kind: 'move', dx: 0, dy: 0 })
      const coins = took.gold
      // A pile is a d5 and the depth: doubled, it is even and between 2 (1 + depth) and 2 (5 + depth).
      if (coins > 0) {
        expect(coins % 2).toBe(0)
        expect(coins).toBeGreaterThanOrEqual(2 * (1 + d))
        expect(coins).toBeLessThanOrEqual(2 * (5 + d))
      }
    }
  })

  test('hoard: a chest pays double its gold', async () => {
    // The first hoard depth of a world with a chest on it: the hero stood beside it, stepping on.
    for (let world = 1; world <= 80; world += 1) {
      let d = 2
      while (d < 300 && depthMod(world, d) !== 'hoard') d += 1
      const level = generate(world, d)
      const chest = level.tiles.flatMap((row, y) => [...row].flatMap((_, x) => (chestAt(world, d, level, { x, y }) === 'wooden' ? [{ x, y }] : [])))[0]
      if (chest === undefined) continue
      const from = [[1, 0], [-1, 0], [0, 1], [0, -1]].map(([dx, dy]) => ({ x: chest.x + dx!, y: chest.y + dy! })).find(p => isFloor(level.tiles, p))!
      const g = { ...plainHero(world), world, ...arrive(world, d), deepest: d, gold: 0, bag: [], uniquesSlain: [bandOf(d)], ...from }
      const opened = apply(g, { kind: 'move', dx: chest.x - from.x, dy: chest.y - from.y })
      const line = opened.log.find(l => l.startsWith('You open the wooden chest: '))!
      const coins = Number(/: (\d+) gold/.exec(line)![1])
      // A wooden chest: a d10 and 3 a depth, doubled.
      expect(coins % 2).toBe(0)
      expect(coins).toBeGreaterThanOrEqual(2 * (1 + 3 * d))
      expect(coins).toBeLessThanOrEqual(2 * (10 + 3 * d))
      return
    }
    throw new Error('no wooden chest on a hoard depth')
  })
})

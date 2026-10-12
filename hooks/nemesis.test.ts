import { describe, expect, test } from 'claude-code/testing'

import type { Game, Nemesis } from '../types'
import { NEMESIS_GROWTH, apply, levelOf, nemesisTitle } from './game'
import { foeAhead, plainHero } from './fixtures'
import { NEMESIS_MARK, frameOf, hexToInt } from './pixels'
import { arrive } from './world'

const WORLD = 4
const at = (depth: number, over: Partial<Game> = {}): Game => ({ ...plainHero(WORLD), world: WORLD, ...arrive(WORLD, depth), deepest: depth, ...over })
/** The hero slain on `depth` by a foe made of `over`. */
const slainBy = (depth: number, over: object, g: Game = at(depth)) =>
  apply({ ...g, hp: 1, foe: foeAhead(g, 1, { glyph: 'o', name: 'Savage orc of ls', atk: 999, opened: true, ...over }) }, { kind: 'outcome', ok: false, what: 'Bash' })
const grak: Nemesis = { given: 'Grak', kind: 'orc', glyph: 'o', mod: 'savage', depth: 9, wins: 1 }

describe('a nemesis is made', () => {
  test('by a champion that slays the hero: named, titled by its modifier, waiting 4 to 7 depths below', async () => {
    for (let seed = 1; seed <= 12; seed += 1) {
      const dead = slainBy(7, { champion: 'savage' }, at(7, { seed }))
      const n = dead.nemesis!
      expect(n).toMatchObject({ kind: 'orc', glyph: 'o', mod: 'savage', wins: 1 })
      expect(n.depth).toBeGreaterThanOrEqual(11)
      expect(n.depth).toBeLessThanOrEqual(14)
      expect(nemesisTitle(n)).toBe(`${n.given} the Butcher`)
      expect(dead.log).toContain(`The Savage orc of ls will remember you. Now it is ${n.given} the Butcher, and it waits on depth ${n.depth}.`)
    }
  })

  test('not by a plain foe, nor a boss; and a second champion does not take the place of one already made', async () => {
    expect(slainBy(7, {}).nemesis).toBeNull()
    expect(slainBy(10, { boss: true, champion: undefined, name: 'orc overlord' }).nemesis).toBeNull()
    expect(slainBy(7, { champion: 'tough' }, at(7, { nemesis: grak })).nemesis).toEqual(grak)
  })
})

describe('a nemesis comes back', () => {
  test('on its depth or deeper the next foe is it: its kind and name, a champion, announced', async () => {
    for (const depth of [9, 12]) {
      const g = apply(at(depth, { nemesis: grak }), { kind: 'summon', name: 'ls' })
      expect(g.foe).toMatchObject({ glyph: 'o', name: 'orc Grak', champion: 'savage', nemesis: true })
      expect(g.toast).toBe('Nemesis: Grak the Butcher!')
      expect(g.log).toContain('You feel watched. Grak the Butcher has found you!')
    }
  })

  test('above its depth, foes are as ever', async () => {
    const g = apply(at(8, { nemesis: grak }), { kind: 'summon', name: 'ls' })
    expect(g.foe?.nemesis).toBeUndefined()
  })

  test('stronger for every win: a fifth more HP and attack each', async () => {
    const one = apply(at(9, { nemesis: grak }), { kind: 'summon', name: 'ls' }).foe!
    const two = apply(at(9, { nemesis: { ...grak, wins: 2 } }), { kind: 'summon', name: 'ls' }).foe!
    // The same kind at the same depth: the champion's stats times 1.2 for one win, 1.4 for two.
    const ratio = (1 + 2 * NEMESIS_GROWTH) / (1 + NEMESIS_GROWTH)
    expect(Math.abs(two.maxHp / one.maxHp - ratio)).toBeLessThan(0.02)
    expect(Math.abs(two.atk / one.atk - ratio)).toBeLessThan(0.06)
  })

  test('winning again, it grows by a win and goes deeper still', async () => {
    const g = at(9, { nemesis: grak })
    const met = apply(g, { kind: 'summon', name: 'ls' })
    const dead = apply({ ...met, hp: 1, foe: { ...met.foe!, atk: 999, opened: true } }, { kind: 'outcome', ok: false, what: 'Bash' })
    expect(dead.nemesis?.wins).toBe(2)
    expect(dead.nemesis!.depth).toBeGreaterThanOrEqual(13)
    expect(dead.nemesis!.depth).toBeLessThanOrEqual(16)
    expect(dead.log.some(l => l.startsWith('Grak the Butcher laughs, and goes deeper still.'))).toBe(true)
  })

  test('slain at last, it leaves a trophy of Epic or better and is gone', async () => {
    // A hero far from a level-up, whose toast would come first, as it does over any champion's prize.
    const met = apply(at(9, { nemesis: grak, bag: [], level: 30 }), { kind: 'summon', name: 'ls' })
    const won = apply({ ...met, foe: { ...met.foe!, hp: 1 } }, { kind: 'attack' })
    expect(won.nemesis).toBeNull()
    expect(won.log.some(l => /^Grak the Butcher falls at last\. Trophy: .+ \((Epic|Legendary)\)\.$/.test(l))).toBe(true)
    expect(won.toast).toBe('Grak the Butcher is slain!')
  })
})

describe('on the map', () => {
  test('a nemesis wears a red crown, a boss a gold one; a plain champion none', async () => {
    const g = at(9)
    const level = levelOf(g)
    const spot = [[1, 0], [-1, 0], [0, 1], [0, -1]].map(([dx, dy]) => ({ x: g.x + dx!, y: g.y + dy! })).find(p => level.tiles[p.y]?.[p.x] === '.')!
    const foe = { glyph: 'o', name: 'orc', hp: 30, maxHp: 40, atk: 9, xp: 5, ...spot }
    const W = 72
    const H = 56
    const red = hexToInt(NEMESIS_MARK)
    const count = (f: object) => [...frameOf({ ...g, foe: f } as Game, W, H, {})].filter(p => p === red).length
    expect(count({ ...foe, champion: 'savage', nemesis: true })).toBeGreaterThan(count({ ...foe, champion: 'savage' }) + 6)
    expect(count({ ...foe, boss: true })).toBe(count({ ...foe, champion: 'savage' }))
  })
})

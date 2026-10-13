import { describe, expect, test } from 'claude-code/testing'

import type { Game } from '../types'
import { foeAhead } from './fixtures'
import { apply, levelOf, newGame } from './game'
import { plainItem } from './items'
import { violations } from './invariants'
import { simulate } from './sim'

const broke = (g: Game) => violations(g).map(v => v.split(':')[0])

describe('the rules stay quiet on legitimate states', () => {
  test('a new game of every class keeps every rule', async () => {
    for (const cls of ['knight', 'mage', 'rogue'] as const) expect(violations(newGame(3, cls))).toEqual([])
  })

  test('a hero in town, by the portal, keeps every rule', async () => {
    const town = apply(newGame(3), { kind: 'portal' })
    expect(town.where).toBe('town')
    expect(violations(town)).toEqual([])
  })

  test('a long simulated game keeps every rule at every step', async () => {
    for (const cls of ['knight', 'mage', 'rogue'] as const) {
      const r = simulate(11, 400, cls)
      expect(r.firstBreak === undefined ? 'clean' : `${cls} step ${r.firstBreak.step}: ${r.firstBreak.broke.join(' | ')}`).toBe('clean')
    }
  })
})

describe('each rule speaks up when broken', () => {
  const g = newGame(3)
  const item = (over: object) => ({ ...plainItem({ nextId: 500 }, 'chain'), ...over })

  test('a shield on a foe that is no shielded champion', async () => {
    const g = newGame(3)
    expect(broke({ ...g, foe: { ...foeAhead(g, 2), shield: 1 } })).toContain('shield only on a shielded champion')
    expect(broke({ ...g, foe: { ...foeAhead(g, 2), champion: 'tough', shield: 1 } })).toContain('shield only on a shielded champion')
    expect(broke({ ...g, foe: { ...foeAhead(g, 2), champion: 'shielded', shield: 1 } })).not.toContain('shield only on a shielded champion')
    expect(broke({ ...g, foe: { ...foeAhead(g, 2), champion: 'shielded', shield: 0 } })).not.toContain('shield only on a shielded champion')
  })

  test('a shield on a big boss that does not ward itself; the Bone King and the Frost Lich do', async () => {
    const g = newGame(3)
    expect(broke({ ...g, foe: { ...foeAhead(g, 2), big: 'king', shield: 1 } })).not.toContain('shield only on a shielded champion')
    expect(broke({ ...g, foe: { ...foeAhead(g, 2), big: 'lich', shield: 1 } })).not.toContain('shield only on a shielded champion')
    expect(broke({ ...g, foe: { ...foeAhead(g, 2), big: 'hive', shield: 1 } })).toContain('shield only on a shielded champion')
    expect(broke({ ...g, foe: { ...foeAhead(g, 2), big: 'lich', shield: 2 } })).toContain('shield only on a shielded champion')
  })

  test('an item tempered past the smith\'s limit, or by a fraction', async () => {
    const sword = { ...g.gear.weapon!, temper: 3 }
    expect(broke({ ...g, gear: { ...g.gear, weapon: sword } })).not.toContain('temper within 0 to 3')
    expect(broke({ ...g, gear: { ...g.gear, weapon: { ...sword, temper: 4 } } })).toContain('temper within 0 to 3')
    expect(broke({ ...g, bag: [{ ...sword, temper: 1.5 }] })).toContain('temper within 0 to 3')
    expect(broke({ ...g, bag: [{ ...sword, temper: -1 }] })).toContain('temper within 0 to 3')
  })

  test('a boss off a boss depth, and a boss slain on a depth never reached or not a boss depth', async () => {
    const boss = { ...foeAhead(g, 2), boss: true as const }
    expect(broke({ ...g, depth: 4, foe: boss })).toContain('boss only on a boss depth')
    expect(broke({ ...g, depth: 5, deepest: 5, foe: boss })).not.toContain('boss only on a boss depth')
    expect(broke({ ...g, deepest: 7, bossSlain: 5 })).not.toContain('boss slain on a boss depth reached')
    expect(broke({ ...g, deepest: 4, bossSlain: 5 })).toContain('boss slain on a boss depth reached')
    expect(broke({ ...g, deepest: 9, bossSlain: 6 })).toContain('boss slain on a boss depth reached')
  })

  test('a stash over its size, and a stashed item that is also in the bag', async () => {
    const item = { ...g.gear.weapon!, id: 900 }
    const ten = Array.from({ length: 10 }, (_, i) => ({ ...item, id: 900 + i }))
    expect(broke({ ...g, stashed: ten })).not.toContain('stash within its size')
    expect(broke({ ...g, stashed: [...ten, { ...item, id: 950 }] })).toContain('stash within its size')
    expect(broke({ ...g, stashed: [item] })).not.toContain('unique item ids')
    expect(broke({ ...g, bag: [item], stashed: [item] })).toContain('unique item ids')
  })

  test("an opening played against a foe by a class that has none", async () => {
    const foe = { ...foeAhead(g, 2), opened: true as const }
    expect(broke({ ...g, cls: 'mage', foe })).toContain('opening only by a class that has one')
    expect(broke({ ...g, cls: 'knight', foe })).not.toContain('opening only by a class that has one')
    expect(broke({ ...g, cls: 'rogue', foe })).not.toContain('opening only by a class that has one')
  })

  test('a quest done more times than it asks, or asking for nothing', async () => {
    const q = { kind: 'slay' as const, depth: 3, need: 8, have: 8 }
    expect(broke({ ...g, quest: q })).not.toContain('quest within its count')
    expect(broke({ ...g, quest: { ...q, have: 9 } })).toContain('quest within its count')
    expect(broke({ ...g, quest: { ...q, need: 0, have: 0 } })).toContain('quest within its count')
    expect(broke({ ...g, quest: { ...q, have: -1 } })).toContain('quest within its count')
    expect(broke({ ...g, quest: { ...q, depth: 0 } })).toContain('quest within its count')
  })

  test('what the healer mended: kept in town, gone in the dungeon, never less than none or a fraction', async () => {
    const town = { ...g, where: 'town' as const }
    expect(broke({ ...g, mended: 0 })).not.toContain('mended only during a town visit')
    // Max HP can have fallen since: in town any count stands.
    expect(broke({ ...town, mended: g.maxHp + 3 })).not.toContain('mended only during a town visit')
    expect(broke({ ...g, mended: 5 })).toContain('mended only during a town visit')
    expect(broke({ ...town, mended: -1 })).toContain('mended only during a town visit')
    expect(broke({ ...town, mended: 1.5 })).toContain('mended only during a town visit')
  })

  test('a nemesis waits below depth 1 having won at least once; a foe is the nemesis only while there is one', async () => {
    const n = { given: 'Grak', kind: 'orc', glyph: 'o', mod: 'savage' as const, depth: 9, wins: 1 }
    expect(broke({ ...g, nemesis: n })).not.toContain('nemesis waits below the first depth, won at least once')
    expect(broke({ ...g, nemesis: { ...n, depth: 1 } })).toContain('nemesis waits below the first depth, won at least once')
    expect(broke({ ...g, nemesis: { ...n, wins: 0 } })).toContain('nemesis waits below the first depth, won at least once')
    const foe = { ...foeAhead(g, 2), nemesis: true as const }
    expect(broke({ ...g, nemesis: n, foe })).not.toContain('a foe is the nemesis only while there is one')
    expect(broke({ ...g, nemesis: null, foe })).toContain('a foe is the nemesis only while there is one')
  })

  test('what was sold is out of the bag, and fetched a whole count of gold', async () => {
    const item = { ...g.bag[0] ?? { ...g.gear.weapon!, x: 0, y: 0 }, id: 777 }
    expect(broke({ ...g, lastSold: { items: [item], coins: 5 } })).not.toContain('what was sold is out of the bag, its gold a count')
    expect(broke({ ...g, bag: [...g.bag, item], lastSold: { items: [item], coins: 5 } })).toContain('what was sold is out of the bag, its gold a count')
    expect(broke({ ...g, lastSold: { items: [item], coins: -1 } })).toContain('what was sold is out of the bag, its gold a count')
  })

  test('a reforge to take back only while in town', async () => {
    const from = { slot: 'weapon' as const, item: { ...g.gear.weapon!, x: 0, y: 0 } }
    expect(broke({ ...g, where: 'town', reforgedFrom: from })).not.toContain('a reforge to take back only in town')
    expect(broke({ ...g, where: 'dungeon', reforgedFrom: from })).toContain('a reforge to take back only in town')
  })

  test('nothing both locked and junk', async () => {
    const item = { ...g.gear.weapon!, id: 778, x: 0, y: 0 }
    expect(broke({ ...g, bag: [{ ...item, locked: true }] })).not.toContain('nothing both locked and junk')
    expect(broke({ ...g, bag: [{ ...item, locked: true, junk: true }] })).toContain('nothing both locked and junk')
    expect(broke({ ...g, stashed: [{ ...item, locked: true, junk: true }] })).toContain('nothing both locked and junk')
  })

  test('uniques slain only in bands reached', async () => {
    expect(broke({ ...g, deepest: 7, uniquesSlain: [0, 1] })).not.toContain('uniques slain in bands reached')
    expect(broke({ ...g, deepest: 7, uniquesSlain: [2] })).toContain('uniques slain in bands reached')
    expect(broke({ ...g, deepest: 7, uniquesSlain: [-1] })).toContain('uniques slain in bands reached')
  })

  test('the kills since a Rare a whole count under its cap', async () => {
    expect(broke({ ...g, sinceRare: 0 })).not.toContain('rare pity within its cap')
    expect(broke({ ...g, sinceRare: 11 })).not.toContain('rare pity within its cap')
    expect(broke({ ...g, sinceRare: 12 })).toContain('rare pity within its cap')
    expect(broke({ ...g, sinceRare: -1 })).toContain('rare pity within its cap')
  })

  test('tension a whole count of zero or more; a calm no longer than its length', async () => {
    expect(broke({ ...g, tension: 0 })).not.toContain('tension a count')
    expect(broke({ ...g, tension: 250 })).not.toContain('tension a count')
    expect(broke({ ...g, tension: -1 })).toContain('tension a count')
    expect(broke({ ...g, tension: 2.5 })).toContain('tension a count')
    expect(broke({ ...g, calm: 2 })).not.toContain('calm within its length')
    expect(broke({ ...g, calm: 3 })).toContain('calm within its length')
    expect(broke({ ...g, calm: -1 })).toContain('calm within its length')
  })

  test('the dog petted a negative or fractional number of times', async () => {
    expect(broke({ ...g, petted: 0 })).not.toContain('petted a count')
    expect(broke({ ...g, petted: 37 })).not.toContain('petted a count')
    expect(broke({ ...g, petted: -1 })).toContain('petted a count')
    expect(broke({ ...g, petted: 0.5 })).toContain('petted a count')
  })

  test('a fortune outliving its depth', async () => {
    expect(broke({ ...g, depth: 3, fortune: { kind: 'luck', depth: 3 } })).not.toContain('fortune only on its depth')
    expect(broke({ ...g, depth: 4, fortune: { kind: 'luck', depth: 3 } })).toContain('fortune only on its depth')
  })

  test("a foe's traits out of order: a turn that is no count, a brew drunk by no kobold, gold held by no goblin", async () => {
    const foe = foeAhead(g, 2)
    expect(broke({ ...g, foe: { ...foe, glyph: 'k', turn: 3, used: true } })).not.toContain('foe traits in order')
    expect(broke({ ...g, foe: { ...foe, glyph: 'g', stolen: 4 } })).not.toContain('foe traits in order')
    expect(broke({ ...g, foe: { ...foe, turn: -1 } })).toContain('foe traits in order')
    expect(broke({ ...g, foe: { ...foe, turn: 1.5 } })).toContain('foe traits in order')
    expect(broke({ ...g, foe: { ...foe, glyph: 'o', used: true } })).toContain('foe traits in order')
    expect(broke({ ...g, foe: { ...foe, glyph: 'o', stolen: 4 } })).toContain('foe traits in order')
    expect(broke({ ...g, foe: { ...foe, glyph: 'g', stolen: -1 } })).toContain('foe traits in order')
  })

  test('the hero on a living foe', async () => {
    expect(broke({ ...g, foe: { ...foeAhead(g), x: g.x, y: g.y } })).toContain('hero not on foe')
  })
  test('a foe on the stairs', async () => {
    expect(broke({ ...g, foe: { ...foeAhead(g), ...levelOf(g).stairs } })).toContain('foe off the stairs')
  })
  test('the hero on rock', async () => {
    expect(broke({ ...g, x: 0, y: 0 })).toContain('hero on floor')
  })
  test('in town: the hero inside a building, a foe, a portal spot on rock, and a portal left open in the dungeon', async () => {
    const town = apply(g, { kind: 'portal' })
    expect(broke({ ...town, x: 0, y: 0 })).toContain('hero on floor')
    expect(broke({ ...town, foe: foeAhead(g) })).toContain('town has no foe')
    expect(broke({ ...town, portal: { x: 0, y: 0 } })).toContain('portal on floor')
    expect(broke({ ...g, portal: { x: g.x, y: g.y } })).toContain('portal only in town')
    expect(broke({ ...town, portal: null })).toContain('portal only in town')
  })
  test('HP above max, and HP at zero', async () => {
    expect(broke({ ...g, hp: g.maxHp + 1 })).toContain('hp within max')
    expect(broke({ ...g, hp: 0 })).toContain('hp positive')
  })
  test('a bag item outside the grid, and two overlapping', async () => {
    expect(broke({ ...g, bag: [item({ id: 1, x: 7 })] })).toContain('bag inside grid')
    expect(broke({ ...g, bag: [item({ id: 1 }), item({ id: 2, x: 1 })] })).toContain('bag no overlap')
  })
  test('an item worn in the wrong slot', async () => {
    expect(broke({ ...g, gear: { ...g.gear, helm: item({ id: 1 }) } })).toContain('gear in its slot')
  })
  test('a belt tier of 10, an empty stack kept, a kind out of its slot, and a belt of 4 slots', async () => {
    expect(broke({ ...g, belt: [{ kind: 'health', tiers: [0, 10, 0] }, null, null, null, null] })).toContain('belt stacks')
    expect(broke({ ...g, belt: [{ kind: 'health', tiers: [0, 0, 0] }, null, null, null, null] })).toContain('belt stacks')
    expect(broke({ ...g, belt: [{ kind: 'health', tiers: [9, 9, 9] }, null, null, null, null] })).not.toContain('belt stacks')
    expect(broke({ ...g, belt: [{ kind: 'fury', tiers: [1, 0, 0] }, null, null, null, null] })).toContain('belt kinds in their slots')
    expect(broke({ ...g, belt: [null, null, { kind: 'fury', tiers: [1, 0, 0] }, null, null] })).not.toContain('belt kinds in their slots')
    expect(broke({ ...g, belt: [{ kind: 'health', tiers: [1, 0, 0], chosen: 3 }, null, null, null, null] })).toContain('a chosen tier is held')
    expect(broke({ ...g, belt: [{ kind: 'health', tiers: [1, 0, 1], chosen: 3 }, null, null, null, null] })).not.toContain('a chosen tier is held')
    expect(broke({ ...g, belt: [null, null, null, null] })).toContain('belt size')
  })
  test('the cursor on an item no longer in the bag', async () => {
    expect(broke({ ...g, cursor: 12345 })).toContain('cursor on a bag item')
  })
})

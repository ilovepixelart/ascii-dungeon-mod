import { describe, expect, test } from 'claude-code/testing'

import type { Foe, Game, HeroClass, Item } from '../types'
import { SAVE_VERSION, apply, attackBonus, critChance, newGame, normalize } from './game'
import { BAG_H, BAG_W, BASES, fit, priceOf, stash } from './items'
import { foeAhead, plainHero } from './fixtures'
import { bagRows } from './panels'

const item = (over: Partial<Item>): Item => ({
  id: 100,
  base: 'ring',
  name: 'Thing',
  rarity: 'common',
  slot: 'weapon',
  w: 1,
  h: 1,
  atk: 0,
  def: 0,
  hp: 0,
  crit: 0,
  xp: 0,
  x: 0,
  y: 0,
  ...over,
})
const weakling = (g: Game): Foe => foeAhead(g, 1, { glyph: 'r', name: 'rat of x', hp: 1, maxHp: 1 })
const fullBag = () => Array.from({ length: BAG_W }, (_, i) => item({ id: 200 + i, w: 1, h: BAG_H, x: i }))

describe('bag placement', () => {
  test('fills column by column from the top-left', async () => {
    const coat = item({ id: 1, w: 2, h: 3 })
    expect(fit([], 1, 2)).toEqual({ x: 0, y: 0 })
    expect(fit([coat], 1, 1)).toEqual({ x: 0, y: 3 })
    expect(fit([coat, item({ id: 2, y: 3 })], 1, 2)).toEqual({ x: 0, y: 4 })
    expect(fit([coat, item({ id: 2, y: 3 }), item({ id: 3, y: 4, h: 2 })], 1, 2)).toEqual({ x: 1, y: 3 })
  })

  test('a full bag refuses an item and keeps its contents', async () => {
    const g = { ...plainHero(), bag: fullBag() }
    expect(fit(g.bag, 1, 1)).toBeNull()
    expect(stash(g, item({ id: 9 }))).toBe(false)
    expect(g.bag.length).toBe(BAG_W)
  })

  test('loot from many fights always lands inside the bag without overlapping', { timeoutMs: 20000 }, async () => {
    let drops = 0
    let rare = 0
    for (let seed = 1; seed <= 300; seed += 1) {
      let g: Game = { ...newGame(seed), depth: 6 }
      for (let fight = 0; fight < 6; fight += 1) {
        g = apply({ ...g, foe: weakling(g) }, { kind: 'outcome', ok: true, what: 'Edit' })
      }
      const cells = new Set<string>()
      for (const it of g.bag) {
        expect(it.x >= 0 && it.y >= 0 && it.x + it.w <= BAG_W && it.y + it.h <= BAG_H).toBe(true)
        for (let dx = 0; dx < it.w; dx += 1) {
          for (let dy = 0; dy < it.h; dy += 1) {
            const key = `${it.x + dx},${it.y + dy}`
            expect(cells.has(key)).toBe(false)
            cells.add(key)
          }
        }
        if (it.rarity !== 'common') rare += 1
      }
      drops += g.bag.length
    }
    expect(drops).toBeGreaterThan(100)
    expect(rare).toBeGreaterThan(20)
  })
})

describe('equipment', () => {
  test('equipping swaps the worn weapon back into the bag and raises attack', async () => {
    const sword = item({ id: 5, name: 'Sword', atk: 5, h: 3 })
    const after = apply({ ...plainHero(), bag: [sword], cursor: 5 }, { kind: 'equip' })
    expect(after.gear.weapon?.name).toBe('Sword')
    expect(after.bag.map(i => i.name)).toEqual(['Short Sword'])
    expect(after.cursor).toBe(900)
    // The Sword's 5 and a point of the plain hero's 1 Might.
    expect(attackBonus(after)).toBe(6)
  })

  test('an HP item raises max HP while worn and lowers it again when taken off', async () => {
    const charm = item({ id: 6, slot: 'amulet', hp: 10 })
    const worn = apply({ ...plainHero(), bag: [charm], cursor: 6 }, { kind: 'equip' })
    expect(worn.maxHp).toBe(30)
    const off = apply({ ...worn, hp: 30 }, { kind: 'unequip', slot: 'amulet' })
    expect(off.maxHp).toBe(20)
    expect(off.hp).toBe(20)
    expect(off.gear.amulet).toBeUndefined()
  })

  test('taking off an item with a full bag is refused', async () => {
    const after = apply({ ...plainHero(), bag: fullBag() }, { kind: 'unequip', slot: 'weapon' })
    expect(after.gear.weapon?.name).toBe('Short Sword')
    expect(after.log.at(-1)).toBe('No room in the bag for your Short Sword.')
  })

  test('defense reduces each hit, never below 1', async () => {
    // The knight's shield already spent on the fight's first blow.
    const foe = { ...weakling(plainHero()), opened: true as const }
    const coat = item({ slot: 'armor', def: 2 })
    expect(apply({ ...plainHero(), foe, gear: { armor: coat } }, { kind: 'outcome', ok: false, what: 'Bash' }).hp).toBe(19)
    const plate = item({ slot: 'armor', def: 10 })
    expect(apply({ ...plainHero(), foe, gear: { armor: plate } }, { kind: 'outcome', ok: false, what: 'Bash' }).hp).toBe(19)
  })

  test('selling pays the price and moves the cursor to the next item', async () => {
    const a = item({ id: 7, atk: 2 })
    const b = item({ id: 8, x: 1 })
    expect(priceOf(a)).toBe(10)
    const after = apply({ ...plainHero(), bag: [a, b], cursor: 7 }, { kind: 'sell' })
    expect(after.gold).toBe(10)
    expect(after.bag.map(i => i.id)).toEqual([8])
    expect(after.cursor).toBe(8)
  })

  test('next walks the bag left to right and wraps', async () => {
    const g = { ...plainHero(), bag: [item({ id: 3, x: 4 }), item({ id: 4, x: 1 })], cursor: 4 }
    const once = apply(g, { kind: 'cycle' })
    expect(once.cursor).toBe(3)
    expect(apply(once, { kind: 'cycle' }).cursor).toBe(4)
  })
})

describe('character stats', () => {
  test('a level grants three stat points', async () => {
    const after = apply({ ...plainHero(), xp: 15, foe: weakling(plainHero()) }, { kind: 'outcome', ok: true, what: 'Edit' })
    expect(after.level).toBe(2)
    expect(after.points).toBe(3)
  })

  test('training vigor spends a point for 3 max HP', async () => {
    const after = apply({ ...plainHero(), points: 1, hp: 10 }, { kind: 'train', stat: 'vigor' })
    expect(after.stats.vigor).toBe(2)
    expect(after.points).toBe(0)
    expect(after.maxHp).toBe(23)
    expect(after.hp).toBe(13)
  })

  test('training without points changes nothing', async () => {
    const after = apply(plainHero(), { kind: 'train', stat: 'might' })
    expect(after.stats.might).toBe(1)
    expect(after.log.at(-1)).toBe('No stat points to spend. Level up first.')
  })

  test('might adds its value to attack, focus 3% crit each up to 60%', async () => {
    const g = { ...plainHero(), stats: { might: 5, focus: 4, vigor: 1, insight: 0 } }
    expect(attackBonus(g)).toBe(5 + 1)
    expect(critChance(g)).toBe(12)
    expect(critChance({ ...g, stats: { ...g.stats, focus: 50 } })).toBe(60)
  })

  test('insight adds 5% XP per point to kills, rounded down', async () => {
    const g = { ...plainHero(), stats: { might: 1, focus: 0, vigor: 1, insight: 5 }, foe: weakling(plainHero()) }
    // 10 XP and a quarter more: 12.5.
    expect(apply(g, { kind: 'outcome', ok: true, what: 'Edit' }).xp).toBe(12)
  })
})

describe('saves and drawing', () => {
  test('a version 2 save moves to the five tiers, the 8x6 bag and the belt, and keeps its stats', async () => {
    const legacy = (over: object) => ({ id: 1, name: 'Rusty Dagger', rarity: 'common', slot: 'weapon', w: 1, h: 2, atk: 1, def: 0, hp: 0, x: 0, y: 0, ...over })
    const { version, cls, belt, effects, potionChance, dryKills, ...rest } = newGame(4)
    const v2 = {
      ...rest,
      version: 2,
      potions: 3,
      gold: 9,
      gear: { weapon: legacy({}) },
      bag: [legacy({ id: 2, name: 'Sharp War Axe', rarity: 'enchanted', w: 2, h: 3, x: 8, atk: 6 }), legacy({ id: 3, name: 'Grim Ward (Chain Shirt)', rarity: 'forged', slot: 'armor', w: 2, h: 3, x: 0, atk: 0, def: 5 })],
      cursor: 2,
    }
    const g = normalize(v2 as unknown as Game)
    expect(g.version).toBe(SAVE_VERSION)
    expect(g.cls).toBe('knight')
    expect(g.gear.weapon).toMatchObject({ base: 'dagger', rarity: 'common', atk: 1, crit: 0, xp: 0 })
    expect(g.gear.weapon?.cls).toBeUndefined()
    expect(g.bag.map(i => [i.base, i.rarity, i.atk + i.def]).sort()).toEqual([['axe', 'uncommon', 6], ['chain', 'rare', 5]])
    for (const it of g.bag) expect(it.x + it.w <= BAG_W && it.y + it.h <= BAG_H).toBe(true)
    expect(g.belt[0]).toEqual({ kind: 'health', tiers: [3, 0, 0] })
    expect(g.gold).toBe(9)
    expect(g.cursor).toBe(2)
  })

  test('the text bag is an 8x6 box with each cell an item glyph or a dot', async () => {
    const g = { ...plainHero(), bag: [item({ id: 3, slot: 'armor', w: 2, h: 3, x: 1 })], cursor: 3 }
    const rows = bagRows(g).map(r => r.map(run => run.text).join(''))
    expect(rows).toEqual([
      '+--------+',
      '|.[[.....|',
      '|.[[.....|',
      '|.[[.....|',
      '|........|',
      '|........|',
      '|........|',
      '+--------+',
    ])
    expect(bagRows(g)[1]?.find(run => run.text === '[[')?.inverse).toBe(true)
  })
})

describe('each class\'s pool', () => {
  test('three bases of its own in weapon, offhand, helm and armor, one pair of boots, and the same count in all', async () => {
    const own = (cls: HeroClass, slot: string) => BASES.filter(b => b.cls === cls && b.slot === slot).length
    for (const cls of ['knight', 'mage', 'rogue'] as const) {
      expect(['weapon', 'offhand', 'helm', 'armor', 'boots'].map(slot => own(cls, slot))).toEqual([3, 3, 3, 3, 1])
    }
  })
})

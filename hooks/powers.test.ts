import { describe, expect, test } from 'claude-code/testing'

import type { Foe, Game, Item, Work } from '../types'
import { apply } from './game'
import { foeAhead, plainHero } from './fixtures'
import { LEGENDARIES, makeItem, plainItem } from './items'
import { arrive } from './world'

/** A Legendary carrying `power`, its base's own stats zeroed but `over`, so only the power differs. */
const legendary = (base: string, power: string, over: Partial<Item> = {}): Item => {
  const name = LEGENDARIES.find(l => l.power === power)?.name ?? power
  return { ...plainItem({ nextId: 950 }, base, 'legendary'), name, atk: 0, def: 0, hp: 0, crit: 0, xp: 0, power, ...over }
}
const wearing = (g: Game, item: Item): Game => ({ ...g, gear: { ...g.gear, [item.slot]: item } })
/** A goblin beside the hero that has met the knight's shield already, and too tough to fall to one blow. */
const tough = (g: Game, over: Partial<Foe> = {}) => foeAhead(g, 1, { hp: 99, maxHp: 99, opened: true, ...over })
const ok = (g: Game, work?: Work) => apply(g, { kind: 'outcome', ok: true, what: 'Edit', ...(work === undefined ? {} : { work }) })
const failed = (g: Game) => apply(g, { kind: 'outcome', ok: false, what: 'Bash' })
const critFor = (g: Game) => Number(g.log.find(l => l.startsWith('You CRITICALLY hit'))?.match(/for (\d+)\.$/)?.[1])
const isCrit = (g: Game) => g.log.slice(g.log.length - g.fresh).some(l => l.startsWith('You CRITICALLY hit'))
const SEEDS = [1, 2, 3, 4, 5, 6, 7, 8, 9, 10, 11, 12]

describe('Segfault, the Null Blade', () => {
  test('a critical hit deals three times the blow where it would deal two', async () => {
    for (const seed of [1, 2, 3]) {
      // No Might nor Focus, whose shares would round the two blows apart.
      const g = { ...plainHero(seed), stats: { ...plainHero(seed).stats, might: 0, focus: 0 } }
      const blade = { ...legendary('sword', 'tripleCrit'), atk: 1 }
      const plain = critFor(ok({ ...g, foe: tough(g) }, 'tests'))
      const triple = critFor(ok(wearing({ ...g, foe: tough(g) }, blade), 'tests'))
      expect(triple * 2).toBe(plain * 3)
    }
  })
})

describe('Rubber Duck of Insight', () => {
  test('a kill pays half again its XP', async () => {
    const g = plainHero(3)
    const kill = (h: Game) => ok({ ...h, foe: foeAhead(h, 1, { hp: 1, maxHp: 1, xp: 10, opened: true }) }).xp
    expect(kill(g)).toBe(10)
    expect(kill(wearing(g, legendary('amulet', 'duck', { xp: 50 })))).toBe(15)
  })
})

describe('Mantle of the Monorepo', () => {
  test('a failed tool call heals 1 HP after the blow it lets through', async () => {
    const g = { ...plainHero(4), hp: 15 }
    const plain = failed({ ...g, foe: tough(g) })
    const mended = failed(wearing({ ...g, foe: tough(g) }, legendary('chain', 'failHeal')))
    expect(plain.hp).toBeLessThan(15)
    expect(mended.hp).toBe(plain.hp + 1)
    expect(mended.log.at(-1)).toBe('The Mantle of the Monorepo mends 1 HP.')
  })

  test('heals nothing past full HP: a warded hero stays at full and is told nothing', async () => {
    const g = { ...plainHero(4), effects: { regen: 0, fury: 0, ward: 1 } }
    const after = failed(wearing({ ...g, foe: tough(g) }, legendary('chain', 'failHeal')))
    expect(after.hp).toBe(20)
    expect(after.log).not.toContain('The Mantle of the Monorepo mends 1 HP.')
  })
})

describe('Band of the Endless Loop', () => {
  /** The hero at 10 HP slays `kills` foes of one HP that pay no XP, so no level heals them. */
  const slayAll = (g: Game, kills: number) => {
    let h: Game = { ...g, hp: 10 }
    for (let i = 0; i < kills; i += 1) h = ok({ ...h, foe: foeAhead(h, 1, { hp: 1, maxHp: 1, xp: 0, opened: true }) })
    return h
  }

  test('every fifth kill heals 3 HP, and the count starts again', async () => {
    const g = wearing(plainHero(5), legendary('ring', 'loopHeal'))
    expect(slayAll(g, 4).hp).toBe(10)
    expect(slayAll(g, 5).hp).toBe(13)
    expect(slayAll(g, 9).hp).toBe(13)
    expect(slayAll(g, 10).hp).toBe(16)
    expect(slayAll(g, 5).log).toContain('The loop comes round: +3 HP.')
  })

  test('without it, kills heal nothing', async () => {
    expect(slayAll(plainHero(5), 5).hp).toBe(10)
  })
})

describe('Aegis of Green Builds', () => {
  test('a passing test run wards off the next hit', async () => {
    const g = plainHero(6)
    const aegis = legendary('kite', 'greenBlock')
    const warded = ok(wearing({ ...g, foe: tough(g) }, aegis), 'tests')
    expect(warded.hp).toBe(20)
    expect(warded.log).toContain('Your Aegis of Green Builds hums: the next blow will be turned.')
    expect(warded.log.some(l => l.startsWith('Your ward absorbs the goblin of x'))).toBe(true)
  })

  test('any other success, or a test run without it, wards nothing', async () => {
    const g = plainHero(6)
    expect(ok(wearing({ ...g, foe: tough(g) }, legendary('kite', 'greenBlock'))).hp).toBeLessThan(20)
    expect(ok({ ...g, foe: tough(g) }, 'tests').hp).toBeLessThan(20)
  })
})

describe('Staff of Stack Traces', () => {
  test('a failed tool call strikes the foe as well', async () => {
    const g = plainHero(7)
    const staff = { ...legendary('staff', 'stackTrace'), atk: 1 }
    expect(failed({ ...g, foe: tough(g) }).foe?.hp).toBe(99)
    const after = failed(wearing({ ...g, foe: tough(g) }, staff))
    expect(after.foe?.hp).toBeLessThan(99)
    expect(after.log).toContain('Your Staff of Stack Traces turns the failure on the goblin of x.')
  })

  test('a foe it slays strikes back no more', async () => {
    const g = { ...plainHero(7), hp: 15 }
    const after = failed(wearing({ ...g, foe: foeAhead(g, 1, { hp: 1, maxHp: 1, opened: true }) }, { ...legendary('staff', 'stackTrace'), atk: 1 }))
    expect(after.foe).toBeNull()
    expect(after.hp).toBe(15)
  })
})

/** The hero standing at `depth`, nothing in the way: no boss owed above it, no fork open. */
const deepAt = (depth: number, over: Partial<Game> = {}): Game => {
  const g = plainHero(3)
  return { ...g, ...arrive(g.world, depth), deepest: depth, bossSlain: 0, fortune: null, ...over }
}
const DEEP = ['Treads of the Hot Path', 'Signet of Force Push', 'Pendant of the Clean Slate']

describe('the deep Legendaries', () => {
  /** The hero at a warden's depth with `foe`, one HP left, beside them; `over` the rest of the game. */
  const atWarden = (foe: Partial<Foe>, over: Partial<Game> = {}) => {
    const g = deepAt(60, { bossSlain: 59, ...over })
    return { ...g, foe: foeAhead(g, 1, { glyph: '&', name: 'Hollow Queen', hp: 1, maxHp: 1, opened: true, boss: true, big: 'queen', ...foe }) }
  }
  const deepHeld = (g: Game) => [...g.bag, ...(g.stashLegends ?? []), ...(g.floor ?? []).map(f => f.item)].filter(i => DEEP.includes(i.name)).map(i => i.name)

  test('never fall as an ordinary find, at any depth', async () => {
    for (const depth of [50, 51, 150]) {
      for (const seed of [1, 2, 3]) {
        const g = { ...plainHero(seed), depth }
        for (let i = 0; i < 100; i += 1) expect(DEEP).not.toContain(makeItem(g, 'legendary').name)
      }
    }
    expect(LEGENDARIES.filter(l => l.deep === true).map(l => l.name)).toEqual(DEEP)
  })

  test('a warden slain pays one, besides its hoard; a big boss that is no warden pays none', async () => {
    expect(deepHeld(ok(atWarden({ warden: 1 })))).toHaveLength(1)
    expect(deepHeld(ok(atWarden({})))).toEqual([])
  })

  test('one the hero holds nowhere comes first; holding all three, any of them', async () => {
    const held = (name: string, id: number): Item => {
      const l = LEGENDARIES.find(x => x.name === name)!
      return { ...plainItem({ nextId: id }, l.base, 'legendary'), name, power: l.power }
    }
    // Two of the three in the stash's Legendaries: the third is paid, in every world.
    for (const world of [1, 2, 3, 4, 5]) {
      const paid = deepHeld(ok(atWarden({ warden: 1 }, { world, stashLegends: [held(DEEP[0]!, 960), held(DEEP[2]!, 961)] })))
      expect(paid.filter(n => n !== DEEP[0] && n !== DEEP[2])).toEqual([DEEP[1]])
    }
    const all = DEEP.map((n, i) => held(n, 970 + i))
    expect(deepHeld(ok(atWarden({ warden: 1 }, { stashLegends: all }))).length).toBe(4)
  })
})

describe('Treads of the Hot Path', () => {
  test('the stairs heal half of max HP where they heal a quarter', async () => {
    // Depth 52 to 53, at 10 of 100 HP: a quarter is 25, half 50.
    const g = deepAt(52, { hp: 10, maxHp: 100 })
    expect(apply(g, { kind: 'descend' })).toMatchObject({ depth: 53, hp: 35 })
    expect(apply(wearing(g, legendary('boots', 'hotPath')), { kind: 'descend' })).toMatchObject({ depth: 53, hp: 60 })
  })
})

describe('Signet of Force Push', () => {
  const blow = (g: Game) => Number(g.log.find(l => /^You (CRITICALLY )?hit/.test(l))?.match(/for (\d+)\.$/)?.[1])
  test('a blow on a big boss or a warden deals a fifth more; on a lesser boss, any other foe, or without it, the same', async () => {
    for (const seed of [1, 2, 3]) {
      const g = { ...plainHero(seed), stats: { ...plainHero(seed).stats, might: 0, focus: 0 } }
      const signet = { ...legendary('signet', 'forcePush'), atk: 40 }
      const on = (h: Game, over: Partial<Foe>) => blow(ok({ ...h, foe: tough(h, { hp: 999, maxHp: 999, ...over }) }))
      const plain = on(wearing(g, signet), {})
      expect(on(wearing(g, signet), { boss: true, big: 'king' })).toBe(Math.round(plain * 1.2))
      expect(on(wearing(g, signet), { boss: true, big: 'lich', warden: 2 })).toBe(Math.round(plain * 1.2))
      expect(on(wearing(g, signet), { boss: true })).toBe(plain)
      expect(on(wearing(g, { ...signet, power: 'none' }), { boss: true, big: 'king' })).toBe(plain)
    }
  })
})

describe('Pendant of the Clean Slate', () => {
  test("the Abyss's weight takes none of the hero's defense", async () => {
    // As the weight's own test: a rogue at depth 75 in 100 defense, two harder marks behind: a 100 blow lands 66
    // under the weight, 43 without it.
    const armor = { ...plainHero().gear.weapon!, slot: 'armor' as const, atk: 0, def: 100, id: 901 }
    const struck = (g: Game) => {
      const after = apply({ ...g, foe: foeAhead(g, 1, { glyph: 'o', name: 'orc of x', hp: 99, maxHp: 99, atk: 100, opened: true }) }, { kind: 'outcome', ok: false, what: 'Bash' })
      return Number(/strikes you for (\d+)\./.exec(after.log.join('\n'))?.[1])
    }
    const g = deepAt(75, { cls: 'rogue', hp: 500, maxHp: 500, marks: { 1: 'steady', 2: 'ironclad', 3: 'lean' }, gear: { ...plainHero().gear, armor } })
    expect([struck(g), struck(wearing(g, legendary('pendant', 'cleanSlate')))]).toEqual([66, 43])
  })
})

describe('Whisper of the Linter', () => {
  const dagger = { ...legendary('dagger', 'chainCrit'), atk: 1 }
  /** A sure critical from passing tests, then two plain successful blows: whether each of the two was critical. */
  const after = (g: Game) => {
    const first = ok({ ...g, foe: tough(g) }, 'tests')
    const second = ok(first)
    return [isCrit(second), isCrit(ok(second))]
  }

  test('a critical hit makes the next one critical too', async () => {
    for (const seed of SEEDS) expect(after(wearing(plainHero(seed), dagger))[0]).toBe(true)
  })

  test('a chained critical chains no further, and without it nothing chains', async () => {
    expect(SEEDS.map(seed => after(wearing(plainHero(seed), dagger))[1])).toContain(false)
    expect(SEEDS.map(seed => after(plainHero(seed))[0])).toContain(false)
  })
})

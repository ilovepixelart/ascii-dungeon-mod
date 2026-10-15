import { describe, expect, test } from 'claude-code/testing'

import type { Foe, Game, Item, Work } from '../types'
import { apply } from './game'
import { foeAhead, plainHero } from './fixtures'
import { LEGENDARIES, plainItem } from './items'

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
      const g = plainHero(seed)
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

import { describe, expect, test } from 'claude-code/testing'

import type { Game } from '../types'
import { addToBelt, emptyBelt, killConsumable, useBelt } from './consumables'
import { foeAhead, plainHero } from './fixtures'
import { apply, newGame } from './game'
import { BASES, PRICE, canWear, makeItem, rarityOf, tierWeights } from './items'
import { itemChance } from './game'

const withBelt = (belt: Game['belt']): Game => ({ ...plainHero(), belt })

describe('the belt', () => {
  test('stacks a kind up to 9, then starts a new slot', async () => {
    const g = withBelt(emptyBelt())
    for (let i = 0; i < 10; i += 1) expect(addToBelt(g, 'health')).toBe(true)
    expect(g.belt.slice(0, 2)).toEqual([{ kind: 'health', count: 9 }, { kind: 'health', count: 1 }])
  })

  test('refuses a sixth kind when all five slots hold others', async () => {
    const g = withBelt([...['regen', 'mapping', 'fury', 'ward', 'smoke'].map(kind => ({ kind, count: 9 }))] as Game['belt'])
    expect(addToBelt(g, 'health')).toBe(false)
  })

  test('using the last of a stack empties its slot', async () => {
    const g = withBelt([{ kind: 'health', count: 1 }, ...emptyBelt().slice(1)])
    useBelt(g, 0)
    expect(g.belt[0]).toBeNull()
    expect(useBelt(g, 0)).toBe('Belt slot 1 is empty.')
  })
})

describe('effects', () => {
  const foeGame = (over: Partial<Game>) => {
    const g = { ...plainHero(), ...over }
    return { ...g, foe: foeAhead(g, 1, { hp: 999, maxHp: 999, atk: 3, opened: true }) }
  }

  test('a Ward Scroll absorbs exactly the next 2 hits', async () => {
    let g = apply(foeGame({ belt: [{ kind: 'ward', count: 1 }, ...emptyBelt().slice(1)] }), { kind: 'use', slot: 0 })
    for (let i = 0; i < 2; i += 1) g = apply(g, { kind: 'outcome', ok: false, what: 'Bash' })
    expect(g.hp).toBe(20)
    expect(apply(g, { kind: 'outcome', ok: false, what: 'Bash' }).hp).toBe(17)
  })

  test('a Scroll of Fury doubles exactly the next 5 hits', async () => {
    const hits = (g: Game, n: number) => {
      const out: number[] = []
      let cur = g
      for (let i = 0; i < n; i += 1) {
        const before = cur.foe?.hp ?? 0
        cur = apply(cur, { kind: 'outcome', ok: true, what: 'Edit' })
        out.push(before - (cur.foe?.hp ?? 0))
      }
      return out
    }
    const calm = foeGame({ stats: { might: 1, focus: 0, vigor: 1, insight: 0 } })
    const furious = { ...calm, effects: { ...calm.effects, fury: 5 } }
    const [plain, doubled] = [hits(calm, 6), hits(furious, 6)]
    expect(doubled.slice(0, 5)).toEqual(plain.slice(0, 5).map(n => n * 2))
    expect(doubled[5]).toBe(plain[5])
  })

  test('a Regeneration Draught heals a tenth of max HP after each of the next 5 fights', async () => {
    let g = apply(foeGame({ hp: 2, belt: [{ kind: 'regen', count: 1 }, ...emptyBelt().slice(1)] }), { kind: 'use', slot: 0 })
    g = { ...g, foe: null }
    const seen: number[] = []
    for (let i = 0; i < 6; i += 1) {
      const before = g.hp
      g = apply({ ...g, effects: { ...g.effects } }, { kind: 'outcome', ok: true, what: 'Edit' })
      seen.push(g.hp - before)
    }
    expect(seen).toEqual([2, 2, 2, 2, 2, 0])
  })

  test('a Scroll of Mapping reveals the whole level', async () => {
    const g = apply(withBelt([{ kind: 'mapping', count: 1 }, ...emptyBelt().slice(1)]), { kind: 'use', slot: 0 })
    expect(g.seen.includes('0')).toBe(false)
  })

  test('a Smoke Bomb makes the foe lose the hero', async () => {
    const g = apply(foeGame({ belt: [{ kind: 'smoke', count: 1 }, ...emptyBelt().slice(1)] }), { kind: 'use', slot: 0 })
    expect(g.foe).toBeNull()
  })
})

describe('drops', () => {
  test('rarity tiers fall at 56, 84, 96 and 100 on the roll', async () => {
    expect([55, 56, 83, 84, 95, 96, 99, 100].map(n => rarityOf(n))).toEqual(['common', 'uncommon', 'uncommon', 'rare', 'rare', 'epic', 'epic', 'legendary'])
  })

  test('about 86% of a Mage\'s gear drops are wearable by a Mage', async () => {
    const forMage = BASES.filter(b => b.cls === undefined || b.cls === 'mage').length / BASES.length
    const expected = 0.75 + 0.25 * forMage
    const g = { ...newGame(5, 'mage'), dryKills: -1000 }
    let wearable = 0
    const n = 3000
    for (let i = 0; i < n; i += 1) if (canWear(g, makeItem(g))) wearable += 1
    expect(Math.abs(wearable / n - expected)).toBeLessThan(0.03)
  })

  test('the potion chance falls 10 after a potion and rises 10 after a kill without one', async () => {
    const sure = { ...plainHero(), potionChance: 100 }
    expect(killConsumable(sure)).toBe('health')
    expect(sure.potionChance).toBe(90)
    const never = { ...plainHero(), potionChance: 0, seed: 7 }
    killConsumable(never)
    expect(never.potionChance).toBe(10)
  })

  test('every kill without an Epic or better improves the next roll, and one dropping resets it', async () => {
    const g = { ...plainHero(), dryKills: 0 }
    let sawEpic = false
    for (let i = 0; i < 400 && !sawEpic; i += 1) {
      const before = g.dryKills
      const item = makeItem(g)
      sawEpic = item.rarity === 'epic' || item.rarity === 'legendary'
      expect(g.dryKills).toBe(sawEpic ? 0 : before + 1)
    }
    expect(sawEpic).toBe(true)
  })
})

describe('rarity by depth', () => {
  const share = (depth: number, n = 6000) => {
    const g = { ...plainHero(), depth, dryKills: 0 }
    const seen: Record<string, number> = {}
    for (let i = 0; i < n; i += 1) {
      g.dryKills = 0
      const r = makeItem(g).rarity
      seen[r] = (seen[r] ?? 0) + 1
    }
    return (r: string) => (seen[r] ?? 0) / n
  }

  test('Legendary stays rare however deep: at most about 2% at depth 40', async () => {
    const at40 = share(40)
    expect(at40('legendary')).toBeLessThan(0.03)
    expect(at40('epic')).toBeLessThan(0.11)
  })

  test('depth moves a point a depth off Common, down to a floor of 30%', async () => {
    expect(tierWeights(1).common).toBe(55)
    expect(tierWeights(11).common).toBe(45)
    expect(tierWeights(26).common).toBe(30)
    expect(tierWeights(40).common).toBe(30)
    expect(Math.abs(share(11)('common') - 0.45)).toBeLessThan(0.03)
  })
})

describe('bad-luck protection', () => {
  const lucky = (w: ReturnType<typeof tierWeights>) => w.epic + w.legendary
  test('does nothing for the first 10 items without an Epic or better, then rises to double at 20', async () => {
    const base = lucky(tierWeights(10, 0))
    expect(lucky(tierWeights(10, 10))).toBe(base)
    expect(Math.round(lucky(tierWeights(10, 15)) * 1e9) / 1e9).toBe(Math.round(base * 1.5 * 1e9) / 1e9)
    expect(Math.round(lucky(tierWeights(10, 20)) * 1e9) / 1e9).toBe(Math.round(base * 2 * 1e9) / 1e9)
    expect(Math.round(lucky(tierWeights(10, 28)) * 1e9) / 1e9).toBe(Math.round(base * 2 * 1e9) / 1e9)
  })

  test('the 30th item in a row without an Epic or better is an Epic or better, every time', async () => {
    for (let seed = 1; seed <= 60; seed += 1) {
      const g = { ...plainHero(seed), depth: 3, dryKills: 29 }
      expect(['epic', 'legendary']).toContain(makeItem(g).rarity)
      expect(g.dryKills).toBe(0)
    }
  })
})

describe('what drops', () => {
  test('a kill leaves an item 35% of the time plus 1% a depth, at most 55%', async () => {
    expect([1, 10, 20, 30].map(itemChance)).toEqual([36, 45, 55, 55])
  })

  test('a best-of-two roll lifts Epic or better from about 7% to about 12% at depth 10', async () => {
    // Worked from the weights: cumulative to Rare 46 + 33.6 + 14.4 = 94%, so one roll misses Epic+ 94% of the
    // time and two rolls 0.94^2 = 88.4%: 11.6% Epic or better.
    const g = { ...plainHero(), depth: 10, dryKills: 0 }
    let lucky = 0
    for (let i = 0; i < 6000; i += 1) {
      g.dryKills = 0
      const r = makeItem(g, 'uncommon', 2).rarity
      expect(r).not.toBe('common')
      if (r === 'epic' || r === 'legendary') lucky += 1
    }
    expect(lucky / 6000).toBeGreaterThan(0.095)
    expect(lucky / 6000).toBeLessThan(0.14)
  })

  test('a Legendary grows with depth like any item: a point on each stat it has every 3 depths, 2 on HP', async () => {
    const segfault = (depth: number) => {
      for (let seed = 1; seed < 5000; seed += 1) {
        const g = { ...plainHero(seed), depth, dryKills: 0 }
        const item = makeItem(g, 'legendary')
        if (item.name.startsWith('Segfault')) return item
      }
      throw new Error('no Segfault')
    }
    expect(segfault(1).atk).toBe(8)
    expect(segfault(18).atk).toBe(14)
    expect(segfault(18).def).toBe(0)
  })

  test('selling pays 2, 5, 6, 12 and 20 times worth by tier', async () => {
    expect(PRICE).toEqual({ common: 2, uncommon: 5, rare: 6, epic: 12, legendary: 20 })
  })
})

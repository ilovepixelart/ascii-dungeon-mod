import { describe, expect, test } from 'claude-code/testing'

import type { Consumable, Game } from '../types'
import { HEALING_DROP_SHARE } from './balance'
import { CONSUMABLES, KINDS, addToBelt, emptyBelt, killConsumable, tierFor, useBelt } from './consumables'
import { toVersion7 } from './save'
import { consumableIcon } from './icons'
import { PAL } from './pixelart'
import { foeAhead, plainHero } from './fixtures'
import { apply, newGame } from './game'
import { BASES, PRICE, canWear, makeItem, rarityOf, tierWeights } from './items'
import { itemChance } from './game'

const withBelt = (belt: Game['belt']): Game => ({ ...plainHero(), belt })

/** A belt holding one slot: `kind` in its own place, `tiers` of it. */
const oneSlot = (kind: Consumable, tiers: [number, number, number]): Game['belt'] => KINDS.map(k => (k === kind ? { kind, tiers } : null))

describe('the belt', () => {
  test('has a slot a kind, 1 to 5: health, regeneration, fury, ward, smoke', async () => {
    expect(KINDS).toEqual(['health', 'regen', 'fury', 'ward', 'smoke'])
  })

  test('puts each kind in its own slot, whatever order they come in', async () => {
    const g = withBelt(emptyBelt())
    for (const kind of ['smoke', 'fury', 'health', 'ward', 'regen'] as const) expect(addToBelt(g, kind)).toBe(true)
    expect(g.belt.map(s => s?.kind)).toEqual(['health', 'regen', 'fury', 'ward', 'smoke'])
  })

  test('stacks each tier up to 99; a full tier refuses one more and leaves the other tiers room', async () => {
    const g = withBelt(emptyBelt())
    for (let i = 0; i < 99; i += 1) expect(addToBelt(g, 'health', 1)).toBe(true)
    expect(addToBelt(g, 'health', 1)).toBe(false)
    expect(addToBelt(g, 'health', 2)).toBe(true)
    expect(g.belt[0]).toEqual({ kind: 'health', tiers: [99, 1, 0] })
  })

  test('a slot full of one kind never blocks another kind', async () => {
    const g = withBelt(KINDS.map(kind => ({ kind, tiers: [99, 99, 99] as [number, number, number] })).map((s, i) => (i === 0 ? null : s)))
    expect(addToBelt(g, 'health')).toBe(true)
  })

  test('uses the strongest tier first, then the next, and empties the slot after the last', async () => {
    const g = withBelt(oneSlot('health', [1, 0, 1]))
    g.hp = 1
    expect(useBelt(g, 0)).toBe(`You drink an Elixir. +${g.maxHp - 1} HP`)
    expect(g.belt[0]).toEqual({ kind: 'health', tiers: [1, 0, 0] })
    g.hp = 1
    expect(useBelt(g, 0)).toBe(`You drink a Health Potion. +${Math.ceil(g.maxHp * 0.35)} HP`)
    expect(g.belt[0]).toBeNull()
    expect(useBelt(g, 0)).toBe('Belt slot 1 is empty.')
  })

  test('uses the tier asked for, keeping the stronger one for later', async () => {
    const g = apply(withBelt(oneSlot('health', [1, 0, 1])), { kind: 'use', slot: 0, tier: 1 })
    expect(g.belt[0]).toEqual({ kind: 'health', tiers: [0, 0, 1] })
    expect(g.log.at(-1)).toMatch(/^You drink a Health Potion\./)
  })

  test('a chosen tier is used first, nothing used in choosing; once it runs out the slot goes back to its strongest', async () => {
    let g = apply(withBelt(oneSlot('health', [2, 0, 1])), { kind: 'choose', slot: 0, tier: 1 })
    expect(g.belt[0]).toEqual({ kind: 'health', tiers: [2, 0, 1], chosen: 1 })
    g = apply(g, { kind: 'use', slot: 0 })
    expect(g.belt[0]).toEqual({ kind: 'health', tiers: [1, 0, 1], chosen: 1 })
    expect(g.log.at(-1)).toMatch(/^You drink a Health Potion\./)
    g = apply(g, { kind: 'use', slot: 0 })
    expect(g.belt[0]).toEqual({ kind: 'health', tiers: [0, 0, 1] })
    g = apply(g, { kind: 'use', slot: 0 })
    expect(g.log.at(-1)).toMatch(/^You drink an Elixir\./)
  })

  test('a pick of a tier the slot does not hold changes nothing and says so; one more of a kind keeps the pick', async () => {
    const g = apply(withBelt(oneSlot('health', [2, 0, 0])), { kind: 'choose', slot: 0, tier: 3 })
    expect(g.belt[0]).toEqual({ kind: 'health', tiers: [2, 0, 0] })
    expect(g.log.at(-1)).toBe('You have no Elixir on your belt.')
    const picked = withBelt([{ kind: 'health', tiers: [2, 0, 1], chosen: 1 }, null, null, null, null])
    addToBelt(picked, 'health', 3)
    expect(picked.belt[0]).toEqual({ kind: 'health', tiers: [2, 0, 2], chosen: 1 })
  })

  test('a tier asked for that the slot does not hold uses nothing and says so', async () => {
    const g = apply(withBelt(oneSlot('health', [1, 0, 1])), { kind: 'use', slot: 0, tier: 2 })
    expect(g.belt[0]).toEqual({ kind: 'health', tiers: [1, 0, 1] })
    expect(g.log.at(-1)).toBe('You have no Greater Health Potion on your belt.')
  })

  test('each kind\'s three tiers have their own names', async () => {
    const names = KINDS.flatMap(k => [1, 2, 3].map(t => CONSUMABLES[k][t as 1 | 2 | 3].name))
    expect(new Set(names).size).toBe(15)
  })
})

describe('tiers by depth', () => {
  const shares = (depth: number, n = 20000) => {
    const g = { ...plainHero(), depth }
    const seen = [0, 0, 0]
    for (let i = 0; i < n; i += 1) seen[tierFor(g) - 1]! += 1
    return seen.map(k => k / n)
  }

  test('at depth 1: tier III 1 in 100, tier II 4 in 100, the rest tier I', async () => {
    const [one, two, three] = shares(1)
    expect(Math.abs(three! - 0.01)).toBeLessThan(0.005)
    expect(Math.abs(two! - 0.04)).toBeLessThan(0.008)
    expect(Math.abs(one! - 0.95)).toBeLessThan(0.01)
  })

  test('from depth 16 on: tier III 30 in 100, tier II 45, tier I 25', async () => {
    for (const depth of [16, 40]) {
      const [one, two, three] = shares(depth)
      expect(Math.abs(three! - 0.3)).toBeLessThan(0.015)
      expect(Math.abs(two! - 0.45)).toBeLessThan(0.015)
      expect(Math.abs(one! - 0.25)).toBeLessThan(0.015)
    }
  })
})

describe('a belt saved before tiers', () => {
  test('moves each old stack to its kind\'s slot at the tier it became, adding stacks of one kind', async () => {
    const old = [{ kind: 'greater', count: 1 }, { kind: 'mapping', count: 2 }, { kind: 'health', count: 3 }, { kind: 'smoke', count: 1 }, { kind: 'health', count: 2 }]
    expect(toVersion7(old)).toEqual([{ kind: 'health', tiers: [5, 0, 1] }, null, null, null, { kind: 'smoke', tiers: [1, 0, 2] }])
  })

  test('caps a merged stack at 9 and drops a kind it does not know', async () => {
    const old = [{ kind: 'ward', count: 9 }, { kind: 'ward', count: 4 }, { kind: 'scroll of doom', count: 3 }, null]
    expect(toVersion7(old)).toEqual([null, null, null, { kind: 'ward', tiers: [9, 0, 0] }, null])
  })
})

describe('effects', () => {
  const foeGame = (over: Partial<Game>) => {
    const g = { ...plainHero(), ...over }
    return { ...g, foe: foeAhead(g, 1, { hp: 999, maxHp: 999, atk: 3, opened: true }) }
  }

  test('a Ward Rune absorbs exactly the next 2 hits', async () => {
    let g = apply(foeGame({ belt: oneSlot('ward', [1, 0, 0]) }), { kind: 'use', slot: 3 })
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

  test('a Healing Herb heals a tenth of max HP after each of the next 5 fights', async () => {
    let g = apply(foeGame({ hp: 2, belt: oneSlot('regen', [1, 0, 0]) }), { kind: 'use', slot: 1 })
    g = { ...g, foe: null }
    const seen: number[] = []
    for (let i = 0; i < 6; i += 1) {
      const before = g.hp
      g = apply({ ...g, effects: { ...g.effects } }, { kind: 'outcome', ok: true, what: 'Edit' })
      seen.push(g.hp - before)
    }
    expect(seen).toEqual([2, 2, 2, 2, 2, 0])
  })

  test('a Passage Bomb reveals the whole level, with no foe to escape', async () => {
    const g = apply(withBelt(oneSlot('smoke', [0, 0, 1])), { kind: 'use', slot: 4 })
    expect(g.seen.includes('0')).toBe(false)
  })

  test('a Smoke Bomb makes the foe lose the hero, and reveals nothing', async () => {
    const before = foeGame({ belt: oneSlot('smoke', [1, 0, 0]) })
    const g = apply(before, { kind: 'use', slot: 4 })
    expect(g.foe).toBeNull()
    expect(g.seen).toBe(before.seen)
  })

  test('a Shadow Bomb escapes the foe and restores a fifth of max HP', async () => {
    const g = apply(foeGame({ hp: 5, belt: oneSlot('smoke', [0, 1, 0]) }), { kind: 'use', slot: 4 })
    expect(g.foe).toBeNull()
    expect(g.hp).toBe(5 + Math.ceil(g.maxHp * 0.2))
  })

  test('a stronger tier lasts longer: a Greater Ward Rune absorbs 3 hits, a Scroll of Battle and Troll Moss their counts', async () => {
    expect(apply(foeGame({ belt: oneSlot('ward', [0, 1, 0]) }), { kind: 'use', slot: 3 }).effects.ward).toBe(3)
    expect(apply(foeGame({ belt: oneSlot('ward', [0, 0, 1]) }), { kind: 'use', slot: 3 }).effects.ward).toBe(5)
    expect(apply(foeGame({ belt: oneSlot('fury', [0, 1, 0]) }), { kind: 'use', slot: 2 }).effects.fury).toBe(8)
    expect(apply(foeGame({ belt: oneSlot('regen', [0, 0, 1]) }), { kind: 'use', slot: 1 }).effects.regen).toBe(12)
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
    // A chance high enough that its share of it is sure.
    const sure = { ...plainHero(), potionChance: 100 / HEALING_DROP_SHARE }
    expect(killConsumable(sure)?.kind).toBe('health')
    expect(sure.potionChance).toBe(100 / HEALING_DROP_SHARE - 10)
    const never = { ...plainHero(), potionChance: 0, seed: 7 }
    killConsumable(never)
    expect(never.potionChance).toBe(10)
  })

  test('a kill takes healing at half its potion chance: at a chance of 100, about half of kills', async () => {
    expect(HEALING_DROP_SHARE).toBe(0.5)
    const kills = Array.from({ length: 600 }, (_, seed) => killConsumable({ ...plainHero(), potionChance: 100, seed: seed + 1 }))
    const share = kills.filter(d => d?.kind === 'health').length / kills.length
    expect([share > 0.42, share < 0.58]).toEqual([true, true])
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

describe('the items\' icons', () => {
  test('all fifteen are their own: 8 by 8, palette colors only, no two alike', async () => {
    const icons = KINDS.flatMap(kind => ([1, 2, 3] as const).map(tier => consumableIcon(kind, tier)))
    expect(new Set(icons.map(i => i.join('/'))).size).toBe(15)
    for (const icon of icons) {
      expect(icon).toHaveLength(8)
      for (const row of icon) {
        expect(row).toHaveLength(8)
        for (const k of row) expect(k === '.' || PAL[k] !== undefined).toBe(true)
      }
    }
  })
})

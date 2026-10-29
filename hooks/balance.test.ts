import { describe, expect, test } from 'claude-code/testing'

import { armorShare, deepGrowth, foeAtk, foeHp, heroDamage, xpToLevel } from './balance'
import { simulate } from './sim'

describe('the balance formulas', () => {
  test('XP per level: 20, 57, 104, 160 for levels 1 to 4', async () => {
    expect([1, 2, 3, 4].map(xpToLevel)).toEqual([20, 57, 104, 160])
  })
  test('a depth-1 rat has 13 to 16 HP and hits for 5 or 7; a depth-10 dragon 81 to 84 HP, hitting 19 or 22', async () => {
    // The plain sums (4 or 6, 16 or 18) times FOE_ATK_SCALE 1.2, rounded: 4.8, 7.2, 19.2, 21.6.
    expect([foeHp(1, 0, 1), foeHp(1, 0, 4)]).toEqual([13, 16])
    expect([foeAtk(1, 0, 1), foeAtk(1, 0, 2)]).toEqual([5, 7])
    expect([foeHp(10, 7, 1), foeHp(10, 7, 4)]).toEqual([81, 84])
    expect([foeAtk(10, 7, 1), foeAtk(10, 7, 2)]).toEqual([19, 22])
  })
  test('past depth 10 foes grow half a percent more HP a depth: a depth-30 rat 10% over the plain sum, a depth-110 one half again', async () => {
    expect([1, 10, 11, 30, 110].map(deepGrowth)).toEqual([1, 1, 1.005, 1.1, 1.5])
    // The plain sum 6 + 180 + 0 + 1 is 187; a tenth more, rounded: 206.
    expect(foeHp(30, 0, 1)).toBe(206)
  })
  test('foe attack grows as depth does, with no deep growth: (30 + 3) and (200 + 3) times 1.2 are 39.6 and 243.6', async () => {
    expect([foeAtk(30, 0, 1), foeAtk(200, 0, 1)]).toEqual([40, 244])
  })
  test("the share of a blow armor lets through: K over K plus defense, K being 0.9 of the depth plus 10, never under a quarter", async () => {
    // Depth 30: K is 36, so 52 defense lets 36 / 88 through; depth 1 with none lets all of it; depth 190: K 180, 286 defense.
    expect([armorShare(52, 30), armorShare(0, 1), armorShare(286, 190)].map(s => Math.round(s * 1e6) / 1e6)).toEqual([0.409091, 1, 0.386266])
    // Defense equal to K halves a blow; ten times K would let 1/11 through, held at the floor.
    expect(armorShare(36, 30)).toBe(0.5)
    expect(armorShare(360, 30)).toBe(0.25)
  })

  test('hero damage grows half a point a level', async () => {
    expect([heroDamage(1, 1, 0), heroDamage(2, 1, 0), heroDamage(10, 1, 0)]).toEqual([2, 3, 7])
  })
})

describe('the feel of a session', () => {
  // Alone the 18 games take under a second; beside the other test files they can pass the 5 s default.
  test('fights cost something: about 3 hits a kill, potions get drunk, and the hero can die', { timeoutMs: 60000 }, async () => {
    // 18 games of about 325 tool calls: a death every 150 to 200 calls is 1.6 to 2.2 per 1,000 steps. The band is
    // wider for the sample's spread; under 0.8 is the game gone easy again, over 3.5 a hero dying every 90 calls.
    const runs = (['knight', 'mage', 'rogue'] as const).flatMap(cls => [1, 2, 3, 4, 5, 6].map(seed => simulate(seed, 1000, cls)))
    const steps = runs.length * 1000
    const deaths = runs.reduce((n, r) => n + r.stats.deaths, 0)
    const potions = runs.reduce((n, r) => n + r.stats.potionsUsed, 0) / runs.length
    const kills = runs.reduce((n, r) => n + r.stats.kills, 0)
    const hits = runs.reduce((n, r) => n + r.records.reduce((m, s) => m + s.said.filter(l => /^You (CRITICALLY )?hit /.test(l)).length, 0), 0)
    expect(hits / kills + 1).toBeGreaterThan(2.3)
    expect(hits / kills + 1).toBeLessThan(4.5)
    expect(potions).toBeGreaterThan(4)
    expect(potions).toBeLessThan(20)
    expect((deaths * 1000) / steps).toBeGreaterThan(0.8)
    expect((deaths * 1000) / steps).toBeLessThan(3.5)
  })
})

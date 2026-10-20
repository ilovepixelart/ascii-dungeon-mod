import { describe, expect, test } from 'claude-code/testing'

import type { Game, Item, Rarity } from '../types'
import { apply, tradeInOf } from './game'
import { plainHero } from './fixtures'
import { BAG_H, BAG_W, plainItem, priceOf } from './items'
import { talkAction } from './talk'

const RANK: readonly Rarity[] = ['common', 'uncommon', 'rare', 'epic', 'legendary']
/** A bag piece of `rarity` at column `x`, one cell. */
const piece = (id: number, rarity: Rarity, x: number, over: Partial<Item> = {}): Item => ({ ...plainItem({ nextId: id }, 'ring', rarity), x, y: 0, ...over })
const atGuard = (bag: Item[], over: Partial<Game> = {}): Game => ({ ...apply(plainHero(3), { kind: 'portal' }), bag, panel: 'guard', ...over })
const trade = (g: Game) => apply(g, { kind: 'tradeIn' })

describe('the guard\'s trade-in', () => {
  test('takes three of the lowest tier with three to spare, marked junk first, then the cheapest; never a locked one', async () => {
    const commons = [piece(1, 'common', 0, { junk: true }), piece(2, 'common', 1, { locked: true }), piece(3, 'common', 2), piece(4, 'common', 3), piece(5, 'common', 4, { atk: 9 })]
    const rares = [piece(6, 'rare', 5), piece(7, 'rare', 6), piece(8, 'rare', 7)]
    const taken = tradeInOf({ bag: [...commons, ...rares] }).map(i => i.id)
    // 1 is junk; 3 and 4 are cheaper than 5 with its attack; 2 is locked.
    expect(priceOf(commons[4]!)).toBeGreaterThan(priceOf(commons[2]!))
    expect(taken).toEqual([1, 3, 4])
    expect(tradeInOf({ bag: [commons[0]!, commons[2]!, ...rares] }).map(i => i.rarity)).toEqual(['rare', 'rare', 'rare'])
    expect(tradeInOf({ bag: [piece(9, 'epic', 0), piece(10, 'epic', 1), piece(11, 'epic', 2)] })).toEqual([])
  })

  test('gives one piece of the next tier or better for them, said', async () => {
    for (const seed of [1, 2, 3, 4, 5, 6]) {
      const g = atGuard([piece(1, 'uncommon', 0), piece(2, 'uncommon', 1), piece(3, 'uncommon', 2)], { seed })
      const after = trade(g)
      expect(after.bag).toHaveLength(1)
      expect(RANK.indexOf(after.bag[0]!.rarity)).toBeGreaterThanOrEqual(RANK.indexOf('rare'))
      expect(after.log.some(l => l.startsWith('The guard takes your ') && l.includes(after.bag[0]!.name))).toBe(true)
    }
  })

  test('with no room for what it gives, the three stay, said; with three of no tier, it says what it wants', async () => {
    // Three small Commons in a bag otherwise full, and nothing the size of the gift free once they go.
    const three = [piece(1, 'common', 0), piece(2, 'common', 1), piece(3, 'common', 2)]
    const filler = Array.from({ length: BAG_W - 3 }, (_, i) => ({ ...plainItem({ nextId: 50 + i }, 'chain', 'epic'), w: 1, h: BAG_H, x: 3 + i, y: 0 }))
    const below = Array.from({ length: 3 }, (_, i) => ({ ...plainItem({ nextId: 70 + i }, 'chain', 'epic'), w: 1, h: BAG_H - 1, x: i, y: 1 }))
    // Once the three go, a strip three cells wide and one tall is free: a ring fits, a sword does not.
    const outcomes = [1, 2, 3, 4, 5, 6, 7, 8, 9, 10, 11, 12].map(seed => {
      const tight = atGuard([...three, ...filler, ...below], { seed, world: seed })
      const after = trade(tight)
      const kept = after.bag.map(i => i.id).sort((m, n) => m - n).join() === tight.bag.map(i => i.id).sort((m, n) => m - n).join()
      if (kept) expect(after.log).toContain('The guard: "No room in your bag for what I would give you."')
      else expect(after.bag.filter(i => three.some(t => t.id === i.id))).toEqual([])
      return kept
    })
    expect(outcomes).toContain(true)
    expect(trade(atGuard([piece(1, 'common', 0)])).log).toContain('The guard: "Bring me three spare pieces of a kind, and the armory has better."')
  })

  test('the guard\'s button is lit with three to trade, dark without; in the dungeon there is no guard', async () => {
    expect(talkAction(atGuard([piece(1, 'common', 0), piece(2, 'common', 1), piece(3, 'common', 2)]), 'guard')).toMatchObject({ key: 'T', label: 'TRADE IN', state: 'ready' })
    expect(talkAction(atGuard([piece(1, 'common', 0)]), 'guard')).toMatchObject({ state: 'off' })
    expect(trade({ ...plainHero(3), bag: [] }).log).toContain('The guard is in town.')
  })
})

test('a trade-in refused for want of room leaves the game as it was: the three, the roll, the bad-luck counts', async () => {
  const three = [piece(1, 'common', 0), piece(2, 'common', 1), piece(3, 'common', 2)]
  const filler = Array.from({ length: BAG_W - 3 }, (_, i) => ({ ...plainItem({ nextId: 50 + i }, 'chain', 'epic'), w: 1, h: BAG_H, x: 3 + i, y: 0 }))
  const below = Array.from({ length: 3 }, (_, i) => ({ ...plainItem({ nextId: 70 + i }, 'chain', 'epic'), w: 1, h: BAG_H - 1, x: i, y: 1 }))
  for (const seed of [1, 2, 3, 4, 5, 6, 7, 8, 9, 10, 11, 12]) {
    const g = atGuard([...three, ...filler, ...below], { seed, world: seed, dryKills: 20, sinceRare: 5 })
    const after = trade(g)
    if (!after.log.includes('The guard: "No room in your bag for what I would give you."')) continue
    const { log: _a, fresh: _b, ...rest } = after
    const { log: _c, fresh: _d, ...was } = g
    expect(rest).toEqual(was)
  }
})

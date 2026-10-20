import { describe, expect, test } from 'claude-code/testing'

import type { Game, Item, Rarity } from '../types'
import { apply, gambleCost } from './game'
import { plainHero } from './fixtures'
import { BAG_H, BAG_W, plainItem } from './items'
import { talkAction } from './talk'

const RANK: readonly Rarity[] = ['common', 'uncommon', 'rare', 'epic', 'legendary']
/** A hero in town with the villager's window open, `gold` to spend. */
const atVillager = (gold: number, over: Partial<Game> = {}): Game => ({ ...apply({ ...plainHero(3), deepest: 10 }, { kind: 'portal' }), gold, panel: 'villager', ...over })
const fullBag = (): Item[] => Array.from({ length: BAG_W }, (_, i) => ({ ...plainItem({ nextId: 6000 + i }, 'chain'), w: 1, h: BAG_H, x: i, y: 0 }))
const gamble = (g: Game) => apply(g, { kind: 'gamble' })

describe('the villager\'s sealed pack', () => {
  test('costs 50 gold and 12 a depth of the deepest reached', async () => {
    expect([gambleCost({ deepest: 1 }), gambleCost({ deepest: 10 }), gambleCost({ deepest: 40 })]).toEqual([62, 170, 530])
  })

  test('bought, takes its price and puts an item of Uncommon or better in the bag, said', async () => {
    for (const seed of [1, 2, 3, 4, 5, 6, 7, 8]) {
      const g = atVillager(1000, { seed })
      const after = gamble(g)
      const got = after.bag.filter(i => !g.bag.some(b => b.id === i.id))
      expect([got.length, after.gold]).toEqual([1, 1000 - 170])
      expect(RANK.indexOf(got[0]!.rarity)).toBeGreaterThanOrEqual(RANK.indexOf('uncommon'))
      expect(after.log.some(l => l.startsWith(`You pay the villager 170 gold and open the pack: ${got[0]!.name} (`))).toBe(true)
    }
  })

  test('short of its price, nothing is bought and the price is said', async () => {
    const after = gamble(atVillager(169))
    expect([after.gold, after.bag.length]).toEqual([169, atVillager(169).bag.length])
    expect(after.log).toContain('The villager: "A sealed pack is 170 gold. No peeking."')
  })

  test('with no room in the bag, nothing is paid, said', async () => {
    const after = gamble(atVillager(1000, { bag: fullBag() }))
    expect([after.gold, after.bag.length]).toEqual([1000, BAG_W])
    expect(after.log).toContain('The villager: "Make room in your bag first."')
  })

  test('the villager\'s button is lit with the price in hand, dark without; in the dungeon there is no villager', async () => {
    expect(talkAction(atVillager(170), 'villager')).toMatchObject({ key: 'G', label: 'GAMBLE', cost: 170, state: 'ready' })
    expect(talkAction(atVillager(169), 'villager')).toMatchObject({ canPay: false, state: 'off' })
    expect(gamble({ ...plainHero(3), gold: 1000 }).log).toContain('The villager is in town.')
  })
})

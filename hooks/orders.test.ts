import { describe, expect, test } from 'claude-code/testing'

import type { Game, Orders } from '../types'
import { DEFAULT_ORDERS, apply } from './game'
import { foeAhead, plainHero } from './fixtures'
import { countOf, slotOf } from './consumables'

/** The hero at `hp` of 20 with orders, struck by a goblin of `atk` that has met the knight's shield: a failed call. */
const struck = (hp: number, atk: number, orders?: Partial<Orders>, over: Partial<Game> = {}) => {
  const g: Game = { ...plainHero(4), hp, ...(orders === undefined ? {} : { orders: { ...DEFAULT_ORDERS, ...orders } }), ...over }
  return apply({ ...g, foe: foeAhead(g, 1, { atk, opened: true, hp: 99, maxHp: 99 }) }, { kind: 'outcome', ok: false, what: 'Bash' })
}
const potions = (g: Game) => countOf(g.belt[slotOf('health')])
const SMOKE_BELT = (g: Game) => g.belt.map((s, i) => (i === slotOf('smoke') ? { kind: 'smoke' as const, tiers: [1, 0, 0] as [number, number, number] } : s))

describe('drink', () => {
  test('by default the hero drinks a healing potion once a blow leaves them under a quarter of their HP', async () => {
    const after = struck(8, 5)
    expect(potions(after)).toBe(0)
    expect(after.log.some(l => l.startsWith('You drink a Health Potion.'))).toBe(true)
    expect(after.hp).toBeGreaterThan(3)
  })

  test('at a quarter or more, nothing is drunk', async () => {
    expect(potions(struck(10, 5))).toBe(1)
  })

  test('at half, a blow that leaves them under half is enough', async () => {
    expect(potions(struck(12, 5, { drink: 50 }))).toBe(0)
    expect(potions(struck(12, 5, { drink: 25 }))).toBe(1)
  })

  test('never: the hero drinks nothing on their own, however low', async () => {
    expect(potions(struck(6, 5, { drink: 0 }))).toBe(1)
  })

  test('a fatal blow is not undone by a potion', async () => {
    expect(struck(3, 9).deaths).toBe(1)
  })
})

describe('smoke', () => {
  test('when low with no healing left, a smoke bomb loses the foe', async () => {
    const g = plainHero(4)
    const after = struck(8, 5, { smoke: true }, { belt: SMOKE_BELT({ ...g, belt: g.belt.map((s, i) => (i === slotOf('health') ? null : s)) }) })
    expect(after.foe).toBeNull()
    expect(after.log.some(l => l.startsWith('You vanish in smoke.'))).toBe(true)
  })

  test('a potion comes first: with one on the belt the hero drinks and stays', async () => {
    const g = plainHero(4)
    const after = struck(8, 5, { smoke: true }, { belt: SMOKE_BELT(g) })
    expect(potions(after)).toBe(0)
    expect(after.foe).not.toBeNull()
  })

  test('not while healing is left, even with drinking turned off', async () => {
    const g = plainHero(4)
    const after = struck(8, 5, { smoke: true, drink: 0 }, { belt: SMOKE_BELT(g) })
    expect(after.foe).not.toBeNull()
    expect(potions(after)).toBe(1)
  })

  test('not while the hero is still above a quarter of their HP', async () => {
    const g = plainHero(4)
    const after = struck(15, 5, { smoke: true }, { belt: SMOKE_BELT({ ...g, belt: g.belt.map((s, i) => (i === slotOf('health') ? null : s)) }) })
    expect(after.foe).not.toBeNull()
  })

  test('off by default', async () => {
    const g = plainHero(4)
    const after = struck(8, 5, undefined, { belt: SMOKE_BELT({ ...g, belt: g.belt.map((s, i) => (i === slotOf('health') ? null : s)) }) })
    expect(after.foe).not.toBeNull()
  })
})

describe('leave', () => {
  /** The first world whose one-blow kill of a one-HP goblin drops a Common item, taking everything. */
  const commonDrop = () => {
    for (let seed = 1; seed < 400; seed += 1) {
      const g = { ...plainHero(seed), seed, world: seed }
      const kill = (orders: Orders) => apply({ ...g, orders, foe: foeAhead(g, 1, { hp: 1, maxHp: 1, opened: true }) }, { kind: 'outcome', ok: true, what: 'Edit' })
      const took = kill(DEFAULT_ORDERS)
      const found = took.bag.find(i => !g.bag.some(b => b.id === i.id))
      if (found?.rarity === 'common') return { found, took, left: kill({ ...DEFAULT_ORDERS, leave: 'uncommon' }) }
    }
    throw new Error('no world drops a Common')
  }

  test('a kill\'s item below the rarity kept stays on the floor, said; the same kill taking all keeps it', async () => {
    const { found, took, left } = commonDrop()
    expect(took.bag.some(i => i.id === found.id)).toBe(true)
    expect(left.bag.some(i => i.name === found.name && i.rarity === 'common')).toBe(false)
    expect(left.log).toContain(`You leave the ${found.name} (Common).`)
  })
})

describe('changing orders', () => {
  const order = (g: Game, which: 'drink' | 'smoke' | 'leave') => apply(g, { kind: 'order', order: which })
  test('drink steps quarter, half, never and round; smoke flips; leave steps take all, leave commons, leave below rare and round', async () => {
    let g = plainHero(1)
    const drinks: number[] = []
    for (let i = 0; i < 3; i += 1) drinks.push((g = order(g, 'drink')).orders!.drink)
    expect(drinks).toEqual([50, 0, 25])
    expect(order(g, 'smoke').orders!.smoke).toBe(true)
    expect(order(order(g, 'smoke'), 'smoke').orders!.smoke).toBe(false)
    const leaves: string[] = []
    for (let i = 0; i < 3; i += 1) leaves.push((g = order(g, 'leave')).orders!.leave)
    expect(leaves).toEqual(['uncommon', 'rare', 'common'])
  })

  test('in town as in the dungeon', async () => {
    const town = apply(plainHero(1), { kind: 'portal' })
    expect(order(town, 'drink').orders!.drink).toBe(50)
  })
})

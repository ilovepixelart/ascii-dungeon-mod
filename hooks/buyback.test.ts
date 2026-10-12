import { describe, expect, test } from 'claude-code/testing'

import type { Game, Item, Rarity } from '../types'
import { apply } from './game'
import { foeAhead, plainHero } from './fixtures'
import { plainItem, priceOf, whyNotBuyBack } from './items'

const hero = (gold: number): Game => ({ ...plainHero(4), gold, bag: [] })
const put = (g: Game, base: string, rarity: Rarity, x: number, y: number, over: Partial<Item> = {}): Item => {
  const item = { ...plainItem(g, base, rarity), x, y, ...over }
  g.bag = [...g.bag, item]
  return item
}

describe('buying back the last sale', () => {
  test('a sold item comes back for what it fetched, and the sale is gone', async () => {
    const g = hero(10)
    const ring = put(g, 'ring', 'rare', 0, 0)
    g.cursor = ring.id
    const sold = apply(g, { kind: 'sell' })
    expect(sold.gold).toBe(10 + priceOf(ring))
    expect(sold.lastSold).toEqual({ items: [ring], coins: priceOf(ring) })
    const back = apply(sold, { kind: 'buyBack' })
    expect(back.gold).toBe(10)
    expect(back.bag.map(i => i.id)).toEqual([ring.id])
    expect(back.lastSold).toBeNull()
    expect(back.log.at(-1)).toBe(`You buy back the ${ring.name} for ${priceOf(ring)} gold.`)
  })

  test('a sale of junk comes back whole', async () => {
    const g = hero(0)
    const a = put(g, 'ring', 'common', 0, 0, { junk: true })
    const b = put(g, 'ring', 'epic', 1, 0, { junk: true })
    const sold = apply(g, { kind: 'sellJunk' })
    const back = apply(sold, { kind: 'buyBack' })
    expect(back.bag.map(i => i.id).sort()).toEqual([a.id, b.id].sort())
    expect(back.gold).toBe(0)
    expect(back.log.at(-1)).toBe(`You buy back 2 items for ${priceOf(a) + priceOf(b)} gold.`)
  })

  test('not without the gold, nor without room in the bag; then nothing changes', async () => {
    const g = hero(0)
    const ring = put(g, 'ring', 'rare', 0, 0)
    g.cursor = ring.id
    const sold = apply(g, { kind: 'sell' })
    const poor = { ...sold, gold: priceOf(ring) - 1 }
    expect(whyNotBuyBack(poor)).toBe('not enough gold')
    expect(apply(poor, { kind: 'buyBack' })).toMatchObject({ gold: priceOf(ring) - 1, bag: [], lastSold: sold.lastSold })
    const full = { ...sold, bag: [{ ...plainItem(sold, 'ring', 'common'), w: 8, h: 6, x: 0, y: 0 }] }
    expect(whyNotBuyBack(full)).toBe('no room in your bag')
    expect(apply(full, { kind: 'buyBack' }).lastSold).toEqual(sold.lastSold)
    expect(whyNotBuyBack(hero(99))).toBe('nothing sold')
    expect(apply(hero(99), { kind: 'buyBack' }).log.at(-1)).toBe('Nothing to buy back.')
  })

  test('the next sale takes its place; the portal, the stairs or a death let it go', async () => {
    const g = hero(0)
    const a = put(g, 'ring', 'rare', 0, 0)
    const b = put(g, 'ring', 'common', 1, 0)
    const first = apply({ ...g, cursor: a.id }, { kind: 'sell' })
    const second = apply({ ...first, cursor: b.id }, { kind: 'sell' })
    expect(second.lastSold?.items.map(i => i.id)).toEqual([b.id])
    expect(apply(second, { kind: 'portal' }).lastSold).toBeNull()
    expect(apply({ ...second, bossSlain: 99 }, { kind: 'descend' }).lastSold).toBeNull()
    const dead = apply({ ...second, hp: 1, foe: foeAhead(second, 1, { glyph: 'o', atk: 999, opened: true }) }, { kind: 'outcome', ok: false, what: 'Bash' })
    expect(dead.lastSold).toBeNull()
  })
})

import { describe, expect, test } from 'claude-code/testing'

import type { Game, Item } from '../types'
import { apply } from './game'
import { plainHero } from './fixtures'
import { BAG_X, BAG_Y } from './inventory'
import { CELL } from './icons'
import { LOCK_INK } from './pieces'
import { inventoryPixels } from './inventory'
import { plainItem } from './items'
import { shopOverlay } from './shop'

const withRing = (over: Partial<Item> = {}): { g: Game; ring: Item } => {
  const g = { ...plainHero(4), gold: 0, bag: [] as Item[] }
  const ring = { ...plainItem(g, 'ring', 'rare'), x: 2, y: 1, ...over }
  return { g: { ...g, bag: [ring], cursor: ring.id }, ring }
}

describe('a locked item', () => {
  test('is kept: not sold, not sold as junk, not marked as junk, not destroyed', async () => {
    const { g, ring } = withRing()
    const locked = apply(g, { kind: 'lock' })
    expect(locked.bag[0]?.locked).toBe(true)
    expect(locked.log.at(-1)).toBe(`You lock the ${ring.name}: it is kept whatever happens.`)
    for (const kind of ['sell', 'destroy', 'junk', 'sellJunk'] as const) {
      const after = apply(locked, { kind })
      expect(after.bag.map(i => i.id)).toEqual([ring.id])
      expect(after.gold).toBe(0)
      expect(after.bag[0]?.junk).not.toBe(true)
    }
    expect(apply(locked, { kind: 'sell' }).log.at(-1)).toBe(`The ${ring.name} is locked: unlock it to sell it.`)
  })

  test('locking clears its junk mark; unlocking lets it be sold again', async () => {
    const { g } = withRing({ junk: true })
    const locked = apply(g, { kind: 'lock' })
    expect(locked.bag[0]?.junk).not.toBe(true)
    const unlocked = apply(locked, { kind: 'lock' })
    expect(unlocked.bag[0]?.locked).toBeUndefined()
    expect(apply(unlocked, { kind: 'sell' }).bag).toEqual([])
  })

  test('keeps its lock worn and taken off again', async () => {
    const { g } = withRing()
    const locked = apply(g, { kind: 'lock' })
    const worn = apply({ ...locked, cls: 'knight' }, { kind: 'equip' })
    const ring = worn.gear.ring ?? worn.bag[0]
    expect(ring?.locked).toBe(true)
  })

  test('shows a padlock in its bottom-right corner; an unlocked one none', async () => {
    const { g, ring } = withRing()
    const corner = (game: Game) => {
      const px = inventoryPixels(game)
      const x = BAG_X + ring.x * CELL + 1 + ring.w * CELL - 1 - 3
      const y = BAG_Y + ring.y * CELL + 1 + ring.h * CELL - 1 - 4
      return px.slice(y, y + 4).flatMap(r => r.slice(x, x + 3))
    }
    expect(corner(apply(g, { kind: 'lock' }))).toContain(LOCK_INK)
    expect(corner(g)).not.toContain(LOCK_INK)
  })

  test('in the merchant\'s menu its Sell is greyed: locked', async () => {
    const { g } = withRing()
    const locked = apply(g, { kind: 'lock' })
    const menu = shopOverlay(locked, { ware: null, menu: true }).find(b => b.role === 'menu')!.lines.map(l => l.map(r => r.text).join(''))
    expect(menu[0]).toMatch(/^s Sell for \d+ {2}locked$/)
  })
})

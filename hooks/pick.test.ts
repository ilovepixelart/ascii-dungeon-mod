import { describe, expect, test } from 'claude-code/testing'

import type { Game, Item } from '../types'
import { apply } from './game'
import { foeAhead, plainHero } from './fixtures'
import { plainItem } from './items'

/** A hero whose bag has room for one ring: every cell filled but the last; two rings lying `ahead` tiles on the way. */
const setUp = (ahead = 3) => {
  const g = plainHero()
  const spot = foeAhead(g, ahead)
  const at = { x: spot.x, y: spot.y }
  let nextId = 500
  const ring = (name: string): Item => ({ ...plainItem({ nextId: nextId++ }, 'ring'), name })
  const bag: Item[] = []
  for (let y = 0; y < 6; y += 1) for (let x = 0; x < 8; x += 1) if (x !== 7 || y !== 5) bag.push({ ...ring(`Filler ${x},${y}`), x, y })
  const [first, second] = [ring('First Ring'), ring('Second Ring')]
  const game: Game = { ...g, bag, nextId, floor: [{ ...at, item: first }, { ...at, item: second }] }
  return { game, at, first, second }
}
const lying = (g: Game) => (g.floor ?? []).map(f => f.item.name)
const carried = (g: Game, name: string) => g.bag.some(i => i.name === name)

describe('picking an item from those lying on a tile', () => {
  test('with room for one, the one chosen is the one taken, the other left lying', async () => {
    const { game, at, second } = setUp()
    const after = apply(game, { kind: 'pick', ...at, id: second.id })
    expect([after.x, after.y]).toEqual([at.x, at.y])
    expect([carried(after, 'Second Ring'), carried(after, 'First Ring'), lying(after)]).toEqual([true, false, ['First Ring']])
    // Walked onto the tile with no choice, the first lying is the one taken.
    const plain = apply(game, { kind: 'goto', ...at })
    expect([carried(plain, 'First Ring'), lying(plain)]).toEqual([true, ['Second Ring']])
  })

  test('standing on the tile, it is taken there', async () => {
    const { game, at, second } = setUp()
    const there = { ...game, x: at.x, y: at.y }
    const after = apply(there, { kind: 'pick', ...at, id: second.id })
    expect([carried(after, 'Second Ring'), lying(after)]).toEqual([true, ['First Ring']])
    expect(after.log.slice(-2)).toEqual(['You pick up the Second Ring (Common).', 'The First Ring lies here; your bag is still full.'])
  })

  test('one no longer lying there is said, and nothing changes', async () => {
    const { game, at } = setUp()
    const after = apply(game, { kind: 'pick', ...at, id: 999 })
    expect([after.log.at(-1), after.x, after.y, lying(after)]).toEqual(['That is no longer there.', game.x, game.y, ['First Ring', 'Second Ring']])
  })
})

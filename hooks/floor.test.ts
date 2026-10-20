import { describe, expect, test } from 'claude-code/testing'

import type { Foe, Game, Item } from '../types'
import { STASH_SIZE, apply, levelOf } from './game'
import { foeAhead, plainHero } from './fixtures'
import { BAG_H, BAG_W, RARITY_COLOR, plainItem } from './items'
import { cellId } from './map'
import { tileAt } from './panels'
import { arrive } from './world'

/** A bag filled to the last cell: a column-tall piece in each column. */
const fullBag = (): Item[] => Array.from({ length: BAG_W }, (_, i) => ({ ...plainItem({ nextId: 3000 + i }, 'chain'), w: 1, h: BAG_H, x: i, y: 0 }))
/** A hero with a one-HP foe the next step along, the bag full; a champion leaves an item every time. */
const facing = (over: Partial<Foe> = {}, g: Game = { ...plainHero(3), ...arrive(3, 3), depth: 3, deepest: 3 }): Game =>
  ({ ...g, bag: fullBag(), foe: foeAhead(g, 1, { hp: 1, maxHp: 1, opened: true, champion: 'tough', ...over }) })
const slay = (g: Game) => apply(g, { kind: 'attack' })
const step = (g: Game) => apply(g, { kind: 'explore', steps: 1 })

describe('an item found with the bag full', () => {
  test('lies where the foe fell, said', async () => {
    const g = facing()
    const after = slay(g)
    expect(after.floor).toHaveLength(1)
    const [lying] = after.floor!
    expect([lying!.x, lying!.y]).toEqual([g.foe!.x, g.foe!.y])
    expect(after.log).toContain(`Your bag is full. The ${lying!.item.name} lies where it fell.`)
    expect(after.bag).toHaveLength(BAG_W)
  })

  test('stepped onto with room, is picked up, said; still full, it lies there, said', async () => {
    const slain = slay(facing())
    const lying = slain.floor![0]!
    const kept = step({ ...slain, bag: [] })
    expect([kept.floor, kept.bag.map(i => i.name)]).toEqual([[], [lying.item.name]])
    expect(kept.log.some(l => l.startsWith(`You pick up the ${lying.item.name} (`))).toBe(true)
    const still = step(slain)
    expect([still.x, still.y]).toEqual([lying.x, lying.y])
    expect(still.floor).toEqual(slain.floor)
    expect(still.log).toContain(`The ${lying.item.name} lies here; your bag is still full.`)
  })

  test('waits through a trip to town and back; is left behind going down, said, and the floor below is bare', async () => {
    const slain = slay(facing())
    const back = apply(apply(slain, { kind: 'portal' }), { kind: 'portal' })
    expect([back.where, back.floor]).toEqual(['dungeon', slain.floor])
    const down = apply({ ...slain, bossSlain: 99 }, { kind: 'descend' })
    expect(down.depth).toBe(4)
    expect(down.floor).toEqual([])
    expect(down.log).toContain('You leave an item on the floor behind you.')
  })

  test('shows on the map as a * in its tier\'s color', async () => {
    const slain = slay(facing())
    const lying = slain.floor![0]!
    const level = levelOf(slain)
    const tile = tileAt(slain, level, new Set([cellId(lying)]), lying)
    expect(tile.occupant).toMatchObject({ glyph: '*', color: RARITY_COLOR[lying.item.rarity] })
  })
})

describe('a prize with the bag full', () => {
  test('a unique\'s goes to the stash in town, said; with the stash full too, it lies where it fell', async () => {
    const unique = { glyph: 'D', name: 'Emberjaw', unique: 'ember' as const, champion: undefined }
    const toStash = slay(facing(unique))
    expect([toStash.stashed.length, toStash.floor ?? []]).toEqual([1, []])
    expect(toStash.log.some(l => l.endsWith('Your bag is full: it waits in your stash in town.'))).toBe(true)
    const crowded = facing(unique)
    const stashFull = { ...crowded, stashed: Array.from({ length: STASH_SIZE }, (_, i) => plainItem({ nextId: 4000 + i }, 'ring')) }
    const toFloor = slay(stashFull)
    expect([toFloor.stashed.length, toFloor.floor?.length]).toEqual([STASH_SIZE, 1])
    expect(toFloor.log.some(l => l.endsWith('Your bag and your stash are full: it lies where it fell.'))).toBe(true)
  })

  test('work\'s cache, a push\'s, goes to the stash too: work is never paid with nothing', async () => {
    const g = { ...plainHero(5), depth: 7, deepest: 7, bag: fullBag() }
    const after = apply(g, { kind: 'outcome', ok: true, what: 'Bash', work: 'push' })
    expect(after.stashed).toHaveLength(1)
    expect(after.bag).toHaveLength(BAG_W)
  })
})

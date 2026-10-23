import { describe, expect, test } from 'claude-code/testing'

import type { Foe, Game, Item } from '../types'
import { alongTheWay, apply, isOnlyAWalk, levelOf } from './game'
import { foeAhead, fullTab, plainHero } from './fixtures'
import { BAG_H, BAG_W, RARITY_COLOR, plainItem } from './items'
import { bfs, cellId, isFloor } from './map'
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
    expect([toStash.stashed[0]!.length, toStash.floor ?? []]).toEqual([1, []])
    expect(toStash.log.some(l => l.endsWith('Your bag is full: it waits in your stash in town.'))).toBe(true)
    const crowded = facing(unique)
    const stashFull = { ...crowded, stashed: [fullTab(4000)] }
    const toFloor = slay(stashFull)
    expect([toFloor.stashed[0]!.length, toFloor.floor?.length]).toEqual([fullTab(4000).length, 1])
    expect(toFloor.log.some(l => l.endsWith('Your bag and your stash are full: it lies where it fell.'))).toBe(true)
  })

  test('work\'s cache, a push\'s, goes to the stash too: work is never paid with nothing', async () => {
    const g = { ...plainHero(5), depth: 7, deepest: 7, bag: fullBag() }
    const after = apply(g, { kind: 'outcome', ok: true, what: 'Bash', work: 'push' })
    expect(after.stashed[0]).toHaveLength(1)
    expect(after.bag).toHaveLength(BAG_W)
  })
})

describe('the floor, at its edges', () => {
  test('a cache earned in town with the bag and the stash full waits by the portal on the depth below, on its floor', async () => {
    const down = { ...plainHero(5), ...arrive(5, 4), depth: 4, deepest: 4 }
    const inTown = { ...apply(down, { kind: 'portal' }), bag: fullBag(), stashed: [fullTab(4000)] }
    const after = apply(inTown, { kind: 'outcome', ok: true, what: 'Bash', work: 'push' })
    expect(after.floor).toHaveLength(1)
    const lying = after.floor![0]!
    expect([lying.x, lying.y]).toEqual([down.x, down.y])
    expect(isFloor(levelOf(down).tiles, lying)).toBe(true)
    expect(after.log.some(l => l.endsWith('it waits by the portal in the dungeon.'))).toBe(true)
  })

  test('that cache, room made, is picked up stepping back through the portal, and by an answer finished in town', async () => {
    const down = { ...plainHero(5), ...arrive(5, 4), depth: 4, deepest: 4 }
    const inTown = { ...apply(down, { kind: 'portal' }), bag: fullBag(), stashed: [fullTab(4000)] }
    const earned = { ...apply(inTown, { kind: 'outcome', ok: true, what: 'Bash', work: 'push' }), bag: [] }
    const cache = earned.floor![0]!.item
    const back = apply(earned, { kind: 'portal' })
    expect([back.floor, back.bag.map(i => i.id)]).toEqual([[], [cache.id]])
    const finished = apply(earned, { kind: 'descend' })
    expect([finished.depth, finished.bag.map(i => i.id)]).toEqual([5, [cache.id]])
    expect(finished.log).not.toContain('You leave an item on the floor behind you.')
  })

  test('an item lying under the hero, room made, goes down with an answer finished; with no room it is left, said', async () => {
    const g = { ...plainHero(3), ...arrive(3, 3), depth: 3, deepest: 3 }
    const lying = { x: g.x, y: g.y, item: plainItem({ nextId: 7201 }, 'ring') }
    const finished = apply({ ...g, floor: [lying] }, { kind: 'descend' })
    expect([finished.depth, finished.bag.map(i => i.id)]).toEqual([4, [lying.item.id]])
    const full = apply({ ...g, floor: [lying], bag: fullBag() }, { kind: 'descend' })
    expect([full.depth, full.log.includes('You leave an item on the floor behind you.')]).toEqual([4, true])
  })

  test('a step onto a tile with two items lying on it picks up both, room allowing', async () => {
    const g = facing()
    const next = g.foe!
    const two = [{ x: next.x, y: next.y, item: plainItem({ nextId: 7001 }, 'ring') }, { x: next.x, y: next.y, item: plainItem({ nextId: 7002 }, 'amulet') }]
    const after = step({ ...g, foe: null, bag: [], floor: two })
    expect([after.floor, after.bag.length]).toEqual([[], 2])
  })

  test('slain, waking on the same depth keeps what lies on its floor; waking on another loses it, said', async () => {
    const base = { ...plainHero(3), ...arrive(3, 3), depth: 3, deepest: 3, hp: 1 }
    const lying = [{ x: base.x, y: base.y, item: plainItem({ nextId: 7101 }, 'ring') }]
    const slayer = (g: Game) => apply({ ...g, foe: foeAhead(g, 1, { opened: true, atk: 99 }) }, { kind: 'outcome', ok: false, what: 'Bash' })
    const same = slayer({ ...base, waypoint: 3, floor: lying })
    expect([same.depth, same.floor]).toEqual([3, lying])
    const other = slayer({ ...base, ...arrive(3, 4), deepest: 4, floor: lying })
    expect([other.depth, other.floor]).toEqual([1, []])
    expect(other.log).toContain('The item left on the floor of depth 4 is lost.')
  })
})

describe('a walk begun on a tile with something lying on it', () => {
  // A bag with one free cell: room for one ring. Ring A lies under the hero, ring B on the way to the stairs.
  const oneFree = (): Item[] => Array.from({ length: BAG_W }, (_, i) => ({ ...plainItem({ nextId: 3000 + i }, 'chain'), w: 1, h: i === BAG_W - 1 ? BAG_H - 1 : BAG_H, x: i, y: 0 }))
  const ring = (id: number) => ({ ...plainItem({ nextId: id }, 'ring'), w: 1, h: 1 })
  const set = () => {
    const base = { ...plainHero(3), ...arrive(3, 3), depth: 3, deepest: 3 }
    const path = bfs(levelOf(base).tiles, base, levelOf(base).stairs)!
    const mid = path[Math.floor(path.length / 2)]!
    return { g: { ...base, bag: oneFree(), floor: [{ x: base.x, y: base.y, item: ring(7001) }, { x: mid.x, y: mid.y, item: ring(7002) }] }, mid }
  }

  test('an answer finished picks up what lies underfoot first, and the walk the pane plays agrees on every tile', async () => {
    const { g } = set()
    const plan = apply(g, { kind: 'descend' })
    expect([plan.bag.some(i => i.id === 7001), plan.bag.some(i => i.id === 7002)]).toEqual([true, false])
    const tiles = alongTheWay(g, plan)!
    expect(tiles.filter(t => t.bag.some(i => i.id === 7002))).toEqual([])
    expect(tiles.every(t => t.bag.some(i => i.id === 7001))).toBe(true)
  })

  test('a click away picks up what lies underfoot too, and is still only a walk', async () => {
    const { g, mid } = set()
    const plan = apply({ ...g, seen: '1'.repeat(g.seen.length) }, { kind: 'goto', ...mid })
    expect([plan.bag.some(i => i.id === 7001), (plan.floor ?? []).map(f => f.item.id)]).toEqual([true, [7002]])
    expect(isOnlyAWalk({ ...g, seen: '1'.repeat(g.seen.length) }, plan)).toBe(true)
    expect(alongTheWay({ ...g, seen: '1'.repeat(g.seen.length) }, plan)!.every(t => t.bag.some(i => i.id === 7001))).toBe(true)
  })
})

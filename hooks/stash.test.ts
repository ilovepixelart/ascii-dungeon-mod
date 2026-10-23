import { describe, expect, test } from 'claude-code/testing'

import type { Game, Item } from '../types'
import { apply, normalize } from './game'
import { fullTab, plainHero } from './fixtures'
import { violations } from './invariants'
import { plainItem } from './items'
import { EMPTY_CODEX } from './codex'
import { stashedItems } from './stash'
import { newGame } from './world'

/** A hero in town with `gold`, carrying `bag`, the first carried item chosen. */
const inTown = (gold: number, bag: Item[] = [], over: Partial<Game> = {}): Game => {
  const g = apply(newGame(4), { kind: 'portal' })
  return { ...g, gold, bag: bag.map((item, i) => ({ ...item, x: i * 2, y: 0 })), cursor: bag[0]?.id ?? null, ...over }
}
const item = (id: number, key = 'ring', over: Partial<Item> = {}): Item => ({ ...plainItem({ nextId: id }, key), ...over })
const blade = (id: number) => item(id, 'sword', { rarity: 'epic', name: 'Oathbound Blade', set: 'oathbound' })
const duck = (id: number) => item(id, 'amulet', { rarity: 'legendary', name: 'Rubber Duck of Insight', power: 'duck' })
const said = (g: Game) => g.log.at(-1)
/** The rules the state breaks, by name. */
const broken = (g: Game) => violations(g).map(v => v.slice(0, v.indexOf(': ')))

describe('buying the stash\'s tabs', () => {
  test('tab 2 costs 1,000 gold, tab 3 2,500 and tab 4 5,000, each after the one before', async () => {
    let g = inTown(8500)
    for (const [tab, left] of [[1, 7500], [2, 5000], [3, 0]] as const) {
      g = apply(g, { kind: 'buyTab', tab })
      expect([g.stashed.length, g.gold]).toEqual([tab + 1, left])
    }
    expect(said(g)).toBe('You buy tab 4 of your stash for 5,000 gold.')
  })

  test('not out of order, not twice, not short of gold, and not a fifth; each said, nothing paid', async () => {
    const g = inTown(10000)
    const tries: [Game, number, string][] = [
      [g, 2, 'Buy tab 2 first.'],
      [apply(g, { kind: 'buyTab', tab: 1 }), 1, 'You have tab 2 already.'],
      [inTown(999), 1, 'Tab 2 costs 1,000 gold.'],
      [g, 0, 'You have tab 1 already.'],
      [{ ...g, stashed: [[], [], [], []] }, 4, 'No such tab.'],
    ]
    for (const [before, tab, line] of tries) {
      const after = apply(before, { kind: 'buyTab', tab })
      expect([said(after), after.gold, after.stashed.length]).toEqual([line, before.gold, before.stashed.length])
    }
  })

  test('the sets\' and the Legendaries\' tabs cost 3,000 each, in any order', async () => {
    const g = apply(apply(inTown(6000), { kind: 'buyTab', tab: 'legends' }), { kind: 'buyTab', tab: 'sets' })
    expect([g.stashLegends, g.stashSets, g.gold]).toEqual([[], [], 0])
    expect(said(apply(inTown(2999), { kind: 'buyTab', tab: 'sets' }))).toBe('The sets\' tab costs 3,000 gold.')
  })

  test('only in town', async () => {
    const g = { ...newGame(4), gold: 5000 }
    expect(said(apply(g, { kind: 'buyTab', tab: 1 }))).toBe('Your stash is in town.')
  })
})

describe('storing', () => {
  test('on the tab shown; with no room for it, on the first with room, said; with no tab with room, nothing', async () => {
    const ring = item(900)
    const two = inTown(0, [ring], { stashed: [fullTab(100), []] })
    expect(apply(two, { kind: 'store', tab: 1 }).stashed[1]!.map(i => i.id)).toEqual([900])
    const moved = apply(two, { kind: 'store', tab: 0 })
    expect([moved.stashed[1]!.map(i => i.id), said(moved)]).toEqual([[900], 'You store the Band in your stash, on tab 2.'])
    const full = apply(inTown(0, [ring], { stashed: [fullTab(100), fullTab(200)] }), { kind: 'store', tab: 1 })
    expect([full.bag.length, said(full)]).toEqual([1, 'Your stash is full.'])
  })

  test('at the first place on the tab\'s grid it fits, column by column, as in the bag; room is cells, not items', async () => {
    // A ring at the top left; armor, 2 by 3, fits first under it in the first column, at 0,1; a second ring at 0,4.
    const g = inTown(0, [item(901), item(902, 'chain'), item(903)])
    const stored = [0, 1, 2].reduce(x => apply(x, { kind: 'store', tab: 0 }), g).stashed[0]!
    expect(stored.map(i => [i.id, i.x, i.y])).toEqual([[901, 0, 0], [902, 0, 1], [903, 0, 4]])
    // Forty-seven rings leave one cell: a ring goes in, armor does not.
    const nearly = fullTab(100).slice(1)
    expect(apply(inTown(0, [item(904)], { stashed: [nearly] }), { kind: 'store' }).stashed[0]!.length).toBe(48)
    expect(said(apply(inTown(0, [item(905, 'chain')], { stashed: [nearly] }), { kind: 'store' }))).toBe('Your stash is full.')
  })

  test('at the cells it is dropped on, when it fits there; over another item or off the grid, it stays in the bag, said', async () => {
    const ring = item(906)
    const g = inTown(0, [ring], { stashed: [[item(907, 'ring', { x: 1, y: 1 })]] })
    const dropped = apply(g, { kind: 'store', tab: 0, at: { x: 3, y: 2 } })
    expect(dropped.stashed[0]!.find(i => i.id === 906)).toMatchObject({ x: 3, y: 2 })
    for (const at of [{ x: 1, y: 1 }, { x: 8, y: 0 }]) {
      const refused = apply(g, { kind: 'store', tab: 0, at })
      expect([refused.bag.map(i => i.id), said(refused)]).toEqual([[906], "It doesn't fit there."])
    }
  })

  test('a set piece on the sets\' tab and a Legendary on the Legendaries\', once bought; a second of one place on a plain tab', async () => {
    const owned = { stashSets: [], stashLegends: [] }
    const piece = apply(inTown(0, [blade(901)], owned), { kind: 'store', tab: 0 })
    expect([piece.stashSets!.map(i => i.id), said(piece)]).toEqual([[901], 'You store the Oathbound Blade in your stash, on the sets\' tab.'])
    const legend = apply(inTown(0, [duck(902)], owned), { kind: 'store' })
    expect(legend.stashLegends!.map(i => i.id)).toEqual([902])
    const again = apply(inTown(0, [blade(903)], { ...owned, stashSets: [blade(901)] }), { kind: 'store' })
    expect([again.stashSets!.map(i => i.id), again.stashed[0]!.map(i => i.id)]).toEqual([[901], [903]])
    // Not bought: a plain tab.
    expect(apply(inTown(0, [blade(904)]), { kind: 'store' }).stashed[0]!.map(i => i.id)).toEqual([904])
  })

  test('taken back to the bag cells it is dropped on, when it fits there; else it stays, said', async () => {
    const stored = item(908)
    const g = inTown(0, [item(909)], { stashed: [[stored]] })
    const back = apply(g, { kind: 'retrieve', id: 908, at: { x: 4, y: 1 } })
    expect(back.bag.find(i => i.id === 908)).toMatchObject({ x: 4, y: 1 })
    // The bag's first item lies at 0,0.
    const refused = apply(g, { kind: 'retrieve', id: 908, at: { x: 0, y: 0 } })
    expect([refused.stashed[0]!.map(i => i.id), said(refused)]).toEqual([[908], "It doesn't fit there."])
  })

  test('moved on its tab to the cells it is dropped on, when it fits there; else it stays, said', async () => {
    const g = inTown(0, [], { stashed: [[item(910), item(911, 'ring', { x: 2, y: 0 })]] })
    expect(apply(g, { kind: 'moveStashed', id: 910, x: 5, y: 4 }).stashed[0]!.find(i => i.id === 910)).toMatchObject({ x: 5, y: 4 })
    const refused = apply(g, { kind: 'moveStashed', id: 910, x: 2, y: 0 })
    expect([refused.stashed[0]!.find(i => i.id === 910), said(refused)]).toEqual([expect.objectContaining({ x: 0, y: 0 }), "It doesn't fit there."])
  })

  test('taken back from any tab', async () => {
    const g = inTown(0, [], { stashed: [[], [item(905)]], stashSets: [blade(906)], stashLegends: [duck(907)] })
    const back = [905, 906, 907].reduce((x, id) => apply(x, { kind: 'retrieve', id }), g)
    expect([back.bag.map(i => i.id).sort(), back.stashed, back.stashSets, back.stashLegends]).toEqual([[905, 906, 907], [[], []], [], []])
  })
})

describe('the stash is the town\'s', () => {
  const veteran = (over: Partial<Game>): Game => {
    const g = plainHero(3)
    const helm = item(700, 'steelHelm', { rarity: 'rare' })
    return { ...g, bossSlain: 10, deepest: 12, depth: 12, level: 14, gear: { ...g.gear, helm }, codex: { ...EMPTY_CODEX, deepest: 12, level: 14 }, ...over }
  }
  const kept = { stashed: [[item(500)], [item(501), item(502, 'ring', { y: 1 })]], stashSets: [blade(503)], stashLegends: [duck(504)] }
  const names = (g: Game) => [g.stashed.map(t => t.map(i => i.name)), g.stashSets?.map(i => i.name), g.stashLegends?.map(i => i.name)]

  test('a retired hero\'s successor has its tabs and what they hold, under ids of their own', async () => {
    const before = veteran(kept)
    const next = apply(apply(before, { kind: 'retire', slot: 'helm' }), { kind: 'restart', cls: 'mage' })
    expect(names(next)).toEqual(names(before))
    expect(broken(next)).toEqual([])
    // Ids the new game has given out: what it makes next never shares one.
    expect(stashedItems(next).every(i => i.id < next.nextId)).toBe(true)
  })

  test('a new game from settings keeps them too', async () => {
    const next = apply(veteran(kept), { kind: 'restart', cls: 'rogue' })
    expect(names(next)).toEqual(names(veteran(kept)))
    expect(broken(next)).toEqual([])
  })
})

describe('the stash in a save', () => {
  const v13 = (stashed: Item[][], over: Partial<Game> = {}) => ({ ...newGame(4), version: 13, stashed, ...over }) as unknown as Game
  const ids = (t: readonly Item[]) => t.map(i => i.id).sort((a, b) => a - b)

  test('a version 13 save\'s tabs, lists of ten, are laid out on their grids, each item where no other is', async () => {
    // Ten items with the bag's stale places, all at 0,0: rings, a chain, a sword.
    const listed = [item(610, 'chain'), item(611, 'sword'), ...Array.from({ length: 8 }, (_, i) => item(612 + i))].map(i => ({ ...i, x: 0, y: 0 }))
    const g = normalize(v13([listed]))
    expect(ids(g.stashed[0]!)).toEqual(ids(listed))
    expect(broken(g)).toEqual([])
  })

  test('what a tab cannot hold goes to another with room, then a tab not yet bought, then the bag, then the floor by the portal', async () => {
    // Ten chains, 2 by 3: eight fill a tab, two are left.
    const chains = (from: number) => Array.from({ length: 10 }, (_, i) => item(from + i, 'chain'))
    const spilled = normalize(v13([chains(700), []]))
    expect(spilled.stashed.map(t => t.length)).toEqual([8, 2])
    const given = normalize(v13([chains(700)]))
    expect(given.stashed.map(t => t.length)).toEqual([8, 2])
    const every = [chains(700), chains(720), chains(740), chains(760)]
    const bagged = normalize(v13(every, { bag: [] }))
    expect([bagged.stashed.map(t => t.length), bagged.bag.length]).toEqual([[8, 8, 8, 8], 8])
    const floored = normalize(v13(every, { bag: fullTab(900) }))
    expect([floored.bag.length, floored.floor?.length]).toEqual([48, 8])
    for (const g of [spilled, given, bagged, floored]) expect(broken(g)).toEqual([])
  })

  test('a version 12 save\'s stash list is tab 1; one that is not a list, an empty tab 1', async () => {
    const old = { ...newGame(4), version: 12, stashed: [item(600), item(601)] } as unknown as Game
    expect(normalize(old).stashed.map(t => t.map(i => i.id))).toEqual([[600, 601]])
    expect(normalize({ ...old, stashed: 'x' } as unknown as Game).stashed).toEqual([[]])
  })
})

describe('the stash\'s rules', () => {
  const g = newGame(4)
  test('one to four plain tabs, each item inside its tab\'s grid and over no other', async () => {
    expect(broken({ ...g, stashed: [fullTab(100), fullTab(200), fullTab(300), fullTab(400)] })).toEqual([])
    expect(broken({ ...g, stashed: [[], [], [], [], []] })).toContain('stash within its size')
    expect(broken({ ...g, stashed: [] })).toContain('stash within its size')
    expect(broken({ ...g, stashed: [[], [item(150, 'ring', { x: 2, y: 2 }), item(151, 'ring', { x: 2, y: 2 })]] })).toContain('stash within its size')
    expect(broken({ ...g, stashed: [[item(152, 'chain', { x: 7, y: 0 })]] })).toContain('stash within its size')
  })

  test('the special tabs hold their own items, one a place', async () => {
    const rule = 'a place each on the stash\'s sets\' and Legendaries\' tabs'
    expect(broken({ ...g, stashSets: [blade(100)], stashLegends: [duck(101)] })).not.toContain(rule)
    expect(broken({ ...g, stashSets: [item(102)] })).toContain(rule)
    expect(broken({ ...g, stashLegends: [blade(103)] })).toContain(rule)
    expect(broken({ ...g, stashSets: [blade(104), blade(105)] })).toContain(rule)
  })
})

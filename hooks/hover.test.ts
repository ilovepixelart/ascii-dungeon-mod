import { describe, expect, test } from 'claude-code/testing'

// The hover's rule, window by window: what a click acts on is lit, and nothing that cannot act now is. Each window's
// lit places (its xHot) are held against its own gestures: a point inside one acts, a point that acts lies inside one.
import type { Game, Item } from '../types'
import { apply } from './game'
import { plainHero } from './fixtures'
import { BAG_H, BAG_W, plainItem } from './items'
import { BAG_UI_IDLE, bagGesture } from './bagui'
import { BELT_X, BELT_Y, INV_TOP, beltHot, inventoryHot } from './inventory'
import { compactGesture, compactHot, compactOverlay } from './compact'
import { shopGesture, shopHot } from './shop'
import { CHEST_UI_IDLE, chestGesture, chestHot, chestOverlay } from './chest'
import { deepCards, deepGesture, deepHot } from './deepwindow'
import { forkTier, pairOf } from './deep'
import { talentGesture, talentHot } from './talentwindow'
import { talkAction, talkHot } from './talk'
import { beltSlotRect } from './pieces'
import type { Gesture, Rect } from './window'
import { arrive } from './world'

/** A click on window pixel (`x`, `y`). */
const tap = (x: number, y: number): Gesture => ({ type: 'release', from: { x: x + 0.5, y: y / 2 + 0.25 }, at: { x: x + 0.5, y: y / 2 + 0.25 }, button: 'left' })
const centre = (r: Rect) => ({ x: r.x + Math.floor(r.w / 2), y: r.y + Math.floor(r.h / 2) })
const lit = (hot: readonly Rect[], p: { x: number; y: number }) => hot.some(r => p.x >= r.x && p.x < r.x + r.w && p.y >= r.y && p.y < r.y + r.h)
const same = (a: unknown, b: unknown) => JSON.stringify(a) === JSON.stringify(b)
/** A bag with no free cell: a column-tall piece in each column. */
const fullBag = (): Item[] => Array.from({ length: BAG_W }, (_, i) => ({ ...plainItem({ nextId: 5000 + i }, 'chain'), w: 1, h: BAG_H, x: i, y: 0 }))
const inTown = (over: Partial<Game> = {}): Game => ({ ...apply({ ...plainHero(3), ...arrive(3, 3), depth: 3, deepest: 3 }, { kind: 'portal' }), ...over })

describe('the hover lights what a click acts on', () => {
  test('the bag: a belt slot holding something is lit, and a click on it uses it; an empty one is not', async () => {
    const g = plainHero(3)
    const held = beltSlotRect(BELT_X, INV_TOP + BELT_Y, g.belt.findIndex(s => s !== null))
    const empty = beltSlotRect(BELT_X, INV_TOP + BELT_Y, g.belt.findIndex(s => s === null))
    expect(bagGesture(g, BAG_UI_IDLE, tap(centre(held).x, centre(held).y)).actions).toEqual([{ kind: 'use', slot: g.belt.findIndex(s => s !== null) }])
    expect([lit(inventoryHot(g), centre(held)), lit(inventoryHot(g), centre(empty))]).toEqual([true, false])
  })

  test('the bag: a worn piece is lit while there is room to take it off, not with the bag full', async () => {
    const g = { ...plainHero(3), bag: [] }
    // Every worn piece's outline, lit with room in the bag: what is lit beside the bag's items and the belt.
    const belt = beltHot(g, BELT_X, INV_TOP + BELT_Y)
    const worn = inventoryHot(g).slice(g.bag.length).filter(r => !belt.some(b => same(b, r)))
    expect(worn.length).toBe(Object.keys(g.gear).length)
    expect(inventoryHot({ ...g, bag: fullBag() }).filter(r => worn.some(w => same(w, r)))).toEqual([])
  })

  test('the compact bag: a filled belt slot and a worn row that can come off are lit; a full bag\'s worn rows are not', async () => {
    const g = { ...plainHero(3), bag: [] }
    const list = compactOverlay(g, BAG_UI_IDLE).find(b => b.role === 'worn')!
    // The weapon's row: the list's first slot, its second row, in window pixels.
    const row = { x: list.x + 3, y: (list.y + 2) * 2 + 1 }
    expect(compactGesture(g, BAG_UI_IDLE, tap(row.x, row.y)).actions).toEqual([{ kind: 'unequip', slot: 'weapon' }])
    expect([lit(compactHot(g), row), lit(compactHot({ ...g, bag: fullBag() }), row)]).toEqual([true, false])
    const held = g.belt.findIndex(s => s !== null)
    const unused = compactHot({ ...g, belt: g.belt.map(() => null) })
    expect(compactHot(g).length - unused.length).toBe(held >= 0 ? 1 : 0)
  })

  test('the merchant: the chosen ware stays lit, a second click opening its menu; a filled belt slot is lit', async () => {
    const g = inTown()
    const ware = centre(shopHot(g)[0]!)
    const chosen = shopGesture(g, { ware: null, menu: false }, tap(ware.x, ware.y)).ui
    expect([chosen.ware !== null, shopGesture(g, chosen, tap(ware.x, ware.y)).ui.menu, lit(shopHot(g), ware)]).toEqual([true, true, true])
    expect(shopHot(g).length - shopHot({ ...g, belt: g.belt.map(() => null) }).length).toBe(1)
  })

  test('the stash: each stored item\'s row is lit, and a click on it chooses it', async () => {
    const stored = [plainItem({ nextId: 6001 }, 'ring'), plainItem({ nextId: 6002 }, 'amulet')]
    const g = inTown({ stashed: stored, bag: [] })
    const list = chestOverlay(g, CHEST_UI_IDLE)[0]!
    stored.forEach((item, i) => {
      const p = { x: list.x + 3, y: (list.y + 1 + i) * 2 + 1 }
      expect(chestGesture(g, CHEST_UI_IDLE, tap(p.x, p.y)).ui.stored).toBe(item.id)
      expect(lit(chestHot(g), p)).toBe(true)
    })
  })

  test('the deep: the mark already chosen is not lit, its click changing nothing; the other is', async () => {
    const at = { ...plainHero(1), ...arrive(plainHero(1).world, 60), depth: 60, deepest: 60, bossSlain: 60 }
    const fork = forkTier(at)!
    const [a, b] = pairOf(at.world, fork)
    const chosen = { ...at, marks: { [fork]: a! } }
    const [ca, cb] = deepCards(chosen)
    expect(deepGesture(chosen, tap(centre(ca!.rect).x, centre(ca!.rect).y)).length).toBe(0)
    expect([lit(deepHot(chosen), centre(ca!.rect)), lit(deepHot(chosen), centre(cb!.rect))]).toEqual([false, true])
    expect(deepGesture(chosen, tap(centre(cb!.rect).x, centre(cb!.rect).y))).toEqual([{ kind: 'mark', mark: b }])
  })

  test('the talent cards: a click acts exactly where a card is lit, the chosen one lifted', async () => {
    const g = { ...plainHero(3), level: 10 }
    const ui = { chosen: 0 }
    const hot = talentHot(g, ui).slice(0, 3)
    for (const r of hot) for (const p of [{ x: centre(r).x, y: r.y - 1 }, { x: centre(r).x, y: r.y + r.h }]) {
      const out = talentGesture(g, ui, tap(p.x, p.y))
      expect([lit(talentHot(g, ui), p), out.actions.length > 0 || !same(out.ui, ui)]).toEqual([false, false])
    }
  })

  test('the townsfolk with the bag full: Claim, Gamble and Trade in are dark and unlit, as a press would change nothing', async () => {
    const done = { kind: 'slay' as const, depth: 3, need: 8, have: 8 }
    // Walked up to them, the codex behind the game: the walk an action made and the codex it brings up to date are no
    // part of what a press would change.
    const g = inTown({ bag: fullBag(), gold: 10 ** 6, quest: done, walked: [{ x: 9, y: 10 }] })
    const full = { ...g, deepest: 40, codex: { ...g.codex!, deepest: 1 } }
    for (const who of ['elder', 'villager'] as const) expect([talkAction(full, who)?.state, talkHot(full, who)]).toEqual(['off', []])
    const room = { ...full, bag: [] }
    for (const who of ['elder', 'villager'] as const) expect(talkHot(room, who)).toHaveLength(1)
  })
})

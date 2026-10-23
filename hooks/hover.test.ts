import { describe, expect, test } from 'claude-code/testing'

// The hover's rule, window by window: what a click acts on is lit, and nothing that cannot act now is. Each window's
// lit places (its xHot) are held against its own gestures: a point inside one acts, a point that acts lies inside one.
import type { Game, Item } from '../types'
import { apply } from './game'
import { plainHero } from './fixtures'
import { BAG_H, BAG_W, plainItem } from './items'
import { BAG_UI_IDLE, bagGesture, inventoryHot } from './bagui'
import { BELT_X, BELT_Y, INV_TOP, beltHot } from './inventory'
import { compactGesture, compactHot, compactOverlay } from './compact'
import { shopGesture, shopHot } from './shop'
import { CHEST_UI_IDLE, chestGesture, chestHot, chestOverlay } from './chest'
import type { ChestUi } from './chest'
import { deepCards, deepGesture, deepHot } from './deepwindow'
import { forkTier, pairOf } from './deep'
import { talentGesture, talentHot } from './talentwindow'
import { talkAction, talkHot } from './talk'
import { beltSlotRect } from './pieces'
import type { Gesture, Rect } from './window'
import { WINDOW_TOP } from './window'
import { arrive } from './world'

/** A click on window pixel (`x`, `y`). */
const tap = (x: number, y: number): Gesture => ({ type: 'release', from: { x: x + 0.5, y: y / 2 + 0.25 }, at: { x: x + 0.5, y: y / 2 + 0.25 }, button: 'left' })
const centre = (r: Rect) => ({ x: r.x + Math.floor(r.w / 2), y: r.y + Math.floor(r.h / 2) })
const lit = (hot: readonly Rect[], p: { x: number; y: number }) => hot.some(r => p.x >= r.x && p.x < r.x + r.w && p.y >= r.y && p.y < r.y + r.h)
const same = (a: unknown, b: unknown) => JSON.stringify(a) === JSON.stringify(b)
const IDLE_SHOP = { ware: null, menu: false }
/** A bag with no free cell: a column-tall piece in each column. */
const fullBag = (): Item[] => Array.from({ length: BAG_W }, (_, i) => ({ ...plainItem({ nextId: 5000 + i }, 'chain'), w: 1, h: BAG_H, x: i, y: 0 }))
const inTown = (over: Partial<Game> = {}): Game => ({ ...apply({ ...plainHero(3), ...arrive(3, 3), depth: 3, deepest: 3 }, { kind: 'portal' }), ...over })

describe('the hover lights what a click acts on', () => {
  test('the bag: a belt slot holding something is lit, and a click on it uses it; an empty one is not', async () => {
    const g = plainHero(3)
    const held = beltSlotRect(BELT_X, INV_TOP + BELT_Y, g.belt.findIndex(s => s !== null))
    const empty = beltSlotRect(BELT_X, INV_TOP + BELT_Y, g.belt.findIndex(s => s === null))
    expect(bagGesture(g, BAG_UI_IDLE, tap(centre(held).x, centre(held).y)).actions).toEqual([{ kind: 'use', slot: g.belt.findIndex(s => s !== null) }])
    expect([lit(inventoryHot(g, BAG_UI_IDLE), centre(held)), lit(inventoryHot(g, BAG_UI_IDLE), centre(empty))]).toEqual([true, false])
  })

  test('the bag: a worn piece is lit while there is room to take it off, not with the bag full', async () => {
    const g = { ...plainHero(3), bag: [] }
    // Every worn piece's outline, lit with room in the bag: what is lit under the title bar beside the bag's items and the belt.
    const belt = beltHot(g, BELT_X, INV_TOP + BELT_Y)
    const worn = inventoryHot(g, BAG_UI_IDLE).slice(g.bag.length).filter(r => r.y >= INV_TOP && !belt.some(b => same(b, r)))
    expect(worn.length).toBe(Object.keys(g.gear).length)
    expect(inventoryHot({ ...g, bag: fullBag() }, BAG_UI_IDLE).filter(r => worn.some(w => same(w, r)))).toEqual([])
  })

  test('the compact bag: a filled belt slot and a worn row that can come off are lit; a full bag\'s worn rows are not', async () => {
    const g = { ...plainHero(3), bag: [] }
    const list = compactOverlay(g, BAG_UI_IDLE).find(b => b.role === 'worn')!
    // The weapon's row: the list's first slot, its second row, in window pixels.
    const row = { x: list.x + 3, y: (list.y + 2) * 2 + 1 }
    expect(compactGesture(g, BAG_UI_IDLE, tap(row.x, row.y)).actions).toEqual([{ kind: 'unequip', slot: 'weapon' }])
    expect([lit(compactHot(g, BAG_UI_IDLE), row), lit(compactHot({ ...g, bag: fullBag() }, BAG_UI_IDLE), row)]).toEqual([true, false])
    const held = g.belt.findIndex(s => s !== null)
    const unused = compactHot({ ...g, belt: g.belt.map(() => null) }, BAG_UI_IDLE)
    expect(compactHot(g, BAG_UI_IDLE).length - unused.length).toBe(held >= 0 ? 1 : 0)
  })

  test('the merchant: the chosen ware stays lit, a second click opening its menu; a filled belt slot is lit', async () => {
    const g = inTown()
    const ware = centre(shopHot(g, IDLE_SHOP)[0]!)
    const chosen = shopGesture(g, { ware: null, menu: false }, tap(ware.x, ware.y)).ui
    expect([chosen.ware !== null, shopGesture(g, chosen, tap(ware.x, ware.y)).ui.menu, lit(shopHot(g, IDLE_SHOP), ware)]).toEqual([true, true, true])
    expect(shopHot(g, IDLE_SHOP).length - shopHot({ ...g, belt: g.belt.map(() => null) }, IDLE_SHOP).length).toBe(1)
  })

  test('the stash: each stored item is lit on the tab\'s grid, and a click on it chooses it', async () => {
    const stored = [plainItem({ nextId: 6001 }, 'ring'), { ...plainItem({ nextId: 6002 }, 'amulet'), x: 2, y: 3 }]
    const g = inTown({ stashed: [stored], bag: [] })
    stored.forEach(item => {
      // Its cell's middle on the tab's grid: the frame from x 4, 2 under the title bar.
      const p = { x: 4 + item.x * 7 + 3, y: WINDOW_TOP + 2 + item.y * 7 + 3 }
      expect(chestGesture(g, CHEST_UI_IDLE, tap(p.x, p.y)).ui.stored).toBe(item.id)
      expect(lit(chestHot(g, CHEST_UI_IDLE), p)).toBe(true)
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

  test('the talent cards: a click acts exactly where a card is lit', async () => {
    const g = { ...plainHero(3), level: 10 }
    const ui = { chosen: 0 }
    const hot = talentHot(g).slice(0, 3)
    for (const r of hot) for (const p of [{ x: centre(r).x, y: r.y - 1 }, { x: centre(r).x, y: r.y + r.h }]) {
      const out = talentGesture(g, ui, tap(p.x, p.y))
      expect([lit(talentHot(g), p), out.actions.length > 0 || !same(out.ui, ui)]).toEqual([false, false])
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

describe('the hover with a card open', () => {
  /** In town with a ring in every cell of the bag and tall cards in the stash: an open card has no clear spot. */
  const crowded = (): Game => {
    const tall = (id: number) => ({ ...plainItem({ nextId: id }, 'amulet', 'epic'), trigger: 'thorns' as const, atk: 1, def: 1, hp: 1, crit: 1, xp: 1 })
    const bag = Array.from({ length: BAG_W * BAG_H }, (_, i) => ({ ...plainItem({ nextId: 9100 + i }, 'ring'), w: 1, h: 1, x: Math.floor(i / BAG_H), y: i % BAG_H }))
    return inTown({ bag, stashed: [[tall(6101), tall(6102)]] })
  }
  /** Each lit centre a click on which changes nothing: under a card, where the click lands on the card. */
  const dead = <U>(hot: readonly Rect[], gesture: (p: { x: number; y: number }) => { ui: U; actions: readonly unknown[] }, ui: U) =>
    hot.map(centre).filter(p => {
      const out = gesture(p)
      return out.actions.length === 0 && same(out.ui, ui)
    })

  test('in the bag, the compact bag, the merchant and the stash, nothing lit under an open card is dead', async () => {
    const g = crowded()
    const found: string[] = []
    // Every fifth item chosen in turn: its card lands all over the window.
    for (const item of g.bag.filter((_, i) => i % 5 === 0)) {
      const chosen = { ...g, cursor: item.id }
      const bagUi = { ...BAG_UI_IDLE }
      found.push(...dead(inventoryHot(chosen, bagUi), p => bagGesture(chosen, bagUi, tap(p.x, p.y)), bagUi).map(p => `bag ${item.id} ${p.x},${p.y}`))
      found.push(...dead(compactHot(chosen, bagUi), p => compactGesture(chosen, bagUi, tap(p.x, p.y)), bagUi).map(p => `compact ${item.id} ${p.x},${p.y}`))
      const shopUi = { ware: null, menu: false }
      found.push(...dead(shopHot(chosen, shopUi), p => shopGesture(chosen, shopUi, tap(p.x, p.y)), shopUi).map(p => `shop ${item.id} ${p.x},${p.y}`))
    }
    for (const stored of g.stashed[0]!) {
      const ui: ChestUi = { stored: stored.id, menu: false, tab: 0 }
      found.push(...dead(chestHot(g, ui), p => chestGesture(g, ui, tap(p.x, p.y)), ui).map(p => `stash ${stored.id} ${p.x},${p.y}`))
    }
    expect(found.slice(0, 6)).toEqual([])
  })

  test('with a menu open, nothing is lit that a click only closes the menu on', async () => {
    const g = crowded()
    const item = g.bag[0]!
    const chosen = { ...g, cursor: item.id }
    const idle = (out: { actions: readonly unknown[] }) => out.actions.length === 0
    const bagUi = { menu: { id: item.id, confirm: false }, drag: null }
    const shopUi = { ware: null, menu: true }
    const stashUi = { stored: g.stashed[0]![0]!.id, menu: true, tab: 0 }
    const found = [
      ...inventoryHot(chosen, bagUi).map(centre).filter(p => idle(bagGesture(chosen, bagUi, tap(p.x, p.y)))).map(p => `bag ${p.x},${p.y}`),
      ...compactHot(chosen, bagUi).map(centre).filter(p => idle(compactGesture(chosen, bagUi, tap(p.x, p.y)))).map(p => `compact ${p.x},${p.y}`),
      ...shopHot(chosen, shopUi).map(centre).filter(p => idle(shopGesture(chosen, shopUi, tap(p.x, p.y)))).map(p => `shop ${p.x},${p.y}`),
      ...chestHot(g, stashUi).map(centre).filter(p => idle(chestGesture(g, stashUi, tap(p.x, p.y)))).map(p => `stash ${p.x},${p.y}`),
    ]
    expect(found.slice(0, 6)).toEqual([])
  })
})

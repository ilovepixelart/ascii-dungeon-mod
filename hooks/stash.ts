// The town's stash, kept from hero to hero: plain tabs each a grid the bag's size, bought one after another, and two
// tabs of a place each, one for every class set's piece and one for every Legendary. Pure rules over the game; the
// window is chest.ts.
import type { Game, Item } from '../types'
import { LEGENDARIES, SETS } from './items/catalog'
import { fit, fitsAt, repack } from './items/bag'
import { countText } from './names'

/** A plain tab is a grid the bag's size (BAG_W by BAG_H cells): an item on it lies at its cell (`x`, `y`), as in the
 * bag, and takes its own w by h of them. */
/** What each plain tab costs, in the order they are bought; the first is the town's from the start. */
export const TAB_PRICES: readonly number[] = [0, 1000, 2500, 5000]
/** What the sets' tab and the Legendaries' tab each cost. */
export const SPECIAL_TAB_PRICE = 3000

/** A tab of the stash: a plain tab by its place, from 0, or the sets' or the Legendaries'. */
export type StashTab = number | 'sets' | 'legends'
type Stash = Pick<Game, 'stashed' | 'stashSets' | 'stashLegends'>

/** Every place on the sets' tab, in board order: each set's pieces in turn. */
export const SET_PLACES = Object.entries(SETS).flatMap(([set, s]) => s.pieces.map(p => ({ set, base: p.base, name: p.name })))
/** Every place on the Legendaries' tab, in board order. */
export const LEGEND_PLACES = LEGENDARIES.map(l => ({ power: l.power, name: l.name, base: l.base }))

/** Every item in the stash, whatever its tab. */
export const stashedItems = (g: Stash): Item[] => [...g.stashed.flat(), ...(g.stashSets ?? []), ...(g.stashLegends ?? [])]

/** The tab's items; undefined while it is not bought. */
export const tabItems = (g: Stash, tab: StashTab): readonly Item[] | undefined =>
  tab === 'sets' ? g.stashSets : tab === 'legends' ? g.stashLegends : g.stashed[tab]

/** The tab of a place each an item belongs on, bought or not: a set piece the sets', a Legendary the Legendaries'. */
export const specialTabOf = (item: Item): 'sets' | 'legends' | undefined =>
  item.set !== undefined ? 'sets' : item.rarity === 'legendary' && item.power !== undefined ? 'legends' : undefined

const isSamePlace = (a: Item, b: Item) => (a.set !== undefined ? a.set === b.set && a.base === b.base : a.power === b.power)

/** Where on a plain tab an item would go: the first cell it fits at, column by column, as in the bag; null if none. */
const spotOn = (tab: readonly Item[] | undefined, item: Item) => (tab === undefined ? null : fit(tab, item.w, item.h))

/** Where an item stored goes: its own special tab, bought and its place there empty; else plain tab `preferred` with
 * room for it; else the first plain tab with room for it. Undefined when there is none. */
export const whereToStore = (g: Stash, item: Item, preferred = 0): StashTab | undefined => {
  const special = specialTabOf(item)
  const held = special === undefined ? undefined : tabItems(g, special)
  if (special !== undefined && held !== undefined && !held.some(i => isSamePlace(i, item))) return special
  if (spotOn(g.stashed[preferred], item) !== null) return preferred
  const free = g.stashed.findIndex(t => spotOn(t, item) !== null)
  return free < 0 ? undefined : free
}

/** The item put on `tab`, which must be bought and, a plain one, have room for it: at its first free cell there. */
export const putIn = (g: Game, item: Item, tab: StashTab) => {
  if (tab === 'sets') g.stashSets = [...(g.stashSets ?? []), item]
  else if (tab === 'legends') g.stashLegends = [...(g.stashLegends ?? []), item]
  else g.stashed = g.stashed.map((t, i) => (i === tab ? [...t, { ...item, ...spotOn(t, item)! }] : t))
}

/** Whether a plain tab's items each lie inside its grid, over no other. */
export const isLaidOut = (tab: readonly Item[]) => tab.every(i => fitsAt(tab, i.w, i.h, i.x, i.y, i.id))

/** Tabs that held a list of items each laid out on their grids: each tab repacked, largest first, then what it could
 * not hold onto the first tab with room. What no tab holds is handed back, for the caller to keep. */
export const laidOut = (tabs: readonly (readonly Item[])[]): { tabs: Item[][]; left: Item[] } => {
  const packed = tabs.map(t => repack(t))
  const out = packed.map(p => p.bag)
  const left: Item[] = []
  for (const item of packed.flatMap(p => p.left)) {
    const at = out.findIndex(t => fit(t, item.w, item.h) !== null)
    if (at < 0) left.push(item)
    else out[at] = [...out[at]!, { ...item, ...fit(out[at]!, item.w, item.h)! }]
  }
  return { tabs: out, left }
}

/** The stashed item `id` taken off its tab; undefined when the stash has none. */
export const takeOut = (g: Game, id: number): Item | undefined => {
  const item = stashedItems(g).find(i => i.id === id)
  if (item === undefined) return undefined
  g.stashed = g.stashed.map(t => t.filter(i => i.id !== id))
  if (g.stashSets !== undefined) g.stashSets = g.stashSets.filter(i => i.id !== id)
  if (g.stashLegends !== undefined) g.stashLegends = g.stashLegends.filter(i => i.id !== id)
  return item
}

/** What a tab costs. */
export const tabPrice = (tab: StashTab) => (typeof tab === 'number' ? (TAB_PRICES[tab] ?? Infinity) : SPECIAL_TAB_PRICE)

/** A tab as the player reads it. */
export const tabName = (tab: StashTab) => (tab === 'sets' ? 'the sets\' tab' : tab === 'legends' ? 'the Legendaries\' tab' : `tab ${tab + 1}`)

/** Why `tab` cannot be bought now, or undefined when it can: bought already, an earlier plain tab not yet, or the gold short. */
export const whyNotBuy = (g: Stash & Pick<Game, 'gold'>, tab: StashTab): string | undefined => {
  if (tabItems(g, tab) !== undefined) return 'bought'
  if (typeof tab === 'number' && (tab >= TAB_PRICES.length || tab !== g.stashed.length)) return tab >= TAB_PRICES.length ? 'no such tab' : `buy tab ${g.stashed.length + 1} first`
  return g.gold < tabPrice(tab) ? `${countText(tabPrice(tab))} gold` : undefined
}

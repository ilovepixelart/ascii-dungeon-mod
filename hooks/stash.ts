// The town's stash, kept from hero to hero: plain tabs of STASH_SIZE items, bought one after another, and two tabs of
// a place each, one for every class set's piece and one for every Legendary. Pure rules over the game; the window
// is chest.ts.
import type { Game, Item } from '../types'
import { LEGENDARIES, SETS } from './items/catalog'

/** How many items a plain tab holds. */
export const STASH_SIZE = 10
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
export const LEGEND_PLACES = LEGENDARIES.map(l => ({ power: l.power, name: l.name }))

/** Every item in the stash, whatever its tab. */
export const stashedItems = (g: Stash): Item[] => [...g.stashed.flat(), ...(g.stashSets ?? []), ...(g.stashLegends ?? [])]

/** The tab's items; undefined while it is not bought. */
export const tabItems = (g: Stash, tab: StashTab): readonly Item[] | undefined =>
  tab === 'sets' ? g.stashSets : tab === 'legends' ? g.stashLegends : g.stashed[tab]

/** The tab of a place each an item belongs on, bought or not: a set piece the sets', a Legendary the Legendaries'. */
export const specialTabOf = (item: Item): 'sets' | 'legends' | undefined =>
  item.set !== undefined ? 'sets' : item.rarity === 'legendary' && item.power !== undefined ? 'legends' : undefined

const isSamePlace = (a: Item, b: Item) => (a.set !== undefined ? a.set === b.set && a.base === b.base : a.power === b.power)

/** Where an item stored goes: its own special tab, bought and its place there empty; else plain tab `preferred` with
 * room; else the first plain tab with room. Undefined when there is none. */
export const whereToStore = (g: Stash, item: Item, preferred = 0): StashTab | undefined => {
  const special = specialTabOf(item)
  const held = special === undefined ? undefined : tabItems(g, special)
  if (special !== undefined && held !== undefined && !held.some(i => isSamePlace(i, item))) return special
  if ((g.stashed[preferred]?.length ?? STASH_SIZE) < STASH_SIZE) return preferred
  const free = g.stashed.findIndex(t => t.length < STASH_SIZE)
  return free < 0 ? undefined : free
}

/** The item put on `tab`, which must be bought. */
export const putIn = (g: Game, item: Item, tab: StashTab) => {
  if (tab === 'sets') g.stashSets = [...(g.stashSets ?? []), item]
  else if (tab === 'legends') g.stashLegends = [...(g.stashLegends ?? []), item]
  else g.stashed = g.stashed.map((t, i) => (i === tab ? [...t, item] : t))
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

/** How many items the stash's bought tabs hold in all. */
export const stashRoom = (g: Stash) => g.stashed.length * STASH_SIZE + (g.stashSets === undefined ? 0 : SET_PLACES.length) + (g.stashLegends === undefined ? 0 : LEGEND_PLACES.length)

/** What a tab costs. */
export const tabPrice = (tab: StashTab) => (typeof tab === 'number' ? (TAB_PRICES[tab] ?? Infinity) : SPECIAL_TAB_PRICE)

/** A tab as the player reads it. */
export const tabName = (tab: StashTab) => (tab === 'sets' ? 'the sets\' tab' : tab === 'legends' ? 'the Legendaries\' tab' : `tab ${tab + 1}`)

/** Why `tab` cannot be bought now, or undefined when it can: bought already, an earlier plain tab not yet, or the gold short. */
export const whyNotBuy = (g: Stash & Pick<Game, 'gold'>, tab: StashTab): string | undefined => {
  if (tabItems(g, tab) !== undefined) return 'bought'
  if (typeof tab === 'number' && (tab >= TAB_PRICES.length || tab !== g.stashed.length)) return tab >= TAB_PRICES.length ? 'no such tab' : `buy tab ${g.stashed.length + 1} first`
  return g.gold < tabPrice(tab) ? `${tabPrice(tab)} gold` : undefined
}

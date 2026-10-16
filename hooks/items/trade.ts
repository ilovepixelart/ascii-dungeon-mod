// Turning items into gold: their price, selling one, and marking and selling junk.
import type { Game, Item } from '../../types'
import { fit, selected, take } from './bag'
import { PRICE, TRIGGER_WORTH } from './catalog'
import { worth } from './stats'

export const priceOf = (item: Item) => PRICE[item.rarity] * (1 + Math.ceil(worth(item)) + (item.trigger === undefined ? 0 : TRIGGER_WORTH))

export const sell = (g: Game): string => {
  const item = selected(g)
  if (item === undefined) return 'Nothing selected.'
  if (item.locked === true) return `The ${item.name} is locked: unlock it to sell it.`
  take(g, item.id)
  const coins = priceOf(item)
  g.gold += coins
  g.lastSold = { items: [item], coins }
  return `You sell the ${item.name} for ${coins} gold.`
}

export const toggleJunk = (g: Game): string => {
  const item = selected(g)
  if (item === undefined) return 'Nothing selected.'
  if (item.locked === true) return `The ${item.name} is locked: unlock it to mark it as junk.`
  g.bag = g.bag.map(i => (i.id === item.id ? { ...i, junk: !i.junk } : i))
  return item.junk ? `The ${item.name} is no longer junk.` : `You mark the ${item.name} as junk.`
}

/** Locks the selected item, or unlocks it: a locked one is never sold, marked as junk or destroyed. Locking clears junk. */
export const toggleLock = (g: Game): string => {
  const item = selected(g)
  if (item === undefined) return 'Nothing selected.'
  const isLocked = item.locked === true
  g.bag = g.bag.map(i => {
    if (i.id !== item.id) return i
    const { locked: _, junk: __, ...rest } = i
    return isLocked ? { ...rest, ...(i.junk === undefined ? {} : { junk: i.junk }) } : { ...rest, locked: true as const }
  })
  return isLocked ? `You unlock the ${item.name}.` : `You lock the ${item.name}: it is kept whatever happens.`
}

/** What selling the junk would come to: how many items are marked, and their gold. */
export const junkValue = (g: Pick<Game, 'bag'>) => {
  const junk = g.bag.filter(i => i.junk === true)
  return { count: junk.length, coins: junk.reduce((sum, i) => sum + priceOf(i), 0) }
}

export const sellJunk = (g: Game): string => {
  const junk = g.bag.filter(i => i.junk === true)
  if (junk.length === 0) return 'Nothing is marked as junk.'
  const { coins } = junkValue(g)
  for (const item of junk) take(g, item.id)
  g.gold += coins
  g.lastSold = { items: junk, coins }
  return `You sell ${junk.length} junk item${junk.length === 1 ? '' : 's'} for ${coins} gold.`
}

/** Why the last sale cannot be bought back now, or undefined when it can. */
export const whyNotBuyBack = (g: Game) => {
  const sold = g.lastSold
  if (sold === null) return 'nothing sold'
  if (g.gold < sold.coins) return 'not enough gold'
  let bag = g.bag
  for (const item of sold.items) {
    const spot = fit(bag, item.w, item.h)
    if (spot === null) return 'no room in your bag'
    bag = [...bag, { ...item, ...spot }]
  }
  return undefined
}

/** The last sale undone: its items back in the bag, its gold paid back. */
export const buyBack = (g: Game): string => {
  const sold = g.lastSold
  const why = whyNotBuyBack(g)
  if (sold === null || why === 'nothing sold') return 'Nothing to buy back.'
  if (why === 'not enough gold') return `Not enough gold: buying it back costs ${sold.coins}.`
  if (why !== undefined) return 'Your bag has no room for what you sold.'
  for (const item of sold.items) {
    const spot = fit(g.bag, item.w, item.h)!
    g.bag = [...g.bag, { ...item, ...spot }]
  }
  g.gold -= sold.coins
  g.lastSold = null
  return sold.items.length === 1 ? `You buy back the ${sold.items[0]!.name} for ${sold.coins} gold.` : `You buy back ${sold.items.length} items for ${sold.coins} gold.`
}

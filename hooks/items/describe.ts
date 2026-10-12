// Items in words: their bonuses and how they compare with what is worn.
import type { Game, Item, Slot } from '../../types'
import { deltas } from './equipment'
import { STAT_KEYS, STAT_LABEL } from './stats'

/** One character per slot for the text views of the bag. */
export const GLYPH: Record<Slot, string> = { weapon: ')', offhand: '(', helm: '[', armor: '[', boots: '_', ring: '=', amulet: '"' }

export const describe = (item: Item) => {
  const parts = STAT_KEYS.filter(k => item[k] > 0).map(k => `+${STAT_LABEL[k](item[k])}`)
  return parts.length > 0 ? parts.join('  ') : 'no bonuses'
}

/** The deltas against the worn item, each with its sign and an arrow, so neither depends on color. */
export const deltaLines = (g: Game, item: Item): { text: string; isGain: boolean }[] => {
  const d = deltas(g, item)
  return STAT_KEYS.filter(k => d[k] !== 0).map(k => ({ text: `${d[k] > 0 ? '+' : ''}${STAT_LABEL[k](d[k])} ${d[k] > 0 ? '^' : 'v'}`, isGain: d[k] > 0 }))
}

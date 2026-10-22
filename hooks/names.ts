// How a foe is named in a sentence: a unique by its own name, which carries any article it has ("the Rotking", "Old
// Bones"); any other foe as "the" and its name. And how a count is written. Pure.
import type { Foe } from '../types'

/** A phrase as it starts a sentence. */
export const capitalized = (s: string) => s.charAt(0).toUpperCase() + s.slice(1)

/** A foe named mid-sentence: "the goblin", "Old Bones", "the Rotking". */
export const theFoe = (foe: Pick<Foe, 'name' | 'unique'>) => (foe.unique !== undefined ? foe.name : `the ${foe.name}`)

/** A foe named at a sentence's start: "The goblin", "Old Bones", "The Rotking". */
export const TheFoe = (foe: Pick<Foe, 'name' | 'unique'>) => capitalized(theFoe(foe))

/** A count as the game writes it, gold or kills or calls: in full, thousands set apart by commas. */
export const countText = (n: number) => String(n).replace(/\B(?=(\d{3})+(?!\d))/g, ',')

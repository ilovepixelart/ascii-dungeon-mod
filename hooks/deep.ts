// The deep: past depth DEEP_FROM the depths come in tiers of TIER_DEPTHS, each ending at its big boss, each with a mark
// that changes its rules (read with `markHere` where the rule lives). When a tier's big boss falls, the next tier's
// mark is chosen of two (`pairOf`), one easier and one harder; unchosen when the hero takes the stairs into it, the
// easier is taken. Pure.
import type { Game, Mark } from '../types'
import { hash } from './rng'

/** The tiers begin past this depth. */
export const DEEP_FROM = 50
/** Depths a tier. */
export const TIER_DEPTHS = 10

/** Every mark: its name, what it does, and whether it is the harder kind. */
export const MARKS: Readonly<Record<Mark, { name: string; does: string; hard?: true }>> = {
  steady: { name: 'Steady', does: 'Nothing changes.' },
  mild: { name: 'Mild', does: 'Foes hit a fifth softer and pay a third less gold.' },
  brittle: { name: 'Brittle', does: 'Foes have a fifth less HP and hit a fifth harder.' },
  ironclad: { name: 'Ironclad', does: 'Foes have half again the HP and hit a sixth harder but items roll twice.', hard: true },
  frenzied: { name: 'Frenzied', does: 'One foe in four is a champion and foes hit a sixth harder.', hard: true },
  lean: { name: 'Lean', does: 'Healing potions drop a quarter as often but gold is doubled.', hard: true },
}
const EASY: readonly Mark[] = ['steady', 'mild', 'brittle']
const HARD: readonly Mark[] = ['ironclad', 'frenzied', 'lean']

/** A depth's tier: 0 down to DEEP_FROM, then 1 for the first TIER_DEPTHS past it, and so on. */
export const tierOf = (depth: number) => Math.max(0, Math.ceil((depth - DEEP_FROM) / TIER_DEPTHS))
/** A tier's first depth. */
export const tierStart = (tier: number) => DEEP_FROM + (tier - 1) * TIER_DEPTHS + 1

/** A tier's mark: as chosen, else Steady. */
export const markOf = (g: Pick<Game, 'marks'>, tier: number): Mark => g.marks?.[tier] ?? 'steady'
/** The mark where the hero is: none in town or above the tiers. */
export const markHere = (g: Pick<Game, 'marks' | 'where' | 'depth'>): Mark => (g.where === 'dungeon' && tierOf(g.depth) > 0 ? markOf(g, tierOf(g.depth)) : 'steady')

/** The two marks a tier is chosen of, the easier first: fixed by the world. */
export const pairOf = (world: number, tier: number): [Mark, Mark] => [EASY[hash(world, tier, 13) % EASY.length]!, HARD[hash(world, tier, 17) % HARD.length]!]

/**
 * The tier whose mark is still to be settled: the one after the deepest big boss slain from DEEP_FROM on, while the
 * hero has not yet gone into it. A tier the hero reached before its fork stays Steady.
 */
export const forkTier = (g: Pick<Game, 'bossSlain' | 'deepest'>): number | undefined => {
  if (g.bossSlain < DEEP_FROM) return undefined
  const tier = Math.floor((g.bossSlain - DEEP_FROM) / TIER_DEPTHS) + 1
  return g.deepest < tierStart(tier) ? tier : undefined
}

/** Whether a fork waits for its choice. */
export const isForkOpen = (g: Pick<Game, 'bossSlain' | 'deepest' | 'marks'>) => {
  const tier = forkTier(g)
  return tier !== undefined && g.marks?.[tier] === undefined
}

/** A tier's number as the deep map writes it. */
export const roman = (n: number) => {
  const NUMERALS: [number, string][] = [[1000, 'M'], [900, 'CM'], [500, 'D'], [400, 'CD'], [100, 'C'], [90, 'XC'], [50, 'L'], [40, 'XL'], [10, 'X'], [9, 'IX'], [5, 'V'], [4, 'IV'], [1, 'I']]
  let left = n
  let out = ''
  for (const [value, numeral] of NUMERALS) {
    while (left >= value) {
      out += numeral
      left -= value
    }
  }
  return out
}

// The deep: past depth DEEP_FROM the depths come in tiers of TIER_DEPTHS, each ending at its big boss, each with a mark
// that changes its rules (read with `markHere` where the rule lives). When a tier's big boss falls, the next tier's
// mark is chosen of two (`pairOf`), one easier and one harder; unchosen when the hero takes the stairs into it, the
// easier is taken. Pure.
import type { ChampionMod, Foe, Game, Mark } from '../types'
import { hash } from './rng'

/** The tiers begin past this depth. */
export const DEEP_FROM = 50
/** Depths a tier. */
export const TIER_DEPTHS = 10

/**
 * The Abyss's weight: each harder mark chosen takes WEIGHT_DEF from the hero's defense in its circle and every circle
 * after, the curse staying when the circle is behind: difficulty the player stacks for the harder marks' rewards, and
 * that only better gear buys back.
 */
export const WEIGHT_DEF = 30
const WEIGHT_SAID = `Its weight stays: ${WEIGHT_DEF} less defense from here on.`

/** Every mark: its name, what it does, and whether it is the harder kind. */
export const MARKS: Readonly<Record<Mark, { name: string; does: string; hard?: true }>> = {
  steady: { name: 'Steady', does: 'Nothing changes.' },
  mild: { name: 'Mild', does: 'Foes hit a fifth softer and pay a third less gold.' },
  brittle: { name: 'Brittle', does: 'Foes have a fifth less HP and hit a fifth harder.' },
  ironclad: { name: 'Ironclad', does: `Foes have half again the HP and hit a sixth harder, but items roll twice. ${WEIGHT_SAID}`, hard: true },
  frenzied: { name: 'Frenzied', does: `One foe in four is a champion and foes hit a sixth harder. ${WEIGHT_SAID}`, hard: true },
  lean: { name: 'Lean', does: `Healing potions drop a quarter as often, but gold is doubled. ${WEIGHT_SAID}`, hard: true },
}
const EASY: readonly Mark[] = ['steady', 'mild', 'brittle']
const HARD: readonly Mark[] = ['ironclad', 'frenzied', 'lean']

/** A depth's tier: 0 down to DEEP_FROM, then 1 for the first TIER_DEPTHS past it, and so on. */
export const tierOf = (depth: number) => Math.max(0, Math.ceil((depth - DEEP_FROM) / TIER_DEPTHS))
/** A tier's first depth. */
export const tierStart = (tier: number) => DEEP_FROM + (tier - 1) * TIER_DEPTHS + 1

/** The Abyss's circles, a tier each, by name: the first ten their own, the rest the Nameless Dark. */
const CIRCLES = ['The Hollow Halls', 'The Sunken Vaults', 'The Rotting Gardens', 'The Rime Galleries', 'The Ember Deeps', 'The Bone Choir', 'The Drowned Stair', 'The Spore Throne', 'The Frozen Heart', 'The Last Forge']
export const circleName = (tier: number) => CIRCLES[tier - 1] ?? 'The Nameless Dark'

/**
 * Each circle's warden: its theme's big boss remade, named for the circle, with one champion rule and its sprite's
 * colors swapped (palette key for palette key). Past the tenth, the Nameless Dark's: in shadow, the rules in turn.
 */
const WARDENS: readonly { name: string; rule: ChampionMod; swap: Readonly<Record<string, string>> }[] = [
  { name: 'Hollow Queen', rule: 'shielded', swap: { C: 'e', b: 'E', B: 'q', g: 'W', G: 'E' } },
  { name: 'Vault Lich', rule: 'tough', swap: { B: 'Y', C: 'y', n: 'N' } },
  { name: 'Rotting King', rule: 'vampiric', swap: { o: 't', O: 'm', R: 'L' } },
  { name: 'Rime Mother', rule: 'shielded', swap: { P: 'B', p: 'c', v: 'Z' } },
  { name: 'Ember Wyrm', rule: 'savage', swap: { R: 'E', y: 'i' } },
  { name: 'Choir Queen', rule: 'vampiric', swap: { C: 'o', b: 'O', B: 'O', g: 'h', G: 'H' } },
  { name: 'Drowned Lich', rule: 'savage', swap: { B: 'G', C: 't', w: 'c' } },
  { name: 'Spore King', rule: 'tough', swap: { o: 'f', O: 'j', R: 'a' } },
  { name: 'Frozen Mother', rule: 'savage', swap: { P: 'W', p: 'w', v: 'c' } },
  { name: 'Last Wyrm', rule: 'shielded', swap: { R: 'q', y: 'w' } },
]
/** The circles with a warden of their own; past them, the Nameless Dark. */
export const NAMED_CIRCLES = WARDENS.length
const NAMELESS_RULES: readonly ChampionMod[] = ['tough', 'savage', 'shielded', 'vampiric']
const NAMELESS_SWAP = { o: 'x', O: 'P', R: 'K', y: 'p', C: 'P', B: 'x', b: 'P', P: 'x', p: 'P', g: 'x', G: 'K', h: 'P', i: 'p', I: 'P' }
/** A circle's warden, by tier: its name (none in the Nameless Dark, where it keeps its boss's last word), its rule, its colors. */
export const wardenOf = (tier: number): { name?: string; rule: ChampionMod; swap: Readonly<Record<string, string>> } =>
  WARDENS[tier - 1] ?? { rule: NAMELESS_RULES[(tier - WARDENS.length - 1) % NAMELESS_RULES.length]!, swap: NAMELESS_SWAP }
/** A warden's name, from its boss's (`Bone King`): the circle's own, or in the Nameless Dark the boss's last word. */
export const wardenName = (tier: number, boss: string) => wardenOf(tier).name ?? `Nameless ${boss.split(' ').at(-1)}`
/** Every name a warden goes by, from the big bosses' (`Bone King`...): the ten circles' own and the Nameless Dark's. */
export const wardenNames = (bosses: readonly string[]) => [...WARDENS.map(w => w.name), ...bosses.map(b => wardenName(WARDENS.length + 1, b))]
/** The champion rule a warden fights by; none for any other foe. */
export const wardenRule = (foe: Pick<Foe, 'warden'>) => (foe.warden === undefined ? undefined : wardenOf(foe.warden).rule)
/** What each rule does to a warden, as the Abyss window says it. */
export const RULE_SAID: Readonly<Record<ChampionMod, string>> = {
  tough: 'Tough: half again the HP.',
  savage: 'Savage: hits a tenth harder.',
  shielded: 'Shielded: turns your first blow aside, and one more when it rages.',
  vampiric: 'Vampiric: heals by what it deals, up to half of what it took since its last blow.',
}
/** A circle as said: its numeral and its name. */
export const circleSaid = (tier: number) => `circle ${roman(tier)}, ${circleName(tier)}`
/** What a mark is to the hero: the easier a blessing, the harder a curse that pays more. */
export const fateOf = (mark: Mark) => (MARKS[mark].hard === true ? 'curse' : 'blessing')

/** A tier's mark: as chosen, else Steady. */
export const markOf = (g: Pick<Game, 'marks'>, tier: number): Mark => g.marks?.[tier] ?? 'steady'
/** The mark where the hero is: none in town or above the tiers. */
export const markHere = (g: Pick<Game, 'marks' | 'where' | 'depth'>): Mark => (g.where === 'dungeon' && tierOf(g.depth) > 0 ? markOf(g, tierOf(g.depth)) : 'steady')

/** The harder marks chosen for the circles the hero is in or past: each a step of the Abyss's weight. */
export const abyssWeight = (g: Pick<Game, 'marks' | 'depth'>) =>
  Object.entries(g.marks ?? {}).filter(([tier, mark]) => Number(tier) <= tierOf(g.depth) && MARKS[mark].hard === true).length

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

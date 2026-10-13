// Making items: a plain base, a class's starting kit, and a rolled drop.
import type { Game, HeroClass, Item, Rarity } from '../../types'
import { pick, roll } from '../rng'
import { AFFIX_COUNT, BASES, LEGENDARIES, PREFIXES, STARTING_KIT, SUFFIXES, baseOf } from './catalog'
import type { Base } from './catalog'
import { NO_STATS, STAT_KEYS, plus } from './stats'
import type { Stats } from './stats'

/** A new item of `key` at `rarity` with no affixes: what a starting kit and a migration hand out. */
export const plainItem = (g: Pick<Game, 'nextId'>, key: string, rarity: Rarity = 'common'): Item => {
  const base = baseOf(key) ?? BASES[0]!
  const id = g.nextId
  g.nextId += 1
  return { id, base: base.key, name: base.name, rarity, slot: base.slot, w: base.w, h: base.h, ...plus(NO_STATS, base), cls: base.cls, x: 0, y: 0 }
}

export const kitFor = (g: Pick<Game, 'nextId'>, cls: HeroClass): Game['gear'] =>
  Object.fromEntries(STARTING_KIT[cls].map(key => {
    const item = plainItem(g, key)
    return [item.slot, item]
  }))

const TIERS: readonly Rarity[] = ['common', 'uncommon', 'rare', 'epic', 'legendary']
/** The non-Common tiers' share of what Common gives up, in the depth-1 ratio 28 : 12 : 4 : 1. */
const UPPER_RATIO: Record<Rarity, number> = { common: 0, uncommon: 28, rare: 12, epic: 4, legendary: 1 }
const COMMON_AT_DEPTH_1 = 55
const COMMON_FLOOR = 30
/** Items in a row without an Epic or better before the odds start to rise, and when one is certain. */
const DRY_GRACE = 10
const DRY_CERTAIN = 30
/** At most this many kills in a row leave nothing Rare or better: the last of them leaves one. */
export const RARE_KILLS = 12

/**
 * Percent weights per tier: 55 / 28 / 12 / 4 / 1 at depth 1; each depth below moves a point off Common, down to a
 * floor of 30, shared out in the depth-1 ratio. Bad luck only: after DRY_GRACE items without an Epic or better, each
 * more raises Epic and Legendary by a tenth, up to double, taken from Common; the DRY_CERTAIN-th is an Epic or better.
 */
export const tierWeights = (depth: number, dryKills = 0): Record<Rarity, number> => {
  const common = Math.max(COMMON_FLOOR, COMMON_AT_DEPTH_1 - (depth - 1))
  const ratioSum = Object.values(UPPER_RATIO).reduce((a, b) => a + b, 0)
  const w = Object.fromEntries(TIERS.map(t => [t, t === 'common' ? common : ((100 - common) * UPPER_RATIO[t]) / ratioSum])) as Record<Rarity, number>
  const boost = Math.min(1, Math.max(0, dryKills - DRY_GRACE) / 10)
  const extra = (w.epic + w.legendary) * boost
  return { ...w, epic: w.epic * (1 + boost), legendary: w.legendary * (1 + boost), common: w.common - extra }
}

/** The tier a roll of 1 to 100 lands on under `weights` (depth 1 without a dry streak by default). */
export const rarityOf = (n: number, weights: Record<Rarity, number> = tierWeights(1)): Rarity => {
  let edge = 0
  for (const t of TIERS) {
    edge += weights[t]
    if (n <= edge + 1e-9) return t
  }
  return 'legendary'
}

const scaled = (base: Base, depth: number): Partial<Stats> => {
  const bonus = Math.floor(depth / 3)
  return Object.fromEntries(STAT_KEYS.map(k => [k, (base[k] ?? 0) > 0 ? (base[k] ?? 0) + (k === 'hp' ? bonus * 2 : bonus) : 0]))
}

/** "Prefix Base of Suffix": one affix names one side, two or more name both. */
const affixed = (g: Game, base: Base, count: number): { name: string; stats: Stats } => {
  let stats = plus(NO_STATS, scaled(base, g.depth))
  const prefix = count >= 2 || (count === 1 && roll(g, 2) === 1) ? pick(g, PREFIXES) : undefined
  const suffix = count >= 2 || (count === 1 && prefix === undefined) ? pick(g, SUFFIXES) : undefined
  for (const affix of [prefix, suffix]) if (affix !== undefined) stats = plus(stats, affix)
  for (let extra = 2; extra < count; extra += 1) stats = plus(stats, pick(g, [...PREFIXES, ...SUFFIXES]))
  const name = [prefix?.name, base.name, suffix?.name].filter(Boolean).join(' ')
  return { name, stats }
}

/** How many times the smith will temper one item. */
export const TEMPER_MAX = 3

/** The smith's price to temper an item once more: 60 gold, times the square of the tempering it would be. */
export const temperCost = (item: Pick<Item, 'temper'>) => 60 * ((item.temper ?? 0) + 1) ** 2

/** What tempering raises: attack on a weapon or on a base made to strike (more attack than defense), defense on the rest. */
export const temperStat = (item: Pick<Item, 'base' | 'slot'>): 'atk' | 'def' => {
  const base = baseOf(item.base)
  return item.slot === 'weapon' || (base?.atk ?? 0) > (base?.def ?? 0) ? 'atk' : 'def'
}

/** The item tempered once more: +1 to its main stat. */
export const temperItem = (item: Item): Item => {
  const stat = temperStat(item)
  return { ...item, temper: (item.temper ?? 0) + 1, [stat]: item[stat] + 1 }
}

/** The item with its affixes rolled anew for the depth: the same base, tier, id, place and temper. Commons and Legendaries keep theirs. */
export const reforgeItem = (g: Game, item: Item): Item => {
  if (item.rarity === 'common' || item.rarity === 'legendary') return item
  const base = baseOf(item.base) ?? BASES[0]!
  const { name, stats } = affixed(g, base, AFFIX_COUNT[item.rarity])
  const stat = temperStat(item)
  return { ...item, name, ...stats, [stat]: stats[stat] + (item.temper ?? 0) }
}

/** About three drops in four are for the hero's class (or any class); the rest are any base at all. */
const pickBase = (g: Game) => {
  const forHero = BASES.filter(b => b.cls === undefined || b.cls === g.cls)
  return roll(g, 4) <= 3 ? pick(g, forHero) : pick(g, BASES)
}

/**
 * A new item for the depth. `rolls` rolls for its tier and keeps the best (a champion's luck); `atLeast` raises a
 * tier under it to it (a chest's or a champion's promise); after DRY_CERTAIN - 1 items without an Epic or better,
 * the next is one.
 */
/**
 * A drop's rarity: the best of `rolls` rolls, `atLeast` at the least and Epic once kills have gone dry long enough;
 * an Epic or better resets the dry spell, a Rare or better the wait for one.
 */
const rarityFor = (g: Game, atLeast: Rarity, rolls: number): Rarity => {
  const weights = tierWeights(g.depth, g.dryKills)
  const rolled = Array.from({ length: rolls }, () => rarityOf((roll(g, 10000) - 1) / 100 + 0.01, weights)).reduce((a, b) => (TIERS.indexOf(b) > TIERS.indexOf(a) ? b : a))
  const floor = g.dryKills >= DRY_CERTAIN - 1 && TIERS.indexOf(atLeast) < TIERS.indexOf('epic') ? 'epic' : atLeast
  const rarity = TIERS.indexOf(rolled) < TIERS.indexOf(floor) ? floor : rolled
  g.dryKills = rarity === 'epic' || rarity === 'legendary' ? 0 : g.dryKills + 1
  if (TIERS.indexOf(rarity) >= TIERS.indexOf('rare')) g.sinceRare = 0
  return rarity
}

/** A Legendary: its fixed powers, and stats that grow with depth as any item's do. */
const legendaryOf = (g: Game): Item => {
  const { base, name, power, ...stats } = pick(g, LEGENDARIES)
  const bonus = Math.floor(g.depth / 3)
  const grown = Object.fromEntries(Object.entries(stats).map(([k, v]) => [k, typeof v === 'number' && v > 0 && STAT_KEYS.includes(k as never) ? v + (k === 'hp' ? bonus * 2 : bonus) : v]))
  return { ...plainItem(g, base, 'legendary'), name, power, ...plus(NO_STATS, grown) }
}

export const makeItem = (g: Game, atLeast: Rarity = 'common', rolls = 1): Item => {
  const rarity = rarityFor(g, atLeast, rolls)
  if (rarity === 'legendary') return legendaryOf(g)
  const base = pickBase(g)
  const { name, stats } = affixed(g, base, AFFIX_COUNT[rarity])
  return { ...plainItem(g, base.key, rarity), name, ...stats }
}

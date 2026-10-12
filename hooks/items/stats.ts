/** The stats an item can carry, and how much a point of each is worth when two items are compared. */
export type Stats = { atk: number; def: number; hp: number; crit: number; xp: number }

export const NO_STATS: Stats = { atk: 0, def: 0, hp: 0, crit: 0, xp: 0 }
export const STAT_KEYS = Object.keys(NO_STATS) as (keyof Stats)[]

export const plus = (a: Partial<Stats>, b: Partial<Stats>): Stats =>
  Object.fromEntries(STAT_KEYS.map(k => [k, (a[k] ?? 0) + (b[k] ?? 0)])) as Stats

/** One number to compare items of a slot by: each stat weighted by how much a point of it is worth in a fight. */
export const worth = (s: Partial<Stats>) => (s.atk ?? 0) * 2 + (s.def ?? 0) * 2 + (s.hp ?? 0) / 2 + (s.crit ?? 0) / 5 + (s.xp ?? 0) / 10

export const STAT_LABEL: Record<keyof Stats, (n: number) => string> = {
  atk: n => `${n} atk`,
  def: n => `${n} def`,
  hp: n => `${n} HP`,
  crit: n => `${n}% crit`,
  xp: n => `${n}% XP`,
}

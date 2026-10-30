// The power curve: from simulated games, depth by depth, how strong the hero is beside the foes it meets. The fights a
// game saw give hits a kill and the blows the hero took, against its max HP; replayed (`withStats`), each step's game
// gives the hero's level, attack, defense and crit too, and its deaths. `tools/curve.ts` prints it; `curve.test.ts`
// holds it to its bands.
import type { Game, HeroClass } from '../types'
import { apply, attackBonus, critChance, defense } from './game'
import { simulate, startOf } from './sim'
import type { SimOptions, SimResult } from './sim'

/** The depths a row covers: each one to 10, then bands of 5 to 30, then of 10. */
export const bandOf = (depth: number) => (depth <= 10 ? depth : depth <= 30 ? Math.floor((depth - 1) / 5) * 5 + 1 : Math.floor((depth - 1) / 10) * 10 + 1)

type Band = { games: Set<string>; level: number[]; atk: number[]; def: number[]; crit: number[]; maxHp: number[]; hits: number; kills: number; blows: number[]; deaths: number }

export type CurveRow = {
  /** The band's first depth, and its name: `7`, `11-15`, `141-150`. */
  from: number
  depth: string
  games: number
  level: number
  atk: number
  def: number
  crit: number
  maxHp: number
  hitsPerKill: number
  blow: number
  /** The mean blow taken, in percent of the median max HP. */
  blowShare: number
  hitsToDie: number
  deaths: number
}

const fought = (b: Band, said: readonly string[]) => {
  for (const line of said) {
    if (/^You (CRITICALLY )?hit /.test(line)) b.hits += 1
    if (/^You slay /.test(line)) {
      b.hits += 1
      b.kills += 1
    }
    const blow = /strikes you for (\d+)/.exec(line)
    if (blow) b.blows.push(Number(blow[1]))
  }
}

const statsOf = (b: Band, g: Game, died: boolean) => {
  b.level.push(g.level)
  b.atk.push(attackBonus(g))
  b.def.push(defense(g))
  b.crit.push(critChance(g))
  if (died) b.deaths += 1
}

const median = (xs: readonly number[]) => (xs.length === 0 ? 0 : [...xs].sort((a, b) => a - b)[Math.floor(xs.length / 2)]!)
const mean = (xs: readonly number[]) => (xs.length === 0 ? 0 : xs.reduce((a, b) => a + b, 0) / xs.length)
const round = (n: number) => Math.round(n * 10) / 10

/** Each band's row, from its first depth up. */
const rowsOf = (bands: ReadonlyMap<number, Band>): CurveRow[] =>
  [...bands.entries()]
    .sort(([a], [b]) => a - b)
    .map(([from, b]) => ({
      from,
      depth: from <= 10 ? `${from}` : `${from}-${from + (from <= 30 ? 4 : 9)}`,
      games: b.games.size,
      level: median(b.level),
      atk: median(b.atk),
      def: median(b.def),
      crit: median(b.crit),
      maxHp: median(b.maxHp),
      hitsPerKill: b.kills === 0 ? 0 : round(b.hits / b.kills),
      blow: round(mean(b.blows)),
      blowShare: round((mean(b.blows) / Math.max(1, median(b.maxHp))) * 100),
      hitsToDie: b.blows.length === 0 ? 0 : round(median(b.maxHp) / mean(b.blows)),
      deaths: b.deaths,
    }))

/**
 * The curve of `seeds` games a class, `steps` steps each, played as `play` says. Each step counts to the depth it was
 * taken from. With `withStats` each step's game is replayed for the hero's level, attack, defense and crit, and its
 * deaths; without, those are 0, at half the time.
 */
export const curveOf = (classes: readonly HeroClass[], seeds: number, steps: number, play: SimOptions = {}, withStats = false): CurveRow[] => {
  const bands = new Map<number, Band>()
  const bandAt = (depth: number) => {
    const at = bandOf(depth)
    const b = bands.get(at) ?? { games: new Set(), level: [], atk: [], def: [], crit: [], maxHp: [], hits: 0, kills: 0, blows: [], deaths: 0 }
    bands.set(at, b)
    return b
  }
  for (const cls of classes)
    for (let seed = 1; seed <= seeds; seed += 1) {
      // Only played: the simulator's own tests hold every step to the rules.
      const result: SimResult = simulate(seed, steps, cls, { ...play, checks: false })
      let g = startOf(seed, cls, play)
      let depth = g.depth
      for (const r of result.records) {
        const b = bandAt(depth)
        b.games.add(`${cls}:${seed}`)
        b.maxHp.push(r.hero.maxHp)
        fought(b, r.said)
        if (withStats) {
          const before = g
          g = apply(g, r.action)
          statsOf(b, g, g.deaths !== before.deaths)
        }
        depth = r.hero.depth
      }
    }
  return rowsOf(bands)
}

// The power curve: from simulated games, depth by depth, how strong the hero is beside the foes it meets. Each step's
// game is replayed for the hero's level, attack, defense, crit and max HP; the fights it saw give hits a kill and the
// blows it took. Read beside it, `hitsToDie` (max HP over the average blow) says how many blows the hero can stand.
// Usage: bun tools/curve.ts [games] [steps] [--class knight|mage|rogue|all] [--build might|focus|vigor|insight] [--hand]
//        (20 and 3000 by default; prints a table, and the JSON with --json)
import type { Attribute, Game, HeroClass } from '../types'
import { apply, attackBonus, critChance, defense } from '../hooks/game'
import { simulate, startOf } from '../hooks/sim'
import type { SimOptions } from '../hooks/sim'

const args = process.argv.slice(2)
const flag = (name: string, fallback: string) => {
  const at = args.indexOf(`--${name}`)
  return at >= 0 ? (args[at + 1] ?? fallback) : fallback
}
const positional = args.filter((a, i) => !a.startsWith('--') && !args[i - 1]?.startsWith('--'))
const games = Number(positional[0] ?? 20)
const steps = Number(positional[1] ?? 3000)
const CLASSES: HeroClass[] = flag('class', 'all') === 'all' ? ['knight', 'mage', 'rogue'] : [flag('class', 'knight') as HeroClass]
const play: SimOptions = {
  ...(flag('build', '') === '' ? {} : { build: flag('build', '') as Attribute }),
  ...(args.includes('--hand') ? { byHand: true } : {}),
}

/** The depths a row covers: each one to 10, then wider bands. */
const bandOf = (depth: number) => (depth <= 10 ? depth : depth <= 30 ? Math.floor((depth - 1) / 5) * 5 + 1 : Math.floor((depth - 1) / 10) * 10 + 1)

type Band = { games: Set<string>; level: number[]; atk: number[]; def: number[]; crit: number[]; maxHp: number[]; hits: number; kills: number; blows: number[]; deaths: number }
const bands = new Map<number, Band>()
const bandAt = (depth: number) => {
  const at = bandOf(depth)
  const b = bands.get(at) ?? { games: new Set(), level: [], atk: [], def: [], crit: [], maxHp: [], hits: 0, kills: 0, blows: [], deaths: 0 }
  bands.set(at, b)
  return b
}

const look = (b: Band, g: Game, said: string[], game: string, died: boolean) => {
  b.games.add(game)
  b.level.push(g.level)
  b.atk.push(attackBonus(g))
  b.def.push(defense(g))
  b.crit.push(critChance(g))
  b.maxHp.push(g.maxHp)
  if (died) b.deaths += 1
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

for (const cls of CLASSES)
  for (let seed = 1; seed <= games; seed += 1) {
    const result = simulate(seed, steps, cls, play)
    let g = startOf(seed, cls, play)
    for (const r of result.records) {
      const before = g
      g = apply(g, r.action)
      look(bandAt(before.depth), g, r.said, `${cls}:${seed}`, g.deaths !== before.deaths)
    }
  }

const median = (xs: number[]) => {
  if (xs.length === 0) return 0
  const s = [...xs].sort((a, b) => a - b)
  return s[Math.floor(s.length / 2)]!
}
const mean = (xs: number[]) => (xs.length === 0 ? 0 : xs.reduce((a, b) => a + b, 0) / xs.length)
const round = (n: number, places = 1) => Math.round(n * 10 ** places) / 10 ** places

const rows = [...bands.entries()]
  .sort(([a], [b]) => a - b)
  .map(([from, b]) => ({
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

if (args.includes('--json')) console.log(JSON.stringify({ classes: CLASSES, games, steps, play, rows }, null, 2))
else {
  const head = ['depth', 'games', 'level', 'atk', 'def', 'crit', 'maxHp', 'hitsPerKill', 'blow', 'blowShare', 'hitsToDie', 'deaths'] as const
  console.log(`${CLASSES.join(', ')} x ${games} games x ${steps} steps ${JSON.stringify(play)}`)
  console.log(head.map(h => h.padStart(11)).join(''))
  for (const r of rows) console.log(head.map(h => String(r[h]).padStart(11)).join(''))
}

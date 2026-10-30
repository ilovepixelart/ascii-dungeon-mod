// The power curve (`curveOf` in hooks/curve.ts), printed: depth by depth, the hero's level, attack, defense, crit and
// max HP, hits a kill, the blows it took. Read beside it, `hitsToDie` (max HP over the average blow) says how many blows
// the hero can stand.
// Usage: bun tools/curve.ts [games] [steps] [--class knight|mage|rogue|all] [--build might|focus|vigor|insight] [--hand]
//        (20 and 3000 by default; prints a table, and the JSON with --json)
import type { Attribute, HeroClass } from '../types'
import { curveOf } from '../hooks/curve'
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

const rows = curveOf(CLASSES, games, steps, play, true)

if (args.includes('--json')) console.log(JSON.stringify({ classes: CLASSES, games, steps, play, rows }, null, 2))
else {
  const head = ['depth', 'games', 'level', 'atk', 'def', 'crit', 'maxHp', 'hitsPerKill', 'blow', 'blowShare', 'hitsToDie', 'deaths'] as const
  console.log(`${CLASSES.join(', ')} x ${games} games x ${steps} steps ${JSON.stringify(play)}`)
  console.log(head.map(h => h.padStart(11)).join(''))
  for (const r of rows) console.log(head.map(h => String(r[h]).padStart(11)).join(''))
}

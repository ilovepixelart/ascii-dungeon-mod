// Simulator: plays many games through the real rules, checks every invariant after every step, and reports balance.
// Usage: bun tools/simulate.ts <out-dir> [--games 30] [--steps 1000] [--class knight|mage|rogue|all]
//        bun tools/simulate.ts <out-dir> --replay <class>:<seed>:<step>   (the steps up to <step>, and a picture of it)
// Writes summary.json and, for any game that broke a rule, trace-<class>-<seed>.jsonl and break-<class>-<seed>.png.
import { mkdirSync } from 'node:fs'
import { join } from 'node:path'

import type { Game, HeroClass } from '../types'
import { apply } from '../hooks/game'
import { mapRows } from '../hooks/panels'
import { frameOf } from '../hooks/pixels'
import { simulate } from '../hooks/sim'
import type { SimResult, StepRecord } from '../hooks/sim'
import { newGame } from '../hooks/world'
import { png } from './png'

const args = process.argv.slice(2)
const out = args[0]
if (out === undefined || out.startsWith('--')) throw new Error('usage: bun tools/simulate.ts <out-dir> [--games N] [--steps N] [--class C|all] [--replay class:seed:step]')
mkdirSync(out, { recursive: true })
const flag = (name: string, fallback: string) => {
  const at = args.indexOf(`--${name}`)
  return at >= 0 ? (args[at + 1] ?? fallback) : fallback
}
const CLASSES: HeroClass[] = flag('class', 'all') === 'all' ? ['knight', 'mage', 'rogue'] : [flag('class', 'knight') as HeroClass]

/** The board as pixels and as the 1x text map, so a moment can be judged by eye and by text alike. */
const picture = (g: Game, file: string) => {
  const w = 21 * 12
  const h = 13 * 12
  const f = frameOf(g, w, h)
  const px = Array.from({ length: h }, (_, y) => Array.from({ length: w }, (_, x) => `#${(f[y * w + x] ?? 0).toString(16).padStart(6, '0')}`))
  Bun.write(file, png(px, 3))
  return mapRows(g, 64, 18).map(r => r.map(run => run.text).join(''))
}

const describeStep = (r: StepRecord) =>
  `#${r.step} ${JSON.stringify(r.action)}  hero ${r.hero.x},${r.hero.y} hp ${r.hero.hp}/${r.hero.maxHp} depth ${r.hero.depth} lv ${r.hero.level}` +
  `${r.foe ? `  foe ${r.foe.name} ${r.foe.hp}hp at ${r.foe.x},${r.foe.y}` : ''}${r.said.length ? `\n      ${r.said.join('\n      ')}` : ''}${r.broke.length ? `\n  !!  ${r.broke.join('\n  !!  ')}` : ''}`

const replay = flag('replay', '')
if (replay !== '') {
  const [cls, seed, step] = replay.split(':')
  const result = simulate(Number(seed), Number(step) + 1, cls as HeroClass)
  let g = newGame(Number(seed), cls as HeroClass)
  for (const r of result.records) g = apply(g, r.action)
  console.log(result.records.slice(-25).map(describeStep).join('\n'))
  const file = join(out, `replay-${cls}-${seed}-${step}.png`)
  console.log(`\n${picture(g, file).join('\n')}\n\npicture: ${file}`)
  process.exit(0)
}

const games = Number(flag('games', '30'))
const steps = Number(flag('steps', '1000'))
const results: SimResult[] = []
for (const cls of CLASSES) for (let seed = 1; seed <= games; seed += 1) results.push(simulate(seed, steps, cls))

const sum = (f: (r: SimResult) => number) => results.reduce((n, r) => n + f(r), 0)
const said = (re: RegExp) => sum(r => r.records.reduce((n, s) => n + s.said.filter(l => re.test(l)).length, 0))
const damageTaken = sum(r => r.records.reduce((n, s) => n + s.said.reduce((m, l) => m + Number(/strikes you for (\d+)/.exec(l)?.[1] ?? 0), 0), 0))
const hits = said(/^You (CRITICALLY )?hit /)
const kills = said(/^You slay /)
const loot: Record<string, number> = {}
for (const r of results) for (const [k, v] of Object.entries(r.stats.loot)) loot[k] = (loot[k] ?? 0) + v
const lootTotal = Object.values(loot).reduce((a, b) => a + b, 0)
const broken = results.filter(r => r.firstBreak !== undefined)

const summary = {
  games: results.length,
  stepsEach: steps,
  classes: CLASSES,
  rulesBroken: broken.map(r => ({ cls: r.cls, seed: r.seed, step: r.firstBreak?.step, broke: r.firstBreak?.broke, replay: `bun tools/simulate.ts ${out} --replay ${r.cls}:${r.seed}:${r.firstBreak?.step}` })),
  balance: {
    deathsPer1000Steps: (sum(r => r.stats.deaths) * 1000) / (results.length * steps),
    potionsPerGame: sum(r => r.stats.potionsUsed) / results.length,
    herbsPerGame: sum(r => r.stats.herbsUsed) / results.length,
    scrollsPerGame: sum(r => r.stats.scrollsUsed) / results.length,
    wardsPerGame: sum(r => r.stats.wardsUsed) / results.length,
    bombsPerGame: sum(r => r.stats.bombsUsed) / results.length,
    turnsPerGame: sum(r => r.stats.turns) / results.length,
    deepestAverage: sum(r => r.stats.deepest) / results.length,
    levelAverage: sum(r => r.stats.finalLevel) / results.length,
    hitsPerKill: kills > 0 ? hits / kills + 1 : 0,
    damageTakenPerKill: kills > 0 ? damageTaken / kills : 0,
    blockedPerGame: sum(r => r.stats.blocked) / results.length,
    clicksPerGame: sum(r => r.stats.clicks) / results.length,
    clicksUnexplained: sum(r => r.stats.clicksUnexplained),
    drawnUntold: sum(r => r.stats.drawnUntold),
    cutsAstray: sum(r => r.stats.cutsAstray),
    jumps: sum(r => r.stats.jumps),
    sightBreaks: sum(r => r.stats.sightBreaks),
    placedPerGame: sum(r => r.stats.placed) / results.length,
    placeRefusedShare: sum(r => r.stats.placeRefused) / Math.max(1, sum(r => r.stats.placed)),
    destroyedPerGame: sum(r => r.stats.destroyed) / results.length,
    chestsPerGame: sum(r => r.stats.chests) / results.length,
    boughtPerGame: sum(r => r.stats.bought) / results.length,
    reforgedPerGame: sum(r => r.stats.reforged) / results.length,
    temperedPerGame: sum(r => r.stats.tempered) / results.length,
    questsDonePerGame: sum(r => r.stats.questsDone) / results.length,
    fortunesPerGame: sum(r => r.stats.fortunes) / results.length,
    bossesMetPerGame: sum(r => r.stats.bossesMet) / results.length,
    bossesSlainPerGame: sum(r => r.stats.bossesSlain) / results.length,
    bossDeathsPerGame: sum(r => r.stats.bossDeaths) / results.length,
    bigMetPerGame: sum(r => r.stats.bigMet) / results.length,
    bigSlainPerGame: sum(r => r.stats.bigSlain) / results.length,
    bigDeathsPerGame: sum(r => r.stats.bigDeaths) / results.length,
    portalsPerGame: sum(r => r.stats.portals) / results.length,
    healedPerGame: sum(r => r.stats.healed) / results.length,
    clicksRefusedShare: sum(r => r.stats.clicksRefused) / Math.max(1, sum(r => r.stats.clicks)),
    goldAverage: sum(r => r.stats.finalGold) / results.length,
    lootShare: Object.fromEntries(Object.entries(loot).map(([k, v]) => [k, Math.round((v / Math.max(1, lootTotal)) * 1000) / 10])),
  },
}
await Bun.write(join(out, 'summary.json'), JSON.stringify(summary, null, 2))
for (const r of broken) {
  await Bun.write(join(out, `trace-${r.cls}-${r.seed}.jsonl`), r.records.map(s => JSON.stringify(s)).join('\n'))
  const at = r.firstBreak!
  let g = newGame(r.seed, r.cls)
  for (const s of r.records.slice(0, at.step + 1)) g = apply(g, s.action)
  picture(g, join(out, `break-${r.cls}-${r.seed}.png`))
}

console.log(`${results.length} games x ${steps} steps (${CLASSES.join(', ')})`)
console.log(broken.length === 0 ? 'rules: none broken' : `rules: BROKEN in ${broken.length} games`)
for (const b of summary.rulesBroken.slice(0, 5)) console.log(`  ${b.cls} seed ${b.seed} step ${b.step}: ${b.broke?.join(' | ')}\n    replay: ${b.replay}`)
console.log('balance:', JSON.stringify(summary.balance, null, 2))
console.log(`wrote ${join(out, 'summary.json')}`)

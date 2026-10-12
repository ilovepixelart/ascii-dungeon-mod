// How a session feels, from simulated games: danger, pace, and how often something new happens, a class each.
// Usage: bun tools/feel.ts [games] [steps]   (60 and 1000 by default; prints JSON)
import type { HeroClass } from '../types'
import { simulate } from '../hooks/sim'

const games = Number(process.argv[2] ?? 60)
const steps = Number(process.argv[3] ?? 1000)

/** What counts as a moment worth seeing, by the log line that tells it. */
const NOTABLE: Readonly<Record<string, RegExp>> = {
  levelUp: /^\*\*\* Level /,
  death: /^You were slain by /,
  goodLoot: /^Loot: .* \((Rare|Epic|Legendary)\)\.$/,
  chest: /^You open the (wooden|iron|gilded) chest/,
  room: /^You (pray at the altar|drink from the spring|read at the lectern)|^The old anvil still rings/,
  boss: / rises to bar the way down!$/,
  champion: /^An? (Tough|Savage|Shielded|Vampiric) /,
  quest: /^Quest done/,
  newTheme: /descend to depth (6|11|16|21|26|31)\b/,
  peak: /^The air grows heavy/,
  twist: /^(Gloom|Horde|Champions' den|Barren|Bloodlust|Hoard): /,
  nemesis: / has found you!$| falls at last\./,
  unique: /^The ground trembles\. |\bis no more\. /,
}

const median = (xs: number[]) => [...xs].sort((a, b) => a - b)[Math.floor(xs.length / 2)] ?? 0

const measure = (cls: HeroClass) => {
  let calls = 0
  let deaths = 0
  let closeCalls = 0
  let bossMet = 0
  let bossWon = 0
  let goldLeft = 0
  let notable = 0
  let replayed = 0
  let kinds = 0
  let depthsSeen = 0
  const quiet: number[] = []
  const perKind: Record<string, number> = {}
  for (let seed = 1; seed <= games; seed += 1) {
    const r = simulate(seed, steps, cls)
    let gameCalls = 0
    let lastNotable = 0
    let longest = 0
    let deepest = 0
    let inFight = false
    let wasLow = false
    const foes = new Map<number, Set<string>>()
    for (const rec of r.records) {
      if (rec.action.kind === 'outcome') {
        gameCalls += 1
        if (rec.hero.depth < deepest) replayed += 1
      }
      deepest = Math.max(deepest, rec.hero.depth)
      let isNotable = false
      for (const [k, re] of Object.entries(NOTABLE)) {
        if (!rec.said.some(l => re.test(l))) continue
        perKind[k] = (perKind[k] ?? 0) + 1
        isNotable = true
      }
      for (const l of rec.said) {
        const kind = /^An? (?:\w+ )?(\w+) of .+ \(.\) emerges from the dark!/.exec(l)?.[1]
        if (kind === undefined) continue
        if (!foes.has(rec.hero.depth)) foes.set(rec.hero.depth, new Set())
        foes.get(rec.hero.depth)!.add(kind)
      }
      // A close call: a fight in which the hero fell under a quarter of max HP and lived.
      if (rec.foe !== null && !inFight) {
        inFight = true
        wasLow = false
      }
      if (inFight && rec.hero.hp > 0 && rec.hero.hp <= rec.hero.maxHp * 0.25) wasLow = true
      if (rec.foe === null && inFight) {
        inFight = false
        if (wasLow && !rec.said.some(l => /^You were slain/.test(l))) {
          closeCalls += 1
          isNotable = true
        }
      }
      if (isNotable) {
        longest = Math.max(longest, gameCalls - lastNotable)
        lastNotable = gameCalls
        notable += 1
      }
    }
    quiet.push(Math.max(longest, gameCalls - lastNotable))
    calls += gameCalls
    deaths += r.stats.deaths
    bossMet += r.stats.bossesMet
    bossWon += r.stats.bossesSlain
    goldLeft += r.final.gold
    for (const s of foes.values()) {
      kinds += s.size
      depthsSeen += 1
    }
  }
  const per100 = (n: number) => +((100 * n) / calls).toFixed(2)
  return {
    toolCallsPerGame: Math.round(calls / games),
    deathsPer100Calls: per100(deaths),
    closeCallsPer100Calls: per100(closeCalls),
    bossWinShare: +(bossWon / Math.max(1, bossMet)).toFixed(2),
    goldLeftPerGame: Math.round(goldLeft / games),
    notablePer100Calls: per100(notable),
    longestQuietCallsMedian: median(quiet),
    foeKindsPerDepth: +(kinds / Math.max(1, depthsSeen)).toFixed(2),
    replayShare: +(replayed / calls).toFixed(2),
    per100: Object.fromEntries(Object.entries(perKind).map(([k, v]) => [k, per100(v)])),
  }
}

console.log(JSON.stringify(Object.fromEntries((['knight', 'mage', 'rogue'] as const).map(cls => [cls, measure(cls)])), null, 1))

// Simulation: plays whole games through the real rules with a scripted coding session and a simple player,
// records every step, and checks every invariant after each one. Pure: no files, no clock; seeds make it replayable.
import type { Game, HeroClass } from '../types'
import { countOf, healingSlot, slotOf } from './consumables'
import { BIG_BOSSES, SHOP_PRICES, alongTheWay, apply, isOnlyAWalk, fortuneCost, keptChoice, onToolStart, reforgeCost, threat } from './game'
import type { Action } from './game'
import { BAG_H, BAG_W, SLOTS, TEMPER_MAX, isUpgrade, temperCost, worth } from './items'
import { MAP_H, MAP_W, chestAt, floorThing, isFloor } from './map'
import type { Level, Pos } from './map'
import { violations } from './invariants'
import { workOf } from './work'
import type { GitOperation } from './work'
import { FRAMES_PER_TILE, walkingGame } from './pixels'
import { levelOf, newGame } from './world'
import { TOWN_H, TOWN_SPOTS, TOWN_W } from './town'

export type StepRecord = {
  step: number
  action: Action
  /** Where the hero stood before the action. */
  from: { x: number; y: number }
  hero: { x: number; y: number; hp: number; maxHp: number; depth: number; level: number }
  foe: { name: string; hp: number; x: number; y: number } | null
  said: string[]
  broke: string[]
}

export type SimStats = {
  steps: number
  turns: number
  deepest: number
  deaths: number
  kills: number
  blocked: number
  potionsUsed: number
  loot: Record<string, number>
  finalLevel: number
  finalGold: number
  clicks: number
  clicksRefused: number
  /** Clicks that ended neither on the clicked tile nor with a line saying why: each one is a bug. */
  clicksUnexplained: number
  /** Items moved by hand, and moves refused because the item did not fit. */
  placed: number
  placeRefused: number
  destroyed: number
  /** Trips to town, and heals the healer gave. */
  portals: number
  healed: number
  /** Chests opened; potions bought, reforges and temperings done. */
  chests: number
  bought: number
  reforged: number
  tempered: number
  /** Walk tiles where the map drew an item taken that the strip and log had not told of, or the other way round. */
  drawnUntold: number
  /** Walk tiles where cutting the walk would leave a game other than the one drawn there. */
  cutsAstray: number
  questsDone: number
  fortunes: number
  /** Bosses risen, slain, and deaths to one. */
  bossesMet: number
  bossesSlain: number
  bossDeaths: number
  /** The big bosses of every tenth depth: risen, slain, and deaths to one. */
  bigMet: number
  bigSlain: number
  bigDeaths: number
}

export type SimResult = { seed: number; cls: HeroClass; records: StepRecord[]; stats: SimStats; firstBreak: StepRecord | undefined; final: Game }

/** The session's own dice, apart from the game's, so a policy change never shifts the game's rolls. */
const dice = (seed: number) => {
  let s = (seed * 2654435761) >>> 0 || 1
  return (sides: number) => {
    s = (s + 0x6d2b79f5) >>> 0
    let t = s
    t = Math.imul(t ^ (t >>> 15), t | 1)
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61)
    return (((t ^ (t >>> 14)) >>> 0) % sides) + 1
  }
}

/** Tools by how often a coding session calls them, with the share of calls that fail. */
const TOOLS: readonly { tool: string; weight: number; failPct: number }[] = [
  { tool: 'Read', weight: 30, failPct: 3 },
  { tool: 'Grep', weight: 15, failPct: 2 },
  { tool: 'Glob', weight: 5, failPct: 1 },
  { tool: 'Edit', weight: 20, failPct: 10 },
  { tool: 'Write', weight: 5, failPct: 5 },
  { tool: 'Bash', weight: 20, failPct: 30 },
  { tool: 'Agent', weight: 3, failPct: 5 },
  { tool: 'WebSearch', weight: 2, failPct: 5 },
]
const FILES = ['src/auth.ts', 'src/db/pool.ts', 'README.md', 'src/api/routes.ts', 'test/auth.test.ts']
/** Shell commands by how often a session runs them, with the git work the host would report on each. */
const COMMANDS: readonly { command: string; weight: number; git?: GitOperation }[] = [
  { command: 'npm test', weight: 24 },
  { command: 'git status', weight: 16 },
  { command: 'tsc -p .', weight: 12 },
  { command: 'npm run lint', weight: 12 },
  { command: 'ls src', weight: 12 },
  { command: 'git commit -m wip', weight: 8, git: { commit: { kind: 'committed' } } },
  { command: 'git push', weight: 4, git: { push: {} } },
  { command: 'gh pr create', weight: 1, git: { pr: { action: 'created' } } },
]

/** The nearest seen floor cell beside floor not yet seen: where an opening leads somewhere new. */
const frontier = (g: Game) => {
  const level = levelOf(g)
  const isSeenFloor = (x: number, y: number) => g.seen[y * MAP_W + x] === '1' && isFloor(level.tiles, { x, y })
  let best: { x: number; y: number } | null = null
  for (let y = 1; y < MAP_H - 1; y += 1) {
    for (let x = 1; x < MAP_W - 1; x += 1) {
      if (!isSeenFloor(x, y)) continue
      const opens = [[1, 0], [-1, 0], [0, 1], [0, -1]].some(([dx, dy]) => isFloor(level.tiles, { x: x + dx!, y: y + dy! }) && g.seen[(y + dy!) * MAP_W + x + dx!] === '0')
      if (opens && (best === null || Math.abs(x - g.x) + Math.abs(y - g.y) < Math.abs(best.x - g.x) + Math.abs(best.y - g.y))) best = { x, y }
    }
  }
  return best
}

/**
 * Where the simulated player clicks: the foe, now and then an opening into the unexplored, a visible pickup, a seen
 * floor tile nearby, or now and then the dark.
 */
type Dice = (n: number) => number

/** The first chest in sight, not yet opened: worth the detour. */
const chestInSight = (g: Game, level: Level) =>
  level.tiles.flatMap((row, y) => [...row].flatMap((_, x) => {
    const id = y * MAP_W + x
    return g.seen[id] === '1' && !g.taken.includes(id) && chestAt(g.world, g.depth, level, { x, y }) !== undefined ? [{ x, y }] : []
  }))[0]

/** A cell up to `r` away each way, on the map. */
const nearCell = (g: Game, d: Dice, r: number) => ({ x: Math.max(0, Math.min(MAP_W - 1, g.x + d(2 * r + 1) - r - 1)), y: Math.max(0, Math.min(MAP_H - 1, g.y + d(2 * r + 1) - r - 1)) })

/** Somewhere near worth a click: known floor with something on it, any known floor after a few tries, else just near. */
const nearbyClick = (g: Game, d: Dice, level: Level): Pos => {
  for (let tries = 0; tries < 12; tries += 1) {
    const t = nearCell(g, d, 8)
    const seen = g.seen[t.y * MAP_W + t.x] === '1'
    if (seen && isFloor(level.tiles, t) && (floorThing(g.world, g.depth, level, t) !== ' ' || tries > 4)) return t
  }
  return nearCell(g, d, 3)
}

const clickTarget = (g: Game, d: Dice): Action => {
  if (g.foe !== null && d(3) === 1) return { kind: 'goto', x: g.foe.x, y: g.foe.y }
  const level = levelOf(g)
  const chest = chestInSight(g, level)
  if (chest !== undefined && d(2) === 1) return { kind: 'goto', ...chest }
  const open = d(2) === 1 ? frontier(g) : null
  if (open !== null) return { kind: 'goto', ...open }
  if (d(10) === 1) return { kind: 'goto', ...nearCell(g, d, 12) }
  return { kind: 'goto', ...nearbyClick(g, d, level) }
}

/** Hurt: to the healer; and a reforge that came out worse taken back. */
const mendInTown = (g: Game): Action | undefined => {
  if (g.hp < g.maxHp) return { kind: 'goto', ...TOWN_SPOTS.healer }
  const from = keptChoice(g)
  return from !== undefined && worth(from.item) > worth(g.gear[from.slot]!) ? { kind: 'keepOld' } : undefined
}

/**
 * To the elder for a quest, or to be paid for one done (now and then, so a full bag cannot hold the hero there); with
 * gold to spare, a potion when the belt runs low on healing, and a fortune now and then.
 */
const errands = (g: Game, d: Dice): Action | undefined => {
  if ((g.quest === null || g.quest.have >= g.quest.need) && d(2) === 1) return { kind: 'goto', ...TOWN_SPOTS.elder }
  if (g.gold >= SHOP_PRICES.health1 && countOf(g.belt[slotOf('health')]) < 2) return { kind: 'buy', ware: 'health1' }
  const canAffordFortune = g.fortune === null && g.gold >= fortuneCost(g) + 2 * SHOP_PRICES.health1
  if (canAffordFortune && g.panel === 'mystic') return { kind: 'fortune' }
  return canAffordFortune && d(3) === 1 ? { kind: 'goto', ...TOWN_SPOTS.mystic } : undefined
}

/** At the smith, with gold to spare: the cheapest tempering, now and then a reforge of the weapon. */
const smithing = (g: Game, d: Dice): Action | undefined => {
  const temperable = SLOTS.filter(slot => (g.gear[slot]?.temper ?? 0) < TEMPER_MAX && g.gear[slot] !== undefined)
  const cheapest = temperable.sort((a, b) => temperCost(g.gear[a]!) - temperCost(g.gear[b]!))[0]
  if (cheapest !== undefined && g.gold >= temperCost(g.gear[cheapest]!) + SHOP_PRICES.health1) return { kind: 'temper', slot: cheapest }
  const weapon = g.gear.weapon
  const isReforgeable = weapon !== undefined && weapon.rarity !== 'common' && weapon.rarity !== 'legendary'
  return isReforgeable && g.gold >= 2 * reforgeCost(g) && d(3) === 1 ? { kind: 'reforge', slot: 'weapon' } : undefined
}

/** In town: to the healer when hurt, its errands, the smith, a wander now and then, otherwise back through the portal. */
const townMove = (g: Game, d: Dice): Action | undefined => {
  const chosen = mendInTown(g) ?? errands(g, d) ?? smithing(g, d)
  if (chosen !== undefined) return chosen
  if (d(3) === 1) return { kind: 'goto', x: d(TOWN_W) - 1, y: d(TOWN_H) - 1 }
  return d(2) === 1 ? { kind: 'portal' } : { kind: 'goto', ...TOWN_SPOTS.portal }
}

/**
 * With no foe about: badly hurt with no potion on the belt, off to the healer in town; with gold to spend, now and then
 * a trip to the merchant and the smith; on the stairs, down now and then.
 */
const leaveWhenClear = (g: Game, d: Dice): Action | undefined => {
  if (g.foe === null && g.hp < g.maxHp * 0.5 && healingSlot(g) < 0 && d(2) === 1) return { kind: 'portal' }
  if (g.foe === null && g.gold >= 150 && d(25) === 1) return { kind: 'portal' }
  const stairs = levelOf(g).stairs
  return g.foe === null && g.x === stairs.x && g.y === stairs.y && d(2) === 1 ? { kind: 'stairs' } : undefined
}

/** Staying alive: a potion when low, or before an announced breath that could kill; better gear on; fury against a deadly foe. */
const keepAlive = (g: Game): Action | undefined => {
  const heal = healingSlot(g)
  if (g.hp < g.maxHp * 0.4 && heal >= 0) return { kind: 'use', slot: heal }
  const isBreathNext = g.foe !== null && (g.log.at(-1) ?? '').includes('draws a deep breath')
  if (isBreathNext && g.foe !== null && g.hp <= g.foe.atk * 2.5 && heal >= 0) return { kind: 'use', slot: heal }
  const upgrade = g.bag.find(i => isUpgrade(g, i))
  if (upgrade !== undefined) return g.cursor === upgrade.id ? { kind: 'equip' } : { kind: 'cycle' }
  const fury = g.belt.findIndex(s => s?.kind === 'fury')
  return g.foe !== null && fury >= 0 && threat(g) === 'deadly' ? { kind: 'use', slot: fury } : undefined
}

/** A full bag cleared: junk sold, now and then destroyed rather than sold, the way a player clears it by hand; else marked. */
const clearBag = (g: Game, d: Dice): Action | undefined => {
  if (g.bag.length < 8) return undefined
  const junk = g.bag.find(i => i.junk)
  if (junk !== undefined && d(4) === 1) return g.cursor === junk.id ? { kind: 'destroy' } : { kind: 'select', id: junk.id }
  return junk !== undefined ? { kind: 'sellJunk' } : { kind: 'junk' }
}

const STEPS_BY_HAND: readonly Action[] = [{ kind: 'move', dx: 1, dy: 0 }, { kind: 'move', dx: -1, dy: 0 }, { kind: 'move', dx: 0, dy: 1 }, { kind: 'move', dx: 0, dy: -1 }]

/** Fidgeting: an item dragged to some cell, which may or may not take it; a click somewhere; a step by hand. */
const fidget = (g: Game, d: Dice): Action | undefined => {
  const moved = g.bag[d(Math.max(1, g.bag.length)) - 1]
  if (moved !== undefined && d(100) <= 5) return { kind: 'place', id: moved.id, x: d(BAG_W) - 1, y: d(BAG_H) - 1 }
  if (d(100) <= 12) return clickTarget(g, d)
  return d(100) <= 4 ? STEPS_BY_HAND[d(4) - 1] : undefined
}

/** What the simulated player does on its own before the next tool call, if anything. */
const playerMove = (g: Game, d: Dice): Action | undefined => {
  if (g.where === 'town') return townMove(g, d)
  return leaveWhenClear(g, d) ?? keepAlive(g) ?? clearBag(g, d) ?? fidget(g, d)
}

/** One of `choices`, each as likely as its weight. */
const pick = <T extends { weight: number }>(d: (n: number) => number, choices: readonly T[]) => {
  let n = d(choices.reduce((sum, t) => sum + t.weight, 0))
  for (const t of choices) {
    n -= t.weight
    if (n <= 0) return t
  }
  return choices[0]!
}

/** One tool call, as its start and its outcome: a shell call's work as the host would report it when it succeeds. */
const toolCall = (d: (n: number) => number): Action[] => {
  const t = pick(d, TOOLS)
  const shell = t.tool === 'Bash' ? pick(d, COMMANDS) : undefined
  const start = onToolStart(t.tool, shell?.command ?? FILES[d(FILES.length) - 1])
  const ok = d(100) > t.failPct
  const work = ok && shell !== undefined ? workOf(shell.command, shell.git) : undefined
  return [start, { kind: 'outcome', ok, what: t.tool, ...(work === undefined ? {} : { work }) }]
}

/** The player's own action, as the pane takes it: a look first; a recap it opens is read and closed, and the action waits for the next turn. */
function* byHand(g: () => Game, own: Action): Generator<Action> {
  if (g().recap !== undefined) yield { kind: 'look' }
  if (g().panel === 'recap') yield { kind: 'panel', panel: 'recap' }
  else yield own
}

/** The session's next actions: a tool call is its start then its outcome; a turn ends by taking the stairs. */
function* session(g: () => Game, d: (n: number) => number): Generator<Action> {
  for (;;) {
    yield { kind: 'quest', text: 'fix the failing build' }
    const calls = 3 + d(10)
    for (let i = 0; i < calls; i += 1) {
      for (let guard = 0; guard < 6; guard += 1) {
        const own = playerMove(g(), d)
        if (own === undefined) break
        yield* byHand(g, own)
      }
      yield* toolCall(d)
    }
    yield { kind: 'descend' }
  }
}

/** A click on the hero explores; any other ends on its tile, or says why not: refused, already there, stopped by a foe, a fight, a death, the stairs, or in town a visit. */
const CLICK_EXPLAINED = /^You can't get there\.|^You are already there\.|blocks your way|^You (CRITICALLY )?hit |^You slay |^You draw on the fallen |strikes you|^You were slain|descend to depth|^The healer |^You step back through the portal|^Your stash holds |^The merchant |^The smith |^The elder[: ]|^The mystic[: ]|^The guard|^A villager |^The dog /
const isUnexplainedClick = (r: StepRecord) =>
  r.action.kind === 'goto' && (r.action.x !== r.from.x || r.action.y !== r.from.y) && (r.hero.x !== r.action.x || r.hero.y !== r.action.y) && !r.said.some(l => CLICK_EXPLAINED.test(l))

/**
 * The tiles of an action's walk where what the map draws and what the strip and log have told disagree: an item drawn
 * taken that the hero has not been told of, or told of while still drawn. The walk plays as the pane plays it, from the
 * game before, each tile's told state the walk's own (`alongTheWay`), or the game before where it has none.
 */
export const drawnVsTold = (before: Game, next: Game) => {
  if (next.walked.length < 2 || next.where !== before.where || next.depth !== before.depth) return 0
  const path = [{ x: before.x, y: before.y }, ...next.walked]
  const tiles = alongTheWay(before, next)
  let off = 0
  for (let k = 1; k < path.length - 1; k += 1) {
    const drawn = new Set(walkingGame(next, before, path, k * FRAMES_PER_TILE).taken)
    const told = new Set((tiles?.[k - 1] ?? before).taken)
    if (drawn.size !== told.size || [...drawn].some(id => !told.has(id))) off += 1
  }
  return off
}

/**
 * The tiles of a walk that is only a walk where cutting it there would leave a game other than the one drawn there:
 * the hero elsewhere, or an item, gold or a potion taken or not that the screen showed otherwise.
 */
export const cutVsDrawn = (before: Game, next: Game) => {
  if (next.walked.length < 2 || next.where !== before.where || next.depth !== before.depth || !isOnlyAWalk(before, next)) return 0
  const tiles = alongTheWay(before, next)
  if (tiles === null) return 0
  let off = 0
  for (let k = 1; k < next.walked.length; k += 1) {
    const cut = apply(before, { kind: 'trail', path: next.walked.slice(0, k) })
    const drawn = tiles[k - 1]!
    const isSame = cut.x === drawn.x && cut.y === drawn.y && cut.gold === drawn.gold && JSON.stringify(cut.taken) === JSON.stringify(drawn.taken) && JSON.stringify(cut.belt) === JSON.stringify(drawn.belt)
    if (!isSame) off += 1
  }
  return off
}

const BIG_NAMES = Object.values(BIG_BOSSES).map(b => b.name).join('|')
const count = (records: StepRecord[], re: RegExp) => records.reduce((n, r) => n + r.said.filter(l => re.test(l)).length, 0)

/** Plays `steps` actions of one game and records each. */
export const simulate = (seed: number, steps: number, cls: HeroClass = 'knight'): SimResult => {
  let g = newGame(seed, cls)
  const d = dice(seed)
  const actions = session(() => g, d)
  const records: StepRecord[] = []
  let turns = 0
  let untold = 0
  let miscut = 0
  for (let step = 0; step < steps; step += 1) {
    const action = actions.next().value as Action
    if (action.kind === 'descend') turns += 1
    const from = { x: g.x, y: g.y }
    const before = g
    g = apply(g, action)
    untold += drawnVsTold(before, g)
    miscut += cutVsDrawn(before, g)
    records.push({
      step,
      action,
      from,
      hero: { x: g.x, y: g.y, hp: g.hp, maxHp: g.maxHp, depth: g.depth, level: g.level },
      foe: g.foe === null ? null : { name: g.foe.name, hp: g.foe.hp, x: g.foe.x, y: g.foe.y },
      said: g.log.slice(g.log.length - g.fresh),
      broke: violations(g),
    })
  }
  const loot: Record<string, number> = {}
  for (const r of records) for (const l of r.said) {
    const tier = /^Loot: .* \((Common|Uncommon|Rare|Epic|Legendary)\)\.$/.exec(l)?.[1]
    if (tier !== undefined) loot[tier] = (loot[tier] ?? 0) + 1
  }
  const stats: SimStats = {
    steps,
    turns,
    deepest: g.deepest,
    deaths: g.deaths,
    kills: count(records, /^You slay /),
    blocked: count(records, /blocks your way/),
    potionsUsed: count(records, /^You drink a/),
    loot,
    finalLevel: g.level,
    finalGold: g.gold,
    clicks: records.filter(r => r.action.kind === 'goto').length,
    clicksRefused: count(records, /^You can't get there\.$/),
    clicksUnexplained: records.filter(isUnexplainedClick).length,
    drawnUntold: untold,
    cutsAstray: miscut,
    placed: records.filter(r => r.action.kind === 'place').length,
    placeRefused: count(records, /^It doesn't fit there\./),
    destroyed: count(records, /^You destroy the /),
    portals: count(records, /^You step through the portal into town\./),
    chests: count(records, /^You open the (wooden|iron|gilded) chest/),
    bought: count(records, /^You buy a /),
    reforged: count(records, /^The smith reforges /),
    tempered: count(records, /^The smith tempers /),
    questsDone: count(records, /^The elder pays you /),
    fortunes: count(records, /^The mystic reads your fortune /),
    bossesMet: count(records, / rises to bar the way down!$/),
    bossesSlain: count(records, /^You slay the [\w ]+ overlord!/),
    bossDeaths: count(records, /^You were slain by the [\w ]+ overlord /),
    bigMet: count(records, new RegExp(`^The (${BIG_NAMES}) \\(&\\) rises to bar the way down!$`)),
    bigSlain: count(records, new RegExp(`^You slay the (${BIG_NAMES})!`)),
    bigDeaths: count(records, new RegExp(`^You were slain by the (${BIG_NAMES}) `)),
    healed: count(records, /^The healer tends your wounds\./),
  }
  return { seed, cls, records, stats, firstBreak: records.find(r => r.broke.length > 0), final: g }
}

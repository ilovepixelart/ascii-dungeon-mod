// Simulation: plays whole games through the real rules with a scripted coding session and a simple player,
// records every step, and checks every invariant after each one. Pure: no files, no clock; seeds make it replayable.
import type { Attribute, Consumable, Game, HeroClass } from '../types'
import { countOf, healingSlot, slotOf } from './consumables'
import { BIG_BOSSES, alongTheWay, apply, isOnlyAWalk, fortuneCost, gambleCost, keptChoice, tradeInOf, onToolStart, priceOfWare, reforgeCost, sightOf, threat } from './game'
import type { Action } from './game'
import { BAG_H, BAG_W, SLOTS, TEMPER_MAX, isUpgrade, temperCost, worth } from './items'
import { MAP_H, MAP_W, cellId, chestAt, floorThing, isFloor, roomAt, same, shapeCut } from './map'
import type { Level, Pos, Room } from './map'
import { violations } from './invariants'
import { workOf } from './work'
import type { GitOperation } from './work'
import { FRAMES_PER_TILE, frameOf, hitsBetween, originAt, tileCamera, walkingGame, worldSize } from './pixels'
import { PX } from './pixelart'
import { levelOf, newGame } from './world'
import { offer } from './talents'
import { forkTier, isForkOpen, pairOf } from './deep'
import { TOWN_H, TOWN_SPOTS, TOWN_W, pathBeside } from './town'

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
  /** Herbs, scrolls, runes and bombs used. */
  herbsUsed: number
  scrollsUsed: number
  wardsUsed: number
  bombsUsed: number
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
  /** Actions that moved the hero with no walk to play (`isJump`): each one is a bug. */
  jumps: number
  /** Cells shown against the rules of sight (`sightBreaks`): each one is a bug. */
  sightBreaks: number
  /** Blows on the hero the pane shows nothing of (`isBlowUntold`): each one is a bug. */
  blowsUntold: number
  /** Walk tiles where the pane's camera leaves the hero off the view (`heroOutOfView`): each one is a bug. */
  outOfView: number
  /** Each step's frame build time in ms, when timed. */
  frameMs: number[]
  questsDone: number
  fortunes: number
  /** Sealed packs bought from the villager. */
  gambles: number
  /** Three pieces traded in to the guard for one better. */
  tradeIns: number
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
 * Where the simulated player clicks: the foe, now and then a chest in sight, the stairs once seen, an opening into the
 * unexplored, a visible pickup, a seen floor tile nearby, or now and then the dark.
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
  // The stairs once seen, now and then, from wherever the hero stands: down there and then.
  if (g.seen[cellId(level.stairs)] === '1' && d(8) === 1) return { kind: 'goto', ...level.stairs }
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
 * gold to spare, a potion when the belt runs low on healing, a fortune now and then, and the town's deals.
 */
const errands = (g: Game, d: Dice): Action | undefined => {
  if ((g.quest === null || g.quest.have >= g.quest.need) && d(2) === 1) return { kind: 'goto', ...TOWN_SPOTS.elder }
  if (g.gold >= priceOfWare('health1', g) && countOf(g.belt[slotOf('health')]) < 2) return { kind: 'buy', ware: 'health1' }
  const canAffordFortune = g.fortune === null && g.gold >= fortuneCost(g) + 2 * priceOfWare('health1', g)
  if (canAffordFortune && g.panel === 'mystic') return { kind: 'fortune' }
  if (canAffordFortune && d(3) === 1) return { kind: 'goto', ...TOWN_SPOTS.mystic }
  return deals(g, d)
}

/** Three spare pieces to the guard for one better; with three packs' gold, a pack from the villager. */
const deals = (g: Game, d: Dice): Action | undefined => {
  if (tradeInOf(g).length === 3) return g.panel === 'guard' ? { kind: 'tradeIn' } : d(2) === 1 ? { kind: 'goto', ...TOWN_SPOTS.guard } : undefined
  if (g.gold < 3 * gambleCost(g)) return undefined
  return g.panel === 'villager' ? { kind: 'gamble' } : d(3) === 1 ? { kind: 'goto', ...TOWN_SPOTS.villager } : undefined
}

/** At the smith, with gold to spare: the cheapest tempering, now and then a reforge of the weapon. */
const smithing = (g: Game, d: Dice): Action | undefined => {
  const temperable = SLOTS.filter(slot => (g.gear[slot]?.temper ?? 0) < TEMPER_MAX && g.gear[slot] !== undefined)
  const cheapest = temperable.sort((a, b) => temperCost(g.gear[a]!) - temperCost(g.gear[b]!))[0]
  if (cheapest !== undefined && g.gold >= temperCost(g.gear[cheapest]!) + priceOfWare('health1', g)) return { kind: 'temper', slot: cheapest }
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

/** The belt slot of a kind, while it holds any. */
const held = (g: Game, kind: Consumable) => (countOf(g.belt[slotOf(kind)]) > 0 ? slotOf(kind) : -1)

/**
 * The rest of the belt, as a player reaches for it: smoke out of a fight when low with no healing left, a ward up
 * against a foe that is not easy, herbs after a fight that left the hero hurt, fury against a deadly foe.
 */
export const beltAid = (g: Game): Action | undefined => {
  if (g.foe !== null && g.hp < g.maxHp * 0.25 && healingSlot(g) < 0 && held(g, 'smoke') >= 0) return { kind: 'use', slot: held(g, 'smoke') }
  if (g.foe !== null && g.effects.ward === 0 && held(g, 'ward') >= 0 && threat(g) !== 'easy') return { kind: 'use', slot: held(g, 'ward') }
  if (g.foe === null && g.effects.regen === 0 && g.hp < g.maxHp * 0.7 && held(g, 'regen') >= 0) return { kind: 'use', slot: held(g, 'regen') }
  if (g.foe !== null && g.effects.fury === 0 && held(g, 'fury') >= 0 && threat(g) === 'deadly') return { kind: 'use', slot: held(g, 'fury') }
  return undefined
}

/** Staying alive: a potion when low, or before an announced breath that could kill; the rest of the belt; better gear on. */
const keepAlive = (g: Game): Action | undefined => {
  const heal = healingSlot(g)
  if (g.hp < g.maxHp * 0.4 && heal >= 0) return { kind: 'use', slot: heal }
  const aid = beltAid(g)
  if (aid !== undefined) return aid
  const isBreathNext = g.foe !== null && (g.log.at(-1) ?? '').includes('draws a deep breath')
  if (isBreathNext && g.foe !== null && g.hp <= g.foe.atk * 2.5 && heal >= 0) return { kind: 'use', slot: heal }
  const upgrade = g.bag.find(i => isUpgrade(g, i))
  return upgrade === undefined ? undefined : g.cursor === upgrade.id ? { kind: 'equip' } : { kind: 'cycle' }
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

/** A talent owed, picked from the offer at random: each is taken by some game. */
const learnTalent = (g: Game, d: Dice): Action | undefined => {
  const offered = offer(g)
  return offered.length === 0 ? undefined : { kind: 'talent', talent: offered[d(offered.length) - 1]! }
}

/** A fork open, one of its two marks chosen at random: each is taken by some game. */
const chooseMark = (g: Game, d: Dice): Action | undefined => {
  const tier = forkTier(g)
  return tier === undefined || !isForkOpen(g) ? undefined : { kind: 'mark', mark: pairOf(g.world, tier)[d(2) - 1]! }
}

/** A point to spend, on one of the four attributes at random: each is trained by some game. */
const TRAINED: readonly Attribute[] = ['might', 'focus', 'vigor', 'insight']
const trainPoint = (g: Game, d: Dice): Action | undefined => (g.points > 0 ? { kind: 'train', stat: TRAINED[d(TRAINED.length) - 1]! } : undefined)

/** What the simulated player does on its own before the next tool call, if anything. */
const playerMove = (g: Game, d: Dice): Action | undefined => {
  const trained = trainPoint(g, d)
  if (trained !== undefined) return trained
  const learnt = learnTalent(g, d)
  if (learnt !== undefined) return learnt
  const marked = chooseMark(g, d)
  if (marked !== undefined) return marked
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
const CLICK_EXPLAINED = /^You can't get there\.|^You are already there\.|blocks your way|^You (CRITICALLY )?hit |^You slay | darts aside\.$| fades into the dark|shield turns your blow\.$|^You swing at the darkness\.|^You draw on the fallen |strikes you|^You were slain|descend to depth|^The healer |^You step back through the portal|^Your stash holds |^The merchant |^The smith |^The elder[: ]|^The mystic[: ]|^The guard|^A villager |^The dog /
/** A click that ended neither on its tile nor with a line saying why: what the simulator counts as a bug. */
export const isUnexplainedClick = (r: StepRecord) =>
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

/** A room's own floor: in its box, not cut back by its shape, floor on the map. Kept by room, as levels are. */
const ownFloor = (level: Level, r: Room) => {
  const known = ownFloors.get(r)
  if (known !== undefined) return known
  const cut = new Set(shapeCut(r).map(cellId))
  const cells = new Set<number>()
  for (let y = r.y; y < r.y + r.h; y += 1) for (let x = r.x; x < r.x + r.w; x += 1) if (isFloor(level.tiles, { x, y }) && !cut.has(cellId({ x, y }))) cells.add(cellId({ x, y }))
  ownFloors.set(r, cells)
  return cells
}
const ownFloors = new WeakMap<Room, ReadonlySet<number>>()

/** Whether a cell of room `b`'s own floor is, or lies beside, one of room `a`'s own: no wall between the two. */
const isOpenBetween = (level: Level, a: Room, b: Room) => {
  const inA = ownFloor(level, a)
  return [...ownFloor(level, b)].some(c => [0, 1, -1, MAP_W, -MAP_W].some(d => inA.has(c + d) && Math.abs(((c + d) % MAP_W) - (c % MAP_W)) <= 1))
}

/**
 * Cells an action showed against the rules of sight: a room's floor with the hero never in it, on its door or in sight
 * range of it; a closed chest the hero never came in sight range of: sight down a corridor stops short of one.
 * A new level, a Passage Bomb and a death show what they show.
 */
export const sightBreaks = (before: Game, next: Game): Pos[] => {
  if (next.where !== 'dungeon' || before.where !== 'dungeon' || next.depth !== before.depth || next.deaths !== before.deaths) return []
  if (next.seen === before.seen || next.log.slice(next.log.length - next.fresh).some(l => l.includes('The whole level is laid bare.'))) return []
  const level = levelOf(next)
  const shown: Pos[] = []
  for (let i = 0; i < next.seen.length; i += 1) {
    const c = { x: i % MAP_W, y: Math.floor(i / MAP_W) }
    if (before.seen[i] === '0' && next.seen[i] === '1' && isFloor(level.tiles, c)) shown.push(c)
  }
  if (shown.length === 0) return []
  const path = [{ x: before.x, y: before.y }, ...next.walked]
  const reach = sightOf(next)
  const near = (c: Pos) => path.some(q => Math.max(Math.abs(q.x - c.x), Math.abs(q.y - c.y)) <= reach)
  // A door is a cell beside a room's own floor: a corner its shape gave back to rock is none.
  const owns = level.rooms.map(r => ({ r, floor: ownFloor(level, r) }))
  const beside = (q: Pos) => owns.filter(o => [[1, 0], [-1, 0], [0, 1], [0, -1]].some(([dx, dy]) => o.floor.has(cellId({ x: q.x + dx!, y: q.y + dy! })))).map(o => o.r)
  // A room open to one stood in, or to one of those (a big boss's arena and the rooms it grew over or against), is the
  // same space.
  const stood = path.flatMap(q => roomAt(level, q) ?? beside(q))
  for (let i = 0; i < stood.length; i += 1) for (const r of level.rooms) if (!stood.includes(r) && isOpenBetween(level, stood[i]!, r)) stood.push(r)
  const roomsStoodIn = new Set(stood)
  return shown.filter(c => {
    const room = roomAt(level, c)
    if (room !== undefined) return !roomsStoodIn.has(room) && !near(c)
    const isChest = chestAt(next.world, next.depth, level, c) !== undefined && !next.taken.includes(cellId(c))
    return isChest && !near(c)
  })
}

/**
 * Whether an action told of a blow landing on the hero ("strikes you for 7") that its blows show nothing of: no hurt
 * or fall where the pane would draw one, as when a potion drunk on the same step leaves the HP higher.
 */
export const isBlowUntold = (before: Game, next: Game) => {
  const fresh = next.log.slice(next.log.length - next.fresh)
  if (!fresh.some(l => / strikes you for [1-9]/.test(l))) return false
  return !hitsBetween(before, next).some(h => h.kind === 'hurt' || h.kind === 'death')
}

/** The pane sizes the camera is followed at, in map pixels: a short pane, the best size's map, a big one. */
const VIEWS: readonly { w: number; h: number }[] = [{ w: 105, h: 60 }, { w: 105, h: 124 }, { w: 200, h: 144 }]
/** The cameras of the pane at each size as the pane moves them: recentered on a change of place, else paged by `tileCamera`. */
type Cameras = { place: string; at: (Pos | null)[] }
const placeKey = (g: Game) => (g.where === 'town' ? 'town' : `depth ${g.depth}`)

/**
 * The tiles of an action's walk, and where it ends, that the pane's camera at some size leaves the hero off the view
 * on; the cameras moved as the pane moves them.
 */
export const heroOutOfView = (cams: Cameras, next: Game): number => {
  if (cams.place !== placeKey(next)) {
    cams.place = placeKey(next)
    cams.at = VIEWS.map(() => null)
  }
  const tiles = next.walked.length > 0 && placeKey(next) === cams.place ? [...next.walked, { x: next.x, y: next.y }] : [{ x: next.x, y: next.y }]
  let off = 0
  VIEWS.forEach((v, i) => {
    for (const t of tiles) {
      const hero = { x: t.x * PX + PX / 2, y: t.y * PX + PX / 2 }
      const at = tileCamera(cams.at[i] ?? null, hero, v.w, v.h)
      cams.at[i] = at
      const o = originAt(at, v.w, v.h, worldSize(next))
      if (hero.x - PX / 2 < o.x || hero.x + PX / 2 > o.x + v.w || hero.y - PX / 2 < o.y || hero.y + PX / 2 > o.y + v.h) off += 1
    }
  })
  return off
}

/** Where a click that changes place is carried out from: beside the town's portal, or on the stairs. */
const isAtTheWayOut = (g: Game) => (g.where === 'town' ? pathBeside(g, TOWN_SPOTS.portal)?.length === 1 : same(g, levelOf(g).stairs))

/**
 * Whether an action moved the hero without a walk the pane can play: in the same place, to a new tile its walk does not
 * end on; or, by a click or an answer's descent in the dungeon, to another place with no walk from where it was not
 * already at the way out. A death is none.
 * The jump a click on the stairs once made.
 */
export const isJump = (before: Game, next: Game, action: Action) => {
  const isSamePlace = next.where === before.where && next.depth === before.depth
  const end = next.walked.at(-1)
  // A death wakes the hero where it wakes him, walk or none.
  if (next.deaths !== before.deaths) return false
  if (isSamePlace) return (next.x !== before.x || next.y !== before.y) && (end === undefined || end.x !== next.x || end.y !== next.y)
  const isWalked = action.kind === 'goto' || (action.kind === 'descend' && before.where === 'dungeon')
  return isWalked && next.walked.length === 0 && !isAtTheWayOut(before)
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
/** What every step is checked for, counted over a game; the pane's cameras followed as it moves them. */
const newChecks = () => ({ untold: 0, miscut: 0, jumps: 0, sightOff: 0, blowsUntold: 0, outOfView: 0, frameMs: [] as number[], cams: { place: '', at: [] } as Cameras })

/** One step checked: the walk drawn against the told, its cuts, jumps, sight, blows untold, the camera; its frame timed with `timeFrames`. */
const check = (c: ReturnType<typeof newChecks>, before: Game, g: Game, action: Action, timeFrames: boolean) => {
  c.untold += drawnVsTold(before, g)
  c.miscut += cutVsDrawn(before, g)
  if (isJump(before, g, action)) c.jumps += 1
  c.sightOff += sightBreaks(before, g).length
  if (isBlowUntold(before, g)) c.blowsUntold += 1
  c.outOfView += heroOutOfView(c.cams, g)
  if (!timeFrames) return
  const t = performance.now()
  frameOf(g, 105, 124)
  c.frameMs.push(performance.now() - t)
}

/** With `timeFrames`, each step's frame is built and timed, as the pane would draw it at the best size's map. */
export const simulate = (seed: number, steps: number, cls: HeroClass = 'knight', timeFrames = false): SimResult => {
  let g = newGame(seed, cls)
  const d = dice(seed)
  const actions = session(() => g, d)
  const records: StepRecord[] = []
  let turns = 0
  const checks = newChecks()
  for (let step = 0; step < steps; step += 1) {
    const action = actions.next().value as Action
    if (action.kind === 'descend') turns += 1
    const from = { x: g.x, y: g.y }
    const before = g
    g = apply(g, action)
    check(checks, before, g, action, timeFrames)
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
    herbsUsed: count(records, /^Warmth spreads through you/),
    scrollsUsed: count(records, /^Fury fills you/),
    wardsUsed: count(records, /^A ward shimmers around you/),
    bombsUsed: count(records, /^You vanish in smoke/),
    loot,
    finalLevel: g.level,
    finalGold: g.gold,
    clicks: records.filter(r => r.action.kind === 'goto').length,
    clicksRefused: count(records, /^You can't get there\.$/),
    clicksUnexplained: records.filter(isUnexplainedClick).length,
    drawnUntold: checks.untold,
    cutsAstray: checks.miscut,
    jumps: checks.jumps,
    sightBreaks: checks.sightOff,
    blowsUntold: checks.blowsUntold,
    outOfView: checks.outOfView,
    frameMs: checks.frameMs,
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
    gambles: count(records, /^You pay the villager /),
    tradeIns: count(records, /^The guard takes your /),
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

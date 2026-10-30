import type { Attribute, ChampionMod, Codex, Consumable, Foe, Mark, Talent, Fortune, Game, HeroClass, Item, Nemesis, Orders, Panel, Quest, Rarity, Slot, Work } from '../types'
import { CALM_CALLS, CALM_HEAL, DESCEND_CALLS, TOWN_IDLE_CALLS, HAND_FOE_ATK, HAND_FOE_MAX, HAND_FOE_TILE, HEAVY_BLOW_MAX, HP_PER_LEVEL, KNIGHT_ARMOR, PIERCED_DEF, KILL_TENSION, PEAK_HP, TENSION_PEAK, CRIT_TIMES, armorShare, foeAtk, foeHp, foeXp, heroDamage, statShare, xpShare, xpToLevel } from './balance'
import { foeTurn, heroBlowOn } from './patterns'
import { addToBelt, chooseTier, countOf, healingSlot, killConsumable, nameOf, slotOf, tickEffects, tierAt, useBelt, wareOf } from './consumables'
import type { Tier, Ware } from './consumables'
import { CLASS_NAME, RARE_KILLS, RARITY_NAME, RARITY_RANK, SET_SHARE, STARTING_KIT, TEMPER_MAX, baseOf, buyBack, arrange, canWear, cycle, destroy, equip, fitsAt, heirloomOf, gearBonus, isSetWhole, makeItem, priceOf, setOf, setPiece, wornPower, wornTrigger, reforgeItem, selected, sell, sellJunk, stash, take, temperCost, temperItem, temperStat, toggleJunk, toggleLock, unequip, place } from './items'
import { BIG_EVERY, THEME_DEPTHS, bfs, cellId, chestAt, corridorAhead, floorThing, isFloor, same, themeOf, visibleFrom } from './map'
import type { ChestKind, Level, Pos, Theme } from './map'
import { hash, roll } from './rng'
import { look, noted } from './recap'
import { EMPTY_CODEX, legendariesOwned, recorded } from './codex'
import { TALENTS, TALENT_EVERY, earned, hasTalent, offer, owed } from './talents'
import { MARKS, circleSaid, fateOf, forkTier, isForkOpen, markHere, markOf, pairOf, roman, tierStart } from './deep'
import { normalize } from './save'
import { putIn, stashedItems, tabName, tabPrice, takeOut, whereToStore, whyNotBuy } from './stash'
import type { StashTab } from './stash'
import { CLASS_LEAN, VIGOR_HP, arrive, levelOf, newGame, reveal } from './world'
import { TOWN_ARRIVAL, TOWN_SPOTS, TOWN_TALK, isTownWalkable, pathBeside, townPath, townSpotAt } from './town'
import type { TownPerson, TownSpot } from './town'
import { TheFoe, capitalized, countText, theFoe } from './names'

export { normalize } from './save'
export { SAVE_VERSION, levelOf, newGame } from './world'

export type Action =
  | { kind: 'explore'; steps: number }
  | { kind: 'summon'; name: string }
  | { kind: 'ally' }
  /** A tool call's end: whether it succeeded, and what work it came to when it did. */
  | { kind: 'outcome'; ok: boolean; what: string; work?: Work }
  | { kind: 'quest'; text: string }
  | { kind: 'descend' }
  | { kind: 'answer' }
  | { kind: 'attack' }
  | { kind: 'potion' }
  | { kind: 'walk' }
  | { kind: 'move'; dx: number; dy: number }
  | { kind: 'goto'; x: number; y: number }
  | { kind: 'pick'; x: number; y: number; id: number }
  /** Exactly these tiles, in order: what a walk cut short has visibly walked. */
  | { kind: 'trail'; path: readonly Pos[] }
  | { kind: 'stairs' }
  | { kind: 'restart'; cls?: HeroClass }
  | { kind: 'use'; slot: number; tier?: Tier }
  | { kind: 'choose'; slot: number; tier: Tier }
  | { kind: 'junk' }
  | { kind: 'lock' }
  | { kind: 'sellJunk' }
  | { kind: 'arrange' }
  | { kind: 'panel'; panel: Panel }
  | { kind: 'cycle' }
  | { kind: 'buy'; ware: Ware }
  | { kind: 'reforge'; slot: Slot }
  | { kind: 'temper'; slot: Slot }
  /** The selected bag item into the stash: its own special tab when it has one, else plain tab `tab` (the first unless said) or the first with room; dropped at cells `at`, onto plain tab `tab` there. */
  | { kind: 'store'; tab?: number; at?: Pos }
  | { kind: 'buyTab'; tab: StashTab }
  | { kind: 'fortune' }
  | { kind: 'gamble' }
  | { kind: 'tradeIn' }
  /** The elder's pay for a quest done, asked for again: after a visit found the bag too full for the item. */
  | { kind: 'claim' }
  | { kind: 'pet' }
  /** A stashed item into the bag, at the first place it fits, or at cells `at` it is dropped on. */
  | { kind: 'retrieve'; id: number; at?: Pos }
  /** A stashed item moved on its plain tab to cells `x`, `y`. */
  | { kind: 'moveStashed'; id: number; x: number; y: number }
  | { kind: 'select'; id: number }
  | { kind: 'deselect' }
  | { kind: 'place'; id: number; x: number; y: number }
  | { kind: 'destroy' }
  | { kind: 'portal' }
  | { kind: 'equip' }
  | { kind: 'unequip'; slot: Slot }
  | { kind: 'sell' }
  /** The last sale bought back at what it fetched. */
  | { kind: 'buyBack' }
  /** One of the hero's standing orders stepped to its next choice. */
  | { kind: 'order'; order: keyof Orders }
  /** The player looks at the pane: a click or a key, before what it does. */
  | { kind: 'look' }
  /** The smith's last reforge taken back: the piece kept as it was. */
  | { kind: 'keepOld' }
  /** The hero retires, passing down the piece they wear in `slot`; the start screen opens for the next. */
  | { kind: 'retire'; slot: Slot }
  /** One of the talents offered, picked. */
  | { kind: 'talent'; talent: Talent }
  /** One of the two marks the next tier is chosen of, chosen. */
  | { kind: 'mark'; mark: Mark }
  /** A session begun: what waits for the player's choice, said. */
  | { kind: 'greet' }
  | { kind: 'train'; stat: Attribute }
  | { kind: 'zoom' }

export type Run = { text: string; color?: string; bg?: string; bold?: boolean; inverse?: boolean; dim?: boolean }

/** The log lines a game keeps, what the log window shows; the dashboard shows the last few (`LOG_SHOWN`). */
export const LOG_KEPT = 30
/** Foes appear this many tiles ahead on the hero's route: inside a typical pane's view of about 3.4 tiles each way at 16 px. */
const FOE_AHEAD = 3
const POINTS_PER_LEVEL = 3

export const BESTIARY = [
  { glyph: 'r', name: 'rat' },
  { glyph: 'g', name: 'goblin' },
  { glyph: 'k', name: 'kobold' },
  { glyph: 'o', name: 'orc' },
  { glyph: 's', name: 'skeleton' },
  { glyph: 'T', name: 'troll' },
  { glyph: 'W', name: 'wraith' },
  { glyph: 'D', name: 'dragon' },
]

/** Bonus melee damage: every worn item's attack. */
export const attackBonus = (g: Game) => gearBonus(g, 'atk')
/** A critical blow's times: twice (Segfault's three times) and Focus's share. */
export const critTimes = (g: Game) => (wornPower(g, 'tripleCrit') === undefined ? CRIT_TIMES : 3) + statShare(g.stats.focus)
/** What Might lifts every blow by. */
export const mightTimes = (g: Game) => 1 + statShare(g.stats.might)
export const defense = (g: Game) => gearBonus(g, 'def')
export const critChance = (g: Game) => Math.min(60, Math.round(100 * statShare(g.stats.focus)) + gearBonus(g, 'crit') + (g.fortune?.kind === 'luck' ? LUCK_CRIT : 0))
export const xpGain = (g: Game, xp: number) => {
  const gained = Math.floor(xp * (1 + g.stats.insight / 20 + gearBonus(g, 'xp') / 100))
  return g.fortune?.kind === 'insight' ? Math.floor(gained * FORTUNE_MORE) : gained
}

/** Points of crit chance a fortune of luck adds. */
export const LUCK_CRIT = 15
/** The Band of the Endless Loop heals LOOP_HEAL HP on every LOOP_KILLS-th kill. */
export const LOOP_KILLS = 5
export const LOOP_HEAL = 3
/** How much more gold (riches) or XP (insight) a fortune brings. */
export const FORTUNE_MORE = 1.5

export { xpToLevel } from './balance'

export type Threat = 'easy' | 'tough' | 'deadly'

/** How dangerous the foe is: by the hits it needs to drop the hero from full health. */
/** How many turns ahead a foe's threat looks for its heaviest blow: every kind's turns come round within 4. */
const THREAT_TURNS = 4

/**
 * How hard the foe is: the blows of max HP its plain one takes through armor (3 or fewer deadly, 6 or fewer tough), and
 * deadly too when a heavy blow within THREAT_TURNS could take the hero's HP now.
 */
export const threat = (g: Game): Threat => {
  const foe = g.foe
  if (foe === null) return 'easy'
  const hits = Math.ceil(g.maxHp / blowAgainst(g, foe.atk, false, false))
  let ahead = foe
  let heaviest = 0
  for (let i = 0; i < THREAT_TURNS; i += 1) {
    const turn = foeTurn(g, ahead)
    if (turn.times > 1) heaviest = Math.max(heaviest, blowAgainst(g, foe.atk * turn.times, turn.pierces, true))
    ahead = turn.foe
  }
  if (hits <= 3 || heaviest >= g.hp) return 'deadly'
  return hits <= 6 ? 'tough' : 'easy'
}

const REPEAT = /^(.*) \(x(\d+)\)$/

const say = (g: Game, line: string) => {
  const last = g.log[g.log.length - 1] ?? ''
  const counted = REPEAT.exec(last)
  if ((counted?.[1] ?? last) === line) {
    g.log = [...g.log.slice(0, -1), `${line} (x${Number(counted?.[2] ?? 1) + 1})`]
    g.fresh = Math.max(g.fresh, 1)
    return
  }
  g.log = [...g.log, line].slice(-LOG_KEPT)
  g.fresh = Math.min(LOG_KEPT, g.fresh + 1)
}

const levelUp = (g: Game) => {
  while (g.xp >= xpToLevel(g.level)) {
    g.xp -= xpToLevel(g.level)
    g.level += 1
    g.maxHp += HP_PER_LEVEL
    g.hp = g.maxHp
    g.points += POINTS_PER_LEVEL
    g.toast = `Level up! You are now level ${g.level}.`
    say(g, `*** Level ${g.level}! HP restored, +${POINTS_PER_LEVEL} stat points (open the character sheet). ***`)
    if (g.level % TALENT_EVERY === 0 && owed(g) > 0) say(g, 'A talent to choose: open the character sheet.')
  }
}

const die = (g: Game, killer: string) => {
  const foe = g.foe !== null && killer === theFoe(g.foe) ? g.foe : undefined
  const depth = g.depth
  const at = { x: g.x, y: g.y }
  g.deaths += 1
  g.toast = `Slain by ${killer} on depth ${g.depth}.`
  // Back to the first depth of the theme, or the depth a commit marked in it: what was won below it stays won, and the depths above are not walked again.
  const first = Math.floor((g.depth - 1) / THEME_DEPTHS) * THEME_DEPTHS + 1
  const wake = g.waypoint !== undefined && g.waypoint >= first && g.waypoint <= g.depth ? g.waypoint : first
  say(g, `You were slain by ${killer} on depth ${g.depth}. You wake on depth ${wake}.`)
  if (foe !== undefined) remember(g, foe)
  if (foe?.unique !== undefined) g.uniqueWon = { ...g.uniqueWon, [bandOf(depth)]: g.level }
  // Waking on the same depth, what lies on its floor still lies there; on another, it is lost, said.
  const lying = g.floor ?? []
  if (wake !== depth && lying.length > 0) say(g, `${lying.length === 1 ? 'The item' : `The ${lying.length} items`} left on the floor of depth ${depth} ${lying.length === 1 ? 'is' : 'are'} lost.`)
  Object.assign(g, arrive(g.world, wake), { walked: [], fortune: null, tension: 0, calm: 0, lastSold: null }, wake === depth ? { floor: lying } : {})
  // The waking depth's twist is said; the toast stays the death's.
  const mod = depthMod(g.world, wake)
  if (mod !== undefined) say(g, `${MOD_SAID[mod]}.`)
  g.hp = g.maxHp
  // Gold brought to town is safe: a death takes half of what was earned since, rounded up.
  const atRisk = g.gold - Math.min(g.banked ?? 0, g.gold)
  const lost = atRisk - Math.floor(atRisk / 2)
  g.gold -= lost
  g.foe = null
  g.fallen = { by: killer, ...(foe === undefined ? {} : { foe }), at, depth, wake, lost }
  g.panel = 'death'
}

const hurt = (g: Game, amount: number, by: string) => {
  g.hp -= amount
  if (g.hp <= 0 && hasTalent(g, 'secondWind') && g.wind !== g.depth) {
    g.hp = 1
    g.wind = g.depth
    say(g, 'Second wind: you stand, at 1 HP.')
  }
  if (g.hp <= 0) die(g, by)
  else obey(g)
}

/** The orders a game keeps until the player changes them: drink under a quarter of max HP, no smoke, take every item,
 * the session playing. A save from before an order has its default. */
export const DEFAULT_ORDERS: Orders = { drink: 25, smoke: false, leave: 'common', play: 'session' }
export const ordersOf = (g: Pick<Game, 'orders'>): Orders => ({ ...DEFAULT_ORDERS, ...g.orders })
/** Whether the player plays by hand: the session's tool calls and answers leave the hero be. */
export const isByHand = (g: Pick<Game, 'orders'>) => ordersOf(g).play === 'hand'

/** The hero's orders after a blow: a healing potion under the drink line; with none, smoke when under a quarter and a foe is near. */
const obey = (g: Game) => {
  const orders = ordersOf(g)
  const healing = healingSlot(g)
  if (healing >= 0 && g.hp * 100 < orders.drink * g.maxHp) say(g, useBelt(g, healing))
  else if (orders.smoke && healing < 0 && g.foe !== null && g.hp * 4 < g.maxHp && countOf(g.belt[slotOf('smoke')]) > 0) say(g, useBelt(g, slotOf('smoke')))
}

/** Each order's choices in the order a click steps through them. */
const ORDER_STEPS: { [K in keyof Orders]: readonly Orders[K][] } = { drink: [25, 50, 0], smoke: [false, true], leave: ['common', 'uncommon', 'rare', 'all'], play: ['session', 'hand'] }

const order = (g: Game, which: keyof Orders) => {
  const orders = ordersOf(g)
  const steps = ORDER_STEPS[which] as readonly unknown[]
  g.orders = { ...orders, [which]: steps[(steps.indexOf(orders[which]) + 1) % steps.length] }
  if (which === 'play') say(g, isByHand(g) ? 'You play by hand: the session no longer moves you, and foes find you as you walk.' : 'The session plays: every tool call moves you, an answer takes the stairs once a depth has seen 3 tool calls.')
}

/** Furnishings: braziers, shelves, reeds and embers, nothing to take. */
const FURNISHINGS = new Set(['B', 'L', 'Q', 'F'])

/**
 * Whether the thing on the hero's tile is there to take now: not a furnishing; the altar and the spring passed by
 * while unhurt, and the old anvil while the weapon cannot take a temper, each kept for later.
 */
const isTakenNow = (g: Game, found: string) => {
  const weapon = g.gear.weapon
  const isAnvilIdle = found === 'N' && (weapon === undefined || (weapon.temper ?? 0) >= TEMPER_MAX)
  const isUnhurt = (found === 'A' || found === 'S') && g.hp >= g.maxHp
  return !FURNISHINGS.has(found) && !isUnhurt && !isAnvilIdle
}

const openChestHere = (g: Game) => openChest(g, chestAt(g.world, g.depth, levelOf(g), g) ?? 'wooden')

/** What each thing on the floor does as it is taken. */
const ON_FLOOR: Readonly<Record<string, (g: Game) => void>> = {
  $: g => {
    const coins = (roll(g, 5) + g.depth) * (modHere(g) === 'hoard' ? HOARD_GOLD : 1)
    g.gold += coins
    say(g, `You pick up ${countText(coins)} gold.`)
  },
  '!': g => say(g, addToBelt(g, 'health') ? 'You find a Health Potion.' : 'Your belt is full; the potion stays behind.'),
  '^': g => {
    say(g, 'A trap snaps at your ankle! -2 HP')
    hurt(g, 2, 'a trap')
  },
  A: g => {
    const healed = Math.min(g.maxHp - g.hp, Math.ceil(g.maxHp / 4))
    g.hp += healed
    say(g, `You pray at the altar. +${healed} HP`)
  },
  S: g => {
    g.hp = g.maxHp
    say(g, 'You drink from the spring. HP full.')
  },
  N: g => {
    const weapon = g.gear.weapon!
    g.gear = { ...g.gear, weapon: temperItem(weapon) }
    say(g, `The old anvil still rings: your ${weapon.name} is tempered, +1 ${temperStat(weapon) === 'atk' ? 'attack' : 'defense'}.`)
  },
  R: g => say(g, 'You read at the lectern and copy out a Scroll of the Berserker.'),
  C: openChestHere,
  H: openChestHere,
  G: openChestHere,
}

/** Each theme's thing to gather (`GATHERABLE`), by glyph: the consumable it gives and where it comes from. */
const GATHER: Readonly<Record<string, { kind: Consumable; from: string }>> = {
  U: { kind: 'ward', from: 'the warding stone' },
  V: { kind: 'regen', from: 'the reeds' },
  P: { kind: 'regen', from: 'the glowing caps' },
  X: { kind: 'ward', from: 'the rime crystal' },
  K: { kind: 'smoke', from: 'the powder keg' },
}

/** What gathering here gives: its kind, and a tier by depth drawn from the world and the cell, so the dice are left alone. */
const gatheredHere = (g: Game) => {
  const gather = GATHER[floorThing(g.world, g.depth, levelOf(g), g)]
  return gather === undefined ? undefined : { ...gather, tier: tierAt(g.depth, hash(g.world * 3 + g.depth, g.x, g.y) + 1) }
}

/** The theme's thing gathered onto the belt and said; false, and said, when its tier has no room there. */
const gather = (g: Game) => {
  const found = gatheredHere(g)!
  const name = nameOf(found.kind, found.tier)
  if (!addToBelt(g, found.kind, found.tier)) {
    say(g, `Your belt has no room for the ${name} ${found.from} offers.`)
    return false
  }
  say(g, `You gather ${/^[AEIOU]/.test(name) ? 'an' : 'a'} ${name} from ${found.from}.`)
  return true
}

const pickUp = (g: Game) => {
  const at = cellId(g)
  const found = g.taken.includes(at) ? ' ' : floorThing(g.world, g.depth, levelOf(g), g)
  const tile = isTakenNow(g, found) ? found : ' '
  // The lectern's scroll needs room on the belt before the lectern counts as read; so does what is gathered.
  if (tile === 'R' && !addToBelt(g, 'fury', 3)) {
    say(g, 'Your belt has no room for the scroll the lectern offers.')
    return
  }
  if (GATHER[tile] !== undefined && !gather(g)) return
  if (tile !== ' ') g.taken = [...g.taken, at]
  ON_FLOOR[tile]?.(g)
}

/** What a chest holds, by kind: gold rolled up from a base per depth, and an item no worse than its promise. */
const CHEST_LOOT: Readonly<Record<ChestKind, { gold: number; perDepth: number; itemChance: number; atLeast: Rarity }>> = {
  wooden: { gold: 10, perDepth: 3, itemChance: 60, atLeast: 'common' },
  iron: { gold: 15, perDepth: 5, itemChance: 100, atLeast: 'uncommon' },
  gilded: { gold: 25, perDepth: 8, itemChance: 100, atLeast: 'rare' },
}

/** Opens a chest: its gold, and its item into the bag if it fits, said in one line. */
const openChest = (g: Game, kind: ChestKind) => {
  const loot = CHEST_LOOT[kind]
  const coins = (roll(g, loot.gold) + loot.perDepth * g.depth) * (modHere(g) === 'hoard' ? HOARD_GOLD : 1)
  g.gold += coins
  const item = roll(g, 100) <= loot.itemChance ? makeItem(g, loot.atLeast) : undefined
  if (item !== undefined) announce(g, item)
  const isKept = item === undefined || stash(g, item)
  if (!isKept) leaveOnFloor(g, item, g)
  const found = item === undefined ? '' : isKept ? ` and ${item.name} (${RARITY_NAME[item.rarity]})` : `; your bag is full, so the ${item.name} lies here`
  say(g, `You open the ${kind} chest: ${countText(coins)} gold${found}.`)
}

/** How far the hero sees in a corridor: a tile around, two with Pathfinder. */
export const sightOf = (g: Pick<Game, 'talents'>) => (hasTalent(g, 'pathfinder') ? 2 : 1)

const moveTo = (g: Game, p: Pos) => {
  g.x = p.x
  g.y = p.y
  g.walked = [...g.walked, { x: p.x, y: p.y }]
  const level = levelOf(g)
  g.seen = reveal(g.seen, [...visibleFrom(level, p, sightOf(g)), ...corridorAhead(level, p)])
  // What lies here first, so a chest opened with the bag full says once where its item lies.
  pickUpFloor(g)
  pickUp(g)
}

/** The way from the hero to the stairs, around the foe; null when the foe cuts it. */
export const routeToStairs = (g: Game) => bfs(levelOf(g).tiles, g, levelOf(g).stairs, g.foe ?? undefined)

const isNextTo = (a: Pos, b: Pos) => Math.max(Math.abs(a.x - b.x), Math.abs(a.y - b.y)) <= 1

/**
 * Exploring walks the plain route to the stairs and stops at a living foe: beside it, never on it.
 * A foe in the way is walked up to and has to be dealt with before the hero goes on.
 */
const step = (g: Game, steps: number) => {
  if (g.foe !== null && isNextTo(g, g.foe)) {
    say(g, `${TheFoe(g.foe)} blocks your way.`)
    return
  }
  const level = levelOf(g)
  const path = bfs(level.tiles, g, level.stairs)
  if (path === null) {
    say(g, 'No way on from here.')
    return
  }
  if (path.length === 1) {
    say(g, 'You stand on the stairs. Finish the task to descend.')
    return
  }
  const deaths = g.deaths
  startWalk(g)
  for (const p of path.slice(1, steps + 1)) {
    if (g.deaths !== deaths) return
    moveTo(g, p)
    if (g.foe !== null && isNextTo(g, g.foe)) return
  }
}

/** Where a foe appears: up to FOE_AHEAD cells along the hero's route but always short of the stairs; else the nearest open cell in sight. */
const foeSpot = (g: Game): Pos => {
  const level = levelOf(g)
  const path = bfs(level.tiles, g, level.stairs) ?? [g]
  const ahead = path[Math.min(FOE_AHEAD, path.length - 2)]
  if (ahead !== undefined && !same(ahead, g)) return ahead
  const open = visibleFrom(level, g).filter(c => isFloor(level.tiles, c) && !same(c, g) && !same(c, level.stairs))
  // The place alone: the game itself spread into a foe would hand it the hero's HP.
  return open.sort((a, b) => Math.abs(a.x - g.x) + Math.abs(a.y - g.y) - (Math.abs(b.x - g.x) + Math.abs(b.y - g.y)))[0] ?? { x: g.x, y: g.y }
}

/** What each theme calls the monsters it has its own take on (their art in MONSTER_VARIANT); the crypt keeps the names. */
export const VARIANT_NAME: Readonly<Partial<Record<Theme, Readonly<Record<string, string>>>>> = {
  flooded: { r: 'bog rat', g: 'bog goblin', k: 'mire kobold', o: 'mire orc', s: 'drowned skeleton', T: 'moss troll', W: 'sunken wraith', D: 'sea drake' },
  fungal: { r: 'spore rat', g: 'toadstool goblin', k: 'mold kobold', o: 'fungal orc', s: 'mossbone skeleton', T: 'cap troll', W: 'spore wraith', D: 'blight drake' },
  frozen: { r: 'frost rat', g: 'ice goblin', k: 'rime kobold', o: 'frost orc', s: 'frozen skeleton', T: 'ice troll', W: 'frost wraith', D: 'frost drake' },
  forge: { r: 'ember rat', g: 'cinder goblin', k: 'slag kobold', o: 'ash orc', s: 'charred skeleton', T: 'magma troll', W: 'flame wraith', D: 'forge drake' },
}
/** A monster's name on a depth: the theme's own where it has one. */
export const kindName = (glyph: string, depth: number) => VARIANT_NAME[themeOf(depth)]?.[glyph] ?? BESTIARY.find(k => k.glyph === glyph)?.name ?? 'horror'

/** A depth's twist, a risk with its reward: foes harder in one way, the depth paying better in another. */
export type DepthMod = 'gloom' | 'horde' | 'den' | 'barren' | 'bloodlust' | 'hoard'
export const DEPTH_MODS: readonly DepthMod[] = ['gloom', 'horde', 'den', 'barren', 'bloodlust', 'hoard']
/** Of the depths past the first, boss depths aside, this many in a hundred have a twist. */
export const MOD_SHARE = 40
/** What each twist does, as the log says it on arrival. */
export const MOD_SAID: Readonly<Record<DepthMod, string>> = {
  gloom: 'Gloom: foes hit a fifth harder, and kills pay half again the gold',
  horde: 'Horde: foes have a quarter more HP, and kills give half again the XP',
  den: "Champions' den: one foe in four is a champion",
  barren: 'Barren: no potions drop here, but gear drops more often',
  bloodlust: 'Bloodlust: you and the foes both hit a quarter harder',
  hoard: 'Hoard: gold on the floor and in chests is doubled, and foes hit a sixth harder',
}
export const MOD_NAME: Readonly<Record<DepthMod, string>> = { gloom: 'Gloom', horde: 'Horde', den: "Champions' den", barren: 'Barren', bloodlust: 'Bloodlust', hoard: 'Hoard' }
const GLOOM_ATK = 1.2
const HORDE_HP = 1.25
const MOD_MORE = 1.5
const DEN_ODDS = 4
const BARREN_ITEMS = 15
const BLOODLUST = 1.25
const HOARD_ATK = 1.15
const HOARD_GOLD = 2
/** What a tier's mark makes of a foe's HP and attack (`MARKS` in hooks/deep.ts): Ironclad's and Frenzied's hit a sixth harder. */
const MARK_TIMES: Readonly<Record<Mark, { hp: number; atk: number }>> = {
  steady: { hp: 1, atk: 1 },
  mild: { hp: 1, atk: 0.8 },
  brittle: { hp: 0.8, atk: 1.2 },
  ironclad: { hp: 1.5, atk: 7 / 6 },
  frenzied: { hp: 1, atk: 7 / 6 },
  lean: { hp: 1, atk: 1 },
}
const MILD_GOLD = 2 / 3
const LEAN_GOLD = 2

/** A depth's twist, the same every time it is drawn: picked from the world and the depth, none on depth 1 or a boss depth. */
export const depthMod = (world: number, depth: number): DepthMod | undefined => {
  if (depth < 2 || isBossDepth(depth) || hash(depth, world, 7) >= MOD_SHARE) return undefined
  return DEPTH_MODS[hash(depth, world, 11) % DEPTH_MODS.length]
}
const modHere = (g: Game) => (g.where === 'dungeon' ? depthMod(g.world, g.depth) : undefined)

/** On arriving at a depth: its twist said in full, and toasted by name. */
const announceTwist = (g: Game) => {
  const mod = depthMod(g.world, g.depth)
  if (mod === undefined) return
  say(g, `${MOD_SAID[mod]}.`)
  g.toast = `Depth ${g.depth}: ${MOD_NAME[mod]}.`
}

/** The monsters each theme favors: there they come FAVORED_WEIGHT times as often as the rest. */
const FAVORED: Readonly<Record<Theme, string>> = { crypt: 'rsW', flooded: 'kTr', fungal: 'rgk', frozen: 'sWo', forge: 'ogD' }
const FAVORED_WEIGHT = 3
/** The newest kinds a depth has unlocked come this many times as often as the older ones. */
const NEW_WEIGHT = 2

/**
 * What kind a foe is, as its tier in the bestiary: any kind the depth has unlocked (up to two tiers past it), the
 * theme's favorites and the newest three more often. Stats grow with depth whatever the kind, so an old kind is
 * fodder beside a new one rather than harmless.
 */
export const foeTierWeights = (depth: number): number[] => {
  const top = Math.min(BESTIARY.length - 1, depth + 1)
  const favored = FAVORED[themeOf(depth)]
  return BESTIARY.slice(0, top + 1).map((kind, tier) => (favored.includes(kind.glyph) ? FAVORED_WEIGHT : 1) * (tier >= top - 2 ? NEW_WEIGHT : 1))
}

const pickTier = (g: Game) => {
  const weights = foeTierWeights(g.depth)
  let n = roll(g, weights.reduce((a, b) => a + b, 0))
  for (const [tier, w] of weights.entries()) {
    n -= w
    if (n <= 0) return tier
  }
  return weights.length - 1
}

const spawn = (g: Game, origin: string): Foe => {
  const tier = pickTier(g)
  const kind = BESTIARY[tier] ?? { glyph: '?', name: 'horror' }
  const mod = modHere(g)
  const mark = markHere(g)
  const maxHp = Math.round(foeHp(g.depth, tier, roll(g, 4)) * (mod === 'horde' ? HORDE_HP : 1) * MARK_TIMES[mark].hp)
  const foe: Foe = {
    glyph: kind.glyph,
    name: `${kindName(kind.glyph, g.depth)} of ${origin}`,
    hp: maxHp,
    maxHp,
    atk: Math.round(foeAtk(g.depth, tier, roll(g, 2)) * (mod === 'gloom' ? GLOOM_ATK : mod === 'hoard' ? HOARD_ATK : 1) * MARK_TIMES[mark].atk),
    xp: foeXp(g.depth, tier),
    ...foeSpot(g),
  }
  if (g.depth >= 2 && roll(g, mod === 'den' || mark === 'frenzied' ? DEN_ODDS : CHAMPION_ODDS) === 1) return championOf(foe, CHAMPION_MODS[roll(g, CHAMPION_MODS.length) - 1]!)
  return foe
}

/** Every BOSS_EVERY depths the stairs have a guardian, met on the first try to descend. */
export const BOSS_EVERY = 5
export const isBossDepth = (depth: number) => depth % BOSS_EVERY === 0

/**
 * A boss depth's guardian: the kind two tiers past the depth, at its strongest roll, with BOSS_HP times the HP and
 * BOSS_ATK times the attack, four times the XP.
 */
export const BOSS_HP = 2.5
export const BOSS_ATK = 1.45

/** Every BIG_EVERY depths, in the guardian's place, a big boss: the theme's own (`BIG_BOSSES`). */
export const isBigBossDepth = (depth: number) => depth % BIG_EVERY === 0
export const BIG_BOSSES: Readonly<Record<Theme, { key: NonNullable<Foe['big']>; name: string }>> = {
  crypt: { key: 'king', name: 'Bone King' },
  flooded: { key: 'queen', name: 'Drowned Queen' },
  fungal: { key: 'hive', name: 'Hive Mother' },
  frozen: { key: 'lich', name: 'Frost Lich' },
  forge: { key: 'wyrm', name: 'Furnace Wyrm' },
}
/** A big boss against the strongest kind at its depth's strongest roll: its HP and attack times these, eight times its XP. */
export const BIG_HP = 4.5
export const BIG_ATK = 1.5
const bigBossOf = (g: Game): Foe => {
  const tier = BESTIARY.length - 1
  const b = BIG_BOSSES[themeOf(g.depth)]
  const maxHp = Math.round(foeHp(g.depth, tier, 4) * BIG_HP)
  return { glyph: '&', name: b.name, hp: maxHp, maxHp, atk: Math.ceil(foeAtk(g.depth, tier, 2) * BIG_ATK), xp: foeXp(g.depth, tier) * 8, ...foeSpot(g), boss: true, big: b.key }
}

/**
 * The guardian's kind on a boss depth: one of its theme's favorites, strongest first, the next at each later visit to
 * the theme (every BOSS_ROUND depths), within the kinds the depth has unlocked. Every guardian past depth 5 was the top
 * kind, a dragon breathing two and a half times as hard every third turn.
 */
const BOSS_ROUND = 50
const guardianTier = (depth: number) => {
  const tiers = [...FAVORED[themeOf(depth)]].map(glyph => BESTIARY.findIndex(k => k.glyph === glyph)).filter(t => t <= depth + 1).sort((a, b) => b - a)
  return tiers[Math.floor(depth / BOSS_ROUND) % tiers.length] ?? Math.min(BESTIARY.length - 1, depth + 1)
}

const bossOf = (g: Game): Foe => {
  const tier = guardianTier(g.depth)
  const kind = BESTIARY[tier] ?? { glyph: '?', name: 'horror' }
  const maxHp = foeHp(g.depth, tier, 4) * BOSS_HP
  return { glyph: kind.glyph, name: `${kindName(kind.glyph, g.depth)} overlord`, hp: maxHp, maxHp, atk: Math.ceil(foeAtk(g.depth, tier, 2) * BOSS_ATK), xp: foeXp(g.depth, tier) * 4, ...foeSpot(g), boss: true }
}

export const CHAMPION_MODS: readonly ChampionMod[] = ['tough', 'savage', 'shielded', 'vampiric']
/** The names a nemesis takes, and the title its modifier gives it. */
const NEMESIS_NAMES: readonly string[] = ['Grak', 'Vex', 'Murk', 'Skarn', 'Thessa', 'Olg', 'Brakka', 'Zul', 'Mirra', 'Dask', 'Korv', 'Ysolde']
const NEMESIS_TITLE: Readonly<Record<ChampionMod, string>> = { tough: 'Unbroken', savage: 'Butcher', shielded: 'Warden', vampiric: 'Bloodthirsty' }
/** A nemesis waits this many depths below where it won, and a d4 more. */
const NEMESIS_AHEAD = 3
/** Each win makes a nemesis this much stronger again, in HP and attack, up to NEMESIS_GROWN_WINS of them: with no
 * ceiling a nemesis ahead of the hero grows with every win and can never be caught. */
export const NEMESIS_GROWTH = 0.2
export const NEMESIS_GROWN_WINS = 3

/** A nemesis by its title: "Grak the Butcher". */
export const nemesisTitle = (n: Pick<Nemesis, 'given' | 'mod'>) => `${n.given} the ${NEMESIS_TITLE[n.mod]}`

const kindOf = (glyph: string) => BESTIARY.find(k => k.glyph === glyph)?.name ?? 'horror'

/** The nemesis that comes for the hero here: its kind at this depth at its strongest, a champion, stronger for each of
 * its first wins. */
const nemesisFoe = (g: Game, n: Nemesis): Foe => {
  const tier = Math.max(0, BESTIARY.findIndex(k => k.glyph === n.glyph))
  const hp = foeHp(g.depth, tier, 4)
  const base: Foe = { glyph: n.glyph, name: `${n.kind} ${n.given}`, hp, maxHp: hp, atk: foeAtk(g.depth, tier, 2), xp: foeXp(g.depth, tier) * 2, ...foeSpot(g) }
  const champion = championOf(base, n.mod)
  const grow = 1 + NEMESIS_GROWTH * Math.min(n.wins, NEMESIS_GROWN_WINS)
  return { ...champion, name: base.name, hp: Math.round(champion.hp * grow), maxHp: Math.round(champion.maxHp * grow), atk: Math.round(champion.atk * grow), nemesis: true }
}

/**
 * A death by a champion makes it the hero's nemesis, or makes the nemesis that won again stronger; it goes deeper to
 * wait. A boss is never a champion, so a boss's win makes none.
 */
const remember = (g: Game, slayer: Foe) => {
  const waits = g.depth + NEMESIS_AHEAD + roll(g, 4)
  if (slayer.nemesis === true && g.nemesis !== null) {
    g.nemesis = { ...g.nemesis, wins: g.nemesis.wins + 1, depth: waits }
    say(g, `${nemesisTitle(g.nemesis)} laughs, and goes deeper still. It waits on depth ${waits}.`)
  } else if (slayer.champion !== undefined && g.nemesis === null) {
    g.nemesis = { given: NEMESIS_NAMES[roll(g, NEMESIS_NAMES.length) - 1]!, kind: kindOf(slayer.glyph), glyph: slayer.glyph, mod: slayer.champion, depth: waits, wins: 1 }
    say(g, `${TheFoe(slayer)} will remember you. Now it is ${nemesisTitle(g.nemesis)}, and it waits on depth ${waits}.`)
  }
}

/** A nemesis slain at last: a trophy of Epic or better, half again a champion's gold, and it is gone. */
const trophy = (g: Game, n: Nemesis, at: Pos) => {
  const item = makeItem(g, 'epic', 2)
  const title = nemesisTitle(n)
  g.nemesis = null
  keepPrize(g, item, at, named => `${title} falls at last. Trophy: ${named}.`)
  g.toast = `${title} is slain!`
}

/** Each theme's named unique: who it is, what kind, and its trick (in `patterns.ts` and `strike`). */
export const UNIQUES: Readonly<Record<Theme, { key: NonNullable<Foe['unique']>; name: string; glyph: string }>> = {
  crypt: { key: 'bones', name: 'Old Bones', glyph: 's' },
  flooded: { key: 'mire', name: 'Mother Mire', glyph: 'T' },
  fungal: { key: 'rot', name: 'the Rotking', glyph: 'k' },
  frozen: { key: 'rime', name: 'Rimehide', glyph: 'o' },
  forge: { key: 'ember', name: 'Emberjaw', glyph: 'D' },
}
/** A unique against its kind at the depth: half again the HP, a tenth more attack, four times the XP. At twice the HP
 * and a third more attack deaths rose by half: one that wins is still there when the hero comes back. */
const UNIQUE_HP = 1.5
const UNIQUE_ATK = 1.1
const UNIQUE_XP = 4

/** The band of five depths a depth lies in: 0 for depths 1 to 5. */
export const bandOf = (depth: number) => Math.floor((depth - 1) / THEME_DEPTHS)
/** Where a band's unique waits: one of its middle depths (never its first, never its boss depth), the same each time. */
export const uniqueDepth = (world: number, band: number) => band * THEME_DEPTHS + 2 + (hash(band, world, 13) % 3)

const uniqueFoe = (g: Game): Foe => {
  const u = UNIQUES[themeOf(g.depth)]
  const tier = Math.max(0, BESTIARY.findIndex(k => k.glyph === u.glyph))
  const hp = foeHp(g.depth, tier, 4) * UNIQUE_HP
  return { glyph: u.glyph, name: u.name, hp, maxHp: hp, atk: Math.round(foeAtk(g.depth, tier, 2) * UNIQUE_ATK), xp: foeXp(g.depth, tier) * UNIQUE_XP, ...foeSpot(g), unique: u.key }
}

/** One foe in this many, from depth 2, is a champion. */
const CHAMPION_ODDS = 10

/**
 * A foe made a champion: its modifier first in its name, double XP, half again its HP and a quarter more attack, and
 * one strength on top: tough has 60% more HP again, savage hits half again as hard, shielded turns the first blow
 * aside, vampiric heals by what it deals, up to half of what it took since its last blow.
 */
export const championOf = (foe: Foe, mod: ChampionMod): Foe => {
  const hp = Math.round(foe.hp * 1.5)
  const maxHp = Math.round(foe.maxHp * 1.5)
  const atk = Math.ceil(foe.atk * 1.25)
  const named = { ...foe, name: `${mod.charAt(0).toUpperCase()}${mod.slice(1)} ${foe.name}`, xp: foe.xp * 2, champion: mod, hp, maxHp, atk }
  if (mod === 'tough') return { ...named, hp: Math.round(hp * 1.6), maxHp: Math.round(maxHp * 1.6) }
  if (mod === 'savage') return { ...named, atk: Math.ceil(atk * 1.5) }
  if (mod === 'shielded') return { ...named, shield: 1 }
  return named
}

/**
 * Toasts a drop worth hearing about: a Legendary or an Epic by name, else a champion's prize; lesser drops are
 * left to the bag, so the toasts stay rare enough to matter.
 */
const announce = (g: Game, item: Item, champion?: string) => {
  if (item.rarity === 'legendary') g.toast = `Legendary! ${item.name}`
  else if (item.rarity === 'epic') g.toast = `Epic! ${item.name}`
  else if (champion !== undefined) g.toast = `Champion slain: ${champion} left ${item.name}.`
}

/** The percent chance a kill leaves an item: 35 and 1 a depth, at most 55. */
export const itemChance = (depth: number) => Math.min(55, 35 + depth)

/** An item that will not fit in the bag, left where it fell (`at`), to be picked up once there is room. */
const leaveOnFloor = (g: Game, item: Item, at: Pos) => {
  g.floor = [...(g.floor ?? []), { x: at.x, y: at.y, item }]
}

/** An item found at `at`: into the bag, said; with the bag full, onto the floor there, said. */
const stashOrLeave = (g: Game, item: Item, at: Pos) => {
  if (stash(g, item)) say(g, `Loot: ${item.name} (${RARITY_NAME[item.rarity]}).`)
  else {
    leaveOnFloor(g, item, at)
    say(g, `Your bag is full. The ${item.name} lies where it fell.`)
  }
}

/** A prize too good to leave lying (a trophy, a unique's or a boss's, the codex's, work's cache): into the bag, else sent to the
 * stash in town while it has room, else onto the floor at `at`. Said by `said` with the item named, then where it went. */
const keepPrize = (g: Game, item: Item, at: Pos, said: (named: string) => string) => {
  const told = said(`${item.name} (${RARITY_NAME[item.rarity]})`)
  const tab = whereToStore(g, item)
  if (stash(g, item)) say(g, told)
  else if (tab !== undefined) {
    putIn(g, item, tab)
    say(g, `${told} Your bag is full: it waits in your stash in town.`)
  } else if (g.where === 'town') {
    // Found in town: it waits on the floor of the depth the portal leads back to, by the portal's tile.
    leaveOnFloor(g, item, g.portal ?? levelOf(g).start)
    say(g, `${told} Your bag and your stash are full: it waits by the portal in the dungeon.`)
  } else {
    leaveOnFloor(g, item, at)
    say(g, `${told} Your bag and your stash are full: it lies where it fell.`)
  }
}

/** Steps onto items lying on the floor: each picked up while there is room, said; what is left, said that it lies there. */
/** What lies on the hero's tile, into the bag as far as it fits; `isQuiet`, nothing said of what stays. */
const pickUpFloor = (g: Game, isQuiet = false) => {
  for (const lying of (g.floor ?? []).filter(f => f.x === g.x && f.y === g.y)) {
    if (!stash(g, lying.item)) {
      if (!isQuiet) say(g, `The ${lying.item.name} lies here; your bag is still full.`)
      continue
    }
    g.floor = (g.floor ?? []).filter(f => f !== lying)
    say(g, `You pick up the ${lying.item.name} (${RARITY_NAME[lying.item.rarity]}).`)
  }
}

/**
 * A walk's first move: what lies on the tile it starts from, into the bag as far as it fits, quietly. Every walk does
 * it (a click, an explore, an answer finished, a trail) and so does the walk the pane plays, so the two agree.
 */
const startWalk = (g: Game) => pickUpFloor(g, true)

/** What a kill drops besides gear (`killConsumable`), onto the belt; none on a barren depth. */
const dropConsumable = (g: Game, isBarren: boolean) => {
  const drop = isBarren ? undefined : killConsumable(g)
  if (drop === undefined) return
  const name = nameOf(drop.kind, drop.tier)
  say(g, addToBelt(g, drop.kind, drop.tier) ? `Loot: ${name}.` : `Your belt has no room for the ${name}.`)
}

/**
 * What a kill leaves: maybe a potion or scroll, and maybe an item; a champion always leaves one of Uncommon or better,
 * `champion` its name, which the item's toast gives.
 */
const loot = (g: Game, at: Pos, champion?: string) => {
  const isChampion = champion !== undefined
  const isBarren = modHere(g) === 'barren'
  dropConsumable(g, isBarren)
  // Good loot is never long in coming: the RARE_KILLS-th kill without any leaves a Rare at least.
  const isRareDue = g.sinceRare >= RARE_KILLS - 1
  if (!isChampion && !isRareDue && roll(g, 100) > itemChance(g.depth) + (isBarren ? BARREN_ITEMS : 0)) {
    g.sinceRare += 1
    return
  }
  const item = makeItem(g, isRareDue ? 'rare' : isChampion ? 'uncommon' : 'common', (isChampion ? 2 : 1) * (markHere(g) === 'ironclad' ? 2 : 1))
  if (item.rarity === 'common' || item.rarity === 'uncommon') g.sinceRare += 1
  const leave = ordersOf(g).leave
  if (leave === 'all' || RARITY_RANK.indexOf(item.rarity) < RARITY_RANK.indexOf(leave)) {
    say(g, `You leave the ${item.name} (${RARITY_NAME[item.rarity]}).`)
    return
  }
  announce(g, item, champion)
  stashOrLeave(g, item, at)
}

/** A boss's hoard: the best of three rolls, Rare at least (a big boss's Epic at least), and an Elixir; the way down opens. */
const bossLoot = (g: Game, foe: Foe, isBig = false) => {
  const name = foe.name
  // A big boss leaves an Elixir, a guardian a Greater Health Potion: the merchant is where the rest of the belt comes from.
  const potion = isBig ? 'Elixir' : 'Greater Health Potion'
  say(g, addToBelt(g, 'health', isBig ? 3 : 2) ? `Loot: ${potion}.` : `Your belt has no room for the ${potion}.`)
  // Half a big boss's Epics, by the depth and the world, are a piece of the hero's class's set.
  const item = isBig && hash(g.depth, g.world, 41) < SET_SHARE ? setPiece(g, setOf(g.cls)) : makeItem(g, isBig ? 'epic' : 'rare', 3)
  keepPrize(g, item, foe, named => `Loot: ${named}.`)
  if (item.rarity !== 'legendary' && item.rarity !== 'epic') g.toast = `The ${name} falls: ${item.name}. The way down is open.`
  else announce(g, item)
}

/** Walks the hero up to the foe: false when they fall on the way (a trap), and the fight is over. */
const charge = (g: Game, foe: Foe) => {
  const deaths = g.deaths
  for (const p of (bfs(levelOf(g).tiles, g, foe) ?? []).slice(1, -1)) {
    moveTo(g, p)
    if (g.deaths !== deaths) return false
  }
  return true
}

/** Prospector's share more of a kill's gold. */
const PROSPECTOR = 1.2

/** What a kill pays: gold by the depth and the foe (a boss or unique five times, a champion three), its stolen gold back; XP by its own. The depth's twist and the fortune add theirs. */
const killPay = (g: Game, foe: Foe) => {
  const found = roll(g, 3) * g.depth * (foe.boss === true || foe.unique !== undefined ? 5 : foe.champion === undefined ? 1 : 3)
  const mod = modHere(g)
  const mark = markHere(g)
  const paid = Math.floor(found * (mod === 'gloom' ? MOD_MORE : 1) * (mark === 'mild' ? MILD_GOLD : mark === 'lean' ? LEAN_GOLD : 1))
  const prospected = wornTrigger(g, 'prospector') ? Math.floor(paid * PROSPECTOR) : paid
  const coins = (g.fortune?.kind === 'riches' ? Math.floor(prospected * FORTUNE_MORE) : prospected) + (foe.stolen ?? 0)
  const xp = Math.floor(xpGain(g, foe.xp) * xpShare(g.level, g.depth) * (mod === 'horde' ? MOD_MORE : 1))
  return { coins, xp }
}

/** What a slain foe leaves: a boss its hoard, a nemesis its trophy, a unique an Epic or better, any other its loot. */
const spoils = (g: Game, foe: Foe) => {
  if (foe.boss === true) {
    g.bossSlain = g.depth
    bossLoot(g, foe, foe.big !== undefined)
    announceFork(g)
  } else if (foe.nemesis === true && g.nemesis !== null) trophy(g, g.nemesis, foe)
  else if (foe.unique !== undefined) {
    g.uniquesSlain = [...g.uniquesSlain, bandOf(g.depth)]
    const item = makeItem(g, 'epic', 2)
    keepPrize(g, item, foe, named => `${foe.name} is no more. It leaves ${named}.`)
    g.toast = `${foe.name} slain!`
  } else loot(g, foe, foe.champion !== undefined ? foe.name : undefined)
}

/** The foe slain: paid, the class's and the quest's part, its spoils, and a level if it came. */
const slay = (g: Game, foe: Foe) => {
  const { coins, xp } = killPay(g, foe)
  g.foe = null
  g.xp += xp
  g.gold += coins
  say(g, `You slay ${theFoe(foe)}! +${countText(xp)} XP, +${countText(coins)} gold.`)
  g.tension += KILL_TENSION
  if (g.cls === 'mage') siphon(g, foe.name)
  if (wornTrigger(g, 'leeching')) g.hp = Math.min(g.maxHp, g.hp + 1)
  if (wornTrigger(g, 'momentum')) g.momentum = true
  if (g.quest?.kind === 'slay' || (g.quest?.kind === 'champion' && foe.champion !== undefined)) advanceQuest(g)
  spoils(g, foe)
  loop(g)
  levelUp(g)
}

/** The Band of the Endless Loop: every fifth kill while it is worn heals 3 HP. */
const loop = (g: Game) => {
  if (wornPower(g, 'loopHeal') === undefined) return
  const looped = (g.looped ?? 0) + 1
  g.looped = looped % LOOP_KILLS
  if (g.looped !== 0) return
  g.hp = Math.min(g.maxHp, g.hp + LOOP_HEAL)
  say(g, `The loop comes round: +${LOOP_HEAL} HP.`)
}

/**
 * The hero's swing at the foe: a crit by chance, or sure in the rogue's ambush (the first strike of each fight); a
 * hit of fury doubled, one fewer left; then what the foe's kind makes of it (`heroBlowOn`).
 */
const swing = (g: Game, foe: Foe, isSure: boolean) => {
  const isAmbush = g.cls === 'rogue' && foe.opened === undefined
  const isChained = g.chain === true && wornPower(g, 'chainCrit') !== undefined
  const isCrit = roll(g, 100) <= critChance(g) || isAmbush || isSure || isChained
  // The Whisper of the Linter: a critical makes the next blow one, but a chained one chains no further.
  delete g.chain
  if (isCrit && !isChained && wornPower(g, 'chainCrit') !== undefined) g.chain = true
  const isFury = g.effects.fury > 0
  if (isFury) g.effects = { ...g.effects, fury: g.effects.fury - 1 }
  const blow = heroBlowOn(g, foe, heroDamage(g.level, roll(g, 4), attackBonus(g)) * mightTimes(g) * (isCrit ? critTimes(g) : 1) * (isFury ? 2 : 1))
  return { blow, isCrit, opened: isAmbush ? openingPlayed(g, foe) : {} }
}

/** The class's opening played against the foe: done, or with a whole set and the first of two played, braced for the second. */
const openingPlayed = (g: Game, foe: Foe): Pick<Foe, 'opened' | 'braced'> => (isSetWhole(g) && foe.braced === undefined ? { braced: true } : { opened: true })

/**
 * Grudge's share more damage to a champion (a nemesis among them) or a unique, and Opener's to a foe at full HP; Bloodletting's
 * HP from a critical. Simulated from the first step, half again for either took deaths per 1,000 steps from 2.28 to
 * 1.1 and 1.3; a quarter, to 1.8 and 1.9, with the other talents.
 */
const GRUDGE = 1.25
const OPENER = 1.25
const BLOODLETTING = 2
/** Executioner's blow on a foe under a quarter HP; Momentum's after a kill. */
const EXECUTIONER = 1.5
const MOMENTUM = 1.25

/** What the hero's worn triggers multiply a blow on `foe` by. */
const triggerTimes = (g: Game, foe: Foe) =>
  (wornTrigger(g, 'executioner') && foe.hp * 4 < foe.maxHp ? EXECUTIONER : 1) * (g.momentum === true && wornTrigger(g, 'momentum') ? MOMENTUM : 1)

/** What the hero's talents multiply a blow on `foe` by. */
const talentTimes = (g: Game, foe: Foe) => {
  // A nemesis is a champion too.
  const isGrudge = hasTalent(g, 'grudge') && (foe.champion !== undefined || foe.unique !== undefined)
  const isOpener = hasTalent(g, 'opener') && foe.hp === foe.maxHp
  return (isGrudge ? GRUDGE : 1) * (isOpener ? OPENER : 1)
}

const strike = (g: Game, isSure = false) => {
  const foe = g.foe
  if (foe === null || !charge(g, foe)) return
  if ((foe.shield ?? 0) > 0) {
    g.foe = { ...foe, shield: (foe.shield ?? 0) - 1 }
    say(g, `${TheFoe(foe)}'s shield turns your blow.`)
    return
  }
  const { blow, isCrit, opened } = swing(g, foe, isSure)
  if (blow.said !== undefined) {
    g.foe = { ...foe, ...opened }
    say(g, blow.said)
    return
  }
  const dmg = Math.round(blow.dmg * (modHere(g) === 'bloodlust' ? BLOODLUST : 1) * talentTimes(g, foe) * triggerTimes(g, foe))
  delete g.momentum
  if (isCrit && hasTalent(g, 'bloodletting')) g.hp = Math.min(g.maxHp, g.hp + BLOODLETTING)
  const left = foe.hp - dmg
  const how = isCrit ? 'CRITICALLY hit' : 'hit'
  if (left > 0) {
    g.foe = { ...foe, hp: left, ...opened }
    say(g, `You ${how} ${theFoe(foe)} for ${dmg}.`)
    return
  }
  // Old Bones pulls itself together once, with a third of its HP.
  if (foe.unique === 'bones' && foe.risen === undefined) {
    g.foe = { ...foe, hp: Math.ceil(foe.maxHp / 3), risen: true, ...opened }
    say(g, `You ${how} ${theFoe(foe)} for ${dmg}. It clatters apart... and pulls itself back together!`)
    return
  }
  slay(g, foe)
}

/** Each class's ability, in a phrase. */
const CLASS_ABILITY: Readonly<Record<HeroClass, string>> = {
  knight: "Shield block, a foe's first blow each fight glances off",
  mage: 'Siphon, each kill restores a fifth of max HP',
  rogue: 'Ambush, the first strike of each fight is a sure critical',
}
const ATTRIBUTE_NAME: Readonly<Record<Attribute, string>> = { might: 'Might', focus: 'Focus', vigor: 'Vigor', insight: 'Insight' }

/** A class in a line, for the choice of a new game: its ability, its stat lean and its starting kit. */
export const classAbout = (cls: HeroClass) => {
  const lean = (Object.entries(CLASS_LEAN[cls]) as [Attribute, number][]).map(([k, v]) => `+${v} ${ATTRIBUTE_NAME[k]}`).join(', ')
  const kit = STARTING_KIT[cls].map(key => baseOf(key)?.name ?? key).join(', ')
  return `${CLASS_NAME[cls]}: ${CLASS_ABILITY[cls]}. ${lean}. ${kit}.`
}

/** The mage's siphon: a fifth of max HP back from every kill, a quarter with the whole Archivist's set. */
const siphon = (g: Game, name: string) => {
  const healed = Math.min(g.maxHp - g.hp, Math.ceil(g.maxHp / (isSetWhole(g) ? 4 : 5)))
  if (healed <= 0) return
  g.hp += healed
  say(g, `You draw on the fallen ${name}. +${healed} HP`)
}

/** The foe's blow turned aside: the knight's shield takes the first of each fight, else a ward the next. */
const isTurned = (g: Game, by: string) => {
  if (g.cls === 'knight' && g.foe !== null && g.foe.opened === undefined && g.foe.braced === undefined) {
    g.foe = { ...g.foe, ...openingPlayed(g, g.foe) }
    say(g, `Your shield turns ${by}'s blow.`)
    return true
  }
  if (g.effects.ward <= 0) return false
  g.effects = { ...g.effects, ward: g.effects.ward - 1 }
  say(g, `Your ward absorbs ${by}'s blow.`)
  return true
}

/** A goblin's hand in the purse: twice the depth in gold, kept on the foe to give back when it falls. */
const steal = (g: Game, by: string) => {
  if (g.foe === null) return
  const took = Math.min(g.gold, 2 * g.depth)
  g.gold -= took
  g.foe = { ...g.foe, stolen: took }
  if (took > 0) say(g, `${capitalized(by)} snatches ${countText(took)} gold!`)
}

/** A vampiric champion after its blow: healed by what it dealt, at most half of what it took since its last blow (its
 * whole loss on its first), so a blow bigger than the hero's never stalls the fight; never past its full HP. */
const drink = (foe: Foe, dmg: number): Foe => {
  const taken = (foe.hpAtBlow ?? foe.maxHp) - foe.hp
  const hp = Math.min(foe.maxHp, foe.hp + Math.min(dmg, Math.max(0, Math.floor(taken / 2))))
  return { ...foe, hp, hpAtBlow: hp }
}

const counter = (g: Game, what: string) => {
  // Who strikes, as a sentence names them: the foe, or with none an imp of the tool.
  const by = g.foe === null ? `the ${what} imp` : theFoe(g.foe)
  const turn = g.foe === null ? undefined : foeTurn(g, g.foe)
  if (turn !== undefined) {
    g.foe = turn.foe
    for (const line of turn.said) say(g, line)
    if (!turn.strikes) return
  }
  if (isTurned(g, by)) return
  const { dmg, halved } = foeBlow(g, turn)
  say(g, `${capitalized(by)} strikes you for ${dmg}${HALVED_SAID[halved]}.`)
  g.tension += Math.round((100 * dmg) / g.maxHp)
  if (turn?.steals === true) steal(g, by)
  if (g.foe?.champion === 'vampiric') g.foe = drink(g.foe, dmg)
  hurt(g, dmg, by)
  landed(g, dmg)
  if (turn !== undefined && turn.times <= 1) warnHeavy(g)
}

/** A heavy blow coming next turn, told now with about what it will take: a turn to ward, drink or step back. */
const warnHeavy = (g: Game) => {
  const foe = g.foe
  if (foe === null || g.hp <= 0) return
  const next = foeTurn(g, foe)
  if (next.times > 1 && next.strikes) say(g, `${TheFoe(foe)}'s next blow lands for about ${blowAgainst(g, foe.atk * next.times, next.pierces, true)}.`)
}

/** What the log adds to a blow halved once or twice. */
const HALVED_SAID = ['', ', half of it turned', ', three quarters of it turned'] as const

/** The defense a blow meets: all of it, a knight's KNIGHT_ARMOR times; through armor, a knight's PIERCED_DEF of that, rounded down, and no one else's. */
const armorAgainst = (g: Game, pierces: boolean) => {
  if (g.cls !== 'knight') return pierces ? 0 : defense(g)
  const def = defense(g) * KNIGHT_ARMOR
  return pierces ? Math.floor(def * PIERCED_DEF) : def
}

/**
 * The foe's blow (an imp's with no foe), the share of it the hero's defense (`armorAgainst`) lets through (`armorShare`),
 * its turn and the depth's twist, a heavy one (its turn makes it harder) at most HEAVY_BLOW_MAX of max HP, halved (rounded up)
 * for the first of a fight to land with Bulwark worn, and for the knight's braced shield: with the whole Oathbound set
 * the shield turns the first blow and halves the second, which spends the opening.
 */
/** A blow of `raw` through the hero's armor (`armorShare`), a heavy one at most HEAVY_BLOW_MAX of max HP. */
const blowAgainst = (g: Game, raw: number, pierces: boolean, isHeavy: boolean) => {
  const blow = Math.max(1, Math.round(raw * armorShare(armorAgainst(g, pierces), g.depth)))
  return isHeavy ? Math.min(blow, Math.ceil(g.maxHp * HEAVY_BLOW_MAX)) : blow
}

const foeBlow = (g: Game, turn: ReturnType<typeof foeTurn> | undefined) => {
  const lust = modHere(g) === 'bloodlust' ? BLOODLUST : 1
  const raw = Math.round((g.foe?.atk ?? g.depth) * (turn?.times ?? 1) * lust)
  const heavy = blowAgainst(g, raw, turn?.pierces === true, (turn?.times ?? 1) > 1)
  const isBulwark = g.foe !== null && g.foe.landed === undefined && wornTrigger(g, 'bulwark')
  const isBraced = g.cls === 'knight' && g.foe?.braced === true && g.foe.opened === undefined
  if (isBraced && g.foe !== null) g.foe = { ...g.foe, opened: true }
  const once = isBulwark ? Math.ceil(heavy / 2) : heavy
  return { dmg: isBraced ? Math.ceil(once / 2) : once, halved: (isBulwark ? 1 : 0) + (isBraced ? 1 : 0) }
}

/** A blow landed and the hero standing (a death takes the foe away with it): the foe has landed one, and Thorns answers it. */
const landed = (g: Game, dmg: number) => {
  if (g.foe === null) return
  g.foe = { ...g.foe, landed: true }
  thorns(g, dmg)
}

/** Thorns: a foe whose blow landed takes a tenth of it back, rounded up, never the last of its HP. */
const thorns = (g: Game, dmg: number) => {
  if (g.foe === null || !wornTrigger(g, 'thorns') || g.foe.hp <= 1) return
  const back = Math.min(g.foe.hp - 1, Math.ceil(dmg / 10))
  g.foe = { ...g.foe, hp: g.foe.hp - back }
  say(g, `Thorns: ${theFoe(g.foe)} takes ${back}.`)
}

const descend = (g: Game) => {
  if (g.foe !== null) {
    say(g, `${TheFoe(g.foe)} guards the stairs.`)
    return
  }
  if (isBossDepth(g.depth) && g.bossSlain < g.depth) {
    g.foe = isBigBossDepth(g.depth) ? bigBossOf(g) : bossOf(g)
    say(g, `${TheFoe(g.foe)} (${g.foe.glyph}) rises to bar the way down!`)
    return
  }
  const fork = forkTier(g)
  // What lies underfoot goes down too, room allowing: the tile a walk down starts from is never stepped onto.
  pickUpFloor(g, true)
  const behind = g.floor?.length ?? 0
  if (behind > 0) say(g, `You leave ${behind === 1 ? 'an item' : `${behind} items`} on the floor behind you.`)
  Object.assign(g, arrive(g.world, g.depth + 1), { walked: [], fortune: null, lastSold: null })
  g.hp = Math.min(g.maxHp, g.hp + Math.ceil(g.maxHp / 4))
  if (g.depth > g.deepest) {
    g.deepest = g.depth
    g.toast = `New record: depth ${g.depth}.`
  }
  if (g.quest?.kind === 'depth') advanceQuest(g)
  say(g, `Task done. You find stairs > and descend to depth ${g.depth}.`)
  enterTier(g, fork)
  announceTwist(g)
}

const attack = (g: Game) => {
  if (g.foe === null) {
    say(g, 'You swing at the darkness.')
    return
  }
  strike(g)
  if (g.foe !== null) counter(g, 'shadow')
}

const quaff = (g: Game) => {
  const slot = healingSlot(g)
  say(g, slot < 0 ? 'Your belt holds no healing potions.' : useBelt(g, slot))
}

const summon = (g: Game, name: string) => {
  if (g.foe !== null) return
  if (g.calm > 0) {
    if (g.calm === CALM_CALLS) say(g, 'The dungeon falls quiet.')
    g.calm -= 1
    const healed = Math.min(g.maxHp - g.hp, Math.ceil(g.maxHp * CALM_HEAL))
    if (healed > 0) {
      g.hp += healed
      say(g, `You catch your breath. +${healed} HP`)
    }
    return
  }
  if (g.nemesis !== null && g.where === 'dungeon' && g.depth >= g.nemesis.depth) {
    g.foe = nemesisFoe(g, g.nemesis)
    g.toast = `Nemesis: ${nemesisTitle(g.nemesis)}!`
    say(g, `You feel watched. ${nemesisTitle(g.nemesis)} has found you!`)
    return
  }
  const band = bandOf(g.depth)
  if (g.where === 'dungeon' && g.depth === uniqueDepth(g.world, band) && !g.uniquesSlain.includes(band) && (g.uniqueWon?.[band] ?? 0) < g.level) {
    g.foe = uniqueFoe(g)
    g.toast = `${g.foe.name} is here!`
    say(g, `The ground trembles. ${g.foe.name} is here!`)
    return
  }
  const foe = spawn(g, name)
  // A peak: the pressure has built, so a champion comes, announced, and a calm follows it.
  if (g.tension >= TENSION_PEAK && g.depth >= 2 && g.hp >= g.maxHp * PEAK_HP) {
    g.foe = foe.champion !== undefined ? foe : championOf(foe, CHAMPION_MODS[roll(g, CHAMPION_MODS.length) - 1]!)
    g.tension = 0
    g.calm = CALM_CALLS
    g.toast = 'Something strong is near.'
    say(g, 'The air grows heavy. Something strong is near.')
  } else g.foe = foe
  say(g, `A ${g.foe.name} (${g.foe.glyph}) emerges from the dark!`)
}

/**
 * A tool call settles one exchange: a success hits the foe and a foe that survives hits back; a failure only takes the
 * foe's hit. Tests that pass make the blow a sure critical; other work is rewarded after (`reward`).
 */
const outcome = (g: Game, ok: boolean, what: string, work: Work | undefined) => {
  g.worked = { depth: g.depth, calls: (g.worked?.depth === g.depth ? g.worked.calls : 0) + 1 }
  if (ok) {
    if (work === 'tests') greenBuild(g)
    strike(g, work === 'tests')
    if (g.foe !== null) counter(g, what)
  } else fail(g, what)
  const regen = tickEffects(g)
  if (regen !== undefined) say(g, regen)
  if (ok) reward(g, work)
}

/** Tests that pass: the blow is sure, and the Aegis of Green Builds wards off the next hit. */
const greenBuild = (g: Game) => {
  const aegis = wornPower(g, 'greenBlock')
  if (aegis !== undefined) {
    g.effects = { ...g.effects, ward: Math.max(g.effects.ward, 1) }
    say(g, `Your ${aegis.name} hums: the next blow will be turned.`)
  }
  if (g.foe !== null) say(g, 'The tests pass: your blow is sure.')
  if (hasTalent(g, 'testDriven')) {
    g.effects = { ...g.effects, fury: g.effects.fury + 2 }
    say(g, 'Test driven: 2 blows of fury.')
  }
  if (wornTrigger(g, 'quickStudy')) {
    g.xp += g.depth
    say(g, `Quick study: +${g.depth} XP.`)
    levelUp(g)
  }
}

/**
 * A failure: the foe's hit, or an imp's with no foe. The Staff of Stack Traces strikes the foe first, and a foe it
 * slays hits no more; the Mantle of the Monorepo mends 1 HP after.
 */
const fail = (g: Game, what: string) => {
  const staff = wornPower(g, 'stackTrace')
  const deaths = g.deaths
  if (staff !== undefined && g.foe !== null) {
    say(g, `Your ${staff.name} turns the failure on ${theFoe(g.foe)}.`)
    strike(g)
    if (g.foe !== null) counter(g, what)
  } else counter(g, what)
  if (hasTalent(g, 'rubberDucking') && g.deaths === deaths) {
    g.xp += g.depth
    say(g, `Rubber ducking: +${g.depth} XP.`)
    levelUp(g)
  }
  const mantle = wornPower(g, 'failHeal')
  if (mantle === undefined || g.deaths !== deaths || g.hp >= g.maxHp) return
  g.hp += 1
  say(g, `The ${mantle.name} mends 1 HP.`)
}

/** A commit's shrine: full HP, and the depth marked to wake on, unless a guardian waits on it. */
const shrine = (g: Game) => {
  g.hp = g.maxHp
  if (hasTalent(g, 'cleanCommit')) {
    g.effects = { ...g.effects, ward: Math.max(g.effects.ward, 1) }
    say(g, 'A clean commit: the next blow will be turned.')
  }
  if (wornTrigger(g, 'freshStart')) {
    g.effects = { ...g.effects, fury: g.effects.fury + 1 }
    say(g, 'A fresh start: 1 blow of fury.')
  }
  if (isBossDepth(g.depth)) {
    say(g, 'You kneel at a shrine: your work is kept. Full HP.')
    return
  }
  g.waypoint = g.depth
  say(g, `You kneel at a shrine: your work is kept. Full HP; you will wake on depth ${g.depth}.`)
  g.toast = `Shrine: you will wake on depth ${g.depth}.`
}

/** Found by work: an item of `atLeast` or better, best of two rolls, kept as a prize is. */
const cache = (g: Game, said: string, atLeast: Rarity) => {
  say(g, said)
  const item = makeItem(g, atLeast, hasTalent(g, 'shipIt') ? 4 : 2)
  keepPrize(g, item, g, named => `Loot: ${named}.`)
  g.toast = `${RARITY_NAME[item.rarity]}! ${item.name}`
}

/** What a commit, a push and a pull request each give, once a depth. */
const REWARDS: Readonly<Record<Exclude<Work, 'tests'>, (g: Game) => void>> = {
  commit: shrine,
  push: g => cache(g, 'Your work goes out, and a cache opens.', 'rare'),
  pr: g => cache(g, 'Your pull request opens a hoard.', 'epic'),
}

/** Work's reward, once a depth for each kind: tests are their blow alone. */
const reward = (g: Game, work: Work | undefined) => {
  if (work === undefined || work === 'tests' || g.boons?.[work]?.includes(g.depth) === true) return
  g.boons = { ...g.boons, [work]: [...(g.boons?.[work] ?? []), g.depth] }
  REWARDS[work](g)
}

const ally = (g: Game) => {
  g.hp = Math.min(g.maxHp, g.hp + 3)
  say(g, 'A companion joins the fight and patches your wounds. +3 HP')
}

const move = (g: Game, dx: number, dy: number) => {
  const to = { x: g.x + dx, y: g.y + dy }
  if (g.foe !== null && same(to, g.foe)) attack(g)
  else if (isFloor(levelOf(g).tiles, to)) moveTo(g, to)
  else say(g, 'Solid rock.')
}

/**
 * Where the player clicked: a seen floor tile is walked to by the shortest path; a living foe is walked up to and
 * attacked; the hero's own tile explores. The walk stops on coming next to a living foe, as exploring does; walking away from one is free.
 */
/** The way to a clicked tile: to a foe, or to known floor, around a foe in the way where there is room, else up to it. */
const wayTo = (g: Game, level: Level, target: Pos, isFoe: boolean) => {
  const isKnown = target.x >= 0 && target.y >= 0 && g.seen[cellId(target)] === '1' && isFloor(level.tiles, target)
  const around = isKnown && !isFoe && g.foe !== null ? bfs(level.tiles, g, target, g.foe) : null
  return around ?? (isFoe || isKnown ? bfs(level.tiles, g, target) : null)
}

/** Walks the way, stopped by a foe that stands on it or steps up beside the hero, or by a fall: whether it went on to its end. */
const walkWay = (g: Game, path: readonly Pos[], isFoe: boolean) => {
  const deaths = g.deaths
  if (path.length > 1) startWalk(g)
  for (const p of path.slice(1, isFoe ? -1 : undefined)) {
    if (g.foe !== null && same(p, g.foe)) {
      say(g, `${TheFoe(g.foe)} blocks your way.`)
      return false
    }
    const wasNextToFoe = g.foe !== null && isNextTo(g, g.foe)
    moveTo(g, p)
    if (g.deaths !== deaths) return false
    if (g.foe !== null && isNextTo(g, g.foe) && !wasNextToFoe && !isFoe) {
      say(g, `${TheFoe(g.foe)} blocks your way.`)
      return false
    }
  }
  return true
}

const goTo = (g: Game, target: Pos) => {
  const level = levelOf(g)
  const isFoe = g.foe !== null && same(target, g.foe)
  const path = wayTo(g, level, target, isFoe)
  if (path === null) {
    say(g, "You can't get there.")
    return
  }
  // A click on the hero explores: a step toward the stairs. On the stairs it takes them, as walking onto them does,
  // so a hero stopped there by a foe goes down once it is gone without stepping off and back.
  if (path.length === 1) {
    if (same(g, level.stairs)) descend(g)
    else step(g, 1)
    return
  }
  if (!walkWay(g, path, isFoe)) return
  if (isFoe && g.foe !== null && isNextTo(g, g.foe)) attack(g)
  if (same(target, level.stairs) && same(g, level.stairs)) descendAfterWalk(g)
}

/**
 * An item chosen from those lying on a tile: it goes first of them, then the hero walks onto the tile (or, there
 * already, takes from it), and as on any step there, what fits goes into the bag in that order. So with room for one,
 * the one taken is the one chosen.
 */
const pick = (g: Game, at: Pos, id: number) => {
  const chosen = (g.floor ?? []).find(f => same(f, at) && f.item.id === id)
  if (chosen === undefined) {
    say(g, 'That is no longer there.')
    return
  }
  g.floor = [chosen, ...(g.floor ?? []).filter(f => f !== chosen)]
  if (same(g, at)) pickUpFloor(g)
  else goTo(g, at)
}

/** Down the stairs the hero walked to, the walk kept past the descent so it can be played on the level it was walked on. */
const descendAfterWalk = (g: Game) => {
  const walked = g.walked
  const depth = g.depth
  descend(g)
  if (g.depth !== depth) g.walked = walked
}

/**
 * An answer finished: the hero walks the way to the stairs, picking up what lies on it, and goes down. With a foe alive
 * the stairs stay guarded, as they are; a foe stepping up or a fall on the way stops the walk short of them.
 */
const walkDown = (g: Game) => {
  const level = levelOf(g)
  const path = g.foe === null && !same(g, level.stairs) ? bfs(level.tiles, g, level.stairs) : null
  if (path !== null && !walkWay(g, path, false)) return
  descendAfterWalk(g)
}

/** An answer finished: the walk down (`walkDown`) once this depth has seen DESCEND_CALLS tool calls; until then, a word why not. */
const answered = (g: Game) => {
  const calls = g.worked?.depth === g.depth ? g.worked.calls : 0
  if (calls >= DESCEND_CALLS) walkDown(g)
  else say(g, `The stairs wait: ${calls} of ${DESCEND_CALLS} tool calls on this depth.`)
}

/**
 * Whether an action's walk is only a walk: its end is the same game as walking its tiles, so it can be cut anywhere.
 * One that ends in more (a blow, a visit, the stairs, a word from someone) is not.
 */
export const isOnlyAWalk = (g: Game, plan: Game) => {
  const walked = apply(g, { kind: 'trail', path: plan.walked })
  const keys = ['x', 'y', 'where', 'depth', 'hp', 'xp', 'gold', 'panel', 'foe', 'taken', 'belt', 'bag', 'gear', 'effects', 'quest'] as const
  return keys.every(k => JSON.stringify(walked[k]) === JSON.stringify(plan[k]))
}

/** The hero walks exactly these tiles, taking up what lies on them, as far as he lives. */
const trail = (g: Game, path: readonly Pos[]) => {
  const deaths = g.deaths
  if (path.length > 0) startWalk(g)
  for (const p of path) {
    moveTo(g, p)
    if (g.deaths !== deaths) return
  }
}

/** Going down by hand: from the stairs only; a living foe still guards them. */
const takeStairs = (g: Game) => {
  if (!same(g, levelOf(g).stairs)) say(g, 'Find the stairs > first.')
  else descend(g)
}

const train = (g: Game, stat: Attribute) => {
  if (g.points === 0) {
    say(g, 'No stat points to spend. Level up first.')
    return
  }
  g.points -= 1
  g.stats = { ...g.stats, [stat]: g.stats[stat] + 1 }
  if (stat === 'vigor') {
    g.maxHp += VIGOR_HP
    g.hp += VIGOR_HP
  }
  say(g, `You train ${stat}: now ${g.stats[stat]}.`)
}

const HANDLERS: { [K in Action['kind']]: (g: Game, a: Extract<Action, { kind: K }>) => void } = {
  explore: (g, a) => step(g, a.steps),
  summon: (g, a) => summon(g, a.name),
  ally: g => ally(g),
  outcome: (g, a) => outcome(g, a.ok, a.what, a.work),
  quest: (g, a) => {
    const quest = questOf(a.text)
    if (quest !== undefined) say(g, `A new quest: "${quest}"`)
  },
  descend: g => walkDown(g),
  answer: g => answered(g),
  attack: g => attack(g),
  potion: g => quaff(g),
  walk: g => step(g, 1),
  move: (g, a) => move(g, a.dx, a.dy),
  goto: (g, a) => goTo(g, { x: a.x, y: a.y }),
  pick: (g, a) => pick(g, { x: a.x, y: a.y }, a.id),
  trail: (g, a) => trail(g, a.path),
  stairs: g => takeStairs(g),
  restart: () => undefined,
  use: (g, a) => say(g, useBelt(g, a.slot, a.tier)),
  choose: (g, a) => {
    const said = chooseTier(g, a.slot, a.tier)
    if (said !== undefined) say(g, said)
  },
  junk: g => say(g, toggleJunk(g)),
  lock: g => say(g, toggleLock(g)),
  sellJunk: g => say(g, sellJunk(g)),
  arrange: g => say(g, arrange(g)),
  panel: (g, a) => {
    // Whatever replaces the recap, what it told is told.
    if (g.panel === 'recap') delete g.recap
    g.panel = g.panel === a.panel ? 'none' : a.panel
  },
  look: g => look(g),
  retire: (g, a) => say(g, whyNotRetire(g, a.slot) ?? ''),
  talent: (g, a) => learn(g, a.talent),
  mark: (g, a) => chooseMark(g, a.mark),
  greet: g => greet(g),
  order: (g, a) => order(g, a.order),
  cycle: g => cycle(g),
  place: (g, a) => {
    const said = place(g, a.id, a.x, a.y)
    if (said !== undefined) say(g, said)
  },
  destroy: g => {
    const said = destroy(g)
    if (said !== undefined) say(g, said)
  },
  portal: g => openPortal(g),
  buy: g => say(g, 'The merchant is in town.'),
  reforge: g => say(g, 'The smith is in town.'),
  keepOld: g => say(g, 'The smith is in town.'),
  temper: g => say(g, 'The smith is in town.'),
  store: g => say(g, 'Your stash is in town.'),
  buyTab: g => say(g, 'Your stash is in town.'),
  fortune: g => say(g, 'The mystic is in town.'),
  gamble: g => say(g, 'The villager is in town.'),
  tradeIn: g => say(g, 'The guard is in town.'),
  claim: g => say(g, 'The elder is in town.'),
  pet: g => say(g, 'The dog is in town.'),
  retrieve: g => say(g, 'Your stash is in town.'),
  moveStashed: g => say(g, 'Your stash is in town.'),
  select: (g, a) => {
    if (g.bag.some(item => item.id === a.id)) g.cursor = a.id
  },
  deselect: g => {
    g.cursor = null
  },
  equip: g => say(g, equip(g)),
  unequip: (g, a) => say(g, unequip(g, a.slot)),
  sell: g => say(g, sell(g)),
  buyBack: g => say(g, buyBack(g)),
  train: (g, a) => train(g, a.stat),
  zoom: g => {
    g.zoom = g.zoom === 3 ? 1 : g.zoom === 1 ? 2 : 3
  },
}

/** The portal from the dungeon: only with no foe alive on the level; it remembers the tile it was opened on. */
const openPortal = (g: Game) => {
  if (g.foe !== null) {
    say(g, `The portal will not open while ${theFoe(g.foe)} lives.`)
    return
  }
  g.portal = { x: g.x, y: g.y }
  Object.assign(g, { where: 'town', ...TOWN_ARRIVAL, lastSold: null })
  say(g, 'You step through the portal into town.')
}

/** Back through the portal to the tile it was opened on. */
const leaveTown = (g: Game) => {
  // The merchant and the smith stay in town.
  if (TOWN_PANELS.has(g.panel)) g.panel = 'none'
  Object.assign(g, { where: 'dungeon', ...(g.portal ?? levelOf(g).start), portal: null, mended: 0, lastSold: null, reforgedFrom: null })
  delete g.idle
  say(g, 'You step back through the portal.')
  // Back on the tile, as a step onto it: a cache earned in town lies here.
  pickUpFloor(g)
}

const walkTown = (g: Game, path: readonly Pos[]) => {
  for (const p of path.slice(1)) {
    g.x = p.x
    g.y = p.y
    g.walked = [...g.walked, { x: p.x, y: p.y }]
  }
}

/** Foes a slay quest asks for. */
export const QUEST_SLAY = 8
/** How much deeper than the hero's deepest a descend quest sends them. */
export const QUEST_DESCEND = 3

/** One step of the quest in hand, when on its depth or deeper; the last one says so. */
const advanceQuest = (g: Game) => {
  const q = g.quest
  if (q === null || q.have >= q.need || g.depth < q.depth) return
  g.quest = { ...q, have: q.have + 1 }
  if (q.have + 1 === q.need) {
    say(g, 'Quest done: go back to the elder in town.')
    g.toast = 'Quest done: go back to the elder.'
  }
}

/** The longest a prompt is quoted as a quest. */
const QUEST_LEN = 48
/** What the host puts in a prompt in place of an attachment: `[Image #16]`, `[Pasted text #2 +40 lines]`. */
const PLACEHOLDER = /\[(?:Image|Pasted text) #\d+[^\]]*\]/g

/** A prompt as its quest: the words alone, on one line, cut at a word past QUEST_LEN; none when no words are left. */
export const questOf = (text: string): string | undefined => {
  const words = text.replace(PLACEHOLDER, ' ').replace(/\s+/g, ' ').trim()
  if (words === '') return undefined
  if (words.length <= QUEST_LEN) return words
  const cut = words.lastIndexOf(' ', QUEST_LEN)
  return `${words.slice(0, cut > 0 ? cut : QUEST_LEN)}...`
}

/** A new quest for the hero's deepest depth: slay 8 there or deeper, slay a champion there or deeper, or go 3 deeper. */
const newQuest = (g: Game): Quest => {
  const kind = (['slay', 'champion', 'depth'] as const)[roll(g, 3) - 1]!
  if (kind === 'slay') return { kind, depth: g.deepest, need: QUEST_SLAY, have: 0 }
  if (kind === 'champion') return { kind, depth: Math.max(2, g.deepest), need: 1, have: 0 }
  return { kind, depth: g.deepest + QUEST_DESCEND, need: 1, have: 0 }
}

/** What a quest pays in gold, besides its item: 15 a depth of it and 30. */
export const questReward = (q: Pick<Quest, 'depth'>) => 15 * q.depth + 30

/** A quest in a line, for the elder's window: what it asks and how far along it is. */
export const questLine = (q: Quest) =>
  q.kind === 'slay' ? `Slay ${q.need} foes on depth ${q.depth} or deeper: ${q.have} of ${q.need}.`
  : q.kind === 'champion' ? `Slay a champion on depth ${q.depth} or deeper: ${q.have === 1 ? 'done' : 'not yet'}.`
  : `Reach depth ${q.depth}: ${q.have === 1 ? 'done' : 'not yet'}.`

export const ASK: Readonly<Record<Quest['kind'], (q: Quest) => string>> = {
  slay: q => `Slay ${q.need} foes on depth ${q.depth} or deeper, and come back to me.`,
  champion: q => `Slay a champion on depth ${q.depth} or deeper, and come back to me.`,
  depth: q => `Reach depth ${q.depth}, and come back to me.`,
}
export const STANDING: Readonly<Record<Quest['kind'], (q: Quest) => string>> = {
  slay: q => `${q.have} of ${q.need} slain on depth ${q.depth} or deeper. Keep at it.`,
  champion: q => `No champion slain on depth ${q.depth} or deeper yet.`,
  depth: q => `Depth ${q.depth} is still ahead of you.`,
}

/** The elder: a quest to take, how the one in hand stands, or the pay for one done (gold and an item, bag room allowing). */
const elder = (g: Game) => {
  const q = g.quest
  if (q === null) {
    g.quest = newQuest(g)
    say(g, `The elder: "${ASK[g.quest.kind](g.quest)}"`)
  } else if (q.have < q.need) say(g, `The elder: "${STANDING[q.kind](q)}"`)
  else {
    // A refusal leaves the game as it was: the roll, the item's id and the bad-luck counts too.
    const before = { ...g }
    const item = makeItem(g, 'uncommon')
    if (!stash(g, item)) {
      Object.assign(g, before)
      say(g, 'The elder: "Make room in your bag for your reward."')
      return
    }
    const coins = questReward(q)
    g.gold += coins
    g.quest = null
    g.questsDone += 1
    say(g, `The elder pays you ${countText(coins)} gold and a ${item.name} for your trouble.`)
  }
}

/** The mystic's price: 20 gold and 10 for each depth reached. */
export const fortuneCost = (g: Pick<Game, 'deepest'>) => 20 + 10 * g.deepest

export const FORTUNE_SAID: Readonly<Record<Fortune['kind'], string>> = {
  luck: 'Luck. Critical hits come easier',
  riches: 'Riches. Foes leave more gold',
  insight: 'Insight. Each kill teaches more',
}

/** The windows that belong to town, closed on leaving it. */
const TOWN_PANELS: ReadonlySet<Panel> = new Set<Panel>(['shop', 'forge', 'stash', 'healer', 'elder', 'mystic', 'guard', 'villager', 'dog'])

/** The mystic: a fortune for the gold, good until the hero changes depth; one at a time. */
const mystic = (g: Game) => {
  const cost = fortuneCost(g)
  if (g.fortune !== null) say(g, 'The mystic: "Your fortune holds until you change depth."')
  else if (g.gold < cost) say(g, `The mystic: "A fortune costs ${countText(cost)} gold."`)
  else {
    const kind = (['luck', 'riches', 'insight'] as const)[roll(g, 3) - 1]!
    g.gold -= cost
    g.fortune = { kind, depth: g.depth }
    say(g, `The mystic reads your fortune for ${countText(cost)} gold: ${FORTUNE_SAID[kind]} until you change depth.`)
  }
}

/** The villager's sealed pack: its price, by the deepest depth reached; from about what its item fetches on depth 1 to three times that by depth 60. */
export const gambleCost = (g: Pick<Game, 'deepest'>) => 50 + 12 * g.deepest

/** Buys the villager's sealed pack: an item of Uncommon or better, rolled as a drop is, into the bag; with no room for
 * it nothing is paid, said. */
const gamble = (g: Game) => {
  const cost = gambleCost(g)
  if (g.gold < cost) {
    say(g, `The villager: "A sealed pack is ${countText(cost)} gold. No peeking."`)
    return
  }
  // A refusal leaves the game as it was: the roll, the item's id and the bad-luck counts too.
  const before = { ...g }
  const item = makeItem(g, 'uncommon')
  if (!stash(g, item)) {
    Object.assign(g, before)
    say(g, 'The villager: "Make room in your bag first."')
    return
  }
  g.gold -= cost
  announce(g, item)
  say(g, `You pay the villager ${countText(cost)} gold and open the pack: ${item.name} (${RARITY_NAME[item.rarity]}).`)
}

/** The tiers the guard takes three of for one of the next, lowest first. */
const TRADED: readonly Rarity[] = ['common', 'uncommon', 'rare']

/** The three bag pieces the guard would take: of the lowest tier with three to spare (not locked), those marked junk
 * first, then the cheapest; none when no tier has three. */
export const tradeInOf = (g: Pick<Game, 'bag'>): Item[] => {
  for (const tier of TRADED) {
    const spare = g.bag.filter(i => i.rarity === tier && i.locked !== true)
    if (spare.length >= 3) return [...spare].sort((a, b) => Number(b.junk === true) - Number(a.junk === true) || priceOf(a) - priceOf(b)).slice(0, 3)
  }
  return []
}

/** The guard's trade: three spare pieces of a tier for one of the next tier or better from the armory, into the bag;
 * with no room for it there, the three are given back. */
const tradeIn = (g: Game) => {
  const three = tradeInOf(g)
  if (three.length === 0) {
    say(g, 'The guard: "Bring me three spare pieces of a kind, and the armory has better."')
    return
  }
  const tier = three[0]!.rarity
  // A refusal leaves the game as it was: the three where they lay, the roll, the item's id, the bad-luck counts.
  const before = { ...g }
  for (const i of three) take(g, i.id)
  const item = makeItem(g, RARITY_RANK[RARITY_RANK.indexOf(tier) + 1]!)
  if (!stash(g, item)) {
    Object.assign(g, before)
    say(g, 'The guard: "No room in your bag for what I would give you."')
    return
  }
  announce(g, item)
  say(g, `The guard takes your ${three.map(i => i.name).join(', ')} and hands you ${item.name} (${RARITY_NAME[item.rarity]}).`)
}


/** Moves the selected bag item into the stash (`whereToStore`), room allowing; said with the tab when not `preferred`. */
const store = (g: Game, preferred = 0, at?: Pos) => {
  const item = selected(g)
  if (item !== undefined && at !== undefined) return storeAt(g, item, preferred, at)
  const tab = item === undefined ? undefined : whereToStore(g, item, preferred)
  if (item === undefined) say(g, 'Select an item in your bag to store.')
  else if (tab === undefined) say(g, 'Your stash is full.')
  else {
    take(g, item.id)
    putIn(g, item, tab)
    say(g, `You store the ${item.name} in your stash${tab === preferred ? '' : `, on ${tabName(tab)}`}.`)
  }
}

/** A bag item dropped on plain tab `tab` at cells `at`: there when it fits, else it stays in the bag, said. */
const storeAt = (g: Game, item: Item, tab: number, at: Pos) => {
  const held = g.stashed[tab]
  if (held === undefined || !fitsAt(held, item.w, item.h, at.x, at.y)) return say(g, "It doesn't fit there.")
  take(g, item.id)
  putIn(g, item, tab, at)
  say(g, `You store the ${item.name} in your stash.`)
}

/** A stashed item moved on its plain tab to cells `x`, `y`, when it fits there. */
const moveStashed = (g: Game, id: number, x: number, y: number) => {
  const tab = g.stashed.findIndex(t => t.some(i => i.id === id))
  const item = g.stashed[tab]?.find(i => i.id === id)
  if (item === undefined) return
  if (!fitsAt(g.stashed[tab]!, item.w, item.h, x, y, id)) return say(g, "It doesn't fit there.")
  g.stashed = g.stashed.map((t, i) => (i === tab ? t.map(s => (s.id === id ? { ...s, x, y } : s)) : t))
}

/** Moves a stashed item back into the bag: where it fits, or at cells `at` it is dropped on, when it fits there. */
const retrieve = (g: Game, id: number, at?: Pos) => {
  const item = stashedItems(g).find(i => i.id === id)
  if (item === undefined) return
  if (at !== undefined && !fitsAt(g.bag, item.w, item.h, at.x, at.y)) say(g, "It doesn't fit there.")
  else if (at !== undefined) {
    takeOut(g, id)
    g.bag = [...g.bag, { ...item, ...at }]
    g.cursor ??= item.id
    say(g, `You take the ${item.name} from your stash.`)
  } else if (!stash(g, item)) say(g, `No room in your bag for the ${item.name}.`)
  else {
    takeOut(g, id)
    say(g, `You take the ${item.name} from your stash.`)
  }
}

/** Buys a tab of the stash, `whyNotBuy` allowing; said either way. */
const buyTab = (g: Game, tab: StashTab) => {
  const why = whyNotBuy(g, tab)
  if (why !== undefined) {
    say(g, why === 'bought' ? `You have ${tabName(tab)} already.` : g.gold < tabPrice(tab) && why.endsWith(' gold') ? `${capitalized(tabName(tab))} costs ${countText(tabPrice(tab))} gold.` : `${capitalized(why)}.`)
    return
  }
  g.gold -= tabPrice(tab)
  if (tab === 'sets') g.stashSets = []
  else if (tab === 'legends') g.stashLegends = []
  else g.stashed = [...g.stashed, []]
  say(g, `You buy ${tabName(tab)} of your stash for ${countText(tabPrice(tab))} gold.`)
}


/** What the merchant sells and asks for it on the first depths, in shelf order. */
export const SHOP_PRICES = { health1: 25, health2: 50, health3: 80, regen1: 45, fury1: 50, ward1: 50, ward2: 75, smoke1: 35, smoke3: 60 } as const satisfies Partial<Record<Ware, number>>
const PRICES: Readonly<Partial<Record<Ware, number>>> = SHOP_PRICES
/** A ware's price: its shelf price once more for every ten depths reached, a fifth less for a Haggler; one the
 * merchant does not sell has none. */
export const priceOfWare = (ware: Ware, g?: Pick<Game, 'talents' | 'deepest'>) => {
  const price = (PRICES[ware] ?? Infinity) * (1 + Math.floor((g?.deepest ?? 1) / 10))
  return g !== undefined && hasTalent(g, 'haggler') ? Math.ceil(price * 0.8) : price
}

const buy = (g: Game, ware: Ware) => {
  const { kind, tier } = wareOf(ware)
  const name = nameOf(kind, tier)
  const price = priceOfWare(ware, g)
  if (price === Infinity) say(g, `The merchant has no ${name} to sell.`)
  else if (g.gold < price) say(g, `Not enough gold: a ${name} costs ${price}.`)
  else if (!addToBelt(g, kind, tier)) say(g, `Your belt has no room for a ${name}.`)
  else {
    g.gold -= price
    say(g, `You buy a ${name} for ${countText(price)} gold.`)
  }
}

/** The smith's price: 40 gold, 40 more for every reforge done before, and 10 for each depth reached. */
export const reforgeCost = (g: Pick<Game, 'reforges' | 'depth'>) => 40 + 40 * g.reforges + 10 * g.depth

const reforge = (g: Game, slot: Slot) => {
  const item = g.gear[slot]
  if (item === undefined) say(g, 'Nothing worn there to reforge.')
  else if (item.rarity === 'common') say(g, 'The smith has nothing to reforge on a Common item.')
  else if (item.rarity === 'legendary') say(g, 'A Legendary is as it was made: the smith will not touch it.')
  else if (g.gold < reforgeCost(g)) say(g, `Not enough gold: reforging costs ${reforgeCost(g)}.`)
  else {
    const cost = reforgeCost(g)
    const made = reforgeItem(g, item)
    g.gold -= cost
    g.reforges += 1
    g.gear = { ...g.gear, [slot]: made }
    g.reforgedFrom = { slot, item }
    say(g, `The smith reforges your ${item.name} into ${made.name} for ${countText(cost)} gold.`)
  }
}

/** The piece reforged last, if it is still worn as the smith left it: what it was, to keep instead. */
export const keptChoice = (g: Game) => {
  const from = g.reforgedFrom
  return from !== null && g.gear[from.slot]?.id === from.item.id ? from : undefined
}

/** The reforge undone: the piece as it was, worn again; the gold stays paid. */
const keepOld = (g: Game) => {
  const from = keptChoice(g)
  if (from === undefined) {
    say(g, 'There is no reforge to take back.')
    return
  }
  const made = g.gear[from.slot]!
  g.gear = { ...g.gear, [from.slot]: from.item }
  g.reforgedFrom = null
  say(g, `You keep your ${from.item.name} as it was, and the smith melts down the ${made.name}.`)
}

const temper = (g: Game, slot: Slot) => {
  const item = g.gear[slot]
  if (item === undefined) say(g, 'Nothing worn there to temper.')
  else if ((item.temper ?? 0) >= TEMPER_MAX) say(g, `Your ${item.name} is tempered as far as it will go.`)
  else if (g.gold < temperCost(item, g.deepest)) say(g, `Not enough gold: tempering costs ${temperCost(item, g.deepest)}.`)
  else {
    const cost = temperCost(item, g.deepest)
    g.gold -= cost
    g.gear = { ...g.gear, [slot]: temperItem(item) }
    g.reforgedFrom = null
    say(g, `The smith tempers your ${item.name}: +1 ${temperStat(item) === 'atk' ? 'attack' : 'defense'}, for ${countText(cost)} gold.`)
  }
}

/** Whoever stands at a spot, once the hero is next to them. */
const visit = (g: Game, spot: TownSpot) => {
  if (spot === 'portal') leaveTown(g)
  else if (spot === 'healer') {
    const isHurt = g.hp < g.maxHp
    g.mended = g.maxHp - Math.max(0, g.hp)
    g.hp = g.maxHp
    g.panel = 'healer'
    say(g, isHurt ? 'The healer tends your wounds. HP full.' : 'The healer finds nothing to mend.')
  } else if (spot === 'merchant') {
    g.panel = 'shop'
    say(g, 'The merchant lays out potions and scrolls.')
  } else if (spot === 'smith') {
    g.panel = 'forge'
    say(g, 'The smith looks over what you wear.')
  } else if (spot === 'elder') {
    g.panel = 'elder'
    elder(g)
  } else if (spot === 'mystic') {
    g.panel = 'mystic'
    say(g, g.fortune !== null ? 'The mystic: "Your fortune holds until you change depth."' : `The mystic gazes into the crystal. "A fortune costs ${countText(fortuneCost(g))} gold."`)
  } else if (spot === 'stash') {
    g.panel = 'stash'
    say(g, `Your stash holds ${countText(stashedItems(g).length)} ${stashedItems(g).length === 1 ? 'item' : 'items'}.`)
  } else {
    g.panel = spot
    say(g, TOWN_TALK[spot])
  }
}

/** A click in town: open ground is walked to; a townsfolk, the stash or the portal is walked up to and visited. */
const townGoTo = (g: Game, target: Pos) => {
  const spot = townSpotAt(target)
  const path = spot !== undefined ? pathBeside(g, TOWN_SPOTS[spot]) : townPath(g, target)
  if (path === null) say(g, "You can't get there.")
  else if (spot === undefined && path.length === 1) say(g, 'You are already there.')
  else {
    walkTown(g, path)
    if (spot !== undefined) visit(g, spot)
  }
}

const townMove = (g: Game, dx: number, dy: number) => {
  const to = { x: g.x + dx, y: g.y + dy }
  const spot = townSpotAt(to)
  if (spot !== undefined) visit(g, spot)
  else if (isTownWalkable(to)) walkTown(g, [g, to])
  else say(g, 'A wall.')
}

/**
 * A tool call in town: a rest. With no window open the call counts, and the TOWN_IDLE_CALLS-th in a row takes the
 * hero back through the portal; with one open, the player is busy in town and the count starts over.
 */
const rest = (g: Game) => {
  const idle = g.panel === 'none' ? (g.idle ?? 0) + 1 : 0
  if (idle < TOWN_IDLE_CALLS) {
    g.idle = idle
    say(g, 'You rest in town.')
    return
  }
  leaveTown(g)
  g.toast = 'Back to the dungeon: the work goes on.'
}
const NO_STAIRS = 'The stairs are in the dungeon: take the portal back (t).'

/** What happens differently in town: no foes, no stairs; the rest of the rules are the dungeon's. */
const TOWN: { [K in Action['kind']]?: (g: Game, a: Extract<Action, { kind: K }>) => void } = {
  explore: rest,
  summon: rest,
  ally: rest,
  outcome: (g, a) => {
    if (a.ok) reward(g, a.work)
  },
  attack: g => say(g, 'No foes here.'),
  walk: g => say(g, NO_STAIRS),
  stairs: g => say(g, NO_STAIRS),
  move: (g, a) => townMove(g, a.dx, a.dy),
  goto: (g, a) => townGoTo(g, { x: a.x, y: a.y }),
  trail: (g, a) => walkTown(g, [{ x: g.x, y: g.y }, ...a.path]),
  portal: g => leaveTown(g),
  buy: (g, a) => buy(g, a.ware),
  reforge: (g, a) => reforge(g, a.slot),
  keepOld: g => keepOld(g),
  temper: (g, a) => temper(g, a.slot),
  store: (g, a) => store(g, a.tab, a.at),
  buyTab: (g, a) => buyTab(g, a.tab),
  fortune: g => mystic(g),
  gamble: g => gamble(g),
  tradeIn: g => tradeIn(g),
  claim: g => elder(g),
  pet: g => {
    g.petted += 1
    say(g, 'The dog wags its tail and leans into your hand.')
  },
  retrieve: (g, a) => retrieve(g, a.id, a.at),
  moveStashed: (g, a) => moveStashed(g, a.id, a.x, a.y),
  // A task done in town leaves the hero there, mid-visit: the portal is the way back.
  descend: () => {},
  answer: () => {},
}

/**
 * The codex of a save kept before there was one: the uniques and big bosses its hero slew (every big boss depth up to
 * the deepest boss slain, as each guards the way down), the Legendaries they own, how deep and high they came and
 * their falls. Kills and gold were never counted.
 */
export const firstCodex = (g: Game): Codex => {
  const bigDepths = Array.from({ length: Math.floor(g.bossSlain / BIG_EVERY) }, (_, i) => (i + 1) * BIG_EVERY)
  return {
    ...EMPTY_CODEX,
    uniques: [...new Set(g.uniquesSlain.map(band => UNIQUES[themeOf(band * THEME_DEPTHS + 1)].key))],
    bigs: [...new Set(bigDepths.map(d => BIG_BOSSES[themeOf(d)].key))],
    legendaries: legendariesOwned(g),
    deepest: g.deepest,
    level: g.level,
    bosses: Math.floor(g.bossSlain / BOSS_EVERY),
    deaths: g.deaths,
  }
}

/** What a set of the codex pays the moment it is made whole, once a save: every unique an Epic or better, every big boss a Legendary. */
const CODEX_SETS: readonly { count: (c: Codex) => number; of: number; prize: Rarity; said: string }[] = [
  { count: c => c.uniques.length, of: Object.keys(UNIQUES).length, prize: 'epic', said: 'Every unique is slain' },
  { count: c => c.bigs.length, of: Object.keys(BIG_BOSSES).length, prize: 'legendary', said: 'Every big boss is slain' },
]

/** Pays for each set `now` makes whole that `was` had not: whether any was paid. */
const paySets = (g: Game, was: Codex, now: Codex) => {
  const made = CODEX_SETS.filter(s => s.count(was) < s.of && s.count(now) >= s.of)
  for (const s of made) {
    const item = makeItem(g, s.prize, 2)
    keepPrize(g, item, g, named => `${s.said}. The codex pays: ${named}.`)
    g.toast = `${s.said}!`
  }
  return made.length > 0
}

/** The codex after `before` became `g`, with what a set made whole paid into the bag first, so a Legendary paid is found. */
const record = (before: Game, g: Game) => {
  const was = before.codex ?? firstCodex(before)
  const now = recorded(was, before, g)
  return paySets(g, was, now) ? recorded(was, before, g) : now
}

/** A talent picked: only one offered, while one is owed. */
const learn = (g: Game, t: Talent) => {
  if (!offer(g).includes(t)) {
    say(g, owed(g) === 0 ? `No talent to choose until level ${TALENT_EVERY * ((g.talents?.length ?? 0) + 1)}.` : `${TALENTS[t].name} is not on offer.`)
    return
  }
  g.talents = [...(g.talents ?? []), t]
  say(g, `You learn ${TALENTS[t].name}: ${TALENTS[t].does}`)
  // The last owed taken, the window it was taken in closes; with more owed, it offers the next three.
  if (g.panel === 'talent' && owed(g) === 0) g.panel = 'none'
}

/** A boss slain that opens a fork (a big boss from depth 50 on: no other leaves the hero short of a tier): the next tier's choice said. */
const announceFork = (g: Game) => {
  const tier = forkTier(g)
  if (tier !== undefined) say(g, forkSaid(g, tier))
}

/** What a fork says: the tier and its two marks, and where to choose. */
const forkSaid = (g: Game, tier: number) => {
  const [easy, hard] = pairOf(g.world, tier).map(m => MARKS[m].name)
  return `The Abyss forks: ${circleSaid(tier)}, takes the blessing ${easy} or the curse ${hard}. Choose in the Abyss.`
}

/**
 * A session begun: the talents owed and the fork open, said, since a hero who earned them before they existed, or
 * while no one watched, has heard of neither.
 */
const greet = (g: Game) => {
  const talents = owed(g)
  if (talents === 1) say(g, 'A talent to choose: open the character sheet.')
  else if (talents > 1) say(g, `${talents} talents to choose: open the character sheet.`)
  const tier = forkTier(g)
  if (tier !== undefined && isForkOpen(g)) say(g, forkSaid(g, tier))
}

/** Into a tier's first depth from the fork before it: the mark taken (the easier, if none was chosen), and said. */
const enterTier = (g: Game, fork: number | undefined) => {
  if (fork === undefined || g.depth !== tierStart(fork)) return
  if (g.marks?.[fork] === undefined) {
    g.marks = { ...g.marks, [fork]: pairOf(g.world, fork)[0] }
    say(g, `Unchosen, ${circleSaid(fork)}, takes the blessing.`)
  }
  const mark = MARKS[markOf(g, fork)]
  say(g, `${capitalized(circleSaid(fork))}: ${mark.name}, a ${fateOf(markOf(g, fork))}. ${mark.does}`)
}

/** One of the next tier's two marks chosen, while its fork is open; a choice made may be changed until the stairs. */
const chooseMark = (g: Game, mark: Mark) => {
  const tier = forkTier(g)
  if (tier === undefined) {
    say(g, 'The Abyss has no fork to choose now.')
    return
  }
  if (!pairOf(g.world, tier).includes(mark)) {
    say(g, `${MARKS[mark].name} is not on offer for circle ${roman(tier)}.`)
    return
  }
  g.marks = { ...g.marks, [tier]: mark }
  say(g, `Tier ${roman(tier)} will be ${MARKS[mark].name}: ${MARKS[mark].does}`)
}

/** Whether the hero may retire: once a big boss is slain. */
export const canRetire = (g: Pick<Game, 'bossSlain'>) => g.bossSlain >= BIG_EVERY

/** Why the hero cannot retire passing down what they wear in `slot`, or undefined when they can. */
export const whyNotRetire = (g: Game, slot: Slot) => {
  if (!canRetire(g)) return 'A hero retires once they have slain a big boss.'
  return g.gear[slot] === undefined ? 'Choose a piece you wear to pass down.' : undefined
}

/** The town's stash of `game`, its tabs and what they hold, as a new game keeps it. */
const townStash = (game: Game): Pick<Game, 'stashed' | 'stashSets' | 'stashLegends'> => ({ stashed: game.stashed, stashSets: game.stashSets, stashLegends: game.stashLegends })

/** The hero retired: counted in the codex, the piece in `slot` the heirloom, the stash kept, and a new hero to choose on the start screen. */
const retiredFrom = (g: Game, slot: Slot): Game => {
  const codex = g.codex ?? firstCodex(g)
  const legacy = Math.floor(g.gold / 2)
  return { ...newGame(g.seed, g.cls), ...townStash(g), ...keptOrders(g), codex: { ...codex, retired: (codex.retired ?? 0) + 1 }, heirloom: heirloomOf(g.gear[slot]!), panel: 'start', ...(legacy > 0 ? { legacy } : {}) }
}

/** The standing orders, the player's and not the hero's: kept from hero to hero. */
const keptOrders = (g: Pick<Game, 'orders'>): Pick<Game, 'orders'> => (g.orders === undefined ? {} : { orders: g.orders })

/**
 * The stash's items for the new game `g`: given ids from its next on, the old hero's ids not being the new one's, and
 * each as an heirloom is (`heirloomOf`), its base's plain stats, its lock and junk mark kept. A stash kept at its
 * depth's stats let a level-1 hero start with 51 to 111 attack.
 */
const restash = (g: Game, kept: Pick<Game, 'stashed' | 'stashSets' | 'stashLegends'>) => {
  const fresh = (items: readonly Item[]) =>
    items.map(item => {
      g.nextId += 1
      return { ...heirloomOf(item), id: g.nextId - 1, ...(item.locked === true ? { locked: true as const } : {}), ...(item.junk === true ? { junk: true } : {}) }
    })
  g.stashed = kept.stashed.map(fresh)
  if (kept.stashSets !== undefined) g.stashSets = fresh(kept.stashSets)
  if (kept.stashLegends !== undefined) g.stashLegends = fresh(kept.stashLegends)
}

/** A new hero for the save of `game`: its codex, stash and heirloom kept, the heirloom worn when the class can, else in the bag. */
const newHero = (game: Game, cls: HeroClass): Game => {
  const g: Game = { ...newGame(game.seed, cls), ...keptOrders(game), codex: game.codex ?? firstCodex(normalize(game)) }
  restash(g, normalize(game))
  if (game.legacy !== undefined) {
    Object.assign(g, { gold: game.legacy, banked: game.legacy })
    say(g, `Your predecessor left you ${game.legacy} gold, safe in town.`)
  }
  if (game.heirloom === undefined) return g
  const item = { ...game.heirloom, id: g.nextId }
  g.heirloom = game.heirloom
  g.nextId += 1
  stash(g, item)
  if (!canWear(g, item)) {
    say(g, `Your heirloom, the ${item.name}, waits in your bag.`)
    return g
  }
  g.cursor = item.id
  equip(g)
  g.cursor = null
  g.hp = g.maxHp
  say(g, `You set out in your heirloom, the ${item.name}.`)
  return g
}

/** Pure: the game after `action`, never mutating `game`. */
/** What the start screen lets through: the dungeon waits behind it, whatever the tool calls do. */
const ON_THE_START_SCREEN: ReadonlySet<Action['kind']> = new Set<Action['kind']>(['restart', 'panel', 'zoom'])

/** What tool calls do, counted for the recap; the player's own clicks and keys are not. */
const TOOL_DRIVEN: ReadonlySet<Action['kind']> = new Set<Action['kind']>(['explore', 'summon', 'ally', 'outcome', 'descend', 'answer'])

/**
 * A talent newly earned opens the talent window on its own, once nothing else is open and no foe is alive: once for
 * each talent earned, so Later leaves it closed until the next.
 */
const offerTalent = (g: Game) => {
  const now = earned(g)
  if (g.panel !== 'none' || g.foe !== null || owed(g) === 0 || now <= (g.talentOffered ?? 0)) return
  g.panel = 'talent'
  g.talentOffered = now
}

/** The player's own steps: by hand, each walk may meet a foe, as a tool call would summon one. */
const HAND_STEPS: ReadonlySet<Action['kind']> = new Set<Action['kind']>(['move', 'goto', 'walk'])

/** A walk by hand in the dungeon with no foe about: a foe met, HAND_FOE_TILE percent a tile walked, at most HAND_FOE_MAX, hitting HAND_FOE_ATK times its kind. */
const handFoe = (g: Game) => {
  if (!isByHand(g) || g.where !== 'dungeon' || g.foe !== null || g.hp <= 0 || g.walked.length === 0) return
  if (roll(g, 100) > Math.min(HAND_FOE_MAX, HAND_FOE_TILE * g.walked.length)) return
  summon(g, 'the depths')
  // Read past the guard above: summon may have set it.
  const met = g.foe as Foe | null
  if (met !== null) g.foe = { ...met, atk: met.atk * HAND_FOE_ATK }
}

/** In town all the gold carried is banked; elsewhere what is spent comes off the banked first, and what is earned is
 * not. Written only when it changes, so an action that changes nothing leaves the game as it was. */
const bank = (before: Game, g: Game) => {
  const banked = g.where === 'town' ? g.gold : Math.min(g.banked ?? 0, g.gold)
  const isNew = g.where === 'town' ? before.where !== 'town' || g.gold !== before.gold : banked < (g.banked ?? 0)
  if (isNew) g.banked = banked
}

export const apply = (game: Game, action: Action): Game => {
  // A new hero keeps the codex and the heirloom: they are the save's, not one hero's.
  if (action.kind === 'restart') return newHero(game, action.cls ?? game.cls ?? 'knight')
  if (game.panel === 'start' && !ON_THE_START_SCREEN.has(action.kind)) return game
  const before = normalize(game)
  if (action.kind === 'retire' && whyNotRetire(before, action.slot) === undefined) return retiredFrom(before, action.slot)
  const g: Game = { ...before, log: [...game.log], toast: null, fresh: 0, walked: [] }
  const handle = ((g.where === 'town' ? TOWN[action.kind] : undefined) ?? HANDLERS[action.kind]) as (g: Game, a: Action) => void
  handle(g, action)
  bank(before, g)
  if (HAND_STEPS.has(action.kind)) handFoe(g)
  offerTalent(g)
  if (TOOL_DRIVEN.has(action.kind)) g.recap = noted(before, g, action)
  g.codex = record(before, g)
  return g
}

export const runsOf = (chars: Run[]): Run[] =>
  chars.reduce<Run[]>((runs, c) => {
    const last = runs[runs.length - 1]
    if (last !== undefined && last.color === c.color && last.bold === c.bold && last.inverse === c.inverse && last.dim === c.dim && last.bg === c.bg) {
      last.text += c.text
    } else {
      runs.push({ ...c })
    }
    return runs
  }, [])

export const bar = (value: number, max: number, width: number) => {
  const full = Math.max(0, Math.round((value / max) * width))
  return '#'.repeat(full) + '-'.repeat(width - full)
}

const basename = (path: string) => path.split('/').filter(Boolean).pop() ?? path

/** What a tool call does in the dungeon as it starts. */
/** The program a shell command runs: its first word past any VAR=value settings and separators, without its path. */
const program = (command: string) => {
  const word = command.split(/[\s;&|]+/).find(w => w !== '' && !/^[A-Za-z_][A-Za-z0-9_]*=/.test(w))
  return word === undefined ? 'the shell' : basename(word)
}

export const onToolStart = (tool: string, target: string | undefined): Action => {
  if (tool === 'Read' || tool === 'Glob' || tool === 'Grep' || tool === 'LS') return { kind: 'explore', steps: 3 }
  if (tool === 'WebFetch' || tool === 'WebSearch') return { kind: 'explore', steps: 4 }
  if (tool === 'Edit' || tool === 'Write' || tool === 'NotebookEdit') {
    return { kind: 'summon', name: basename(target ?? 'the code') }
  }
  if (tool === 'Bash') return { kind: 'summon', name: program(target ?? '') }
  if (tool === 'Agent' || tool === 'Task') return { kind: 'ally' }
  return { kind: 'explore', steps: 1 }
}

/**
 * The game on each tile of an action's walk, as it stands when the hero gets there: its path replayed a step at a time,
 * as the action walked it, the last tile the action's own end. In town the hero only moves: nothing lies on its streets.
 * Null for no walk; a hero slain on the way wakes at the entrance with none.
 */
export const alongTheWay = (game: Game, plan: Game): Game[] | null => {
  const last = plan.walked.length - 1
  if (last < 0) return null
  const g: Game = { ...normalize(game), log: [...game.log], toast: null, fresh: 0, walked: [] }
  if (g.where === 'dungeon') startWalk(g)
  const tiles: Game[] = []
  for (const p of plan.walked.slice(0, last)) {
    if (g.where === 'town') Object.assign(g, { x: p.x, y: p.y, walked: [...g.walked, { x: p.x, y: p.y }] })
    else moveTo(g, p)
    tiles.push({ ...g })
  }
  return [...tiles, plan]
}

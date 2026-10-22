import type { Attribute, Game, Item } from '../types'
import { countOf, slotOf } from './consumables'
import { attackBonus, bar, critChance, defense, levelOf, runsOf, sightOf, threat, xpToLevel } from './game'
import type { Run } from './game'
import { BAG_H, BAG_W, GLYPH, RARITY_COLOR, RARITY_RANK, itemAt } from './items'
import { MAP_H, MAP_W, OPENED_GLYPH, cellId, floorThing, isFloor, roomAt, same, visibleFrom } from './map'
import type { Level, Pos } from './map'
import { TOWN_GROUND, TOWN_H, TOWN_W, townDecorAt, townSpotAt } from './town'
import type { TownSpot } from './town'
import { CANVAS, INK, MEMORY_BG, MEMORY_FG, WOOD_BG, WOOD_FG, light, mix, shade } from './palette'
import { hash } from './rng'

const THING_INK: Record<string, string> = { $: INK.gold, '!': INK.potion, '^': INK.trap, '>': INK.stairs, U: '#7fe3ff', V: '#6abe30', P: '#8c6cc8', X: '#b8e8ff', K: '#ffb43a' }

const isRoom = (level: Level, x: number, y: number) => isFloor(level.tiles, { x, y }) && roomAt(level, { x, y }) !== undefined

const STRAIGHT: readonly Pos[] = [{ x: 1, y: 0 }, { x: -1, y: 0 }, { x: 0, y: 1 }, { x: 0, y: -1 }]

export type Surface = 'void' | 'wall' | 'floor' | 'passage' | 'door'

/** A corridor cell running straight into a room. */
const opensOnRoom = (level: Level, p: Pos) =>
  isFloor(level.tiles, p) && roomAt(level, p) === undefined && STRAIGHT.some(d => isRoom(level, p.x + d.x, p.y + d.y) && isFloor(level.tiles, { x: p.x - d.x, y: p.y - d.y }))

/**
 * What a cell is built of: rock touching a room is its wall, other rock is void; a corridor running straight into a
 * room is a door. Two rooms two cells apart are joined by a corridor whose both cells open on a room: only the top or
 * left one is the door, the other a passage, so doors never stand side by side.
 */
export const surfaceOf = (level: Level, p: Pos): Surface => {
  const isInside = p.x >= 0 && p.y >= 0 && p.x < MAP_W && p.y < MAP_H
  if (!isInside) return workedSurface(level, p)
  let known = surfaces.get(level)
  if (known === undefined) {
    known = []
    surfaces.set(level, known)
  }
  return (known[cellId(p)] ??= workedSurface(level, p))
}
/** Each level's surfaces as worked out, by cell: a level never changes, and its door rules look at many cells. */
const surfaces = new WeakMap<Level, Surface[]>()

const workedSurface = (level: Level, p: Pos): Surface => {
  if (!isFloor(level.tiles, p)) {
    const touchesRoom = [-1, 0, 1].some(dx => [-1, 0, 1].some(dy => isRoom(level, p.x + dx, p.y + dy)))
    return touchesRoom ? 'wall' : 'void'
  }
  if (roomAt(level, p) !== undefined) return 'floor'
  if (!opensOnRoom(level, p)) return 'passage'
  const besideADoor = opensOnRoom(level, { x: p.x - 1, y: p.y }) || opensOnRoom(level, { x: p.x, y: p.y - 1 })
  return besideADoor ? 'passage' : 'door'
}

/** A game's taken cells as a set, worked out once for each list (lists are never changed in place). */
const takenSets = new WeakMap<readonly number[], ReadonlySet<number>>()
const takenSet = (taken: readonly number[]) => {
  let set = takenSets.get(taken)
  if (set === undefined) {
    set = new Set(taken)
    takenSets.set(taken, set)
  }
  return set
}

/** The most rows a floor label stacks: past it, the last says how many more lie there. */
const LABEL_ROWS = 5

/**
 * What a floor label says: each item lying on the tile on a row of its own, in its tier's color, with its id to pick it
 * by, the rarest first, so nothing lying under another goes unseen; past LABEL_ROWS, the rest counted, uncolored.
 * `color` is the rarest one's, the text map's `*`.
 */
export const lyingLabel = (items: readonly Item[]): { lines: { text: string; color?: string; id?: number }[]; color: string } => {
  const rank = (i: Item) => RARITY_RANK.indexOf(i.rarity)
  const sorted = [...items].sort((a, b) => rank(b) - rank(a))
  const lines = sorted.map(i => ({ text: i.name, color: RARITY_COLOR[i.rarity], id: i.id }))
  const shown = lines.length <= LABEL_ROWS ? lines : [...lines.slice(0, LABEL_ROWS - 1), { text: `+${lines.length - LABEL_ROWS + 1} more` }]
  return { lines: shown, color: lines[0]!.color }
}

/** The items lying on the floor at a cell, left there when the bag was full. */
const lyingAt = (g: Game, p: Pos) => (g.floor ?? []).filter(f => f.x === p.x && f.y === p.y).map(f => f.item)

/** The thing lying on a cell, if any: stairs, an item left on the floor (`*`), or gold, a potion, a sprung trap not yet used up. */
const thingAt = (g: Game, level: Level, p: Pos) => {
  if (same(p, level.stairs)) return '>'
  if (lyingAt(g, p).length > 0) return '*'
  const thing = floorThing(g.world, g.depth, level, p)
  const isTaken = takenSet(g.taken).has(cellId(p))
  if (thing === '^') return isTaken ? '^' : undefined
  // The themed room's furnishings stand there for good, used or not.
  if (thing === 'A' || thing === 'B' || thing === 'L' || thing === 'R' || thing === 'S' || thing === 'Q' || thing === 'N' || thing === 'F') return thing
  // An opened chest stays where it stood, open.
  if (thing === 'C' || thing === 'H' || thing === 'G') return isTaken ? OPENED_GLYPH[thing] : thing
  return thing === ' ' || isTaken ? undefined : thing
}

/** Stone gets a sparse speckle so walls read as rock, not as flat paint. */
const stoneGlyph = (p: Pos) => (hash(7, p.x, p.y) < 22 ? ':' : ' ')

const lit = (surface: Surface, level: number, p: Pos): Run => {
  if (surface === 'wall') return { text: stoneGlyph(p), color: shade('wallFg', level), bg: shade('wallBg', level) }
  if (surface === 'floor') return { text: '.', color: shade('floorFg', level), bg: shade('floorBg', level) }
  if (surface === 'door') return { text: '.', color: WOOD_FG, bg: mix(WOOD_BG, '#000000', 1 - Math.max(0.35, level)) }
  return { text: ' ', bg: shade('passageBg', level) }
}

const remembered = (surface: Surface, p: Pos): Run => {
  if (surface === 'wall') return { text: stoneGlyph(p), color: MEMORY_FG, bg: MEMORY_BG }
  if (surface === 'floor' || surface === 'door') return { text: '.', color: MEMORY_FG, bg: MEMORY_BG }
  return { text: ' ', bg: MEMORY_BG }
}

const VOID: Run = { text: ' ', bg: CANVAS }

const groundOf = (g: Game, level: Level, isVisible: boolean, p: Pos): Run => {
  const surface = surfaceOf(level, p)
  if (surface === 'void') return VOID
  return isVisible ? lit(surface, light(p.x - g.x, p.y - g.y), p) : remembered(surface, p)
}

export type Occupant = { kind: 'hero' | 'foe' | 'thing'; glyph: string; color: string; bold?: true }

/** One map cell as both scales draw it: the ground painted under it, what it is built of, and who or what stands on it. */
export type Tile = { ground: Run; surface: Surface | 'unseen'; isVisible: boolean; occupant?: Occupant }

const occupantOf = (g: Game, level: Level, isSeen: boolean, isVisible: boolean, p: Pos): Occupant | undefined => {
  if (same(p, g)) return { kind: 'hero', glyph: '@', color: INK.hero, bold: true }
  if (g.foe !== null && same(p, g.foe)) {
    return isVisible ? { kind: 'foe', glyph: g.foe.glyph, color: INK.foe, bold: true } : { kind: 'foe', glyph: g.foe.glyph, color: INK.sensed }
  }
  const thing = isSeen ? thingAt(g, level, p) : undefined
  if (thing === undefined) return undefined
  const ink = thing === '*' ? lyingLabel(lyingAt(g, p)).color : (THING_INK[thing] ?? INK.gold)
  return isVisible ? { kind: 'thing', glyph: thing, color: ink, bold: true } : { kind: 'thing', glyph: thing, color: MEMORY_FG }
}

export const tileAt = (g: Game, level: Level, visible: ReadonlySet<number>, p: Pos, withGround = true): Tile => {
  const isInside = p.x >= 0 && p.y >= 0 && p.x < MAP_W && p.y < MAP_H
  if (!isInside) return { ground: VOID, surface: 'void', isVisible: false }
  const isSeen = g.seen[cellId(p)] === '1'
  const isVisible = visible.has(cellId(p))
  // The pixel views draw their own ground: the text one's colors are worked out only for it.
  const ground = isSeen && withGround ? groundOf(g, level, isVisible, p) : VOID
  const surface = isSeen ? surfaceOf(level, p) : 'unseen'
  return { ground, surface, isVisible, occupant: occupantOf(g, level, isSeen, isVisible, p) }
}

const mapCell = (tile: Tile): Run => {
  const o = tile.occupant
  return o === undefined ? tile.ground : { text: o.glyph, color: o.color, bold: o.bold, bg: tile.ground.bg }
}

/** The first of `span` cells a window of `span` shows along an axis of `size`, `at` as near its middle as the edges allow. */
export const windowStart = (at: number, span: number, size: number) => Math.max(0, Math.min(at - Math.floor(span / 2), size - span))

export const visibleSet = (g: Game, level: Level) => new Set(visibleFrom(level, g, sightOf(g)).map(cellId))

/** The map from above, `columns` by `rows`, the window following the hero. */
const TOWN_CHAR: Readonly<Record<string, Run>> = {
  R: { text: '#', color: '#9a3a2c' },
  W: { text: '#', color: '#e4d8c0' },
  A: { text: '#', color: '#c8402a' },
  C: { text: '_', color: '#8a5a2b' },
  '=': { text: '.', color: '#a89a84' },
  '.': { text: '"', color: '#5a9a38' },
  ',': { text: '*', color: '#ff6ad5' },
  f: { text: '.', color: '#5a4a3a' },
  H: { text: '&', color: '#3f7d2a' },
  S: { text: '#', color: '#4c5466' },
  P: { text: '#', color: '#3a8a8e' },
  X: { text: '#', color: '#7a746c' },
}
/** What stands in the way, by its art: trees, the fountain, lamps, and the goods and anvil. */
const DECOR_CHAR: Readonly<Record<string, Run>> = {
  tree: { text: '&', color: '#3f7d2a' },
  fountain: { text: '~', color: '#5ab4e0' },
  lamp: { text: '!', color: '#ffb43a' },
  barrel: { text: 'o', color: '#8a5a2b' },
  crate: { text: 'o', color: '#8a5a2b' },
  anvil: { text: 'o', color: '#8a919c' },
}
const SPOT_CHAR: Readonly<Record<TownSpot, Run>> = {
  merchant: { text: 'M', color: '#c88cff', bold: true },
  smith: { text: 'S', color: '#ffd34d', bold: true },
  healer: { text: 'H', color: '#ff6a6a', bold: true },
  stash: { text: '=', color: '#c87f4a', bold: true },
  portal: { text: 'O', color: '#7fe3ff', bold: true },
  elder: { text: 'E', color: '#e8e2d0', bold: true },
  mystic: { text: 'Y', color: '#7fe3ff', bold: true },
  guard: { text: 'G', color: '#d9443a', bold: true },
  villager: { text: 'v', color: '#6abe30', bold: true },
  dog: { text: 'd', color: '#8a5a2b', bold: true },
}

/** The town as characters: buildings, road and grass, the townsfolk by initial, the stash, the portal and the hero. */
export const townRows = (g: Game, columns: number, rows: number): Run[][] => {
  const left = windowStart(g.x, columns, TOWN_W)
  const top = windowStart(g.y, rows, TOWN_H)
  const cell = (p: Pos): Run => {
    if (same(p, g)) return { text: '@', color: INK.hero, bold: true }
    const spot = townSpotAt(p)
    if (spot !== undefined) return SPOT_CHAR[spot]
    const decor = townDecorAt(p)
    if (decor !== undefined) return DECOR_CHAR[decor.art] ?? { text: '#' }
    return TOWN_CHAR[TOWN_GROUND[p.y]?.[p.x] ?? ''] ?? { text: ' ' }
  }
  return Array.from({ length: rows }, (_, row) => runsOf(Array.from({ length: columns }, (_, col) => cell({ x: left + col, y: top + row }))))
}

export const mapRows = (g: Game, columns: number, rows: number): Run[][] => {
  if (g.where === 'town') return townRows(g, columns, rows)
  const level = levelOf(g)
  const visible = visibleSet(g, level)
  const left = windowStart(g.x, columns, MAP_W)
  const top = windowStart(g.y, rows, MAP_H)
  return Array.from({ length: rows }, (_, row) =>
    runsOf(Array.from({ length: columns }, (_, col) => mapCell(tileAt(g, level, visible, { x: left + col, y: top + row })))),
  )
}

const edge = `+${'-'.repeat(BAG_W)}+`

/** The bag as a bordered grid of item glyphs, the selected item drawn inverse. */
export const bagRows = (g: Game): Run[][] => {
  const rows: Run[][] = [[{ text: edge, color: 'gray' }]]
  for (let y = 0; y < BAG_H; y += 1) {
    const cells: Run[] = [{ text: '|', color: 'gray' }]
    for (let x = 0; x < BAG_W; x += 1) {
      const item = itemAt(g.bag, x, y)
      cells.push(
        item === undefined
          ? { text: '.', color: 'gray' }
          : { text: GLYPH[item.slot], color: RARITY_COLOR[item.rarity], inverse: item.id === g.cursor },
      )
    }
    cells.push({ text: '|', color: 'gray' })
    rows.push(runsOf(cells))
  }
  rows.push([{ text: edge, color: 'gray' }])
  return rows
}

const BAR = 20
const BAR_EMPTY = '#2b2b30'
export const BAR_FILL = { healthy: '#2e7d32', hurt: '#9a6c00', critical: '#b3261e' } as const

/** The fill of a bar at a share of its maximum: healthy above 70%, hurt down to 40%, critical below. */
export const barFill = (share: number) => (share <= 0.4 ? BAR_FILL.critical : share <= 0.7 ? BAR_FILL.hurt : BAR_FILL.healthy)

/** HP as a 20-cell bar with its label inside, its filled share painted by how hurt the hero is. */
export const hpBar = (g: Pick<Game, 'hp' | 'maxHp'>): Run[] => {
  const hp = Math.max(0, g.hp)
  const label = `HP ${String(hp).padStart(String(g.maxHp).length)}/${g.maxHp}`
  const pad = BAR - label.length
  const inside = ' '.repeat(Math.floor(pad / 2)) + label + ' '.repeat(Math.ceil(pad / 2))
  const filled = Math.round((hp / g.maxHp) * BAR)
  const fill = barFill(hp / g.maxHp)
  return [
    { text: '[' },
    ...(filled > 0 ? [{ text: inside.slice(0, filled), color: '#ffffff', bold: true, bg: fill }] : []),
    ...(filled < BAR ? [{ text: inside.slice(filled), color: '#c8c8c8', bg: BAR_EMPTY }] : []),
    { text: ']' },
  ]
}

const stat = (caption: string, value: string): Run[] => [
  { text: `  ${caption} `, dim: true },
  { text: value },
]

/** The status line: the HP bar, then muted captions with their values. */
export const statusRuns = (g: Game): Run[] => [
  ...hpBar(g),
  ...stat('Lv', String(g.level)),
  ...stat('XP', `${g.xp}/${xpToLevel(g.level)}`),
  ...stat('Atk', `+${attackBonus(g)}`),
  ...stat('Def', String(defense(g))),
  ...stat('Gold', String(g.gold)),
  ...stat('Potions', String(countOf(g.belt[slotOf('health')]))),
  ...stat('Depth', g.where === 'town' ? `Town (depth ${g.depth})` : `${g.depth} (best ${g.deepest})`),
]

const THREAT_STYLE = { easy: {}, tough: { color: 'yellow' }, deadly: { color: 'red', bold: true } } as const

/** The foe's line: its glyph and name, its threat said in words as well as color, its HP. */
export const foeRuns = (g: Game): Run[] => {
  const foe = g.foe
  if (g.where === 'town') return [{ text: `You are in town. The portal (t) leads back to depth ${g.depth}.`, dim: true }]
  if (foe === null) return [{ text: 'Nothing hunts you. The way to > is clear.', dim: true }]
  const rating = threat(g)
  return [
    { text: foe.glyph, color: 'red', bold: true },
    { text: ` ${foe.name} `, ...THREAT_STYLE[rating] },
    { text: `(${rating})`, ...THREAT_STYLE[rating] },
    { text: `  [${bar(foe.hp, foe.maxHp, 10)}] ${foe.hp}/${foe.maxHp}`, dim: true },
  ]
}

/** The log lines the dashboard shows, the last of those the game keeps. */
export const LOG_SHOWN = 5

/** The log's last `n` lines, oldest first: the latest action's lines at full strength, older ones faded. */
export const logRuns = (g: Game, n = LOG_SHOWN): Run[] => {
  const from = Math.max(0, g.log.length - n)
  return g.log.slice(from).map((line, i) => ({ text: line, dim: from + i < g.log.length - g.fresh ? true : undefined }))
}

export const ATTRIBUTES: readonly { stat: Attribute; label: string; effect: (g: Game) => string }[] = [
  { stat: 'might', label: 'Might  ', effect: g => `+${attackBonus(g)} attack (half Might + gear)` },
  { stat: 'focus', label: 'Focus  ', effect: g => `${critChance(g)}% critical hit chance` },
  { stat: 'vigor', label: 'Vigor  ', effect: () => '+3 max HP per point' },
  { stat: 'insight', label: 'Insight', effect: g => `+${g.stats.insight * 10}% XP from kills` },
]

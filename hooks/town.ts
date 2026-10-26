// The town: a fixed square of shops reached by portal, lit by day, with no foes. Pure data and walking.
import type { Pos } from './map'
import { bfs, same } from './map'

/**
 * The ground, by tile. Buildings: R red roof, S slate roof, P teal roof, W timber wall, X stone wall, A awning,
 * C counter; H the forest floor under the tree line. Open ground: f forge floor, = road, . grass, , flowers.
 */
export const TOWN_GROUND: readonly string[] = [
  'HHHHHHHHHHHHHHHHHHHH',
  'H.RRRR..SSSS..PPPP.H',
  'H.RRRR..SSSS..PPPP.H',
  'H.WWWW..XXXX..WWWW.H',
  'H.AAAA..XXXX..AAAA.H',
  'H.CCCC..ffff..CCCC.H',
  'H.================.H',
  'H.===..======..===.H',
  'H.==.,,.====.,,.==.H',
  'H.==.,,.====.,,.==.H',
  'H.===..======..===.H',
  'H.================.H',
  'H........==........H',
  'H........==........H',
  'HHHHHHHHH==HHHHHHHHH',
]
export const TOWN_W = TOWN_GROUND[0]!.length
export const TOWN_H = TOWN_GROUND.length

export type TownSpot = 'merchant' | 'smith' | 'healer' | 'stash' | 'portal' | 'elder' | 'mystic' | TownPerson
/** The townsfolk without work yet: visited, they have a word. */
export type TownPerson = 'guard' | 'villager' | 'dog'

/** Who and what the hero visits, each on its own tile: the shopkeepers at their counters, the smith at his anvil with the stash beside it on the forge floor, the rest about the square. */
export const TOWN_SPOTS: Readonly<Record<TownSpot, Pos>> = {
  merchant: { x: 3, y: 5 },
  smith: { x: 8, y: 5 },
  healer: { x: 15, y: 5 },
  stash: { x: 11, y: 5 },
  portal: { x: 9, y: 12 },
  elder: { x: 8, y: 10 },
  mystic: { x: 16, y: 9 },
  guard: { x: 11, y: 12 },
  villager: { x: 4, y: 7 },
  dog: { x: 5, y: 7 },
}

/** What each townsperson without work says when visited. */
export const TOWN_TALK: Readonly<Record<TownPerson, string>> = {
  guard: 'The guard: "The dungeon is through the portal. Mind the stairs."',
  villager: 'A villager waves. "Fine day for it."',
  dog: 'The dog wags its tail.',
}

/** Where the portal sets the hero down: just north of it, on the road from the gate. */
export const TOWN_ARRIVAL: Pos = { x: 9, y: 11 }

export type TownDecor = { art: string; x: number; y: number; size: 1 | 2; blocks: boolean; alt?: boolean }

/** The tree line: overlapping trees along every edge, a gap where the road leaves by the gate; every third in the second green. */
const treeLine = (): TownDecor[] => {
  const at: Pos[] = []
  for (let x = -1; x <= TOWN_W - 1; x += 2) at.push({ x, y: -1 })
  for (let x = -1; x <= TOWN_W - 1; x += 2) if (x < 8 || x > 10) at.push({ x, y: TOWN_H - 1 })
  for (let y = 1; y <= TOWN_H - 2; y += 2) at.push({ x: -1, y }, { x: TOWN_W - 1, y })
  return at.sort((a, b) => a.y - b.y).map((p, i) => ({ art: 'tree', ...p, size: 2, blocks: true, alt: i % 3 === 1 }))
}

/**
 * What stands about the town, drawn in this order (later over earlier): the tree line, then the town's own trees and
 * fountain, then the small things. Signs, the furnace and the chimney sit on walls and block nothing more.
 */
export const TOWN_DECOR: readonly TownDecor[] = [
  ...treeLine(),
  { art: 'tree', x: 6, y: 1, size: 2, blocks: true, alt: true },
  { art: 'tree', x: 12, y: 1, size: 2, blocks: true },
  { art: 'fountain', x: 9, y: 8, size: 2, blocks: true },
  { art: 'tree', x: 1, y: 12, size: 2, blocks: true },
  { art: 'tree', x: 5, y: 12, size: 2, blocks: true, alt: true },
  { art: 'tree', x: 13, y: 12, size: 2, blocks: true },
  { art: 'tree', x: 17, y: 12, size: 2, blocks: true, alt: true },
  { art: 'signCoin', x: 4, y: 3, size: 1, blocks: false },
  { art: 'signAnvil', x: 10, y: 3, size: 1, blocks: false },
  { art: 'signCross', x: 16, y: 3, size: 1, blocks: false },
  { art: 'furnace', x: 9, y: 4, size: 1, blocks: false },
  { art: 'chimney', x: 10, y: 1, size: 1, blocks: false },
  { art: 'anvil', x: 9, y: 5, size: 1, blocks: true },
  // At the top of the lane beside the shop, its dead end: lower down they would wall in the ground above them.
  { art: 'barrel', x: 1, y: 1, size: 1, blocks: true },
  { art: 'crate', x: 1, y: 2, size: 1, blocks: true },
  { art: 'lamp', x: 6, y: 7, size: 1, blocks: true },
  { art: 'lamp', x: 13, y: 7, size: 1, blocks: true },
]

export const townSpotAt = (p: Pos) => (Object.keys(TOWN_SPOTS) as TownSpot[]).find(k => same(TOWN_SPOTS[k], p))

const isCovered = (d: TownDecor, p: Pos) => p.x >= d.x && p.x < d.x + d.size && p.y >= d.y && p.y < d.y + d.size

/** The thing standing on a tile that blocks the way, if any. */
export const townDecorAt = (p: Pos) => TOWN_DECOR.find(d => d.blocks && isCovered(d, p))

const isOpenGround = (p: Pos) => ['=', '.', ',', 'f'].includes(TOWN_GROUND[p.y]?.[p.x] ?? '')

/** Whether the hero can stand on a tile: open ground with no one and nothing standing on it. */
export const isTownWalkable = (p: Pos) => isOpenGround(p) && townSpotAt(p) === undefined && townDecorAt(p) === undefined

/** The town as bfs reads it: '.' where the hero can stand, '#' elsewhere. */
const WALKABLE: readonly string[] = TOWN_GROUND.map((row, y) => [...row].map((_, x) => (isTownWalkable({ x, y }) ? '.' : '#')).join(''))

/** The shortest walk to a tile, both ends included; null when it cannot be stood on or reached. */
export const townPath = (from: Pos, to: Pos) => (isTownWalkable(to) ? bfs(WALKABLE, from, to) : null)

/** The shortest walk to stand next to a spot (diagonals count), for talking to whoever stands there. */
export const pathBeside = (from: Pos, spot: Pos) => {
  const around = [-1, 0, 1].flatMap(dy => [-1, 0, 1].map(dx => ({ x: spot.x + dx, y: spot.y + dy }))).filter(p => !same(p, spot))
  if (around.some(p => same(p, from))) return [from]
  return around.map(p => townPath(from, p)).filter(p => p !== null).sort((a, b) => a.length - b.length)[0] ?? null
}

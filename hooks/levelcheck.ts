// What a generated level must be, whatever its world and depth: the rules a level lab and its test hold every level to,
// each broken one a sentence naming where. Pure.
import { MAP_H, MAP_W, analyze, floorThing, generate, isFloor, roomAt, shapeCut } from './map'
import type { Level, Pos } from './map'

const cells: readonly Pos[] = Array.from({ length: MAP_W * MAP_H }, (_, i) => ({ x: i % MAP_W, y: Math.floor(i / MAP_W) }))
const at = (p: Pos) => `${p.x},${p.y}`

/** A cell of a room's own floor: inside its rectangle and not given back to rock by its shape. */
const isRoomFloor = (level: Level, p: Pos) => {
  const room = roomAt(level, p)
  return room !== undefined && isFloor(level.tiles, p) && !shapeCut(room).some(c => c.x === p.x && c.y === p.y)
}

/** Each rule a level keeps: its name, and the cells or rooms that break it. */
const RULES: readonly [string, (level: Level, world: number, depth: number) => string[]][] = [
  ['every floor cell is reachable from the start', level => {
    const { dist } = analyze(level)
    return cells.filter(p => isFloor(level.tiles, p) && dist[p.y * MAP_W + p.x] === -1).map(at)
  }],
  ['the stairs are reachable from the start', level => (analyze(level).pathLength < 0 ? [at(level.stairs)] : [])],
  ['no dead end on a room\'s floor, where a chest would stand in the room', level => analyze(level).deadEnds.filter(p => isRoomFloor(level, p)).map(at)],
  ['a shaped room keeps its middle row and column open', level => level.rooms.filter(r => r.shape !== undefined).filter(r => {
    const mid = { x: r.x + Math.floor(r.w / 2), y: r.y + Math.floor(r.h / 2) }
    const row = Array.from({ length: r.w }, (_, i) => ({ x: r.x + i, y: mid.y }))
    const column = Array.from({ length: r.h }, (_, i) => ({ x: mid.x, y: r.y + i }))
    return [...row, ...column].some(p => !isFloor(level.tiles, p))
  }).map(r => `${r.shape} room at ${at(r)}`)],
  ['nothing lies on rock', (level, world, depth) => cells.filter(p => !isFloor(level.tiles, p) && floorThing(world, depth, level, p) !== ' ').map(at)],
]

/** The rules a level breaks: each a sentence naming the rule and where, none for a sound level. */
export const problemsOf = (level: Level, world: number, depth: number): string[] =>
  RULES.flatMap(([rule, broken]) => {
    const where = broken(level, world, depth)
    return where.length === 0 ? [] : [`${rule}: ${where.slice(0, 5).join(' ')}${where.length > 5 ? ` and ${where.length - 5} more` : ''}`]
  })

/** The rules the level of `world` and `depth`, as the game generates it, breaks. */
export const levelProblems = (world: number, depth: number): string[] => problemsOf(generate(world, depth), world, depth)

/** The names of the rules, in order, for a report. */
export const LEVEL_RULES = RULES.map(([rule]) => rule)

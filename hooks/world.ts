// A game's world: creating a hero and arriving on a level.
import type { Attribute, Game, HeroClass } from '../types'
import { emptyBelt } from './consumables'
import { kitFor } from './items'
import { MAP_H, MAP_W, cellId, generate, visibleFrom } from './map'
import type { Pos } from './map'

export const SAVE_VERSION = 11

export const FOG = '0'.repeat(MAP_W * MAP_H)

export const reveal = (seen: string, cells: readonly Pos[]) => {
  const out = seen.split('')
  for (const c of cells) out[cellId(c)] = '1'
  return out.join('')
}

export const levelOf = (g: Pick<Game, 'world' | 'depth'>) => generate(g.world, g.depth)

export const arrive = (world: number, depth: number) => {
  const level = generate(world, depth)
  return { depth, ...level.start, seen: reveal(FOG, visibleFrom(level, level.start)), taken: [] as number[] }
}

const BASE_STATS: Record<Attribute, number> = { might: 1, focus: 1, vigor: 1, insight: 0 }
const BASE_HP = 20
export const VIGOR_HP = 3

/** Each class's lean on the four attributes, added to the base. */
export const CLASS_LEAN: Readonly<Record<HeroClass, Partial<Record<Attribute, number>>>> = {
  knight: { might: 2, vigor: 1 },
  mage: { insight: 3, focus: 1 },
  rogue: { focus: 3, might: 1, vigor: 1 },
}

export const newGame = (seed = 1, cls: HeroClass = 'knight'): Game => {
  const ids = { nextId: 1 }
  const gear = kitFor(ids, cls)
  const lean = CLASS_LEAN[cls]
  const stats = { ...BASE_STATS }
  for (const [k, v] of Object.entries(lean) as [Attribute, number][]) stats[k] += v
  const maxHp = BASE_HP + (lean.vigor ?? 0) * VIGOR_HP + Object.values(gear).reduce((sum, item) => sum + (item?.hp ?? 0), 0)
  const world = seed >>> 0 || 1
  return {
    version: SAVE_VERSION,
    seed: world,
    world,
    ...arrive(world, 1),
    walked: [],
    hp: maxHp,
    maxHp,
    level: 1,
    xp: 0,
    gold: 0,
    cls,
    belt: [{ kind: 'health', tiers: [1, 0, 0] }, ...emptyBelt().slice(1)],
    effects: { regen: 0, fury: 0, ward: 0 },
    potionChance: 40,
    dryKills: 0,
    sinceRare: 0,
    reforges: 0,
    bossSlain: 0,
    stashed: [],
    quest: null,
    questsDone: 0,
    fortune: null,
    deepest: 1,
    deaths: 0,
    mended: 0,
    petted: 0,
    tension: 0,
    calm: 0,
    nemesis: null,
    uniquesSlain: [],
    lastSold: null,
    reforgedFrom: null,
    foe: null,
    log: ['You enter the dungeon. Every tool call moves you toward the stairs >.'],
    toast: null,
    fresh: 1,
    bag: [],
    gear,
    cursor: null,
    nextId: ids.nextId,
    stats,
    points: 0,
    panel: 'none',
    where: 'dungeon',
    portal: null,
    zoom: 3,
  }
}

// The codex: what every hero of a save has done, kept through a new game. `recorded` adds what one action did;
// `codexwindow.ts` draws it, and game.ts begins it from an older save and pays for a set made whole. Pure.
import type { Codex, Game, Item } from '../types'
import { slain } from './recap'

/** A codex with nothing in it yet, for a hero who has done nothing. */
export const EMPTY_CODEX: Codex = { uniques: [], bigs: [], legendaries: [], deepest: 1, level: 1, kills: 0, bosses: 0, deaths: 0, gold: 0 }

const owned = (g: Game): Item[] => [...g.bag, ...g.stashed, ...Object.values(g.gear).filter((i): i is Item => i !== undefined)]
const added = <T>(list: readonly T[], x: T | undefined) => (x === undefined || list.includes(x) ? list : [...list, x])

/** The Legendaries the hero owns, by name, each once. */
export const legendariesOwned = (g: Game) => [...new Set(owned(g).filter(i => i.rarity === 'legendary').map(i => i.name))]

/** The Legendaries the hero came to own between `before` and `after`, by name, new to the codex. */
const foundLegendaries = (c: Codex, before: Game, after: Game) => {
  const had = new Set(owned(before).map(i => i.id))
  return owned(after)
    .filter(i => i.rarity === 'legendary' && !had.has(i.id))
    .reduce<readonly string[]>((names, i) => added(names, i.name), c.legendaries)
}

/** The codex `c` after an action took `before` to `after`: a foe slain, a fall, a Legendary come to hand, the deepest depth, the top level, gold found in the dungeon. */
export const recorded = (c: Codex, before: Game, after: Game): Codex => {
  const foe = slain(before, after)
  const inDungeon = before.where === 'dungeon' && after.where === 'dungeon'
  // A sale is gold paid for what the hero had, not found: bought back, it would count again.
  const isSale = after.lastSold !== null && after.lastSold !== before.lastSold
  return {
    uniques: [...added(c.uniques, foe?.unique)],
    bigs: [...added(c.bigs, foe?.big)],
    legendaries: [...foundLegendaries(c, before, after)],
    deepest: Math.max(c.deepest, after.deepest),
    level: Math.max(c.level, after.level),
    kills: c.kills + (foe === undefined ? 0 : 1),
    bosses: c.bosses + (foe?.boss === true ? 1 : 0),
    deaths: c.deaths + Math.max(0, after.deaths - before.deaths),
    gold: c.gold + (inDungeon && !isSale ? Math.max(0, after.gold - before.gold) : 0),
  }
}

import type { Foe, Game } from '../types'
import { newGame, routeToStairs } from './game'
import { plainItem } from './items'

/** A foe standing `ahead` cells along the hero's route to the stairs. */
export const foeAhead = (g: Game, ahead = 1, over: Partial<Foe> = {}): Foe => {
  const route = routeToStairs({ ...g, foe: null }) ?? [g]
  const spot = route[Math.min(ahead, route.length - 1)] ?? g
  return { glyph: 'g', name: 'goblin of x', hp: 5, maxHp: 5, atk: 3, xp: 10, x: spot.x, y: spot.y, ...over }
}

/**
 * The bare hero the combat tests' hand-worked numbers assume: 20 HP, a +1 attack blade and nothing else,
 * Might 1, Focus 1, Vigor 1, Insight 0, one Health Potion on the belt.
 */
export const plainHero = (seed = 1): Game => {
  const g = newGame(seed)
  const blade = { ...plainItem({ nextId: 900 }, 'sword'), atk: 1 }
  return { ...g, gear: { weapon: blade }, stats: { might: 1, focus: 1, vigor: 1, insight: 0 }, maxHp: 20, hp: 20 }
}

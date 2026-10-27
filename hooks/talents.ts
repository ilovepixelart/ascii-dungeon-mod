// Talents: one picked of three every TALENT_EVERY levels, each changing a rule (read with `hasTalent` where the rule
// lives). Which three are offered is fixed by the world and the picks so far, so the offer reads the same each time it
// is opened. Pure.
import type { Game, Talent } from '../types'
import { hash } from './rng'

/** A talent is earned at every this many levels. */
export const TALENT_EVERY = 5
/** Talents offered at each pick. */
export const OFFERED = 3

/** Every talent, in the order the list shows them: its name, what it does, and whether it rewards the player's work. */
export const TALENTS: Readonly<Record<Talent, { name: string; does: string; work?: true }>> = {
  testDriven: { name: 'Test Driven', does: 'A passing test run also gives 2 blows of fury.', work: true },
  cleanCommit: { name: 'Clean Commit', does: 'A commit also wards off the next blow.', work: true },
  shipIt: { name: 'Ship It', does: 'A push or PR rolls its item four times, not two.', work: true },
  rubberDucking: { name: 'Rubber Ducking', does: 'A failed tool call gives 1 XP a depth.', work: true },
  secondWind: { name: 'Second Wind', does: 'Once a depth, a killing blow leaves you at 1 HP.' },
  opener: { name: 'Opener', does: 'A blow on a foe at full HP deals a quarter more.' },
  bloodletting: { name: 'Bloodletting', does: 'A critical hit heals 2 HP.' },
  grudge: { name: 'Grudge', does: 'A quarter more damage to champions and uniques.' },
  scavenger: { name: 'Scavenger', does: 'Healing potions drop half again as often.' },
  ironStomach: { name: 'Iron Stomach', does: 'Potions and herbs heal a quarter more.' },
  haggler: { name: 'Haggler', does: 'The merchant asks a fifth less.' },
  pathfinder: { name: 'Pathfinder', does: 'In corridors you see two tiles around you, not one.' },
}
const ALL = Object.keys(TALENTS) as Talent[]

export const hasTalent = (g: Pick<Game, 'talents'>, t: Talent) => g.talents?.includes(t) === true

/** Talents earned: one every TALENT_EVERY levels, as many as there are. */
export const earned = (g: Pick<Game, 'level'>) => Math.min(Math.floor(g.level / TALENT_EVERY), ALL.length)

/** Talents earned and not yet picked. */
export const owed = (g: Pick<Game, 'level' | 'talents'>) => Math.max(0, earned(g) - (g.talents?.length ?? 0))

/** The three talents offered now, none already picked: by the world and the picks so far; none when none is owed. */
export const offer = (g: Pick<Game, 'level' | 'talents' | 'world'>): Talent[] => {
  if (owed(g) === 0) return []
  const picked = g.talents?.length ?? 0
  return ALL.filter(t => !hasTalent(g, t))
    .map((t, i) => ({ t, rank: hash(g.world, picked, i) * 100 + i }))
    .sort((a, b) => a.rank - b.rank)
    .slice(0, OFFERED)
    .map(x => x.t)
}

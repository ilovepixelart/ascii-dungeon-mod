// Talents: one picked of three every TALENT_EVERY levels, each changing a rule (read with `hasTalent` where the rule
// lives). Which three are offered is fixed by the world and the picks so far, so the offer reads the same each time it
// is opened. Pure.
import type { Game, Talent } from '../types'
import { hash } from './rng'

/** A talent is earned at every this many levels. */
export const TALENT_EVERY = 5
/** Talents offered at each pick. */
export const OFFERED = 3

/**
 * Every talent, in the order the list shows them: its name, what it does, what its second rank does (twice the first),
 * and whether it rewards the player's work.
 */
export const TALENTS: Readonly<Record<Talent, { name: string; does: string; twice: string; work?: true }>> = {
  testDriven: { name: 'Test Driven', does: 'A passing test run also gives 2 blows of fury.', twice: 'A passing test run also gives 4 blows of fury.', work: true },
  cleanCommit: { name: 'Clean Commit', does: 'A commit also wards off the next blow.', twice: 'A commit also wards off the next 2 blows.', work: true },
  shipIt: { name: 'Ship It', does: 'A push or PR rolls its item four times, not two.', twice: 'A push or PR rolls its item six times, not two.', work: true },
  rubberDucking: { name: 'Rubber Ducking', does: 'A failed tool call gives 1 XP a depth.', twice: 'A failed tool call gives 2 XP a depth.', work: true },
  secondWind: { name: 'Second Wind', does: 'Once a depth, a killing blow leaves you at 1 HP.', twice: 'Once a depth, a killing blow leaves you at a quarter HP.' },
  opener: { name: 'Opener', does: 'A blow on a foe at full HP deals a quarter more.', twice: 'A blow on a foe at full HP deals half again.' },
  bloodletting: { name: 'Bloodletting', does: 'A critical hit heals 2 HP.', twice: 'A critical hit heals 4 HP.' },
  grudge: { name: 'Grudge', does: 'A quarter more damage to champions and uniques.', twice: 'Half again the damage to champions and uniques.' },
  scavenger: { name: 'Scavenger', does: 'Healing potions drop half again as often.', twice: 'Healing potions drop twice as often.' },
  ironStomach: { name: 'Iron Stomach', does: 'Potions and herbs heal a quarter more.', twice: 'Potions and herbs heal half again.' },
  haggler: { name: 'Haggler', does: 'The merchant asks a fifth less.', twice: 'The merchant asks two fifths less.' },
  pathfinder: { name: 'Pathfinder', does: 'In corridors you see two tiles around you, not one.', twice: 'In corridors you see three tiles around you.' },
}
/** The most times a talent is taken: its second rank twice its first, all taken by level 120. */
export const MAX_RANK = 2
const ALL = Object.keys(TALENTS) as Talent[]

export const hasTalent = (g: Pick<Game, 'talents'>, t: Talent) => g.talents?.includes(t) === true
/** How many times a talent is taken: 0, 1, or MAX_RANK. */
export const rankOf = (g: Pick<Game, 'talents'>, t: Talent) => (g.talents ?? []).filter(x => x === t).length
/** A talent as the lists name it: II at its second rank. */
export const talentLabel = (g: Pick<Game, 'talents'>, t: Talent) => (rankOf(g, t) >= 2 ? `${TALENTS[t].name} II` : TALENTS[t].name)
/** What a talent does at the rank held, or at its first when none is. */
export const talentDoes = (g: Pick<Game, 'talents'>, t: Talent) => (rankOf(g, t) >= 2 ? TALENTS[t].twice : TALENTS[t].does)
/** A talent as offered: II when it is held once, its offer the second rank. */
export const offerLabel = (g: Pick<Game, 'talents'>, t: Talent) => (rankOf(g, t) >= 1 ? `${TALENTS[t].name} II` : TALENTS[t].name)
/** What an offered talent would do: its second rank's when it is held once. */
export const offerDoes = (g: Pick<Game, 'talents'>, t: Talent) => (rankOf(g, t) >= 1 ? TALENTS[t].twice : TALENTS[t].does)
/** Each talent taken, once, in the order first taken. */
export const takenTalents = (g: Pick<Game, 'talents'>): Talent[] => [...new Set(g.talents ?? [])]

/** Talents earned: one every TALENT_EVERY levels, as many as there are. */
export const earned = (g: Pick<Game, 'level'>) => Math.min(Math.floor(g.level / TALENT_EVERY), ALL.length * MAX_RANK)

/** Talents earned and not yet picked. */
export const owed = (g: Pick<Game, 'level' | 'talents'>) => Math.max(0, earned(g) - (g.talents?.length ?? 0))

/** The three talents offered now, none already picked: by the world and the picks so far; none when none is owed. */
export const offer = (g: Pick<Game, 'level' | 'talents' | 'world' | 'orders'>): Talent[] => {
  if (owed(g) === 0) return []
  const picked = g.talents?.length ?? 0
  // Played by hand no tool call comes: a talent that needs one is not offered.
  const isHand = g.orders?.play === 'hand'
  const open = ALL.filter(t => !(isHand && TALENTS[t].work === true))
  // Every talent first; its second rank only once none is left to take a first time.
  const fresh = open.filter(t => rankOf(g, t) === 0)
  return (fresh.length > 0 ? fresh : open.filter(t => rankOf(g, t) < MAX_RANK))
    .map((t, i) => ({ t, rank: hash(g.world, picked, i) * 100 + i }))
    .sort((a, b) => a.rank - b.rank)
    .slice(0, OFFERED)
    .map(x => x.t)
}

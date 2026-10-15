// How each kind of foe fights: one trait a kind, the dangerous ones announced a turn before they land.
import type { Foe, Game } from '../types'
import { roll } from './rng'
import { TheFoe, theFoe } from './names'

/** What the foe's turn comes to before its blow: lines to say, a changed foe, whether it strikes, and how. */
export type FoeTurn = { foe: Foe; said: string[]; strikes: boolean; times: number; pierces: boolean; steals: boolean }

const isOverlord = (foe: Foe) => foe.boss === true

/** The foe's turn: counted, then its kind's trait. */
type Turn = { foe: Foe; plain: FoeTurn; turn: number; share: number }

/** The uniques' own tricks, in place of their kind's: none on a turn the unique fights as its kind. */
const UNIQUE_MOVES: Readonly<Partial<Record<NonNullable<Foe['unique']>, (t: Turn) => FoeTurn | undefined>>> = {
  mire: ({ foe, plain, turn }) => {
    if (turn % 3 !== 0) return undefined
    const healed = Math.min(foe.maxHp - foe.hp, Math.ceil(foe.maxHp / 6))
    return { ...plain, foe: { ...foe, hp: foe.hp + healed }, said: [`${foe.name} sinks into the mud and rises whole. +${healed} HP`] }
  },
  rot: ({ foe, plain, turn }) => (turn % 2 === 0 ? { ...plain, pierces: true, said: [`${foe.name}'s spores slip past your armor!`] } : plain),
  rime: ({ foe, plain, turn }) => {
    if (turn % 3 === 2) return { ...plain, said: [`Frost gathers on ${foe.name}'s axe...`] }
    return turn % 3 === 0 ? { ...plain, times: 2, said: [`${foe.name} brings down a frost blow!`] } : plain
  },
  ember: ({ foe, plain, turn }) =>
    turn % 2 === 1 ? { ...plain, said: [`${foe.name}'s throat glows white-hot...`] } : { ...plain, times: 1.5, said: [`${foe.name} breathes fire!`] },
}

/** Each kind's trait, by its glyph; a kind not here fights plainly. */
const KIND_MOVES: Readonly<Record<string, (t: Turn) => FoeTurn>> = {
  k: ({ foe, plain, share }) => {
    if (share > 0.5 || foe.used !== undefined) return plain
    const healed = Math.min(foe.maxHp - foe.hp, Math.ceil(foe.maxHp * 0.3))
    return { ...plain, foe: { ...foe, hp: foe.hp + healed, used: true }, said: [`${TheFoe(foe)} gulps a foul brew. +${healed} HP`], strikes: false }
  },
  g: ({ foe, plain }) => ({ ...plain, steals: foe.stolen === undefined }),
  o: ({ foe, plain, share }) => (share <= 0.4 ? { ...plain, times: 1.25, said: [`${TheFoe(foe)} roars in rage!`] } : plain),
  T: ({ foe, plain }) => {
    const healed = Math.min(foe.maxHp - foe.hp, Math.ceil(foe.maxHp * 0.02))
    return healed > 0 ? { ...plain, foe: { ...foe, hp: foe.hp + healed }, said: [`${TheFoe(foe)}'s wounds knit. +${healed} HP`] } : plain
  },
  W: ({ foe, plain, turn }) => (turn % 3 === 0 ? { ...plain, pierces: true, said: [`${TheFoe(foe)}'s chill touch passes through your armor!`] } : plain),
  D: ({ foe, plain, turn }) => {
    if (turn % 3 === 2) return { ...plain, said: [`${TheFoe(foe)} draws a deep breath...`] }
    return turn % 3 === 0 ? { ...plain, times: isOverlord(foe) ? 2.5 : 1.5, said: [`${TheFoe(foe)} breathes fire!`] } : plain
  },
}

export const foeTurn = (g: Game, before: Foe): FoeTurn => {
  const turn = (before.turn ?? 0) + 1
  const foe = { ...before, turn }
  const plain: FoeTurn = { foe, said: [], strikes: true, times: 1, pierces: false, steals: false }
  const share = foe.hp / foe.maxHp
  if (foe.big !== undefined) return bigTurn(foe, plain, turn, share)
  const t: Turn = { foe, plain, turn, share }
  return (foe.unique === undefined ? undefined : UNIQUE_MOVES[foe.unique]?.(t)) ?? KIND_MOVES[foe.glyph]?.(t) ?? plain
}

/** What a big boss says as its second phase begins, at half its HP. */
const RAGE: Readonly<Record<NonNullable<Foe['big']>, string>> = {
  king: 'The Bone King howls, and the dead stir to guard him!',
  queen: 'The Drowned Queen calls up the deep!',
  hive: 'The Hive Mother shrieks, and the swarm boils!',
  lich: 'The Frost Lich wreathes itself in ice!',
  wyrm: 'The Furnace Wyrm roars, white-hot!',
}

/**
 * A big boss's turn. Each move comes round on a count and the hard ones are announced a turn before they land; at half
 * its HP it enters its second phase once, spending that turn on a roar, and from then its moves come harder:
 * - the Bone King raises his blade one turn and brings it down double the next; in his second phase bones rise to turn
 *   the hero's next blow each time he raises it;
 * - the Drowned Queen's tide mends a tenth of her HP every third turn; in her second phase she drags the hero under,
 *   past their armor, every other turn;
 * - the Hive Mother's spores slip past armor every other turn; in her second phase the swarm bites half again as hard;
 * - the Frost Lich chills the air one turn and looses a frost nova double the next; in its second phase ice armor turns
 *   the next blow every fourth turn;
 * - the Furnace Wyrm draws breath one turn and breathes fire two and a half times as hard the next, every third turn; in
 *   its second phase every other turn.
 */
type Move = (foe: Foe, plain: FoeTurn, turn: number, isRaging: boolean) => FoeTurn

const MOVES: Readonly<Record<NonNullable<Foe['big']>, Move>> = {
  king: (foe, plain, turn, isRaging) => {
    if (turn % 3 === 2) return { ...plain, foe: isRaging ? { ...foe, shield: 1 } : foe, said: [`${TheFoe(foe)} raises his greatsword...`, ...(isRaging ? ['Bones rise to shield him.'] : [])] }
    return turn % 3 === 0 ? { ...plain, times: 2, said: [`${TheFoe(foe)} brings his greatsword down!`] } : plain
  },
  queen: (foe, plain, turn, isRaging) => {
    if (isRaging && turn % 2 === 0) return { ...plain, pierces: true, said: [`${TheFoe(foe)} drags you under!`] }
    if (turn % 3 !== 0) return plain
    const healed = Math.min(foe.maxHp - foe.hp, Math.ceil(foe.maxHp / 10))
    return { ...plain, foe: { ...foe, hp: foe.hp + healed }, said: [`The tide mends ${theFoe(foe)}. +${healed} HP`] }
  },
  hive: (foe, plain, turn, isRaging) => {
    const isSpores = turn % 2 === 0
    const said = isSpores ? [`${TheFoe(foe)}'s spores slip past your armor!`] : isRaging ? ['The swarm bites!'] : []
    return { ...plain, pierces: isSpores, times: isRaging ? 1.5 : 1, said }
  },
  lich: (foe, plain, turn, isRaging) => {
    if (isRaging && turn % 4 === 1) return { ...plain, foe: { ...foe, shield: 1 }, said: [`Ice armor forms on ${theFoe(foe)}.`] }
    if (turn % 3 === 2) return { ...plain, said: ['The air freezes around you...'] }
    return turn % 3 === 0 ? { ...plain, times: 2, said: [`${TheFoe(foe)} looses a frost nova!`] } : plain
  },
  wyrm: (foe, plain, turn, isRaging) => {
    const every = isRaging ? 2 : 3
    if (turn % every === every - 1) return { ...plain, said: [`${TheFoe(foe)} draws a deep breath...`] }
    return turn % every === 0 ? { ...plain, times: 2.5, said: [`${TheFoe(foe)} breathes fire!`] } : plain
  },
}

const bigTurn = (foe: Foe, plain: FoeTurn, turn: number, share: number): FoeTurn => {
  const big = foe.big!
  if (foe.phase !== 2 && share <= 0.5) return { ...plain, foe: { ...foe, phase: 2 }, strikes: false, said: [RAGE[big]] }
  return MOVES[big](foe, plain, turn, foe.phase === 2)
}

/** The hero's blow as the foe's kind takes it: dodged, blunted, or passing through. */
export const heroBlowOn = (g: Game, foe: Foe, dmg: number): { dmg: number; said?: string } => {
  if (foe.glyph === 'r' && roll(g, 5) === 1) return { dmg: 0, said: `${TheFoe(foe)} darts aside.` }
  if (foe.glyph === 's') return { dmg: Math.max(1, dmg - 1) }
  if (foe.glyph === 'W' && isOverlord(foe) && (foe.turn ?? 0) % 4 === 3) return { dmg: 0, said: `${TheFoe(foe)} fades into the dark; your blow passes through.` }
  return { dmg }
}

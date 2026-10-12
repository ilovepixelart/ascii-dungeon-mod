// How each kind of foe fights: one trait a kind, the dangerous ones announced a turn before they land.
import type { Foe, Game } from '../types'
import { roll } from './rng'

/** What the foe's turn comes to before its blow: lines to say, a changed foe, whether it strikes, and how. */
export type FoeTurn = { foe: Foe; said: string[]; strikes: boolean; times: number; pierces: boolean; steals: boolean }

const isOverlord = (foe: Foe) => foe.boss === true

/** The foe's turn: counted, then its kind's trait. */
export const foeTurn = (g: Game, before: Foe): FoeTurn => {
  const turn = (before.turn ?? 0) + 1
  const foe = { ...before, turn }
  const plain: FoeTurn = { foe, said: [], strikes: true, times: 1, pierces: false, steals: false }
  const share = foe.hp / foe.maxHp
  // The uniques' own tricks, in place of their kind's.
  if (foe.unique === 'mire' && turn % 3 === 0) {
    const healed = Math.min(foe.maxHp - foe.hp, Math.ceil(foe.maxHp / 6))
    return { ...plain, foe: { ...foe, hp: foe.hp + healed }, said: [`${foe.name} sinks into the mud and rises whole. +${healed} HP`] }
  }
  if (foe.unique === 'ember') {
    if (turn % 2 === 1) return { ...plain, said: [`${foe.name}'s throat glows white-hot...`] }
    return { ...plain, times: 1.5, said: [`${foe.name} breathes fire!`] }
  }
  switch (foe.glyph) {
    case 'k':
      if (share <= 0.5 && foe.used === undefined) {
        const healed = Math.min(foe.maxHp - foe.hp, Math.ceil(foe.maxHp * 0.3))
        return { ...plain, foe: { ...foe, hp: foe.hp + healed, used: true }, said: [`The ${foe.name} gulps a foul brew. +${healed} HP`], strikes: false }
      }
      return plain
    case 'g':
      return { ...plain, steals: foe.stolen === undefined }
    case 'o':
      return share <= 0.4 ? { ...plain, times: 1.25, said: [`The ${foe.name} roars in rage!`] } : plain
    case 'T': {
      const healed = Math.min(foe.maxHp - foe.hp, Math.ceil(foe.maxHp * 0.02))
      return healed > 0 ? { ...plain, foe: { ...foe, hp: foe.hp + healed }, said: [`The ${foe.name}'s wounds knit. +${healed} HP`] } : plain
    }
    case 'W':
      return turn % 3 === 0 ? { ...plain, pierces: true, said: [`The ${foe.name}'s chill touch passes through your armor!`] } : plain
    case 'D': {
      const every = 3
      if (turn % every === every - 1) return { ...plain, said: [`The ${foe.name} draws a deep breath...`] }
      if (turn % every === 0) return { ...plain, times: isOverlord(foe) ? 2.5 : 1.5, said: [`The ${foe.name} breathes fire!`] }
      return plain
    }
    default:
      return plain
  }
}

/** The hero's blow as the foe's kind takes it: dodged, blunted, or passing through. */
export const heroBlowOn = (g: Game, foe: Foe, dmg: number): { dmg: number; said?: string } => {
  if (foe.glyph === 'r' && roll(g, 5) === 1) return { dmg: 0, said: `The ${foe.name} darts aside.` }
  if (foe.glyph === 's') return { dmg: Math.max(1, dmg - 1) }
  if (foe.glyph === 'W' && isOverlord(foe) && (foe.turn ?? 0) % 4 === 3) return { dmg: 0, said: `The ${foe.name} fades into the dark; your blow passes through.` }
  return { dmg }
}

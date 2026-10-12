import type { Game } from '../types'

// mulberry32: the whole RNG state lives in game.seed, so a game replays exactly.
export const roll = (g: Game, sides: number) => {
  g.seed = (g.seed + 0x6d2b79f5) >>> 0
  let t = g.seed
  t = Math.imul(t ^ (t >>> 15), t | 1)
  t ^= t + Math.imul(t ^ (t >>> 7), t | 61)
  return (((t ^ (t >>> 14)) >>> 0) % sides) + 1
}

export const pick = <T>(g: Game, list: readonly T[]): T => list[roll(g, list.length) - 1] as T

export const hash = (depth: number, col: number, row: number) => {
  let h = Math.imul((depth * 73856093) ^ (col * 19349663) ^ (row * 83492791), 0x45d9f3b)
  h = Math.imul(h ^ (h >>> 16), 0x45d9f3b)
  return ((h ^ (h >>> 16)) >>> 0) % 100
}

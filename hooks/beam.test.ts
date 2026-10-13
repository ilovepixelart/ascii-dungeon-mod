import { describe, expect, test } from 'claude-code/testing'

import type { Game } from '../types'
import { apply, levelOf, newGame } from './game'
import { foeAhead, plainHero } from './fixtures'
import { RARE_KILLS, RARITY_COLOR } from './items'
import { BEAM_H, BEAM_W, HIT_FRAMES, frameOf, hexToInt, hitsBetween } from './pixels'
import type { Hit } from './pixels'

/** A kill of a one-HP orc (no dodge) by the plain hero. */
const killOf = (g: Game) => apply({ ...g, foe: foeAhead(g, 1, { hp: 1, maxHp: 1, glyph: 'o' }) }, { kind: 'attack' })

describe('good loot is never long in coming', () => {
  test('the kill after RARE_KILLS - 1 without a Rare or better leaves one, though it would have left nothing', async () => {
    for (let seed = 1; seed <= 20; seed += 1) {
      const g = { ...plainHero(seed), sinceRare: RARE_KILLS - 1, bag: [] }
      const after = killOf(g)
      expect(after.log.some(l => /^Loot: .* \((Rare|Epic|Legendary)\)\.$/.test(l))).toBe(true)
      expect(after.sinceRare).toBe(0)
    }
  })

  test('a kill that leaves nothing Rare or better counts one; one that does starts the count over', async () => {
    const counts = Array.from({ length: 40 }, (_, i) => {
      const after = killOf({ ...plainHero(i + 1), sinceRare: 3, bag: [] })
      const good = after.log.some(l => /^Loot: .* \((Rare|Epic|Legendary)\)\.$/.test(l))
      return { good, n: after.sinceRare }
    })
    for (const c of counts) expect(c.n).toBe(c.good ? 0 : 4)
    expect(counts.some(c => !c.good)).toBe(true)
  })
})

describe('the beam', () => {
  test('a kill that leaves Rare or better raises a beam of its best tier where the foe fell; a lesser one none', async () => {
    const g = { ...plainHero(4), fresh: 0 }
    const foe = foeAhead(g, 1, { hp: 3 })
    const before = { ...g, foe }
    const after = (lines: string[]): Game => ({ ...g, foe: null, xp: g.xp + 5, log: [...g.log, `You slay the ${foe.name}! +5 XP, +1 gold.`, ...lines], fresh: 1 + lines.length })
    const loot = (h: Hit[]) => h.filter(x => x.kind === 'loot')
    expect(loot(hitsBetween(before, after(['Loot: Band (Rare).'])))).toEqual([{ at: { x: foe.x, y: foe.y }, amount: 0, kind: 'loot', tier: 'rare' }])
    expect(loot(hitsBetween(before, after(['Loot: Health Potion.', 'Loot: Band (Rare).', 'Loot: Crown (Legendary).'])))[0]?.tier).toBe('legendary')
    expect(loot(hitsBetween(before, after(['Loot: Band (Uncommon).'])))).toEqual([])
    // Not a line of this kill's: an old drop in the log raises nothing.
    expect(loot(hitsBetween(before, { ...after([]), log: [...g.log, 'Loot: Old (Epic).', `You slay the ${foe.name}! +5 XP, +1 gold.`], fresh: 1 }))).toEqual([])
  })

  const W = 72
  const H = 56
  const at = (g: Game) => {
    const level = levelOf(g)
    return [[1, 0], [-1, 0], [0, 1], [0, -1]].map(([dx, dy]) => ({ x: g.x + dx!, y: g.y + dy! })).find(p => level.tiles[p.y]?.[p.x] === '.')!
  }
  /** The columns of the frame tinted from the frame without the beam, on the tile's row just above its bottom. */
  const tinted = (tier: 'rare' | 'epic' | 'legendary', hitFrame: number) => {
    const g = newGame(2, 'knight')
    const spot = at(g)
    const plain = frameOf(g, W, H, { hits: [], hitFrame })
    const lit = frameOf(g, W, H, { hits: [{ at: spot, amount: 0, kind: 'loot', tier }], hitFrame })
    const changed: number[] = []
    for (let y = 0; y < H; y += 1) for (let x = 0; x < W; x += 1) if (plain[y * W + x] !== lit[y * W + x] && !changed.includes(x)) changed.push(x)
    let tall = 0
    for (let y = 0; y < H; y += 1) if ([...Array(W).keys()].some(x => plain[y * W + x] !== lit[y * W + x])) tall += 1
    return { columns: changed.length, rows: tall, lit, plain }
  }

  test('is wider the rarer: Rare 2 px, Epic 4, Legendary 6, spark aside', async () => {
    for (const tier of ['rare', 'epic', 'legendary'] as const) expect(tinted(tier, 8).columns).toBeLessThanOrEqual(BEAM_W[tier]! + 2)
    expect(tinted('legendary', 8).columns).toBeGreaterThan(tinted('rare', 8).columns)
  })

  test('grows a few pixels a frame up to its height, and is gone by the blow\'s last frame', async () => {
    // Frames 2 and 6 both without the spark (it shows two frames in four): 8 px of beam, then 24.
    expect(tinted('epic', 2).rows).toBe(8)
    expect(tinted('epic', 6).rows).toBe(24)
    expect(tinted('epic', 12).rows).toBeLessThanOrEqual(BEAM_H + 3)
    expect(tinted('epic', HIT_FRAMES).rows).toBe(0)
  })

  test('is in its tier\'s color, mixed over the floor', async () => {
    const { lit, plain } = tinted('epic', 8)
    const epic = hexToInt(RARITY_COLOR.epic)
    const diffs = [...lit.keys()].filter(i => lit[i] !== plain[i])
    // Toward the tier's color: the blue channel of the epic purple rises over the brown floor.
    expect(diffs.some(i => (lit[i]! & 0xff) > (plain[i]! & 0xff) && (epic & 0xff) > (plain[i]! & 0xff))).toBe(true)
  })
})

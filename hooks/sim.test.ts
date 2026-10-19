import { describe, expect, test } from 'claude-code/testing'

import { apply, newGame } from './game'
import { drawnVsTold, simulate } from './sim'
import { MARKS, tierOf } from './deep'

describe('what the map draws against what the strip and log tell', () => {
  test('a walk over gold and a potion: on every tile the map and the strip agree', async () => {
    // On depth 1 of world 1, the row y 4 holds gold at x 50 and a potion at x 51.
    const g = { ...newGame(), seen: '1'.repeat(64 * 18), x: 48, y: 4 }
    const plan = apply(g, { kind: 'goto', x: 55, y: 4 })
    expect(drawnVsTold(g, plan)).toBe(0)
  })

  test('over simulated games of every class, not one walk tile where they disagree', { timeoutMs: 20000 }, async () => {
    for (const cls of ['knight', 'mage', 'rogue'] as const) for (const seed of [1, 2]) expect(simulate(seed, 600, cls).stats).toMatchObject({ drawnUntold: 0, cutsAstray: 0 })
  })
})

test('the simulated player picks a talent once one is owed', async () => {
  const run = simulate(1, 1500, 'knight')
  expect(run.final.level).toBeGreaterThanOrEqual(10)
  expect(run.final.talents?.length).toBe(Math.floor(run.final.level / 10))
})

test('the simulated player chooses a mark at every fork it reaches', { timeoutMs: 20000 }, async () => {
  const run = simulate(3, 8000, 'knight')
  expect(tierOf(run.final.deepest)).toBeGreaterThanOrEqual(2)
  expect(Object.keys(run.final.marks ?? {}).map(Number)).toEqual(Array.from({ length: tierOf(run.final.deepest) }, (_, i) => i + 1))
  // The stairs take only the easier: a harder one was chosen.
  expect(Object.values(run.final.marks ?? {}).some(m => MARKS[m].hard === true)).toBe(true)
})

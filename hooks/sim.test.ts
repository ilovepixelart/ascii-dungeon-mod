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

/** The first of a few seeds whose run gets as far as `reached` says: any one shows what the player does there. */
const firstRun = (steps: number, reached: (run: ReturnType<typeof simulate>) => boolean) =>
  [1, 2, 3, 4, 5, 6].map(seed => simulate(seed, steps, 'knight')).find(reached)

test('the simulated player picks a talent once one is owed', { timeoutMs: 20000 }, async () => {
  const run = firstRun(1500, r => r.final.level >= 10)!
  expect(run).toBeDefined()
  expect(run.final.talents?.length).toBe(Math.floor(run.final.level / 10))
})

test('the simulated player chooses a mark at every fork it reaches', { timeoutMs: 60000 }, async () => {
  // A run that reached a second tier and took a harder mark there: the stairs alone take only the easier.
  const run = firstRun(8000, r => tierOf(r.final.deepest) >= 2 && Object.values(r.final.marks ?? {}).some(m => MARKS[m].hard === true))!
  expect(run).toBeDefined()
  expect(Object.keys(run.final.marks ?? {}).map(Number)).toEqual(Array.from({ length: tierOf(run.final.deepest) }, (_, i) => i + 1))
  // The stairs take only the easier: a harder one was chosen.
  expect(Object.values(run.final.marks ?? {}).some(m => MARKS[m].hard === true)).toBe(true)
})

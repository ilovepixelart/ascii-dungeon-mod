import { describe, expect, test } from 'claude-code/testing'

import type { Game } from '../types'
import { apply } from './game'
import { plainHero } from './fixtures'
import { MARKS, pairOf } from './deep'
import { arrive } from './world'

const greeted = (g: Game) => {
  const after = apply(g, { kind: 'greet' })
  return after.log.slice(g.log.length)
}
const hero = (over: Partial<Game> = {}): Game => ({ ...plainHero(3), ...over })

describe('a session begun with choices waiting', () => {
  test('talents owed are said, how many, and where to choose them', async () => {
    expect(greeted(hero({ level: 91 }))).toEqual(['9 talents to choose: open the character sheet.'])
    expect(greeted(hero({ level: 12 }))).toEqual(['A talent to choose: open the character sheet.'])
  })

  test('an open fork is said with its two marks', async () => {
    const g = hero({ ...arrive(plainHero(3).world, 110), deepest: 110, bossSlain: 110, level: 5 })
    const [easy, hard] = pairOf(g.world, 7).map(m => MARKS[m].name)
    expect(greeted(g)).toEqual([`The deep forks: tier VII will be ${easy} or ${hard}. Choose on the character sheet.`])
  })

  test('a fork already chosen, or no fork, is not said; nor is a hero with every talent taken', async () => {
    const g = hero({ ...arrive(plainHero(3).world, 110), deepest: 110, bossSlain: 110, level: 5 })
    expect(greeted({ ...g, marks: { 7: pairOf(g.world, 7)[0] } })).toEqual([])
    expect(greeted(hero({ level: 9 }))).toEqual([])
    expect(greeted(hero({ level: 20, talents: ['grudge', 'opener'] }))).toEqual([])
  })

  test('both at once: the talents first, then the fork', async () => {
    const g = hero({ ...arrive(plainHero(3).world, 60), deepest: 60, bossSlain: 60, level: 20 })
    const said = greeted(g)
    expect(said.length).toBe(2)
    expect([said[0], said[1]!.startsWith('The deep forks: tier II')]).toEqual(['2 talents to choose: open the character sheet.', true])
  })

  test('changes nothing else about the game', async () => {
    const g = hero({ level: 91 })
    const { log: _a, ...after } = apply(g, { kind: 'greet' })
    const { log: _b, ...before } = g
    expect(after).toEqual({ ...before, codex: after.codex })
  })
})

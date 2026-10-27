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
    expect(greeted(hero({ level: 45 }))).toEqual(['9 talents to choose: open the character sheet.'])
    expect(greeted(hero({ level: 6 }))).toEqual(['A talent to choose: open the character sheet.'])
  })

  test('an open fork is said with its two marks', async () => {
    const g = hero({ ...arrive(plainHero(3).world, 110), deepest: 110, bossSlain: 110, level: 4 })
    const [easy, hard] = pairOf(g.world, 7).map(m => MARKS[m].name)
    expect(greeted(g)).toEqual([`The Abyss forks: circle VII, The Drowned Stair, takes the blessing ${easy} or the curse ${hard}. Choose in the Abyss.`])
  })

  test('a fork already chosen, or no fork, is not said; nor is a hero with every talent taken', async () => {
    const g = hero({ ...arrive(plainHero(3).world, 110), deepest: 110, bossSlain: 110, level: 4 })
    expect(greeted({ ...g, marks: { 7: pairOf(g.world, 7)[0] } })).toEqual([])
    expect(greeted(hero({ level: 4 }))).toEqual([])
    expect(greeted(hero({ level: 10, talents: ['grudge', 'opener'] }))).toEqual([])
  })

  test('both at once: the talents first, then the fork', async () => {
    const g = hero({ ...arrive(plainHero(3).world, 60), deepest: 60, bossSlain: 60, level: 10 })
    const said = greeted(g)
    expect(said.length).toBe(2)
    expect([said[0], said[1]!.startsWith('The Abyss forks: circle II')]).toEqual(['2 talents to choose: open the character sheet.', true])
  })

  test('changes nothing else about the game, but for opening the talent window on the talents owed', async () => {
    const g = hero({ level: 45 })
    const { log: _a, ...after } = apply(g, { kind: 'greet' })
    const { log: _b, ...before } = g
    expect(after).toEqual({ ...before, codex: after.codex, panel: 'talent', talentOffered: 9 })
  })
})

import { describe, expect, test } from 'claude-code/testing'

import type { Foe, Game, Work } from '../types'
import { apply } from './game'
import { foeAhead, plainHero } from './fixtures'

/** A rogue (no shield block) at 500 HP beside the Bone King, too tough to fall, its turn `turn`: at 2 it raises its
 * greatsword, so its next blow is the heavy one. */
const facing = (turn: number, over: Partial<Foe> = {}): Game => {
  const g = { ...plainHero(3), cls: 'rogue' as const, hp: 500, maxHp: 500 }
  return { ...g, foe: foeAhead(g, 1, { glyph: '&', name: 'Bone King', hp: 9999, maxHp: 9999, atk: 60, opened: true, boss: true, big: 'king', turn, ...over }) }
}
const ok = (g: Game, work?: Work) => apply(g, { kind: 'outcome', ok: true, what: 'Edit', ...(work === undefined ? {} : { work }) })
const brace = (g: Game) => apply(g, { kind: 'brace' })
const NO_HEAVY = 'No heavy blow is coming.'
/** The lines the last action added to the log. */
const told = (g: Game) => g.log.slice(g.log.length - g.fresh)
const struck = (g: Game) => Number(/strikes you for (\d+)/.exec(told(g).join('\n'))?.[1])

describe('bracing', () => {
  test('against a heavy blow warned: the hero holds their guard instead of striking, and the blow lands at half', async () => {
    const g = facing(2)
    const plain = ok(g)
    const braced = ok(brace(g))
    expect(struck(braced)).toBe(Math.ceil(struck(plain) / 2))
    expect(braced.foe?.hp).toBe(9999)
    expect(plain.foe?.hp).toBeLessThan(9999)
    expect(braced.log).toContain('You hold your guard.')
  })

  test('is told on the warning, and said when taken; the guard is spent on the blow it met', async () => {
    // Turn 1 is a plain blow, after which the warning comes for the raised greatsword.
    expect(ok(facing(1)).log.at(-1)).toMatch(/^The Bone King's next blow lands for about \d+\. Brace \(click yourself, or b\) to halve it\.$/)
    const braced = brace(facing(2))
    expect(braced.log.at(-1)).toBe('You brace for the Bone King\'s blow.')
    expect(ok(braced).foe?.guard).toBeUndefined()
  })

  test('a click on the hero braces while a heavy blow is warned; with none, it is the step it always was', async () => {
    const self = (g: Game) => apply(g, { kind: 'goto', x: g.x, y: g.y })
    expect(self(facing(2)).foe?.guard).toBe(true)
    expect(told(self(facing(0)))).not.toContain(NO_HEAVY)
    expect(self(facing(0)).foe?.guard).toBeUndefined()
  })

  test('with no heavy blow coming, or no foe, does nothing but say so', async () => {
    const calm = brace(facing(0))
    expect(calm.foe?.guard).toBeUndefined()
    expect(calm.log.at(-1)).toBe(NO_HEAVY)
    expect(brace({ ...plainHero(3), foe: null }).log.at(-1)).toBe('No heavy blow is coming.')
  })
})

describe('a passing test run against a big boss', () => {
  test('staggers it: it loses its turn, and its count does not move, so its warned blow still comes', async () => {
    const g = facing(2)
    const tested = ok(g, 'tests')
    expect(tested.log).toContain('The tests pass: the Bone King staggers.')
    expect(struck(tested)).toBeNaN()
    expect(tested.foe?.turn).toBe(2)
  })

  test('once a phase: a second run in the same phase is a plain sure blow, and the boss strikes back', async () => {
    const once = ok(facing(1), 'tests')
    const twice = ok(once, 'tests')
    expect(told(twice)).not.toContain('The tests pass: the Bone King staggers.')
    expect(struck(twice)).toBeGreaterThan(0)
    // In its second phase it staggers again.
    const raging = ok({ ...twice, foe: { ...twice.foe!, phase: 2 } }, 'tests')
    expect(told(raging)).toContain('The tests pass: the Bone King staggers.')
  })

  test('a lesser foe is not staggered', async () => {
    const g = facing(1, { big: undefined, boss: undefined, name: 'orc', glyph: 'o' })
    expect(struck(ok(g, 'tests'))).toBeGreaterThan(0)
  })
})

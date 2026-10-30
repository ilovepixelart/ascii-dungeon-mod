import { describe, expect, test } from 'claude-code/testing'

import type { Foe } from '../types'
import { apply, newGame, threat } from './game'
import { foeAhead, plainHero } from './fixtures'
import { foeTurn, heroBlowOn } from './patterns'
import { plainItem } from './items'

/** A foe of `glyph` beside the bare hero, 100 HP. */
const foe = (glyph: string, over: Partial<Foe> = {}): Foe => ({ ...foeAhead(plainHero(), 1, { glyph, name: `${glyph}-foe`, hp: 100, maxHp: 100, atk: 10 }), ...over })

describe("each kind's trait", () => {
  test('a kobold at half HP drinks back 30% of its max once, and strikes no blow that turn', async () => {
    const t = foeTurn(plainHero(), foe('k', { hp: 50 }))
    expect([t.foe.hp, t.strikes, t.foe.used]).toEqual([80, false, true])
    expect(t.said).toEqual(['The k-foe gulps a foul brew. +30 HP'])
    expect(foeTurn(plainHero(), { ...t.foe, hp: 40 }).strikes).toBe(true)
    expect(foeTurn(plainHero(), foe('k', { hp: 51 })).strikes).toBe(true)
  })

  test('an orc at 40% HP or less hits a quarter harder', async () => {
    expect(foeTurn(plainHero(), foe('o', { hp: 40 })).times).toBe(1.25)
    expect(foeTurn(plainHero(), foe('o', { hp: 41 })).times).toBe(1)
  })

  test('a troll knits 2% of its max HP each turn, never past full', async () => {
    expect(foeTurn(plainHero(), foe('T', { hp: 50 })).foe.hp).toBe(52)
    expect(foeTurn(plainHero(), foe('T', { hp: 100 })).foe.hp).toBe(100)
  })

  test("a wraith's every third blow passes through armor", async () => {
    expect([0, 1, 2].map(turn => foeTurn(plainHero(), foe('W', { turn })).pierces)).toEqual([false, false, true])
  })

  test("a blow through armor meets a knight's half defense, rounded down, and none of another class's", async () => {
    const taken = (cls: 'knight' | 'rogue', turn: number) => {
      const g = { ...plainHero(), cls, hp: 100, maxHp: 100 }
      const armored = { ...g, gear: { ...g.gear, armor: { ...plainItem({ nextId: 901 }, 'plate'), def: 11 } } }
      return 100 - apply({ ...armored, foe: foe('W', { atk: 21, turn, opened: true }) }, { kind: 'outcome', ok: false, what: 'Bash' }).hp
    }
    // Depth 1, K 9.9: defense 11 lets 9.9 / 20.9 of the plain 21 through, 9.9; through armor a knight keeps 5 of it,
    // 9.9 / 14.9 of 21 being 14.0, and a rogue none.
    expect([taken('knight', 0), taken('knight', 2), taken('rogue', 0), taken('rogue', 2)]).toEqual([10, 14, 10, 21])
  })

  test('a dragon draws breath on its second turn of three and breathes on the third, half again as hard; an overlord two and a half times', async () => {
    const turns = [0, 1, 2].map(turn => foeTurn(plainHero(), foe('D', { turn })))
    expect(turns.map(t => t.times)).toEqual([1, 1, 1.5])
    expect(turns[1]!.said).toEqual(['The D-foe draws a deep breath...'])
    expect(turns[2]!.said).toEqual(['The D-foe breathes fire!'])
    expect(foeTurn(plainHero(), foe('D', { turn: 2, boss: true })).times).toBe(2.5)
  })

  test('a goblin steals only while it has not yet', async () => {
    expect(foeTurn(plainHero(), foe('g')).steals).toBe(true)
    expect(foeTurn(plainHero(), foe('g', { stolen: 0 })).steals).toBe(false)
  })

  test('a rat dodges about one blow in five; a skeleton blunts each by 1, never below 1; a wraith overlord fades every fourth turn', async () => {
    const g = plainHero()
    const dodged = Array.from({ length: 1000 }, () => heroBlowOn(g, foe('r'), 5).dmg === 0).filter(Boolean).length
    expect(dodged).toBeGreaterThan(150)
    expect(dodged).toBeLessThan(250)
    expect([heroBlowOn(g, foe('s'), 5).dmg, heroBlowOn(g, foe('s'), 1).dmg]).toEqual([4, 1])
    expect([0, 1, 2, 3, 4].map(turn => heroBlowOn(g, foe('W', { boss: true, turn }), 5).dmg)).toEqual([5, 5, 5, 0, 5])
    expect(heroBlowOn(g, foe('W', { turn: 3 }), 5).dmg).toBe(5)
  })
})

describe('the traits in a fight', () => {
  test("a goblin's first landed blow takes 2 gold a depth, given back with its gold when it falls", async () => {
    const g = { ...plainHero(), depth: 3, gold: 50, foe: foe('g', { opened: true }) }
    const robbed = apply(g, { kind: 'outcome', ok: false, what: 'Bash' })
    expect([robbed.gold, robbed.foe?.stolen]).toEqual([44, 6])
    expect(robbed.log).toContain('The g-foe snatches 6 gold!')
    const slain = apply({ ...robbed, foe: { ...robbed.foe!, hp: 1 } }, { kind: 'attack' })
    // The same kill, the same dice, with nothing stolen: exactly the 6 less.
    const honest = apply({ ...robbed, foe: { ...robbed.foe!, hp: 1, stolen: 0 } }, { kind: 'attack' })
    expect(slain.gold - honest.gold).toBe(6)
  })

  test('a kobold drinking its brew strikes no blow that turn', async () => {
    const g = plainHero()
    const after = apply({ ...g, foe: foe('k', { hp: 50, opened: true }) }, { kind: 'outcome', ok: false, what: 'Bash' })
    expect([after.hp, after.foe?.hp]).toEqual([g.hp, 80])
  })

  test("a wraith's chill ignores a rogue's armor; a plain blow does not", async () => {
    const armored = { ...plainHero(), cls: 'rogue' as const, gear: { ...plainHero().gear, armor: { ...plainHero().gear.weapon!, slot: 'armor' as const, atk: 0, def: 4, id: 901 } } }
    const hit = (turn: number) => armored.hp - apply({ ...armored, foe: foe('W', { turn, opened: true }) }, { kind: 'outcome', ok: false, what: 'Bash' }).hp
    // Depth 1, K 9.9: 4 defense lets 9.9 / 13.9 of the wraith's 10 through, 7.1; the chill all of it.
    expect([hit(0), hit(2)]).toEqual([7, 10])
  })

  test('a heavy blow, a breath or any blow a turn makes harder, takes at most 60% of max HP; a plain blow is as hard as it is', async () => {
    const g = { ...plainHero(), hp: 100, maxHp: 100 }
    // The blow as told: the hero's standing orders drink a potion after a big one.
    const taken = (over: Partial<Foe>) => Number(/strikes you for (\d+)\./.exec(apply({ ...g, foe: foe('D', { opened: true, ...over }) }, { kind: 'outcome', ok: false, what: 'Bash' }).log.join('\n'))?.[1])
    // No defense, all of it: a plain 80; a breath of 1.5 times 50 is 75, held at 60; an overlord's 2.5 times 40, 100, too.
    expect([taken({ atk: 80, turn: 0 }), taken({ atk: 50, turn: 2 }), taken({ atk: 40, turn: 2, boss: true })]).toEqual([80, 60, 60])
  })

  test('a blow its next turn makes heavier is told the turn before, with about what it will take', async () => {
    const g = { ...plainHero(), hp: 100, maxHp: 100 }
    // Turn 2 draws breath; turn 3 breathes, 1.5 times 30 with no defense: 45.
    const after = apply({ ...g, foe: foe('D', { atk: 30, turn: 1, opened: true }) }, { kind: 'outcome', ok: false, what: 'Bash' })
    expect(after.log).toContain('The D-foe draws a deep breath...')
    expect(after.log.at(-1)).toBe("The D-foe's next blow lands for about 45.")
    // A plain turn next: nothing told.
    const plain = apply({ ...g, foe: foe('D', { atk: 30, turn: 3, opened: true }) }, { kind: 'outcome', ok: false, what: 'Bash' })
    expect(plain.log.some(l => l.includes('next blow'))).toBe(false)
  })

  test("a foe's threat counts its blows through armor as they land, and its next heavy one against the hero's HP now", async () => {
    // Depth 100: K is 99, so 99 defense halves a blow; a foe of 60 lands 30, 4 blows to 100 HP: tough. Taking defense
    // off, 60 less 99 left 1 a blow: easy.
    const armor = { ...plainItem({ nextId: 901 }, 'plate'), def: 99 }
    const deep = { ...plainHero(), depth: 100, deepest: 100, hp: 100, maxHp: 100, gear: { ...plainHero().gear, armor } }
    expect(threat({ ...deep, foe: foe('o', { atk: 60 }) })).toBe('tough')
    // A dragon overlord whose next turn breathes: 2.5 times 30 is 75, held at 60 of 100, enough to slay a hero at 50.
    const g = { ...plainHero(), hp: 50, maxHp: 100 }
    expect(threat({ ...g, foe: foe('D', { atk: 30, turn: 2, boss: true }) })).toBe('deadly')
    expect(threat({ ...g, hp: 100, foe: foe('D', { atk: 30, turn: 2, boss: true }) })).toBe('tough')
  })

  test('a dragon breathes for half again its attack', async () => {
    const g = plainHero()
    const hit = (turn: number) => g.hp - apply({ ...g, hp: 99, maxHp: 99, foe: foe('D', { turn, opened: true }) }, { kind: 'outcome', ok: false, what: 'Bash' }).hp - (g.hp - 99)
    expect([hit(0), hit(2)]).toEqual([10, 15])
  })
})

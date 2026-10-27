import { describe, expect, test } from 'claude-code/testing'

import type { Foe, Game } from '../types'
import { UNIQUES, apply, bandOf, isBossDepth, uniqueDepth } from './game'
import { foeAtk, foeHp } from './balance'
import { plainHero } from './fixtures'
import { foeTurn } from './patterns'
import { arrive } from './world'
import { killerName } from './death'
import { CHAMPION_MARK, frameOf, hexToInt } from './pixels'

const WORLD = 4
const at = (depth: number, over: Partial<Game> = {}): Game => ({ ...plainHero(WORLD), world: WORLD, ...arrive(WORLD, depth), deepest: depth, level: 30, ...over })
const summon = (g: Game) => apply({ ...g, foe: null }, { kind: 'summon', name: 'ls' })

describe('where a unique waits', () => {
  test('one depth a band of five, never its first and never its boss depth, the same every time', async () => {
    for (let band = 0; band < 12; band += 1) {
      const d = uniqueDepth(WORLD, band)
      expect(bandOf(d)).toBe(band)
      expect(d % 5).not.toBe(1)
      expect(isBossDepth(d)).toBe(false)
      expect(uniqueDepth(WORLD, band)).toBe(d)
    }
  })

  test('on its depth the next foe is it, announced; elsewhere, or once slain, foes are as ever', async () => {
    const d = uniqueDepth(WORLD, 1)
    const met = summon(at(d))
    expect(met.foe).toMatchObject({ name: 'Mother Mire', glyph: 'T', unique: 'mire' })
    expect(met.log).toContain('The ground trembles. Mother Mire is here!')
    expect(met.toast).toBe('Mother Mire is here!')
    expect(summon(at(d === 9 ? 8 : 9)).foe?.unique).toBeUndefined()
    expect(summon(at(d, { uniquesSlain: [1] })).foe?.unique).toBeUndefined()
  })

  test('one that slew the hero waits for them a level stronger; slain by another, it is there as ever', async () => {
    const d = uniqueDepth(WORLD, 0)
    const g = at(d, { level: 3 })
    const met = summon(g)
    const slain = apply({ ...met, hp: 1, belt: met.belt.map(() => null), foe: { ...met.foe!, atk: 50, opened: true } }, { kind: 'outcome', ok: false, what: 'Bash' })
    expect([slain.deaths, slain.uniqueWon]).toEqual([g.deaths + 1, { 0: 3 }])
    const back = { ...slain, ...arrive(WORLD, d) }
    expect(summon(back).foe?.unique).toBeUndefined()
    expect(summon({ ...back, level: 4 }).foe?.unique).toBe('bones')
    expect(summon({ ...at(d), uniqueWon: { 1: 50 } }).foe?.unique).toBe('bones')
  })

  test('each theme has its own: Old Bones the skeleton, Mother Mire the troll, the Rotking, Rimehide, Emberjaw the drake', async () => {
    expect([0, 1, 2, 3, 4].map(b => summon(at(uniqueDepth(WORLD, b))).foe?.name)).toEqual(['Old Bones', 'Mother Mire', 'the Rotking', 'Rimehide', 'Emberjaw'])
    expect(Object.values(UNIQUES).map(u => u.glyph)).toEqual(['s', 'T', 'k', 'o', 'D'])
  })

  test('half again the HP of its kind at its strongest roll, a tenth more attack', async () => {
    const d = uniqueDepth(WORLD, 1)
    const foe = summon(at(d)).foe!
    // A troll is tier 5.
    expect(foe.maxHp).toBe(foeHp(d, 5, 4) * 1.5)
    expect(foe.atk).toBe(Math.round(foeAtk(d, 5, 2) * 1.1))
  })
})

describe('on the map', () => {
  test('a unique wears a gold crown and gold pips, as a boss does', async () => {
    const met = summon(at(uniqueDepth(WORLD, 0)))
    const gold = hexToInt(CHAMPION_MARK)
    const count = (g: Game) => [...frameOf(g, 72, 56, {})].filter(p => p === gold).length
    const { unique: _, ...plain } = met.foe!
    expect(count(met)).toBeGreaterThan(count({ ...met, foe: plain }) + 8)
  })
})

describe('their tricks', () => {
  test('Old Bones, struck down, pulls itself back together once with a third of its HP; the second time it stays down', async () => {
    const d = uniqueDepth(WORLD, 0)
    const met = summon(at(d))
    const struck = apply({ ...met, foe: { ...met.foe!, hp: 1 } }, { kind: 'attack' })
    expect(struck.foe).toMatchObject({ name: 'Old Bones', hp: Math.ceil(met.foe!.maxHp / 3), risen: true })
    expect(struck.log.some(l => l.endsWith('It clatters apart... and pulls itself back together!'))).toBe(true)
    const down = apply({ ...struck, foe: { ...struck.foe!, hp: 1 } }, { kind: 'attack' })
    expect(down.foe).toBeNull()
  })

  test('Mother Mire rises whole by a sixth of her HP every third turn, and knits as a troll between', async () => {
    const mire: Foe = { glyph: 'T', name: 'Mother Mire', hp: 50, maxHp: 120, atk: 10, xp: 1, x: 0, y: 0, unique: 'mire', turn: 2 }
    const t = foeTurn(at(7), mire)
    expect(t.foe.hp).toBe(70)
    // Her other turns are a troll's: its wounds knit 2%, 3 of 120.
    expect(foeTurn(at(7), { ...mire, turn: 0 }).foe.hp).toBe(53)
  })

  test('Emberjaw glows one turn and breathes fire the next, half again as hard', async () => {
    const ember: Foe = { glyph: 'D', name: 'Emberjaw', hp: 50, maxHp: 120, atk: 10, xp: 1, x: 0, y: 0, unique: 'ember', turn: 0 }
    const glow = foeTurn(at(12), ember)
    expect([glow.times, glow.said]).toEqual([1, ["Emberjaw's throat glows white-hot..."]])
    const fire = foeTurn(at(12), { ...ember, turn: 1 })
    expect([fire.times, fire.said]).toEqual([1.5, ['Emberjaw breathes fire!']])
  })

  test('the Rotking\'s spores slip past armor every other turn', async () => {
    const rot: Foe = { glyph: 'k', name: 'the Rotking', hp: 50, maxHp: 80, atk: 8, xp: 1, x: 0, y: 0, unique: 'rot', turn: 0 }
    const turns = [0, 1, 2, 3].map(turn => foeTurn(at(13), { ...rot, turn }))
    expect(turns.map(t => t.pierces)).toEqual([false, true, false, true])
    expect(turns[1]!.said).toEqual(["the Rotking's spores slip past your armor!"])
  })

  test('Rimehide gathers frost one turn and brings it down double the next; a third turn plain', async () => {
    const rime: Foe = { glyph: 'o', name: 'Rimehide', hp: 60, maxHp: 90, atk: 9, xp: 1, x: 0, y: 0, unique: 'rime', turn: 0 }
    const turns = [0, 1, 2].map(turn => foeTurn(at(18), { ...rime, turn }))
    expect(turns.map(t => t.times)).toEqual([1, 1, 2])
    expect(turns[1]!.said).toEqual(["Frost gathers on Rimehide's axe..."])
    expect(turns[2]!.said).toEqual(['Rimehide brings down a frost blow!'])
  })

  test('slain, it leaves an Epic or better, is toasted, and its band\'s is done', async () => {
    const d = uniqueDepth(WORLD, 4)
    const met = summon(at(d, { bag: [] }))
    const won = apply({ ...met, foe: { ...met.foe!, hp: 1 } }, { kind: 'attack' })
    expect(won.foe).toBeNull()
    expect(won.uniquesSlain).toEqual([4])
    expect(won.log.some(l => /^Emberjaw is no more\. It leaves .+ \((Epic|Legendary)\)\.$/.test(l))).toBe(true)
    expect(won.toast).toBe('Emberjaw slain!')
  })
})

describe('how a unique is named in the log', () => {
  /** "the" or "The" put before a unique's own name: "the the Rotking", "The Old Bones". */
  const WRONG = new RegExp(`\\b[Tt]he (${Object.values(UNIQUES).map(u => u.name.replace(/^the /, 'the ')).join('|')})\\b`)
  const SMOKE = { kind: 'smoke' as const, tiers: [3, 0, 0] as [number, number, number] }

  /** A long fight with each theme's unique: blows both ways, the hero's own attack, a smoke escape, and a fall. */
  const fights = () => [0, 1, 2, 3, 4].flatMap(band => {
    let g = summon(at(uniqueDepth(WORLD, band), { maxHp: 999, hp: 999 }))
    const lines = [...g.log]
    for (let i = 0; i < 30; i += 1) {
      g = apply({ ...g, hp: 999 }, i % 3 === 2 ? { kind: 'attack' } : { kind: 'outcome', ok: i % 2 === 0, what: 'Bash' })
      lines.push(...g.log.slice(g.log.length - g.fresh))
    }
    const met = summon(at(uniqueDepth(WORLD, band)))
    const smoked = apply({ ...met, belt: met.belt.map((s, i) => (i === 4 ? SMOKE : s)) }, { kind: 'use', slot: 4 })
    const fell = apply({ ...met, hp: 1, foe: met.foe === null ? null : { ...met.foe, atk: 999, opened: true } }, { kind: 'outcome', ok: false, what: 'Bash' })
    return [...lines, ...smoked.log.slice(-smoked.fresh), ...fell.log.slice(-fell.fresh), fell.toast ?? '']
  })

  test('no line puts "the" before a unique\'s own name', async () => {
    const all = fights()
    expect(all.length).toBeGreaterThan(150)
    expect(all.filter(l => WRONG.test(l))).toEqual([])
  })

  test('a fall to a unique keeps it for the death window, named as it names itself', async () => {
    const met = summon(at(uniqueDepth(WORLD, 2)))
    const fell = apply({ ...met, hp: 1, foe: { ...met.foe!, atk: 999, opened: true } }, { kind: 'outcome', ok: false, what: 'Bash' })
    expect(fell.fallen?.foe?.unique).toBe('rot')
    expect(killerName(fell.fallen!)).toBe('the Rotking')
  })

  test('a sentence that starts with the Rotking capitalizes its article, and the others read bare', async () => {
    const all = fights()
    expect(all.some(l => l.startsWith('The Rotking '))).toBe(true)
    expect(all.some(l => /^(Old Bones|Mother Mire|Rimehide|Emberjaw) /.test(l))).toBe(true)
  })
})

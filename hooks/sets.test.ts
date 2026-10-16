import { describe, expect, test } from 'claude-code/testing'

import type { ClassSet, Foe, Game, HeroClass, Item } from '../types'
import { apply } from './game'
import { foeAhead, plainHero } from './fixtures'
import { SETS, SET_COLOR, gearBonus, heirloomOf, plainItem, reforgeItem, setPiece } from './items'
import { card } from './bagui'
import { itemCard } from './inventory'
import { arrive } from './world'

const SLOT_OF: Readonly<Record<string, 'weapon' | 'armor' | 'helm'>> = { sword: 'weapon', scepter: 'weapon', rapier: 'weapon', plate: 'armor', vestments: 'armor', cloak: 'armor', hornedHelm: 'helm', circlet: 'helm', cowl: 'helm' }
/** Piece `i` of the set, plain, as the set names it. */
const piece = (g: Game, set: ClassSet, i: number): Item => {
  const p = SETS[set].pieces[i]!
  return { ...plainItem(g, p.base, 'epic'), name: p.name, set }
}
/** A hero of the class wearing the first `n` pieces of its set. */
const wearing = (cls: HeroClass, set: ClassSet, n: number, seed = 3): Game => {
  const g = { ...plainHero(seed), cls }
  const gear = Object.fromEntries(Array.from({ length: n }, (_, i) => { const p = piece(g, set, i); return [SLOT_OF[p.base]!, p] }))
  return { ...g, gear: { ...g.gear, ...gear } }
}
const tough = (g: Game, over: Partial<Foe> = {}) => foeAhead(g, 1, { hp: 999, maxHp: 999, atk: 30, ...over })
const ok = (g: Game) => apply(g, { kind: 'outcome', ok: true, what: 'Edit' })
const failed = (g: Game) => apply(g, { kind: 'outcome', ok: false, what: 'Bash' })
const text = (lines: { text: string }[][]) => lines.map(l => l.map(r => r.text).join(''))

describe('the pieces', () => {
  test('an Epic of its base with its own name and set, and no trigger', async () => {
    const g = plainHero(3)
    const p = setPiece(g, 'oathbound')
    expect(p).toMatchObject({ rarity: 'epic', set: 'oathbound' })
    expect(p.trigger).toBeUndefined()
    expect(SETS.oathbound.pieces).toContainEqual({ base: p.base, name: p.name })
  })

  test('a piece the hero has nowhere comes first; with all three owned, any', async () => {
    const g = plainHero(3)
    const [blade, plate] = [piece(g, 'oathbound', 0), piece(g, 'oathbound', 1)]
    expect(setPiece({ ...g, bag: [{ ...blade, x: 0, y: 0 }], stashed: [plate] }, 'oathbound').name).toBe('Oathbound Helm')
    const helm = piece(g, 'oathbound', 2)
    const all = { ...g, gear: { ...g.gear, helm }, bag: [{ ...blade, x: 0, y: 0 }], stashed: [plate] }
    const names = new Set(Array.from({ length: 40 }, (_, depth) => setPiece({ ...all, depth: depth + 1 }, 'oathbound').name))
    expect(names.size).toBeGreaterThan(1)
  })

  test('a reforge rolls its stats, keeping its name and set, and gives it no trigger', async () => {
    const p = { ...piece(plainHero(3), 'nightglass', 1), def: 1 }
    for (const seed of [1, 2, 3, 4, 5, 6, 7, 8]) {
      const r = reforgeItem({ ...plainHero(seed), seed }, p)
      expect([r.name, r.set, r.trigger]).toEqual([p.name, 'nightglass', undefined])
    }
  })

  test('an heirloom keeps its set', async () => {
    expect(heirloomOf(piece(plainHero(3), 'archivist', 0)).set).toBe('archivist')
  })
})

describe('where they drop', () => {
  /** What the big boss (or guardian) of `depth` leaves a hero of the class in world `world`. */
  const bossFind = (world: number, depth: number, cls: HeroClass) => {
    const g0 = { ...plainHero(world), cls, level: 200 }
    const g = apply({ ...g0, ...arrive(g0.world, depth), deepest: depth, bossSlain: 0, bag: [] }, { kind: 'descend' })
    const slain = apply({ ...g, foe: { ...g.foe!, hp: 1 } }, { kind: 'attack' })
    return slain.bag.find(i => i.rarity !== 'common')
  }

  test('about half a big boss\'s Epics are a piece of the hero\'s class\'s set', async () => {
    const finds = Array.from({ length: 40 }, (_, i) => bossFind(i + 1, 10 * (1 + (i % 4)), 'mage'))
    const sets = finds.filter(i => i?.set !== undefined)
    expect(sets.every(i => i!.set === 'archivist')).toBe(true)
    expect([sets.length >= 10, sets.length <= 30]).toEqual([true, true])
  })

  test('a lesser guardian leaves none', async () => {
    expect(Array.from({ length: 20 }, (_, i) => bossFind(i + 1, 15, 'knight')).some(i => i?.set !== undefined)).toBe(false)
  })
})

describe('two worn', () => {
  test('Oathbound: +2 def; one piece, nothing', async () => {
    const [one, two] = [wearing('knight', 'oathbound', 1), wearing('knight', 'oathbound', 2)]
    expect(gearBonus(two, 'def') - (two.gear.weapon!.def + two.gear.armor!.def)).toBe(2)
    expect(gearBonus(one, 'def') - one.gear.weapon!.def).toBe(0)
  })

  test('Archivist\'s: +10% XP; Nightglass: +5% crit', async () => {
    const mage = wearing('mage', 'archivist', 2)
    expect(gearBonus(mage, 'xp') - (mage.gear.weapon!.xp + mage.gear.armor!.xp)).toBe(10)
    const rogue = wearing('rogue', 'nightglass', 2)
    expect(gearBonus(rogue, 'crit') - (rogue.gear.weapon!.crit + rogue.gear.armor!.crit)).toBe(5)
  })
})

describe('three worn', () => {
  test('Oathbound: the shield turns the first blow of a fight and halves the second, rounded up; two pieces, only the first', async () => {
    const blows = (g: Game) => {
      let x: Game = { ...g, hp: 999, maxHp: 999, foe: tough(g) }
      const out = []
      for (let i = 0; i < 3; i += 1) {
        x = failed({ ...x, log: [] })
        out.push(x.log.some(l => l.startsWith('Your shield turns')) ? 'turned' : Number(x.log.find(l => / strikes you for/.test(l))?.match(/for (\d+)/)?.[1]))
      }
      return out
    }
    // The third blow lands whole: the second, against the same defense, is half of it.
    const three = blows(wearing('knight', 'oathbound', 3))
    expect(three).toEqual(['turned', Math.ceil((three[2] as number) / 2), three[2]])
    const two = blows(wearing('knight', 'oathbound', 2))
    expect([two[0], two[1]]).toEqual(['turned', two[2]])
  })

  test('Oathbound with Bulwark: the second blow halved twice, and said', async () => {
    const g = { ...wearing('knight', 'oathbound', 3), hp: 999, maxHp: 999 }
    const ring = { ...plainItem(g, 'ring', 'rare'), trigger: 'bulwark' as const }
    const x = failed(failed({ ...g, gear: { ...g.gear, ring }, foe: tough(g) }))
    expect(x.log.some(l => l.endsWith(', three quarters of it turned.'))).toBe(true)
  })

  test('Nightglass: the first two strikes of a fight are sure criticals; two pieces, only the first', async () => {
    const crits = (g: Game) => {
      let x: Game = { ...g, foe: tough(g, { atk: 0 }) }
      const out = []
      for (let i = 0; i < 2; i += 1) {
        x = ok({ ...x, log: [] })
        out.push(x.log.some(l => l.startsWith('You CRITICALLY')))
      }
      return [...out, x.foe!.opened === true]
    }
    expect(crits(wearing('rogue', 'nightglass', 3))).toEqual([true, true, true])
    // With two pieces the first is sure and the foe is opened; the second is left to chance.
    const two = crits(wearing('rogue', 'nightglass', 2))
    expect([two[0], two[2]]).toEqual([true, true])
    const plainSecond = [1, 2, 3, 4, 5, 6].map(seed => crits({ ...wearing('rogue', 'nightglass', 2), seed })[1])
    expect(plainSecond.includes(false)).toBe(true)
  })

  test('Archivist\'s: siphon restores a quarter of max HP, not a fifth', async () => {
    const at = (g: Game) => ({ ...g, hp: 1, maxHp: 20, foe: foeAhead(g, 1, { hp: 1, maxHp: 1, opened: true }) })
    expect(ok(at(wearing('mage', 'archivist', 3))).hp).toBe(1 + 5)
    expect(ok(at(wearing('mage', 'archivist', 2))).hp).toBe(1 + 4)
  })

  test('another class\'s whole set strengthens nothing', async () => {
    const g = { ...wearing('rogue', 'oathbound', 3), cls: 'knight' as const }
    const off = { ...g, cls: 'mage' as const, hp: 1, maxHp: 20, foe: foeAhead(g, 1, { hp: 1, maxHp: 1, opened: true }) }
    expect(ok(off).hp).toBe(1 + 4)
  })
})

describe('on the item card', () => {
  test('the set and how many are worn, each bonus in the set\'s color once reached, dim until then', async () => {
    const g = wearing('knight', 'oathbound', 2)
    const lines = card(g, g.gear.armor!, undefined, true)
    const t = text(lines)
    const at = t.indexOf('Oathbound, 2 of 3 worn')
    expect(at).toBeGreaterThan(0)
    expect(lines[at]![0]).toMatchObject({ color: SET_COLOR, bold: true })
    expect(t.slice(at + 1, at + 4)).toEqual(['2: +2 def', '3: Shield block turns the first', 'blow of a fight and halves the'])
    expect(lines[at + 1]![0]!.color).toBe(SET_COLOR)
    expect(lines[at + 2]![0]).toMatchObject({ dim: true })
    expect(t[at + 5]).toMatch(/^Sells for /)
  })

  test('as text, on one line', async () => {
    const g = wearing('knight', 'oathbound', 1)
    const item = { ...piece(g, 'oathbound', 1), x: 0, y: 0 }
    expect(text(itemCard({ ...g, bag: [item], cursor: item.id }))).toContain('Oathbound, 1 of 3 worn: 2, +2 def; 3, Shield block turns the first blow of a fight and halves the second.')
  })
})

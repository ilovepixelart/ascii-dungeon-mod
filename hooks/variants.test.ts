import { describe, expect, test } from 'claude-code/testing'

import type { Game } from '../types'
import { VARIANT_NAME, apply, kindName, levelOf } from './game'
import { frameOf } from './pixels'
import { MONSTER_ART, MONSTER_VARIANT, monsterArt } from './pixelart'
import { plainHero } from './fixtures'
import { arrive } from './world'

describe('a theme\'s own monsters', () => {
  test('the crypt draws every monster as it is; the others their variants, the same shape in other colors', async () => {
    for (const glyph of Object.keys(MONSTER_ART)) expect(monsterArt(glyph, 'crypt')).toBe(MONSTER_ART[glyph])
    for (const [theme, kinds] of Object.entries(MONSTER_VARIANT)) {
      for (const [glyph, swap] of Object.entries(kinds)) {
        const base = MONSTER_ART[glyph]!
        const art = monsterArt(glyph, theme)!
        expect(art).not.toEqual(base)
        art.forEach((row, y) => [...row].forEach((k, x) => {
          const was = base[y]![x]!
          expect(k).toBe(swap[was] ?? was)
        }))
      }
    }
  })

  test('every variant drawn has a name, and every name a drawn variant', async () => {
    for (const theme of ['flooded', 'forge'] as const) {
      expect(Object.keys(VARIANT_NAME[theme]!).sort()).toEqual(Object.keys(MONSTER_VARIANT[theme]).sort())
    }
  })

  test('a foe takes its theme\'s name: a bog rat in the flooded halls, a cinder goblin in the forge, a goblin in the crypt', async () => {
    expect(kindName('r', 7)).toBe('bog rat')
    expect(kindName('g', 12)).toBe('cinder goblin')
    expect(kindName('g', 2)).toBe('goblin')
    expect(kindName('T', 7)).toBe('troll')
    const names = new Set<string>()
    // The band's unique slain, so depth 12 brings its ordinary foes.
    let g = { ...plainHero(4), world: 4, ...arrive(4, 12), deepest: 12, uniquesSlain: [2] }
    for (let i = 0; i < 120; i += 1) {
      g = apply({ ...g, foe: null, tension: 0, calm: 0 }, { kind: 'summon', name: 'ls' })
      names.add(g.foe!.name.replace(/^(Tough|Savage|Shielded|Vampiric) /, '').replace(/ of ls$/, ''))
    }
    expect(names.has('cinder goblin')).toBe(true)
    expect(names.has('goblin')).toBe(false)
  })

  test('the map draws the theme\'s variant: a goblin adds far more red in the forge than in the crypt', async () => {
    /** Red less green over the pixels a goblin beside the hero adds to the frame. */
    const lean = (depth: number) => {
      const g = { ...plainHero(4), world: 4, ...arrive(4, depth), deepest: depth } as Game
      const level = levelOf(g)
      const at = [[1, 0], [-1, 0], [0, 1], [0, -1]].map(([dx, dy]) => ({ x: g.x + dx!, y: g.y + dy! })).find(p => level.tiles[p.y]?.[p.x] === '.')!
      const plain = frameOf(g, 72, 56, {})
      const withFoe = frameOf({ ...g, foe: { glyph: 'g', name: 'goblin', hp: 9, maxHp: 9, atk: 3, xp: 3, ...at } }, 72, 56, {})
      let sum = 0
      for (let i = 0; i < plain.length; i += 1) if (plain[i] !== withFoe[i]) sum += ((withFoe[i]! >> 16) & 0xff) - ((withFoe[i]! >> 8) & 0xff)
      return sum
    }
    // Both carry the same red health bar: the forge's cinder goblin leans far redder than the crypt's green one.
    expect(lean(12) - lean(2)).toBeGreaterThan(2000)
  })
})

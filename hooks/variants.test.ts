import { describe, expect, test } from 'claude-code/testing'

import type { Game } from '../types'
import { VARIANT_NAME, apply, kindName, levelOf } from './game'
import { frameOf, originAt } from './pixels'
import { MONSTER_ART, MONSTER_VARIANT, UNIQUE_ART, monsterArt } from './pixelart'
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
    expect(kindName('g', 22)).toBe('cinder goblin')
    expect(kindName('g', 12)).toBe('toadstool goblin')
    expect(kindName('g', 2)).toBe('goblin')
    expect(kindName('T', 7)).toBe('moss troll')
    expect(kindName('T', 2)).toBe('troll')
    const names = new Set<string>()
    // The band's unique slain, so depth 22 brings its ordinary foes.
    let g = { ...plainHero(4), world: 4, ...arrive(4, 22), deepest: 22, uniquesSlain: [4] }
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
    expect(lean(22) - lean(2)).toBeGreaterThan(2000)
  })
})

test('every kind has its own look and name in every theme past the crypt', async () => {
  const DEPTH = { flooded: 7, fungal: 12, frozen: 17, forge: 22 } as const
  for (const theme of ['flooded', 'fungal', 'frozen', 'forge'] as const) {
    const depth = DEPTH[theme]
    for (const glyph of ['r', 'g', 'k', 'o', 's', 'T', 'W', 'D']) {
      expect(monsterArt(glyph, theme)).not.toEqual(monsterArt(glyph, 'crypt'))
      expect(kindName(glyph, depth)).not.toBe(kindName(glyph, 2))
    }
  }
})

test('a named foe is drawn as its own: Old Bones in his cloak, not as a skeleton', async () => {
  const g = { ...plainHero(4), seen: '1'.repeat(64 * 18) }
  const at = { x: g.x + 1, y: g.y }
  const skeleton = { glyph: 's', name: 'skeleton', hp: 9, maxHp: 9, atk: 2, xp: 3, ...at }
  const draw = (foe: Game['foe']) => frameOf({ ...g, foe } as Game, 200, 100)
  const plain = draw(skeleton as Game['foe'])
  const named = draw({ ...skeleton, name: 'Old Bones', unique: 'bones' } as Game['foe'])
  // Only the foe's own tile: the crown over a named foe's head is drawn above it.
  const o = originAt({ x: g.x * 8 + 4, y: g.y * 8 + 4 }, 200, 100)
  const tile = (f: Uint32Array) => Array.from({ length: 64 }, (_, i) => f[(at.y * 8 + Math.floor(i / 8) - o.y) * 200 + at.x * 8 + (i % 8) - o.x])
  expect(tile(named)).not.toEqual(tile(plain))
  expect(UNIQUE_ART.bones).not.toEqual(MONSTER_ART.s)
})

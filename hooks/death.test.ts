import { describe, expect, test } from 'claude-code/testing'

import type { Game } from '../types'
import { apply, newGame } from './game'
import { floorThing, generate } from './map'
import { foeAhead, plainHero } from './fixtures'
import { BOSS_HOLD, BOSS_KEYS, FOE_HOLD, FOE_KEYS, HERO_HOLD, HERO_KEYS, HERO_REST, bossFall, fallDim, foeFall, heroFall } from './fall'
import type { Pixel } from './fall'
import { deathGesture, deathHeight, deathOverlay, killerArt, killerName } from './death'
import { BOSS_ART, PX, THING_ART } from './pixelart'
import { HIT_FRAMES, deathScene, frameOf, hitFramesFor, hitsBetween } from './pixels'
import type { Hit } from './pixels'
import { CLOSE_BOX, WINDOW_W } from './window'

/** A hero on `depth` with 2 HP and 31 gold, a rat that cannot miss beside them, and the fatal blow struck. */
const slain = (depth: number) => {
  const g: Game = { ...plainHero(5), depth, deepest: depth, hp: 2, gold: 31 }
  const foe = foeAhead(g, 1, { glyph: 'r', name: 'rat of x', opened: true, atk: 99 })
  return { g, foe, after: apply({ ...g, foe }, { kind: 'outcome', ok: false, what: 'Bash' }) }
}

describe('falling', () => {
  test('a death opens the death window and keeps what slew the hero, as it stood, where, the gold lost and where they wake', async () => {
    const { foe, after, g } = slain(14)
    expect(after.panel).toBe('death')
    expect(after.fallen).toEqual({ by: 'the rat of x', foe: { ...foe, turn: 1 }, at: { x: g.x, y: g.y }, depth: 14, wake: 11, lost: 16 })
  })

  test('a trap, even with a foe waiting beyond it, keeps no foe', async () => {
    // A trap with open floor either side along a row: the hero on one side, the foe on the other.
    for (let world = 1; world <= 200; world += 1) {
      const level = generate(world, 3)
      for (let y = 1; y < level.tiles.length - 1; y += 1) for (let x = 1; x < level.tiles[0]!.length - 1; x += 1) {
        const open = (dx: number, dy: number) => level.tiles[y + dy]?.[x + dx] === '.' && floorThing(world, 3, level, { x: x + dx, y: y + dy }) === ' '
        if (floorThing(world, 3, level, { x, y }) !== '^' || !open(-1, 0) || !open(1, 0) || open(0, -1) || open(0, 1)) continue
        const g = { ...newGame(world), world, depth: 3, x: x - 1, y, hp: 1, gold: 10, taken: [], foe: { glyph: 'g', name: 'goblin of x', hp: 99, maxHp: 99, atk: 1, xp: 0, x: x + 1, y } }
        const after = apply(g, { kind: 'outcome', ok: true, what: 'Edit' })
        expect([after.panel, after.fallen]).toEqual(['death', { by: 'a trap', at: { x, y }, depth: 3, wake: 1, lost: 5 }])
        return
      }
    }
    throw new Error('no trap in a corridor')
  })

  test('waking closes the window; the fall is kept for the next look', async () => {
    const { after } = slain(4)
    const woke = apply(after, { kind: 'panel', panel: 'death' })
    expect(woke.panel).toBe('none')
    expect(woke.fallen?.depth).toBe(4)
  })
})

const ART = ['..KK....', '.KwwK...', '.KwwK...', '..KK....', '.KwwK...', 'KwwwwK..', '.K..K...', '.K..K...']
const BIG = Array.from({ length: 16 }, () => 'w'.repeat(16))
const lit = () => '#808080'
const span = (ps: readonly Pixel[], k: 'x' | 'y') => ({ lo: Math.min(...ps.map(p => p[k])), hi: Math.max(...ps.map(p => p[k])) })

describe('a foe crumbling', () => {
  test('it flashes white in its own shape, then red, then crumbles: fewer pixels each key, none below its feet, then nothing', async () => {
    const shape = ART.flatMap((r, y) => [...r].flatMap((k, x) => (k === '.' ? [] : [`${x},${y}`])))
    expect(foeFall(ART, 0, lit).map(p => `${p.x},${p.y}`)).toEqual(shape)
    expect(new Set(foeFall(ART, 0, lit).map(p => p.hex))).toEqual(new Set(['#ffffff']))
    expect(foeFall(ART, 1, lit)).toHaveLength(shape.length)
    const body = [2, 3, 4, 5, 6].map(key => foeFall(ART, key, lit).filter(p => p.hex !== '#ffffff'))
    for (const ps of body) expect(span(ps, 'y').hi).toBeLessThanOrEqual(ART.length - 1)
    const counts = [2, 3, 4, 5, 6].map(key => foeFall(ART, key, lit).length)
    expect(counts[4]!).toBeLessThan(counts[0]!)
    expect(counts[4]!).toBeLessThan(shape.length / 2)
    expect(foeFall(ART, FOE_KEYS, lit)).toEqual([])
  })
})

describe('a big boss bursting', () => {
  test('it shakes a pixel each way, flashing; then its pieces fly out past its own bounds; then nothing', async () => {
    expect(span(bossFall(BIG, 0, lit), 'x')).toEqual({ lo: -1, hi: 14 })
    expect(span(bossFall(BIG, 1, lit), 'x')).toEqual({ lo: 1, hi: 16 })
    expect(bossFall(BIG, 5, lit).some(p => p.hex === '#ffd34d')).toBe(true)
    const burst = span(bossFall(BIG, 9, lit), 'x')
    expect(burst.lo < 0 && burst.hi > 15).toBe(true)
    expect(bossFall(BIG, BOSS_KEYS, lit)).toEqual([])
  })
})

describe('the hero falling', () => {
  test('a lean then a steeper one, then lying with a pool under; the last keyframe holds', async () => {
    const top = (key: number) => heroFall(ART, key, lit).filter(p => p.y === Math.min(...heroFall(ART, key, lit).map(q => q.y)))
    expect(Math.max(...top(3).map(p => p.x))).toBeGreaterThan(Math.max(...top(2).map(p => p.x)))
    expect(heroFall(ART, 5, lit).some(p => p.y === ART.length + 1)).toBe(true)
    expect(heroFall(ART, HERO_KEYS + 3, lit)).toEqual(heroFall(ART, HERO_KEYS - 1, lit))
  })

  test('it falls away from the foe: toward the left, the lean mirrored', async () => {
    const right = span(heroFall(ART, 3, lit, 1), 'x')
    const left = span(heroFall(ART, 3, lit, -1), 'x')
    expect(right.hi).toBeGreaterThan(ART[0]!.length)
    expect(left.lo).toBeLessThan(0)
  })

  test('the map darkens once they lie, to six tenths at most', async () => {
    expect([0, 3, 4, 5, 7, 20].map(fallDim)).toEqual([0, 0, 0.15, 0.3, 0.6, 0.6])
  })
})

describe('how long each plays', () => {
  const foe = { glyph: 'g', name: 'g', hp: 1, maxHp: 1, atk: 1, xp: 1, x: 0, y: 0 }
  test('a foe within a blow\'s time, a big boss three frames a key, the hero three a key and a rest', async () => {
    expect(hitFramesFor([{ at: foe, amount: 1, kind: 'kill', foe }])).toBe(HIT_FRAMES + 4)
    expect(hitFramesFor([{ at: foe, amount: 1, kind: 'kill', foe: { ...foe, big: 'king' } }])).toBe(BOSS_KEYS * BOSS_HOLD + 4)
    expect(hitFramesFor([{ at: foe, amount: 0, kind: 'death' }])).toBe(HERO_KEYS * HERO_HOLD + HERO_REST)
  })
})

describe('the fall on the map', () => {
  const { g, after } = slain(4)
  const before = { ...g, foe: foeAhead(g, 1, { glyph: 'r', name: 'rat of x', opened: true, atk: 99 }) }

  test('it plays on the level fallen on: the hero where struck, the killer beside them, no window yet', async () => {
    const scene = deathScene(before, after)!
    expect({ depth: scene.depth, x: scene.x, y: scene.y, foe: scene.foe?.name, panel: scene.panel }).toEqual({ depth: 4, x: g.x, y: g.y, foe: 'rat of x', panel: 'none' })
    expect(hitsBetween(before, after)).toEqual([{ at: { x: g.x, y: g.y }, amount: 0, kind: 'death' }])
    expect(deathScene(before, before)).toBeUndefined()
  })

  test('the map darkens as the hero lies fallen', async () => {
    const scene = deathScene(before, after)!
    const hits = hitsBetween(before, after)
    const camera = { x: g.x * PX + PX / 2, y: g.y * PX + PX / 2 }
    const light = (f: Uint32Array) => f.reduce((n, p) => n + ((p >> 16) & 255) + ((p >> 8) & 255) + (p & 255), 0)
    expect(light(frameOf(scene, 64, 48, { camera, hits, hitFrame: 7 * HERO_HOLD }))).toBeLessThan(0.5 * light(frameOf(scene, 64, 48, { camera, hits, hitFrame: 0 })))
  })
})

describe('the death window', () => {
  const { after } = slain(14)
  const top = (r: { x: number; y: number }) => ({ x: r.x + 1, y: (r.y + 1) / 2 })

  test('it names what slew the hero: a unique by its own name, a kind with "the", a trap as said', async () => {
    const f = after.fallen!
    expect(killerName(f)).toBe('the rat of x')
    expect(killerName({ ...f, foe: { ...f.foe!, name: 'the Rotking', unique: 'rot' }, by: 'the the Rotking' })).toBe('the Rotking')
    expect(killerName({ ...f, foe: undefined, by: 'a trap' })).toBe('a trap')
  })

  test('its portrait is the killer as it stood on its theme: a big boss its own art', async () => {
    const f = after.fallen!
    expect(killerArt({ ...f, foe: { ...f.foe!, glyph: '&', big: 'king' } })).toBe(BOSS_ART.king)
  })

  test('a trap\'s portrait stands up, its spikes over its plate, mirrored, where the map\'s lies flat on the floor', async () => {
    const art = killerArt({ ...after.fallen!, foe: undefined, by: 'a trap' })
    expect(art).not.toBe(THING_ART['^'])
    expect(art.length).toBe(8)
    expect(art.map(row => [...row].reverse().join(''))).toEqual([...art])
    // Something on more than half of its rows: it rises, where the map's plate takes its last four.
    expect(art.filter(row => row !== '........').length).toBeGreaterThan(4)
  })

  test('it says who, where, the toll and where the hero wakes', async () => {
    const text = deathOverlay(after).filter(b => b.role !== 'button').flatMap(b => b.lines.map(l => l.map(r => r.text).join('')))
    expect(text).toEqual(['Slain by', 'the rat of x', 'on depth 14.', `Level ${after.level}, deaths 1. Lost 16 gold.`, 'You wake on depth 11.'])
  })

  test('Wake and the close box close it; a click elsewhere does nothing', async () => {
    const at = (p: { x: number; y: number }) => deathGesture(after, { type: 'release', from: p, at: p, button: 'left' })
    const h = deathHeight(after)
    // Wake sits centered under the boxes, its last row 2 pixels over the window's end.
    expect(at({ x: WINDOW_W / 2, y: (h - 5) / 2 })).toEqual([{ kind: 'panel', panel: 'death' }])
    expect(at(top({ x: CLOSE_BOX[0], y: CLOSE_BOX[1] }))).toEqual([{ kind: 'panel', panel: 'death' }])
    expect(at({ x: 6, y: (h - 5) / 2 })).toEqual([])
  })
})

describe('a kill on the map', () => {
  test('a slain foe crumbles on its tile, and a slain big boss bursts past its own two tiles', async () => {
    const g = { ...plainHero(5), seen: '1'.repeat(64 * 18) }
    const camera = { x: g.x * PX, y: g.y * PX }
    const [w, h] = [96, 80]
    const foe = foeAhead(g, 2, { glyph: 's', name: 'skeleton' })
    const changed = (hit: Hit, frame: number, axis: 'x' | 'y' = 'x') => {
      const shown = frameOf(g, w, h, { camera, hits: [hit], hitFrame: frame })
      const bare = frameOf(g, w, h, { camera, hits: [{ ...hit, foe: undefined }], hitFrame: frame })
      const at: number[] = []
      shown.forEach((n, i) => n !== bare[i] && at.push(axis === 'x' ? i % w : Math.floor(i / w)))
      return at
    }
    const kill = { at: { x: foe.x, y: foe.y }, amount: 0, kind: 'kill' as const, foe }
    expect(changed(kill, 2 * FOE_HOLD).length).toBeGreaterThan(0)
    const big = { ...kill, foe: { ...foe, glyph: '&', big: 'king' as const } }
    // Its first flash stands a tile above the foe's own and half a tile out each side, a pixel shaken to the left.
    const [tileX, tileY] = [Math.min(...changed(kill, 0)), Math.min(...changed(kill, 0, 'y'))]
    expect([Math.min(...changed(big, 0)), Math.min(...changed(big, 0, 'y'))]).toEqual([tileX - PX / 2 - 1, tileY - PX])
    const xs = changed(big, 9 * BOSS_HOLD + 4)
    expect(Math.min(...xs) < tileX - PX / 2 || Math.max(...xs) >= tileX + 3 * PX / 2).toBe(true)
  })
})

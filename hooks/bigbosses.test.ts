import { describe, expect, test } from 'claude-code/testing'

import type { Foe, Game } from '../types'
import { SAVE_VERSION, apply, newGame, normalize } from './game'
import { MAP_H, MAP_W, generate } from './map'
import { foeTurn } from './patterns'
import { PX } from './pixelart'
import { frameOf } from './pixels'
import { SPRITES } from './sprites'
import { arrive } from './world'

const WORLD = 4
const atDepth = (depth: number, over: Partial<Game> = {}): Game => {
  const g = newGame(WORLD)
  return { ...g, ...arrive(g.world, depth), deepest: depth, bossSlain: 0, ...over }
}
const met = (depth: number) => apply(atDepth(depth), { kind: 'descend' })
const big = (key: NonNullable<Foe['big']>, over: Partial<Foe> = {}): Foe =>
  ({ glyph: '&', name: 'Boss', hp: 100, maxHp: 100, atk: 10, xp: 1, x: 0, y: 0, boss: true, big: key, ...over })
/** The foe's turns from its first, each from the foe the turn before left. */
const turns = (foe: Foe, n: number) => {
  const out = []
  let now = foe
  for (let i = 0; i < n; i += 1) {
    const t = foeTurn(atDepth(10), now)
    out.push(t)
    now = t.foe
  }
  return out
}

describe('the big boss of every tenth depth', () => {
  test('each of the five themes has its own, in the order the depths run', async () => {
    expect([10, 20, 30, 40, 50].map(d => met(d).foe?.name)).toEqual(['Drowned Queen', 'Frost Lich', 'Bone King', 'Hive Mother', 'Furnace Wyrm'])
  })

  test('it rises at the stairs as a boss, drawn as &, and is announced', async () => {
    const g = met(10)
    expect(g.foe).toMatchObject({ glyph: '&', big: 'queen', boss: true })
    expect(g.log.at(-1)).toBe('The Drowned Queen (&) rises to bar the way down!')
  })

  test('it is far tougher than the guardian five depths before it: over twice its HP', async () => {
    expect(met(10).foe!.maxHp).toBeGreaterThan(2 * met(5).foe!.maxHp)
  })

  test('slain, it leaves an Elixir and an Epic or better, and the way down opens', async () => {
    const g = met(20)
    const slain = apply({ ...g, foe: { ...g.foe!, hp: 1 }, belt: [null, null, null, null, null] }, { kind: 'attack' })
    expect(slain.foe).toBeNull()
    expect(slain.belt[0]).toEqual({ kind: 'health', tiers: [0, 0, 1] })
    const found = slain.bag.filter(item => !g.bag.some(b => b.id === item.id))
    expect(found).toHaveLength(1)
    expect(['epic', 'legendary']).toContain(found[0]!.rarity)
    expect(apply(slain, { kind: 'descend' }).depth).toBe(21)
  })
})

describe('its rage', () => {
  test('at half its HP it rages once: a turn spent roaring, no blow', async () => {
    const t = foeTurn(atDepth(10), big('hive', { hp: 50 }))
    expect([t.strikes, t.foe.phase, t.said]).toEqual([false, 2, ['The Hive Mother shrieks, and the swarm boils!']])
    expect(foeTurn(atDepth(10), t.foe).said).not.toContain('The Hive Mother shrieks, and the swarm boils!')
  })

  test('above half it does not rage', async () => {
    expect(foeTurn(atDepth(10), big('hive', { hp: 51 })).foe.phase).toBeUndefined()
  })
})

describe('its moves', () => {
  test('the Bone King raises his greatsword one turn and brings it down double the next; raging, bones shield him as he raises it', async () => {
    const calm = turns(big('king', { name: 'Bone King' }), 3)
    expect(calm.map(t => t.times)).toEqual([1, 1, 2])
    expect(calm[1]!.said).toEqual(['The Bone King raises his greatsword...'])
    expect(calm[1]!.foe.shield).toBeUndefined()
    const raging = turns(big('king', { name: 'Bone King', phase: 2, hp: 40 }), 2)
    expect(raging[1]!.foe.shield).toBe(1)
  })

  test('the Drowned Queen is mended by the tide every third turn; raging, she drags the hero under every other', async () => {
    const calm = turns(big('queen', { name: 'Drowned Queen', hp: 60 }), 3)
    expect(calm.map(t => t.foe.hp)).toEqual([60, 60, 70])
    expect(calm.map(t => t.pierces)).toEqual([false, false, false])
    const raging = turns(big('queen', { name: 'Drowned Queen', phase: 2, hp: 40 }), 4)
    expect(raging.map(t => t.pierces)).toEqual([false, true, false, true])
  })

  test('the Hive Mother\'s spores slip past armor every other turn; raging, the swarm bites half again as hard', async () => {
    const calm = turns(big('hive', { hp: 60 }), 4)
    expect(calm.map(t => [t.pierces, t.times])).toEqual([[false, 1], [true, 1], [false, 1], [true, 1]])
    expect(turns(big('hive', { phase: 2, hp: 40 }), 2).map(t => t.times)).toEqual([1.5, 1.5])
  })

  test('the Frost Lich chills the air and looses a double frost nova; raging, ice armors it every fourth turn', async () => {
    const calm = turns(big('lich', { name: 'Frost Lich' }), 3)
    expect(calm.map(t => t.times)).toEqual([1, 1, 2])
    expect(calm[1]!.said).toEqual(['The air freezes around you...'])
    const raging = turns(big('lich', { name: 'Frost Lich', phase: 2, hp: 40 }), 5)
    expect(raging.map(t => t.foe.shield ?? 0)).toEqual([1, 1, 1, 1, 1])
    expect(raging[0]!.said).toEqual(['Ice armor forms on the Frost Lich.'])
    expect(raging[4]!.said).toEqual(['Ice armor forms on the Frost Lich.'])
  })

  test('the Furnace Wyrm breathes fire at two and a half times its blow every third turn; raging, every other', async () => {
    expect(turns(big('wyrm'), 6).map(t => t.times)).toEqual([1, 1, 2.5, 1, 1, 2.5])
    expect(turns(big('wyrm', { phase: 2, hp: 40 }), 4).map(t => t.times)).toEqual([1, 2.5, 1, 2.5])
  })
})

describe('its arena', () => {
  const stairsRoom = (world: number, depth: number) => {
    const l = generate(world, depth)
    return l.rooms.find(r => l.stairs.x >= r.x && l.stairs.x < r.x + r.w && l.stairs.y >= r.y && l.stairs.y < r.y + r.h)
  }
  const isArena = (r: ReturnType<typeof stairsRoom>) => r !== undefined && r.w >= 14 && r.h >= 8

  test('on a tenth depth the stairs stand in a room at least 14 by 8, all but where the level starts in it', async () => {
    let without = 0
    for (let world = 1; world <= 100; world += 1) for (const d of [10, 20, 30, 40, 50]) if (!isArena(stairsRoom(world, d))) without += 1
    expect(without).toBeLessThanOrEqual(5)
  })

  test('on other depths the stairs room is as it was: most are smaller', async () => {
    let arenas = 0
    for (let world = 1; world <= 100; world += 1) if (isArena(stairsRoom(world, 9))) arenas += 1
    expect(arenas).toBeLessThan(50)
  })
})

describe('drawing it', () => {
  /** The whole level in one frame, so a frame pixel is a world pixel: with the boss, and with no foe. */
  const both = (g: Game) => {
    const [w, h] = [MAP_W * PX, MAP_H * PX]
    const camera = { x: w / 2, y: h / 2 }
    return { w, now: frameOf(g, w, h, { camera }), bare: frameOf({ ...g, foe: null }, w, h, { camera }) }
  }
  /** How many pixels of a box differ between the two frames. */
  const changed = ({ w, now, bare }: ReturnType<typeof both>, x0: number, y0: number, bw: number, bh: number) => {
    let n = 0
    for (let y = y0; y < y0 + bh; y += 1) for (let x = x0; x < x0 + bw; x += 1) if (now[y * w + x] !== bare[y * w + x]) n += 1
    return n
  }

  test('it stands two tiles wide and two tall: it fills the tile above its own and half a tile each side', async () => {
    for (const d of [10, 20, 30, 40, 50]) {
      const g = met(d)
      const f = both(g)
      const [left, top] = [g.foe!.x * PX, g.foe!.y * PX]
      expect(changed(f, left, top - PX, PX, PX)).toBeGreaterThan(PX)
      expect(changed(f, left - PX / 2, top - PX, PX / 2, 2 * PX)).toBeGreaterThan(PX / 2)
      expect(changed(f, left + PX, top - PX, PX / 2, 2 * PX)).toBeGreaterThan(PX / 2)
      expect(f.now.includes(0xff00ff)).toBe(false)
    }
  })

  test('its bar runs above its head, as wide as its sprite', async () => {
    const g = met(10)
    const f = both(g)
    const [left, top] = [g.foe!.x * PX, g.foe!.y * PX]
    expect(changed(f, left - PX / 2, top - PX - 3, 2 * PX, 1)).toBe(2 * PX)
  })

  test('the text map draws it with its own sprite', async () => {
    expect(SPRITES['&']).toBeDefined()
  })
})

describe('saves from before the arenas', () => {
  const spotOn = (depth: number) => {
    const level = generate(WORLD, depth)
    return level.rooms.map(r => ({ x: r.x + Math.floor(r.w / 2), y: r.y + Math.floor(r.h / 2) })).find(p => p.x !== level.start.x || p.y !== level.start.y)!
  }
  const at = (depth: number) => normalize({ ...newGame(WORLD), world: WORLD, depth, ...spotOn(depth), seen: '1'.repeat(64 * 18), version: 9 } as Game)

  test('a version 9 save on a tenth depth re-enters it at the start; on another depth it stays put', async () => {
    const moved = at(10)
    expect({ x: moved.x, y: moved.y, version: moved.version }).toEqual({ ...generate(WORLD, 10).start, version: SAVE_VERSION })
    const kept = at(9)
    expect({ x: kept.x, y: kept.y }).toEqual(spotOn(9))
  })
})

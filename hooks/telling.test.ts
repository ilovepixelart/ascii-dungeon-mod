import { describe, expect, test } from 'claude-code/testing'

import type { Game } from '../types'
import { alongTheWay, apply, levelOf, newGame } from './game'
import { MAP_H, MAP_W, floorThing } from './map'
import { tellAtTheEnd, tellOnTheWay } from './register'

/** A hero who can see a gold pile and walks over it, from a world where one lies on the way, and the walk's tiles. */
const goldWalk = () => {
  for (let world = 1; world <= 200; world += 1) {
    const g0 = { ...newGame(world), seen: '1'.repeat(MAP_W * MAP_H) }
    const level = levelOf(g0)
    for (let y = 0; y < MAP_H; y += 1) for (let x = 0; x < MAP_W; x += 1) {
      if (floorThing(g0.world, g0.depth, level, { x, y }) !== '$') continue
      // A click two tiles past the pile, so the walk goes on beyond it.
      for (const [dx, dy] of [[2, 0], [-2, 0], [0, 2], [0, -2]] as const) {
        const plan = apply(g0, { kind: 'goto', x: x + dx, y: y + dy })
        const onIt = plan.walked.findIndex(p => p.x === x && p.y === y)
        // The pile the only thing on the way: another (a trap) would be told, and outrank it.
        const isOnlyGold = plan.walked.every(p => (p.x === x && p.y === y) || floorThing(g0.world, g0.depth, level, p) === ' ')
        if (onIt < 0 || onIt >= plan.walked.length - 1 || plan.foe !== null || !isOnlyGold) continue
        const tiles = alongTheWay(g0, plan)
        if (tiles !== null) return { start: g0 as Game, plan, tiles }
      }
    }
  }
  throw new Error('no gold on a walk')
}

describe('telling a walk', () => {
  test('gold picked up on the way is told once, on its tile: one coin, then nothing again on the tiles after or at the end', async () => {
    const { start, plan, tiles } = goldWalk()
    let walked: { start: Game; shown: Game | null } = { start, shown: null }
    const sounds: (string | undefined)[] = []
    for (const reached of tiles.slice(0, -1)) {
      sounds.push(tellOnTheWay(walked, reached, true, true).sound)
      walked = { ...walked, shown: reached }
    }
    const end = tellAtTheEnd(walked.shown ?? undefined, start, plan, true, true, [])
    expect(sounds.filter(s => s === 'coin').length).toBe(1)
    expect(end.sound).toBeUndefined()
  })

  test('an action with no walk told tells what it did', async () => {
    const { start, plan } = goldWalk()
    expect(tellAtTheEnd(undefined, start, plan, true, true, []).sound).toBe('coin')
  })
})

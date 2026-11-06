import { describe, expect, test } from 'claude-code/testing'

import type { Game } from '../types'
import { SAVE_VERSION, normalize } from './game'
import { violations } from './invariants'
import { RELEASED_SAVES } from './released'
import { isFromLater, isReadable } from './save'
import { simulate } from './sim'

/** What a save must keep through every migration: who the hero is and how far they got. */
const kept = (g: Game) => ({ cls: g.cls, level: g.level, xp: g.xp, deepest: g.deepest, depth: g.depth, gear: Object.values(g.gear).map(i => i?.name ?? null).sort() })

describe('every released save layout loads', () => {
  for (const [version, byClass] of Object.entries(RELEASED_SAVES)) {
    for (const [cls, saved] of Object.entries(byClass)) {
      test(`${version}'s ${cls}: readable, brought to the current layout, the hero and their gear kept, every rule held`, async () => {
        expect(isReadable(saved)).toBe(true)
        const g = normalize(saved as Game)
        expect(g.version).toBe(SAVE_VERSION)
        expect(kept(g)).toEqual(kept(saved as Game))
        expect(violations(g)).toEqual([])
      })

      test(`${version}'s ${cls}: plays on 400 steps with no rule broken`, { timeoutMs: 30000 }, async () => {
        const r = simulate(1, 400, (saved as Game).cls ?? 'knight', { from: normalize(saved as Game) })
        expect(r.firstBreak?.broke ?? []).toEqual([])
        expect(r.final.level).toBeGreaterThanOrEqual((saved as Game).level)
      })
    }
  }

  test('the saves come from layouts before the current one and from it: an old layout is really migrated', async () => {
    const versions = Object.values(RELEASED_SAVES).flatMap(byClass => Object.values(byClass).map(s => (s as Game).version))
    expect(Math.min(...versions)).toBeLessThan(SAVE_VERSION)
    expect(Math.max(...versions)).toBe(SAVE_VERSION)
  })

  test('a save from a newer layout is never read', async () => {
    const later = { ...(RELEASED_SAVES['0.11.0']!.knight as Game), version: SAVE_VERSION + 1 }
    expect(isFromLater(later)).toBe(true)
    expect(isReadable(later)).toBe(false)
  })
})

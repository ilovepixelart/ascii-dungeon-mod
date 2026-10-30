import { describe, expect, test } from 'claude-code/testing'

import type { Attribute } from '../types'
import { curveOf } from './curve'

/**
 * The bands the power curve keeps, every build: a blow taken never on average over 30% of max HP, a kill never more
 * than 6 blows, and past depth 100 no build slaying in under 1.7 blows on average. With armor taking its defense off a
 * blow and foe attack outgrowing depth, deep blows took 31% to 39% of max HP by depth 130 and builds slew in 1.6; with
 * Focus raising crit damage 5% a point, every point on it slew deep foes in 1.44 blows.
 */
const MOST_BLOW_SHARE = 30
const MOST_HITS = 6
const LEAST_DEEP_HITS = 1.7

describe('the power curve, one game a class to 10,000 steps', () => {
  for (const build of [undefined, 'might', 'focus'] as const satisfies readonly (Attribute | undefined)[]) {
    test(`${build === undefined ? 'points spent at random' : `every point on ${build}`}: every depth band keeps its bands`, { timeoutMs: 120000 }, async () => {
      // A band two games of the three reached, so one game's luck is not the band.
      const rows = curveOf(['knight', 'mage', 'rogue'], 1, 10000, build === undefined ? {} : { build }).filter(r => r.games >= 2)
      expect(rows.filter(r => r.blowShare > MOST_BLOW_SHARE).map(r => `${r.depth}: ${r.blowShare}%`)).toEqual([])
      expect(rows.filter(r => r.hitsPerKill > MOST_HITS).map(r => `${r.depth}: ${r.hitsPerKill} hits`)).toEqual([])
      const deep = rows.filter(r => r.from > 100 && r.hitsPerKill > 0)
      expect(deep.length).toBeGreaterThan(5)
      expect(deep.reduce((n, r) => n + r.hitsPerKill, 0) / deep.length).toBeGreaterThanOrEqual(LEAST_DEEP_HITS)
    })
  }
})

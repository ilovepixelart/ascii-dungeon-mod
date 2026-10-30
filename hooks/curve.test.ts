import { describe, expect, test } from 'claude-code/testing'

import type { Attribute } from '../types'
import { curveOf } from './curve'

/**
 * The bands the power curve keeps, every build: a blow taken never on average two fifths of max HP, a kill never more
 * than 6 blows, and past depth 100 no build slaying in under 1.75 blows on average. Before armor let a share of a blow
 * through, deep blows took 40% to 60% of max HP; with Focus raising crit damage without bound, every point on it slew
 * deep foes in about 1.6 blows.
 */
const MOST_BLOW_SHARE = 40
const MOST_HITS = 6
const LEAST_DEEP_HITS = 1.75

describe('the power curve, one game a class to 15,000 steps', () => {
  for (const build of [undefined, 'might', 'focus'] as const satisfies readonly (Attribute | undefined)[]) {
    test(`${build === undefined ? 'points spent at random' : `every point on ${build}`}: every depth band keeps its bands`, { timeoutMs: 300000 }, async () => {
      // A band two games of the three reached, so one game's luck is not the band.
      const rows = curveOf(['knight', 'mage', 'rogue'], 1, 15000, build === undefined ? {} : { build }).filter(r => r.games >= 2)
      expect(rows.filter(r => r.blowShare > MOST_BLOW_SHARE).map(r => `${r.depth}: ${r.blowShare}%`)).toEqual([])
      expect(rows.filter(r => r.hitsPerKill > MOST_HITS).map(r => `${r.depth}: ${r.hitsPerKill} hits`)).toEqual([])
      const deep = rows.filter(r => r.from > 100 && r.hitsPerKill > 0)
      expect(deep.length).toBeGreaterThan(5)
      expect(deep.reduce((n, r) => n + r.hitsPerKill, 0) / deep.length).toBeGreaterThanOrEqual(LEAST_DEEP_HITS)
    })
  }
})

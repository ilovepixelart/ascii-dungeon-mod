import { describe, expect, test } from 'claude-code/testing'

import type { Game } from '../types'
import { LOG_KEPT, apply } from './game'
import { plainHero } from './fixtures'
import { LOG_SHOWN, logRuns } from './panels'
import { logHeight, logOverlay } from './logwindow'

/** A hero whose log holds `n` lines, the last `fresh` of them the latest action's. */
const logged = (n: number, fresh = 1): Game => ({ ...plainHero(3), log: Array.from({ length: n }, (_, i) => `Line ${i + 1}.`), fresh })

describe('the log', () => {
  test('keeps its last 30 lines; the dashboard shows the last 5, the latest action\'s at full strength', async () => {
    let g = logged(0)
    for (let i = 0; i < 40; i += 1) g = apply(g, { kind: 'explore', steps: 1 })
    expect(LOG_KEPT).toBe(30)
    expect(g.log.length).toBeLessThanOrEqual(30)
    const shown = logRuns(logged(30, 2))
    expect([LOG_SHOWN, shown.map(r => r.text)]).toEqual([5, ['Line 26.', 'Line 27.', 'Line 28.', 'Line 29.', 'Line 30.']])
    expect(shown.map(r => r.dim === true)).toEqual([true, true, true, false, false])
  })

  test('a busy action keeps every line it said, past the five the dashboard shows', async () => {
    const g = logged(0, 0)
    const busy = { ...g, log: Array.from({ length: 7 }, (_, i) => `Said ${i + 1}.`), fresh: 7 }
    expect(logRuns(busy, LOG_KEPT).filter(r => r.dim !== true)).toHaveLength(7)
  })

  test('the log window holds every line kept, oldest first, and fits in 41 rows', async () => {
    const box = logOverlay(logged(30))[0]!
    expect(box.lines.map(l => l[0]!.text)).toEqual(Array.from({ length: 30 }, (_, i) => `Line ${i + 1}.`))
    expect(logHeight(logged(30))).toBeLessThanOrEqual(82)
    expect(logOverlay(logged(0))[0]!.lines).toEqual([[{ text: 'Nothing has happened yet.', dim: true }]])
  })
})

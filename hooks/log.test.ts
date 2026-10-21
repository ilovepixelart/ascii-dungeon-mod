import { describe, expect, test } from 'claude-code/testing'

import type { Game } from '../types'
import { LOG_KEPT, apply } from './game'
import { plainHero } from './fixtures'
import { LOG_SHOWN, logRuns } from './panels'
import { LOG_ROW, logHeight, logOverlay } from './logwindow'

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

test('a line longer than a row of the log window breaks at its spaces onto the next, every word kept', async () => {
  const long = Array.from({ length: 30 }, (_, i) => `word${i}`).join(' ')
  const box = logOverlay({ ...logged(0), log: [long], fresh: 1 })[0]!
  const rows = box.lines.map(l => l[0]!.text)
  // 199 characters: word0 to word14 fill 94 of a row's 97, word15 to word28 exactly 97, word29 a row of its own.
  expect(rows.map(r => r.split(' ').length)).toEqual([15, 14, 1])
  expect(rows.join(' ')).toBe(long)
  for (const r of rows) expect(r.length).toBeLessThanOrEqual(LOG_ROW)
  const busy = { ...logged(0), log: Array.from({ length: 30 }, () => long), fresh: 1 }
  expect(logHeight(busy)).toBeLessThanOrEqual(82)
})

test('too long to show whole, the log window shows the newest lines whole and says how many earlier ones do not fit', async () => {
  // Each line 113 characters, two rows: with the note's row, 14 lines fill 29 of the box's 30 rows.
  const line = (i: number) => `Line ${String(i).padStart(2, '0')}: ${'abcdefghi '.repeat(10)}abc`.slice(0, 113)
  const g = { ...logged(0), log: Array.from({ length: 30 }, (_, i) => line(i + 1)), fresh: 1 }
  const rows = logOverlay(g)[0]!.lines.map(l => l.map(r => r.text).join(''))
  expect(rows[0]).toBe('16 earlier lines do not fit here.')
  expect(rows.slice(1).filter(r => r.startsWith('Line ')).map(r => r.slice(0, 7))).toEqual(Array.from({ length: 14 }, (_, i) => `Line ${17 + i}`))
  expect(rows.length).toBeLessThanOrEqual(LOG_KEPT)
  expect(logHeight(g)).toBeLessThanOrEqual(82)
})

test('a word longer than a row of the log window wraps onto the next, every character kept', async () => {
  const word = 'x'.repeat(300)
  const rows = logOverlay({ ...logged(0), log: [word], fresh: 1 })[0]!.lines.map(l => l[0]!.text)
  expect(rows.map(r => r.length)).toEqual([97, 97, 97, 9])
  expect(rows.join('')).toBe(word)
})

test('the log window\'s note counts in words that agree, and says nothing when no earlier line is left out', async () => {
  const rows = (log: string[]) => logOverlay({ ...logged(0), log, fresh: 1 })[0]!.lines.map(l => l.map(r => r.text).join(''))
  // One earlier line of 29 rows' worth, one newest of 2: the newest whole, one left out.
  const word = (n: number) => Array.from({ length: n }, () => 'abcdefghi').join(' ')
  expect(rows([word(9 * 29), word(19)])[0]).toBe('1 earlier line does not fit here.')
  // One line alone too long for the box: no earlier line to count.
  expect(rows([word(9 * 40)])[0]!.startsWith('abcdefghi')).toBe(true)
})

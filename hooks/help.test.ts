import { describe, expect, test } from 'claude-code/testing'

import { HELP_ROWS, helpGesture, helpHeight, helpLines, helpPixels } from './helpwindow'
import { MAP_H } from './map'
import { PX, missingGlyphs } from './pixelart'
import { CLOSE_BOX } from './window'
import type { Gesture } from './window'

const tap = (x: number, y: number): Gesture => ({ type: 'release', from: { x: x + 0.5, y: y / 2 + 0.25 }, at: { x: x + 0.5, y: y / 2 + 0.25 }, button: 'left' })

describe('the how it plays window', () => {
  test('says what the coding does: a row each, what happens and what it comes to', async () => {
    expect(HELP_ROWS.map(r => [r.when, r.does])).toEqual([
      ['EVERY TOOL CALL', 'A STEP OR A BLOW'],
      ['A FAILED CALL', 'LETS THE FOE STRIKE'],
      ['TESTS THAT PASS', 'A SURE CRITICAL'],
      ['A COMMIT', 'A SHRINE AND FULL HP'],
      ['A PUSH OR A PR', 'A CACHE OF LOOT'],
      ['AN ANSWER FINISHED', 'THE STAIRS DOWN'],
    ])
    const texts = helpLines().map(l => l.text)
    expect(texts[0]).toBe('YOUR CODING PLAYS THE HERO')
    for (const r of HELP_ROWS) expect([texts.includes(r.when), texts.includes(r.does)]).toEqual([true, true])
  })

  test('the work it rewards is in green: tests, commits, pushes and pull requests', async () => {
    const ink = (text: string) => helpLines().find(l => l.text === text)!.ink
    expect(['TESTS THAT PASS', 'A COMMIT', 'A PUSH OR A PR'].map(ink)).toEqual(['#3ccf4e', '#3ccf4e', '#3ccf4e'])
    expect(ink('EVERY TOOL CALL')).not.toBe('#3ccf4e')
  })

  test('fits over the map, every letter one the font has', async () => {
    missingGlyphs.clear()
    const px = helpPixels()
    expect(helpHeight()).toBeLessThanOrEqual(MAP_H * PX)
    expect(px.length).toBe(helpHeight())
    expect([...missingGlyphs]).toEqual([])
  })

  test('its close box closes it; anywhere else, nothing', async () => {
    expect(helpGesture(tap(CLOSE_BOX[0] + 1, CLOSE_BOX[1] + 1))).toBe(true)
    expect(helpGesture(tap(40, 40))).toBe(false)
    expect(helpGesture({ type: 'drag', from: { x: 1, y: 1 }, at: { x: 9, y: 9 }, button: 'left' } as Gesture)).toBe(false)
  })
})

import { describe, expect, test } from 'claude-code/testing'

import { HELP_ROWS, helpGesture, helpHeight, helpOverlay, helpPixels } from './helpwindow'
import { missingGlyphs } from './pixelart'
import { CLOSE_BOX, POPOVER_BG } from './window'
import type { Gesture } from './window'

const tap = (x: number, y: number): Gesture => ({ type: 'release', from: { x: x + 0.5, y: y / 2 + 0.25 }, at: { x: x + 0.5, y: y / 2 + 0.25 }, button: 'left' })

describe('the how it plays window', () => {
  const text = (line: { text: string }[]) => line.map(r => r.text).join('')

  test('heads its box with what it is about, bold in gold, a row of room under it', async () => {
    const lines = helpOverlay()[0]!.lines
    expect(lines[0]).toEqual([{ text: 'Your coding plays the hero.', bold: true, color: '#ffd34d' }])
    expect(lines[1]).toEqual([])
  })

  test('says what the coding does: a rule each, what happens and what it comes to', async () => {
    expect(HELP_ROWS.map(r => [r.when, r.does])).toEqual([
      ['Every tool call', 'A step or a blow'],
      ['A failed call', 'Lets the foe strike'],
      ['Tests that pass', 'A sure critical'],
      ['A commit', 'A shrine and full HP'],
      ['A push or a PR', 'A cache of loot'],
      ['An answer finished', 'The stairs down'],
    ])
    const lines = helpOverlay()[0]!.lines
    HELP_ROWS.forEach((r, i) => {
      expect(lines[2 + 3 * i]![0]).toMatchObject({ text: r.when, bold: true })
      expect(lines[3 + 3 * i]![0]).toMatchObject({ text: r.does, dim: true })
    })
    expect(text(lines[lines.length - 1]!)).toBe('You pick the gear and the talents, and set the orders.')
  })

  test('the work it rewards is in green: tests, commits, pushes and pull requests', async () => {
    const color = (when: string) => helpOverlay()[0]!.lines.find(l => l[0]?.text === when)![0]!.color
    expect(['Tests that pass', 'A commit', 'A push or a PR'].map(color)).toEqual(['#3ccf4e', '#3ccf4e', '#3ccf4e'])
    expect(color('Every tool call')).toBeUndefined()
  })

  test('each rule\'s icon beside its first line, left of the text', async () => {
    const px = helpPixels()
    const box = helpOverlay()[0]!
    HELP_ROWS.forEach((_, i) => {
      const y = 2 * (box.y + 3 + 3 * i)
      const inked = [0, 1, 2, 3, 4].some(dy => px[y + dy]!.slice(box.x + 1, box.x + 1 + 8).some(p => p !== POPOVER_BG))
      expect(inked).toBe(true)
    })
  })

  test('fits in 40 rows, every letter one the font has', async () => {
    missingGlyphs.clear()
    const px = helpPixels()
    expect(helpHeight()).toBeLessThanOrEqual(80)
    expect(px.length).toBe(helpHeight())
    expect([...missingGlyphs]).toEqual([])
  })

  test('its close box closes it; anywhere else, nothing', async () => {
    expect(helpGesture(tap(CLOSE_BOX[0] + 1, CLOSE_BOX[1] + 1))).toBe(true)
    expect(helpGesture(tap(40, 40))).toBe(false)
    expect(helpGesture({ type: 'drag', from: { x: 1, y: 1 }, at: { x: 9, y: 9 }, button: 'left' } as Gesture)).toBe(false)
  })
})

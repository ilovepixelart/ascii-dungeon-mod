import { describe, expect, test } from 'claude-code/testing'

import { BEST_COLUMNS, BEST_ROWS, UNDER_WINDOW, fitNote, sizeNote } from './panesize'
import { shots } from './screens'

describe('a window taller than the pane', () => {
  test('says how many rows it needs, counting its own line, and how many the pane has', async () => {
    // 71 rows of window, 5 under it and this line: 77.
    expect(fitNote(71, 5, 60)).toBe('This window needs 77 rows to show whole; the pane has 60. Make it taller, or scroll down.')
  })

  test('says nothing once the pane holds it and its line, and speaks one row short of that', async () => {
    expect(fitNote(71, 5, 77)).toBeUndefined()
    expect(fitNote(71, 5, 76)).toBe('This window needs 77 rows to show whole; the pane has 76. Make it taller, or scroll down.')
  })
})

describe('the size the game plays best in', () => {
  test('holds every window drawn, the tallest whole with its lines under it', async () => {
    for (const s of shots()) {
      expect(s.px[0]!.length <= BEST_COLUMNS || s.name.startsWith('strip')).toBe(true)
      expect(s.px.length / 2 + UNDER_WINDOW).toBeLessThanOrEqual(BEST_ROWS)
    }
    expect(Math.max(...shots().map(s => s.px.length / 2)) + UNDER_WINDOW + 1).toBe(BEST_ROWS)
  })

  test('is said for a pane narrower or shorter than it, and not at it', async () => {
    expect(sizeNote(96, 50)).toBe('ASCII Dungeon plays best in a pane at least 105 columns wide and 78 rows tall; this one is 96 by 50.')
    expect(sizeNote(BEST_COLUMNS - 1, BEST_ROWS)).toBeDefined()
    expect(sizeNote(BEST_COLUMNS, BEST_ROWS - 1)).toBeDefined()
    expect(sizeNote(BEST_COLUMNS, BEST_ROWS)).toBeUndefined()
    expect(sizeNote(160, 90)).toBeUndefined()
  })
})

import { describe, expect, test } from 'claude-code/testing'

import { FONT, POPUP_INK, POPUP_OUTLINE, textMask } from './pixelart'

describe('the number font', () => {
  test('every glyph is 5 rows of one width, at most 3 pixels wide', async () => {
    for (const [ch, rows] of Object.entries(FONT)) {
      expect(rows.length === 5 ? ch : `${ch}: ${rows.length} rows`).toBe(ch)
      const widths = new Set(rows.map(r => r.length))
      expect(widths.size === 1 && [...widths][0]! <= 3 ? ch : `${ch}: widths ${[...widths]}`).toBe(ch)
    }
  })

  test('has every character a popup needs', async () => {
    for (const ch of '0123456789+-! XPLVU') expect(FONT[ch] !== undefined ? ch : `missing ${ch}`).toBe(ch)
  })

  test('writes every capital, each letter its own shape, for the windows\' titles, tabs and keys', async () => {
    const letters = [...'ABCDEFGHIJKLMNOPQRSTUVWXYZ']
    for (const ch of letters) expect(FONT[ch] !== undefined ? ch : `missing ${ch}`).toBe(ch)
    expect(new Set(letters.map(ch => (FONT[ch] ?? []).join('/'))).size).toBe(26)
  })

  test('no two digits share a shape', async () => {
    const digits = [...'0123456789'].map(d => (FONT[d] ?? []).join('/'))
    expect(new Set(digits).size).toBe(10)
  })

  test('lays glyphs out a pixel apart: "-3" is 3 + 1 + 3 wide, 5 tall', async () => {
    expect(textMask('-3')).toEqual([
      '...' + '.' + '###',
      '...' + '.' + '..#',
      '###' + '.' + '###',
      '...' + '.' + '..#',
      '...' + '.' + '###',
    ])
    expect(textMask('14!')[0]).toBe('.#.' + '.' + '#.#' + '.' + '#')
  })

  test('a crit is gold and the same size as any other number', async () => {
    expect(POPUP_INK.crit).toBe(POPUP_INK.gold)
    expect(textMask('14!').length).toBe(textMask('7').length)
  })

  test('the outline is darker than every ink', async () => {
    const luma = (hex: string) => [1, 3, 5].map(i => Number.parseInt(hex.slice(i, i + 2), 16)).reduce((a, c, i) => a + c * [0.299, 0.587, 0.114][i]!, 0)
    for (const ink of Object.values(POPUP_INK)) expect(luma(ink)).toBeGreaterThan(luma(POPUP_OUTLINE) + 100)
  })
})

import { describe, expect, test } from 'claude-code/testing'

import { BUTTON_H, button, buttonBox, buttonW } from './pieces'
import { canvas } from './canvas'
import { shots } from './screens'
import { buttonsIn } from './fixtures'
import { INK, SURFACE } from './ui/tokens'

describe('a button', () => {
  test('is 6 pixels tall and as wide as its words and a cell of room each side in its frame', async () => {
    expect(BUTTON_H).toBe(6)
    // S, a space, START: 7 cells; with the room and the frame, 11.
    expect(buttonW('S', 'START')).toBe(11)
    expect(buttonW('+', '')).toBe(5)
    // B BUY 120 gold: 14 cells.
    expect(buttonW('B', 'BUY', 120)).toBe(18)
    const c = canvas(20, 8)
    expect(button(c, 'S', 'START', 1, 1, 'ready')).toBe(11)
    const drawn = c.px.map(row => row.slice(1, 12).some(p => p !== c.px[0]![0]))
    expect(drawn).toEqual([false, true, true, true, true, true, true, false])
  })

  test('says its key in gold and its label in text on its face, its words on the row under its lit edge', async () => {
    expect(buttonBox('S', 'START', 10, 20, 'armed')).toEqual({
      role: 'button', x: 10, y: 10, w: 11, h: 3, border: SURFACE.raised, bg: SURFACE.raised, pad: 1,
      lines: [[{ text: 'S', color: INK.gold, bold: true }, { text: ' START', color: INK.text }]],
    })
  })

  test('off, all in the off ink on the sunken face; a price it cannot pay in grey, one it can in gold', async () => {
    expect(buttonBox('R', 'RETIRE', 0, 0, 'off')).toMatchObject({ bg: SURFACE.sunken, lines: [[{ text: 'R', color: INK.off, bold: false }, { text: ' RETIRE', color: INK.off }]] })
    expect(buttonBox('F', 'FORTUNE', 0, 0, 'ready', 50, false).lines[0]![2]).toEqual({ text: ' 50 gold', color: INK.dim })
    expect(buttonBox('F', 'FORTUNE', 0, 0, 'ready', 50, true).lines[0]![2]).toEqual({ text: ' 50 gold', color: INK.gold })
  })
})

describe('the windows\' buttons', () => {
  const all = shots()

  test('on every window, each button\'s words lie on a whole cell on its plain face, between its lit edge and its frame', async () => {
    let seen = 0
    for (const s of all) {
      for (const b of s.boxes.filter(x => x.role === 'button')) {
        seen += 1
        // On a whole cell: the terminal writes text on no other.
        expect([s.name, Number.isInteger(b.y)]).toEqual([s.name, true])
        const top = b.y * 2
        const inside = (row: number) => s.px[row]!.slice(b.x + 1, b.x + b.w - 1)
        // The words' row, two pixels tall: the face alone, no pixel letters.
        for (const row of [top + 2, top + 3]) expect([s.name, row, [...new Set(inside(row))]]).toEqual([s.name, row, [b.bg]])
        // The frame above and below it is not the face.
        for (const row of [top, top + 5]) expect([s.name, inside(row).includes(b.bg!)]).toEqual([s.name, false])
      }
    }
    expect(seen).toBeGreaterThan(50)
  })

  test('each window says its buttons', async () => {
    const said = (name: string) => buttonsIn(all.find(s => s.name === name)!.boxes).map(b => b.text)
    expect(said('settings-game')).toEqual(['N NEW GAME', 'H HELP', 'E SOUND OFF', 'M MUSIC OFF', 'V VIEW PIXEL', 'L VOL 100'])
    expect(said('settings-orders')).toEqual(['D DRINK AT QUARTER HP', 'F SMOKE NEVER', 'K TAKE ALL LOOT'])
    expect(said('start-knight')).toEqual(['S START', 'H HELP', 'B BACK'])
    expect(said('sheet-knight')).toEqual(['+', '+', '+', '+', 'R RETIRE'])
    expect(said('death-king')).toEqual(['W WAKE'])
    expect(said('recap')).toEqual(['P PLAY ON'])
    expect([said('codex-foes'), said('codex-finds')]).toEqual([[], ['K CARD']])
    expect(said('talent-0')).toEqual(['T TAKE', 'L LATER'])
    expect(said('retire')).toEqual(['R RETIRE', 'B BACK'])
    expect([said('forge-knight'), said('forge-keep-knight')]).toEqual([['T TEMPER', 'R REFORGE'], ['T TEMPER', 'R REFORGE', 'K KEEP OLD']])
    expect(said('talk-dog')).toEqual(['P PET'])
  })
})

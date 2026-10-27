import { describe, expect, test } from 'claude-code/testing'

import { BUTTON_H, button, buttonBox, buttonW } from './pieces'
import { canvas } from './canvas'
import { shots } from './screens'
import { buttonsIn } from './fixtures'
import { INK, SURFACE } from './ui/tokens'
import { WINDOW_W } from './window'
import type { OverlayBox } from './window'
import { apply, newGame } from './game'
import { CHEST_UI_IDLE, chestOverlay } from './chest'

describe('a button', () => {
  test('is 6 pixels tall and as wide as its words and a cell of room each side in its frame', async () => {
    expect(BUTTON_H).toBe(6)
    // START: 5 cells; with the room and the frame, 9.
    expect(buttonW('START')).toBe(9)
    expect(buttonW('+')).toBe(5)
    // BUY 120 GOLD: 12 cells.
    expect(buttonW('BUY', 120)).toBe(16)
    const c = canvas(20, 8)
    expect(button(c, 'START', 1, 1, 'ready')).toBe(9)
    const drawn = c.px.map(row => row.slice(1, 10).some(p => p !== c.px[0]![0]))
    expect(drawn).toEqual([false, true, true, true, true, true, true, false])
  })

  test('says its label, bold, on its face on the row under its lit edge; no key: the pane has none till ctrl+x tab', async () => {
    expect(buttonBox('START', 10, 20, 'armed')).toEqual({
      role: 'button', x: 10, y: 10, w: 9, h: 3, border: SURFACE.raised, bg: SURFACE.raised, pad: 1,
      lines: [[{ text: 'START', color: INK.text, bold: true }]],
    })
  })

  test('off, all in the off ink on the sunken face; a price it cannot pay in grey, one it can in gold', async () => {
    expect(buttonBox('RETIRE', 0, 0, 'off')).toMatchObject({ bg: SURFACE.sunken, lines: [[{ text: 'RETIRE', color: INK.off, bold: false }]] })
    expect(buttonBox('FORTUNE', 0, 0, 'ready', 50, false).lines[0]![1]).toEqual({ text: ' 50 GOLD', color: INK.dim })
    expect(buttonBox('FORTUNE', 0, 0, 'ready', 50, true).lines[0]![1]).toEqual({ text: ' 50 GOLD', color: INK.gold })
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

  test('on every window, each button\'s words are centred on its face, however wide the face', async () => {
    let wide = 0
    for (const s of all) {
      for (const b of s.boxes.filter(x => x.role === 'button')) {
        const words = b.lines[0]!.map(r => r.text).join('').length
        const room = b.w - 2 - words
        if (room > 2) wide += 1
        // The room left by the words, split evenly, the odd cell on the right.
        expect([s.name, b.pad]).toEqual([s.name, Math.floor(room / 2)])
      }
    }
    expect(wide).toBeGreaterThan(5)
  })

  test('the smith\'s jobs, one under another, are one width', async () => {
    const widths = all.find(s => s.name === 'forge-keep-knight')!.boxes.filter(b => b.role === 'button').map(b => b.w)
    expect(widths).toEqual([widths[0], widths[0], widths[0]])
  })

  test('each window says its buttons', async () => {
    const said = (name: string) => buttonsIn(all.find(s => s.name === name)!.boxes).map(b => b.text)
    expect(said('settings-game')).toEqual(['NEW GAME', 'HELP', 'SOUND OFF', 'MUSIC OFF', 'VOL 100', 'PLAY BY SESSION'])
    expect(said('settings-orders')).toEqual(['DRINK AT QUARTER HP', 'SMOKE NEVER', 'TAKE ALL LOOT'])
    expect(said('start-knight')).toEqual(['START', 'HELP', 'BACK'])
    expect(said('sheet-knight')).toEqual(['+', '+', '+', '+', 'RETIRE'])
    expect(said('death-king')).toEqual(['WAKE'])
    expect(said('recap')).toEqual(['PLAY ON'])
    expect([said('codex-foes'), said('codex-finds')]).toEqual([[], ['CARD']])
    expect(said('talent-0')).toEqual(['TAKE', 'LATER'])
    expect(said('retire')).toEqual(['RETIRE', 'BACK'])
    expect([said('forge-knight'), said('forge-keep-knight')]).toEqual([['TEMPER', 'REFORGE'], ['TEMPER', 'REFORGE', 'KEEP OLD']])
    expect(said('talk-dog')).toEqual(['PET'])
  })
})

describe('a row of buttons', () => {
  /** The room left and right of each row of buttons: under the nearest box over it that spans it, else the window. */
  const rooms = (boxes: readonly OverlayBox[], under: 'box' | 'window', isGrid = false) => {
    const buttons = boxes.filter(b => b.role === 'button')
    // A grid's columns line up, its short rows with them: the grid is centred, as one row.
    const ys = isGrid ? [Math.min(...buttons.map(b => b.y))] : [...new Set(buttons.map(b => b.y))]
    return ys.map(y => {
      const row = isGrid ? buttons : buttons.filter(b => b.y === y)
      const left = Math.min(...row.map(b => b.x))
      const right = Math.max(...row.map(b => b.x + b.w))
      const over = boxes.filter(b => b.role !== 'button' && b.role !== 'title' && b.role !== 'gold' && b.role !== 'tabs' && b.y + b.h <= y && b.x <= left && b.x + b.w >= right).sort((a, b) => b.y - a.y)[0]
      const [from, to] = under === 'window' || over === undefined ? [0, WINDOW_W] : [over.x, over.x + over.w]
      return [left - from, to - right]
    })
  }
  const centred = ([l, r]: number[]) => r! - l! === 0 || r! - l! === 1

  test('stands centred under the box over it, or in the window: as much room each side, the odd pixel on the right', async () => {
    const all = shots()
    // Beside the worn slots, under the box there; the rest across the window.
    const under = { retire: 'box', 'forge-knight': 'box', 'forge-keep-knight': 'box', 'settings-game': 'window', 'settings-orders': 'window', 'death-king': 'window', recap: 'window', 'talent-0': 'window', 'start-knight': 'window' } as const
    for (const [name, span] of Object.entries(under)) {
      const s = all.find(x => x.name === name)!
      for (const room of rooms(s.boxes, span, name.startsWith('settings'))) expect([name, room, centred(room)]).toEqual([name, room, true])
    }
    const town = { ...apply(newGame(4), { kind: 'portal' }), gold: 0 }
    for (const room of rooms(chestOverlay(town, { ...CHEST_UI_IDLE, tab: 1 }), 'box')) expect(['chest tab 2', room, centred(room)]).toEqual(['chest tab 2', room, true])
  })
})

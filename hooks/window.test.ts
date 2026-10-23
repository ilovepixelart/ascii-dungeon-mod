import { describe, expect, test } from 'claude-code/testing'

import { BG } from './canvas'
import { MARK_INK } from './hud'
import { INK } from './ui/tokens'
import { CLOSE_BOX, CLOSE_INK, HEAD_H, WINDOW_TOP, WINDOW_W, boxShape, cardWithMenu, chromeBoxes, coverage, place, remembered, windowPixels } from './window'

const GOLD_INK = '#ffd34d'
const inkIn = (px: string[][], ink: string, y0: number, y1: number) => px.slice(y0, y1).some(row => row.includes(ink))

describe('the window', () => {
  test('is WINDOW_W wide, its body 3 px under the title bar, on an even row so text boxes sit on whole cells', async () => {
    const body = Array.from({ length: 7 }, () => Array<string>(WINDOW_W).fill('#123456'))
    const c = windowPixels({ title: 'SHOP' }, body)
    expect([WINDOW_TOP, WINDOW_TOP % 2, c.px.length]).toEqual([HEAD_H + 3, 0, HEAD_H + 3 + 7])
    for (const row of c.px) expect(row.length).toBe(WINDOW_W)
    expect(c.px[WINDOW_TOP - 1]?.[0]).toBe(BG)
    expect(c.px[WINDOW_TOP]?.[0]).toBe('#123456')
    expect(c.px[WINDOW_TOP + 6]?.[WINDOW_W - 1]).toBe('#123456')
  })

  test('shows the gold only when the window says so', async () => {
    expect(inkIn(windowPixels({ title: 'A' }, []).px, GOLD_INK, 0, HEAD_H)).toBe(false)
    expect(inkIn(windowPixels({ title: 'A', gold: 12 }, []).px, GOLD_INK, 0, HEAD_H)).toBe(true)
  })

  test('draws the gold\'s coin as the strip\'s mark, 5 by 5, a cell of room before its number', async () => {
    const c = windowPixels({ title: 'A', gold: 12 }, [])
    const inks = [MARK_INK.y, MARK_INK.Y, MARK_INK.o, INK.coinRim, GOLD_INK]
    const lit = c.px.flatMap((row, y) => (y < HEAD_H ? [...row].flatMap((p, x) => (inks.includes(p) ? [{ x, y }] : [])) : []))
    const xs = lit.map(p => p.x)
    const ys = lit.map(p => p.y)
    expect([Math.max(...xs) - Math.min(...xs) + 1, Math.max(...ys) - Math.min(...ys) + 1]).toEqual([5, 5])
    const number = chromeBoxes(c.px).find(b => b.role === 'gold')!
    // The number's box starts a cell before its words: its words a cell clear of the coin's last column.
    expect(number.x + 1 - (Math.max(...xs) + 1)).toBe(1)
  })

  test('always has its close box', async () => {
    const c = windowPixels({ title: 'A' }, [])
    const [x, y, w, h] = CLOSE_BOX
    expect(inkIn(c.px.slice(y, y + h).map(r => r.slice(x, x + w)), CLOSE_INK, 0, h)).toBe(true)
  })
})

describe('a remembered layout', () => {
  test('is laid out once for the same game and window state, again for a new one of either', async () => {
    let made = 0
    const layout = remembered((g: { n: number }, ui: { open: boolean }) => {
      made += 1
      return [g.n, ui.open]
    })
    const g = { n: 1 }
    const ui = { open: false }
    const first = layout(g, ui)
    expect([layout(g, ui) === first, made]).toEqual([true, 1])
    expect([layout({ n: 1 }, ui), made]).toEqual([[1, false], 2])
    expect([layout(g, { open: true }), made]).toEqual([[1, true], 3])
  })
})

describe('placing text boxes', () => {
  test('coverage weighs each pixel under a box: a cell is one pixel across and two down', async () => {
    const cost = coverage(10, [{ rect: { x: 0, y: 0, w: 4, h: 4 }, weight: 1 }])
    expect(cost(0, 0, 2, 1)).toBe(4)
    expect(cost(0, 0, 4, 2)).toBe(16)
    expect(cost(4, 0, 3, 3)).toBe(0)
    expect(cost(0, 2, 4, 3)).toBe(0)
  })

  test('a box goes where it hides nothing when there is such a place, nearest what it is about', async () => {
    const rows = 20
    const heavy = { x: 0, y: 0, w: WINDOW_W, h: 20 }
    const cost = coverage(rows, [{ rect: heavy, weight: 1 }])
    const at = place(cost, rows, [], { x: 50, y: 0, w: 4, h: 4 }, 10, 3)
    expect(cost(at.x, at.y, 10, 3)).toBe(0)
    // The first free row is cell row 10; nearest the point above it is straight below it.
    expect({ x: at.x, y: at.y }).toEqual({ x: 47, y: 10 })
  })

  test('a box never overlaps one already placed', async () => {
    const rows = 6
    const cost = coverage(rows, [])
    const first = { ...boxShape('a', [[{ text: 'x'.repeat(20) }]], '#fff'), x: 40, y: 0 }
    const at = place(cost, rows, [first], { x: 45, y: 0, w: 2, h: 2 }, first.w, first.h)
    const overlaps = at.x < first.x + first.w && first.x < at.x + first.w && at.y < first.y + first.h && first.y < at.y + first.h
    expect(overlaps).toBe(false)
  })

  test('a card and its menu never cover what the card is about, even where every place hides something', async () => {
    const rows = 20
    const everything = [{ rect: { x: 0, y: 0, w: WINDOW_W, h: rows * 2 }, weight: 1 }]
    const card = boxShape('card', [[{ text: 'x'.repeat(30) }], [{ text: 'y' }]], '#fff')
    const menu = boxShape('menu', [[{ text: 'z'.repeat(12) }]], '#fff')
    for (const near of [{ x: 0, y: 0, w: 8, h: 6 }, { x: 50, y: 14, w: 7, h: 7 }, { x: WINDOW_W - 8, y: 32, w: 8, h: 8 }]) {
      for (const b of cardWithMenu(rows, everything, near, card, menu)) {
        const covers = near.x < b.x + b.w && b.x < near.x + near.w && near.y < (b.y + b.h) * 2 && b.y * 2 < near.y + near.h
        expect(covers).toBe(false)
      }
    }
  })

  test('a box is sized to its widest line, with frame and padding', async () => {
    const b = boxShape('a', [[{ text: 'abc' }, { text: 'de' }], [{ text: 'f' }]], '#fff')
    expect(b.w).toBe(5 + 4)
    expect(b.h).toBe(2 + 2)
  })
})

test('the close box is square, its X centred: a pixel of the box all round it inside the frame', async () => {
  const c = windowPixels({ title: 'T' }, [])
  const [x, y, w, h] = CLOSE_BOX
  expect(w).toBe(h)
  const inkAt = (dx: number, dy: number) => c.px[y + dy]![x + dx] === CLOSE_INK
  const lit: [number, number][] = []
  for (let dy = 1; dy < h - 1; dy += 1) for (let dx = 1; dx < w - 1; dx += 1) if (inkAt(dx, dy)) lit.push([dx, dy])
  const xs = lit.map(p => p[0])
  const ys = lit.map(p => p[1])
  expect([Math.min(...xs) - 1, w - 2 - Math.max(...xs), Math.min(...ys) - 1, h - 2 - Math.max(...ys)]).toEqual([1, 1, 1, 1])
})
